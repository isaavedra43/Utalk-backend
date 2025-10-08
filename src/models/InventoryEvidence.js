/**
 * 📸 MODELO DE EVIDENCIA DE INVENTARIO
 * 
 * Gestiona evidencias (archivos/imágenes) asociadas a plataformas.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class InventoryEvidence {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.platformId = data.platformId;
    this.providerId = data.providerId;
    this.userId = data.userId;
    this.fileName = data.fileName || '';
    this.fileType = data.fileType || '';
    this.fileSize = data.fileSize || 0;
    this.storagePath = data.storagePath || '';
    this.downloadUrl = data.downloadUrl || '';
    this.description = data.description || '';
    this.uploadedBy = data.uploadedBy;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      platformId: this.platformId,
      providerId: this.providerId,
      userId: this.userId,
      fileName: this.fileName,
      fileType: this.fileType,
      fileSize: this.fileSize,
      storagePath: this.storagePath,
      downloadUrl: this.downloadUrl,
      description: this.description,
      uploadedBy: this.uploadedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new InventoryEvidence({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda la evidencia en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      
      let docRef;
      
      // Intentar primero en client_platforms
      try {
        docRef = db.collection('client_platforms').doc(this.platformId)
          .collection('evidence').doc(this.id);
        await docRef.set(this.toFirestore());
        console.log(`✅ Evidencia guardada en client_platforms/${this.platformId}/evidence/${this.id}`);
      } catch (clientError) {
        // Si falla, intentar en providers/{providerId}/platforms/{platformId}/evidence
        docRef = db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.platformId)
          .collection('evidence').doc(this.id);
        await docRef.set(this.toFirestore());
        console.log(`✅ Evidencia guardada en providers/${this.providerId}/platforms/${this.platformId}/evidence/${this.id}`);
      }
      
      // Actualizar contador en la plataforma
      await this.updatePlatformEvidenceCount();
      
      return this;
    } catch (error) {
      console.error('Error guardando evidencia:', error);
      throw error;
    }
  }

  /**
   * Elimina la evidencia
   */
  async delete() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('platforms').doc(this.platformId)
        .collection('evidence').doc(this.id);
      
      await docRef.delete();
      
      // Actualizar contador en la plataforma
      await this.updatePlatformEvidenceCount();
      
      return true;
    } catch (error) {
      console.error('Error eliminando evidencia:', error);
      throw error;
    }
  }

  /**
   * Actualiza el contador de evidencias en la plataforma
   */
  async updatePlatformEvidenceCount() {
    try {
      let evidencesSnapshot;
      let platformRef;
      
      // Primero intentar en client_platforms
      evidencesSnapshot = await db.collection('client_platforms').doc(this.platformId)
        .collection('evidence').get();
      
      if (evidencesSnapshot.size >= 0) {
        // La plataforma está en client_platforms
        platformRef = db.collection('client_platforms').doc(this.platformId);
        console.log(`✅ Contador de evidencias actualizado en client_platforms: ${evidencesSnapshot.size}`);
      } else {
        // Intentar en providers/{providerId}/platforms
        evidencesSnapshot = await db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.platformId)
          .collection('evidence').get();
        platformRef = db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.platformId);
        console.log(`✅ Contador de evidencias actualizado en providers: ${evidencesSnapshot.size}`);
      }
      
      const count = evidencesSnapshot.size;
      await platformRef.update({ evidenceCount: count });
      
      return count;
    } catch (error) {
      console.error('Error actualizando contador de evidencias:', error);
      // No lanzar error, es una operación secundaria
      return 0;
    }
  }

  /**
   * Lista todas las evidencias de una plataforma
   */
  static async listByPlatform(userId, providerId, platformId) {
    try {
      const snapshot = await db.collection('providers').doc(providerId)
        .collection('platforms').doc(platformId)
        .collection('evidence')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => InventoryEvidence.fromFirestore(doc));
    } catch (error) {
      console.error('Error listando evidencias:', error);
      throw error;
    }
  }

  /**
   * Busca una evidencia por ID
   */
  static async findById(userId, providerId, platformId, evidenceId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('platforms').doc(platformId)
        .collection('evidence').doc(evidenceId).get();
      
      const evidence = InventoryEvidence.fromFirestore(doc);
      
      // Verificar que pertenece al usuario
      if (evidence && evidence.userId !== userId) {
        return null;
      }
      
      return evidence;
    } catch (error) {
      console.error('Error buscando evidencia:', error);
      throw error;
    }
  }

  /**
   * Cuenta las evidencias de una plataforma
   */
  static async countByPlatform(userId, providerId, platformId) {
    try {
      const snapshot = await db.collection('providers').doc(providerId)
        .collection('platforms').doc(platformId)
        .collection('evidence')
        .where('userId', '==', userId)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error('Error contando evidencias:', error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas de evidencias de una plataforma
   */
  static async getStatsByPlatform(userId, providerId, platformId) {
    try {
      const evidences = await this.listByPlatform(userId, providerId, platformId);
      
      const stats = {
        totalFiles: evidences.length,
        totalSize: evidences.reduce((sum, e) => sum + e.fileSize, 0),
        fileTypes: {},
        lastUpload: evidences.length > 0 ? evidences[0].createdAt : null
      };

      // Contar por tipo de archivo
      evidences.forEach(evidence => {
        const type = evidence.fileType;
        stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de evidencias:', error);
      throw error;
    }
  }
}

module.exports = InventoryEvidence;

