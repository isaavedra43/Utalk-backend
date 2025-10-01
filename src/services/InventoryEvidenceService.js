/**
 * 📸 SERVICIO DE EVIDENCIAS DE INVENTARIO
 * 
 * Maneja la lógica de negocio para evidencias de plataformas.
 * 
 * @version 1.0.0
 */

const InventoryEvidence = require('../models/InventoryEvidence');
const Platform = require('../models/Platform');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');
const { storage } = require('../config/firebase');
const path = require('path');
const fs = require('fs').promises;

class InventoryEvidenceService {
  /**
   * Configuración de límites
   */
  static get LIMITS() {
    return {
      MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
      MAX_FILES_PER_UPLOAD: 20,
      MAX_EVIDENCE_PER_PLATFORM: 50,
      ALLOWED_TYPES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ]
    };
  }

  /**
   * Valida un archivo
   */
  validateFile(file) {
    const limits = InventoryEvidenceService.LIMITS;

    // Validar tamaño
    if (file.size > limits.MAX_FILE_SIZE) {
      throw ApiError.validationError(
        `Archivo demasiado grande. Máximo permitido: ${limits.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Validar tipo
    if (!limits.ALLOWED_TYPES.includes(file.mimetype)) {
      throw ApiError.validationError(
        `Tipo de archivo no permitido: ${file.mimetype}`
      );
    }

    // Validar nombre de archivo
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (sanitizedName.length === 0) {
      throw ApiError.validationError('Nombre de archivo inválido');
    }

    return true;
  }

  /**
   * Sube evidencias a Firebase Storage
   */
  async uploadEvidences(userId, providerId, platformId, files, descriptions = []) {
    try {
      logger.info('Subiendo evidencias', {
        userId,
        platformId,
        filesCount: files.length
      });

      // Verificar que la plataforma existe
      const platform = await Platform.findById(userId, providerId, platformId);
      if (!platform) {
        throw ApiError.notFoundError('Plataforma no encontrada');
      }

      // Verificar límite de archivos
      if (files.length > InventoryEvidenceService.LIMITS.MAX_FILES_PER_UPLOAD) {
        throw ApiError.validationError(
          `Máximo ${InventoryEvidenceService.LIMITS.MAX_FILES_PER_UPLOAD} archivos por subida`
        );
      }

      // Verificar límite de evidencias por plataforma
      const existingCount = await InventoryEvidence.countByPlatform(userId, providerId, platformId);
      if (existingCount + files.length > InventoryEvidenceService.LIMITS.MAX_EVIDENCE_PER_PLATFORM) {
        throw ApiError.validationError(
          `Límite de evidencias alcanzado para esta plataforma (máximo ${InventoryEvidenceService.LIMITS.MAX_EVIDENCE_PER_PLATFORM})`
        );
      }

      // Procesar cada archivo
      const uploadedEvidences = [];
      const bucket = storage.bucket();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validar archivo
        this.validateFile(file);

        // Generar ruta única en Storage
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const uniqueId = uuidv4();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `inventory/evidence/${year}/${month}/evi_${uniqueId}_${sanitizedName}`;

        // Subir archivo a Firebase Storage
        const fileBuffer = file.buffer;
        const storageFile = bucket.file(storagePath);
        
        await storageFile.save(fileBuffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              uploadedBy: userId,
              platformId: platformId,
              providerId: providerId,
              uploadDate: new Date().toISOString()
            }
          }
        });

        // Obtener URL de descarga
        await storageFile.makePublic();
        const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        // Crear registro de evidencia
        const evidence = new InventoryEvidence({
          platformId,
          providerId,
          userId,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath,
          downloadUrl,
          description: descriptions[i] || '',
          uploadedBy: userId
        });

        await evidence.save();
        uploadedEvidences.push(evidence);
      }

      logger.info('Evidencias subidas exitosamente', {
        userId,
        platformId,
        count: uploadedEvidences.length
      });

      return uploadedEvidences;
    } catch (error) {
      logger.error('Error subiendo evidencias', {
        userId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene todas las evidencias de una plataforma
   */
  async getEvidencesByPlatform(userId, providerId, platformId) {
    try {
      logger.info('Obteniendo evidencias de plataforma', { userId, platformId });

      // Verificar que la plataforma existe
      const platform = await Platform.findById(userId, providerId, platformId);
      if (!platform) {
        throw ApiError.notFoundError('Plataforma no encontrada');
      }

      const evidences = await InventoryEvidence.listByPlatform(userId, providerId, platformId);

      logger.info('Evidencias obtenidas exitosamente', {
        userId,
        platformId,
        count: evidences.length
      });

      return evidences;
    } catch (error) {
      logger.error('Error obteniendo evidencias', {
        userId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Elimina una evidencia
   */
  async deleteEvidence(userId, providerId, platformId, evidenceId) {
    try {
      logger.info('Eliminando evidencia', { userId, platformId, evidenceId });

      // Buscar evidencia
      const evidence = await InventoryEvidence.findById(userId, providerId, platformId, evidenceId);
      
      if (!evidence) {
        throw ApiError.notFoundError('Evidencia no encontrada');
      }

      // Eliminar archivo de Firebase Storage
      try {
        const bucket = storage.bucket();
        const file = bucket.file(evidence.storagePath);
        await file.delete();
        logger.info('Archivo eliminado de Storage', { storagePath: evidence.storagePath });
      } catch (storageError) {
        logger.warn('Error eliminando archivo de Storage (puede no existir)', {
          storagePath: evidence.storagePath,
          error: storageError.message
        });
      }

      // Eliminar registro de Firestore
      await evidence.delete();

      logger.info('Evidencia eliminada exitosamente', { userId, evidenceId });

      return true;
    } catch (error) {
      logger.error('Error eliminando evidencia', {
        userId,
        evidenceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de evidencias de una plataforma
   */
  async getEvidenceStats(userId, providerId, platformId) {
    try {
      logger.info('Obteniendo estadísticas de evidencias', { userId, platformId });

      const stats = await InventoryEvidence.getStatsByPlatform(userId, providerId, platformId);

      logger.info('Estadísticas obtenidas', { userId, platformId, stats });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de evidencias', {
        userId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }
}

// Necesario para generar IDs únicos
const { v4: uuidv4 } = require('uuid');

module.exports = InventoryEvidenceService;

