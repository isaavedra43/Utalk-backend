/**
 * 📱 SERVICIO DE PROCESAMIENTO DE MEDIOS DE TWILIO
 * 
 * Descarga y procesa medios de WhatsApp desde URLs de Twilio
 * que requieren autenticación, y los almacena localmente
 * para generar URLs públicas accesibles.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const FileService = require('./FileService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class TwilioMediaService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!this.accountSid || !this.authToken) {
      logger.error('❌ CREDENCIALES DE TWILIO NO CONFIGURADAS', {
        hasAccountSid: !!this.accountSid,
        hasAuthToken: !!this.authToken
      });
    }
    
    this.fileService = new FileService();
  }

  /**
   * 🔍 VALIDAR URL DE TWILIO
   */
  isValidTwilioUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Patrón de URL de Twilio para medios
    const twilioMediaPattern = /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/[^\/]+\/Messages\/[^\/]+\/Media\/[^\/]+$/;
    return twilioMediaPattern.test(url);
  }

  /**
   * 📥 DESCARGAR MEDIO DE TWILIO
   */
  async downloadTwilioMedia(mediaUrl, messageSid, index = 0) {
    const ErrorWrapper = require('../utils/errorWrapper');
    
    try {
      logger.info('📥 Iniciando descarga de medio de Twilio', {
        mediaUrl: mediaUrl?.substring(0, 50) + '...',
        messageSid,
        index
      });

      // Validar parámetros de entrada
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        throw ErrorWrapper.createError(
          'URL de medio requerida',
          'VALIDATION_ERROR',
          400
        );
      }

      if (!this.isValidTwilioUrl(mediaUrl)) {
        throw ErrorWrapper.createError(
          'URL de Twilio inválida',
          'VALIDATION_ERROR',
          400
        );
      }

      if (!this.accountSid || !this.authToken) {
        throw ErrorWrapper.createError(
          'Credenciales de Twilio no configuradas',
          'CONFIGURATION_ERROR',
          500
        );
      }

      // Crear credenciales HTTP Basic
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Descargar el archivo desde la URL de Twilio con autenticación
      const response = await ErrorWrapper.withTimeout(
        fetch(mediaUrl, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'User-Agent': 'Utalk-Backend/1.0'
          }
        }),
        30000, // 30 segundos de timeout
        'TwilioMediaService.downloadTwilioMedia'
      );
      
      if (!response.ok) {
        throw ErrorWrapper.createError(
          `Error descargando medio: ${response.status} - ${response.statusText}`,
          'DOWNLOAD_ERROR',
          response.status
        );
      }

      const buffer = await ErrorWrapper.withTimeout(
        response.arrayBuffer(),
        15000, // 15 segundos para procesar el buffer
        'TwilioMediaService.processBuffer'
      );
      
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      // Validar que el contenido sea válido
      if (!contentType) {
        throw ErrorWrapper.createError(
          'Tipo de contenido no especificado',
          'DOWNLOAD_ERROR',
          422
        );
      }

      logger.info('✅ Medio descargado exitosamente', {
        mediaUrl: mediaUrl?.substring(0, 50) + '...',
        messageSid,
        index,
        contentType,
        size: buffer.byteLength,
        contentLength
      });

      return {
        buffer: Buffer.from(buffer),
        contentType,
        size: buffer.byteLength,
        originalUrl: mediaUrl
      };

    } catch (error) {
      ErrorWrapper.logError(error, 'TwilioMediaService.downloadTwilioMedia', {
        mediaUrl: mediaUrl?.substring(0, 50) + '...',
        messageSid,
        index
      });

      // Re-lanzar error estructurado
      if (error.code && error.status) {
        throw error;
      }

      // Crear error estructurado si no lo tiene
      throw ErrorWrapper.createError(
        `Error descargando medio de Twilio: ${error.message}`,
        'TWILIO_DOWNLOAD_ERROR',
        500
      );
    }
  }

  /**
   * 🏷️ DETERMINAR CATEGORÍA DEL MEDIO
   */
  determineMediaCategory(contentType) {
    if (contentType.startsWith('image/')) {
      // Detectar stickers de WhatsApp (WebP)
      if (contentType === 'image/webp') {
        return 'sticker';
      }
      return 'image';
    }
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType.startsWith('application/')) return 'document';
    return 'document';
  }

  /**
   * 📝 GENERAR NOMBRE DE ARCHIVO
   */
  generateFileName(mediaUrl, contentType, messageSid, index) {
    const extension = this.getExtensionFromContentType(contentType);
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    
    return `twilio-${messageSid}-${index}-${timestamp}-${randomId}.${extension}`;
  }

  /**
   * 🔧 OBTENER EXTENSIÓN DESDE CONTENT-TYPE
   */
  getExtensionFromContentType(contentType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/m4a': 'm4a',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    
    return extensions[contentType] || 'bin';
  }

  /**
   * 💾 PROCESAR Y ALMACENAR MEDIO DE TWILIO
   */
  async processAndStoreMedia(mediaUrl, messageSid, index, conversationId, userId) {
    try {
      logger.info('🔄 Iniciando procesamiento y almacenamiento de medio', {
        mediaUrl,
        messageSid,
        index,
        conversationId,
        userId
      });

      // Paso 1: Descargar medio de Twilio
      const downloadedMedia = await this.downloadTwilioMedia(mediaUrl, messageSid, index);
      
      // Paso 2: Determinar categoría
      const category = this.determineMediaCategory(downloadedMedia.contentType);
      
      // Paso 3: Generar nombre de archivo
      const fileName = this.generateFileName(mediaUrl, downloadedMedia.contentType, messageSid, index);
      
      // Paso 4: Preparar datos para FileService
      const fileData = {
        buffer: downloadedMedia.buffer,
        originalName: fileName,
        mimetype: downloadedMedia.contentType,
        size: downloadedMedia.size,
        conversationId: conversationId,
        userId: userId,
        uploadedBy: 'twilio-webhook',
        tags: ['twilio', 'whatsapp', category],
        metadata: {
          source: 'twilio-webhook',
          originalUrl: downloadedMedia.originalUrl,
          messageSid: messageSid,
          mediaIndex: index,
          category: category,
          processedAt: new Date().toISOString()
        }
      };

      // Paso 5: Usar FileService para almacenar
      const processedFile = await this.fileService.uploadFile(fileData);

      logger.info('✅ Medio procesado y almacenado exitosamente', {
        mediaUrl,
        messageSid,
        index,
        fileId: processedFile.id,
        category,
        publicUrl: processedFile.url,
        size: downloadedMedia.size
      });

      return {
        fileId: processedFile.id,
        category: category,
        url: processedFile.url, // URL pública
        size: downloadedMedia.size,
        mimetype: downloadedMedia.contentType,
        originalUrl: downloadedMedia.originalUrl,
        processed: true,
        storedLocally: true
      };

    } catch (error) {
      logger.error('❌ Error procesando y almacenando medio', {
        mediaUrl,
        messageSid,
        index,
        conversationId,
        userId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * 🔄 PROCESAR MÚLTIPLES MEDIOS
   */
  async processMultipleMedia(mediaUrls, messageSid, conversationId, userId) {
    try {
      logger.info('🔄 Procesando múltiples medios', {
        messageSid,
        conversationId,
        userId,
        mediaCount: mediaUrls.length
      });

      const results = [];
      
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaUrl = mediaUrls[i];
        
        if (!mediaUrl) {
          logger.warn('⚠️ URL de medio vacía, saltando', { index: i });
          continue;
        }

        try {
          const result = await this.processAndStoreMedia(
            mediaUrl, 
            messageSid, 
            i, 
            conversationId, 
            userId
          );
          
          results.push(result);
          
          logger.info(`✅ Medio ${i + 1}/${mediaUrls.length} procesado`, {
            index: i,
            fileId: result.fileId,
            category: result.category
          });
          
        } catch (error) {
          logger.error(`❌ Error procesando medio ${i + 1}/${mediaUrls.length}`, {
            index: i,
            mediaUrl,
            error: error.message
          });
          
          // Continuar con el siguiente medio
          results.push({
            error: error.message,
            originalUrl: mediaUrl,
            index: i,
            processed: false
          });
        }
      }

      logger.info('✅ Procesamiento de múltiples medios completado', {
        messageSid,
        totalProcessed: results.filter(r => r.processed).length,
        totalErrors: results.filter(r => r.error).length,
        total: results.length
      });

      return results;

    } catch (error) {
      logger.error('❌ Error procesando múltiples medios', {
        messageSid,
        conversationId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔍 OBTENER INFORMACIÓN DE MEDIO SIN DESCARGAR
   */
  async getMediaInfo(mediaUrl) {
    try {
      if (!this.isValidTwilioUrl(mediaUrl)) {
        throw new Error('URL de Twilio inválida');
      }

      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const response = await fetch(mediaUrl, {
        method: 'HEAD',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'Utalk-Backend/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error obteniendo información: ${response.status}`);
      }

      return {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag')
      };

    } catch (error) {
      logger.error('❌ Error obteniendo información de medio', {
        mediaUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🧹 LIMPIAR MEDIOS TEMPORALES
   */
  async cleanupTempMedia(fileIds) {
    try {
      logger.info('🧹 Iniciando limpieza de medios temporales', {
        fileCount: fileIds.length
      });

      const results = [];
      
      for (const fileId of fileIds) {
        try {
          // Aquí se implementaría la lógica de limpieza
          // Por ahora solo log
          logger.info('🧹 Medio temporal marcado para limpieza', { fileId });
          results.push({ fileId, cleaned: true });
        } catch (error) {
          logger.error('❌ Error limpiando medio temporal', {
            fileId,
            error: error.message
          });
          results.push({ fileId, cleaned: false, error: error.message });
        }
      }

      return results;

    } catch (error) {
      logger.error('❌ Error en limpieza de medios temporales', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TwilioMediaService; 