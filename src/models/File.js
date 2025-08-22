const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { prepareForFirestore } = require('../utils/firestore');
const logger = require('../utils/logger');

/**
 * 📁 MODELO DE ARCHIVOS CON INDEXACIÓN ESCALABLE
 * 
 * Proporciona indexación completa para consultas eficientes
 * sin necesidad de recorrer el bucket completo.
 * 
 * @version 2.0.0
 * @author Backend Team
 */
class File {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.originalName = data.originalName;
    this.storagePath = data.storagePath;
    this.storageUrl = data.storageUrl;
    this.publicUrl = data.publicUrl;
    this.category = data.category; // image, audio, video, document
    this.mimeType = data.mimeType;
    this.size = data.size;
    this.sizeBytes = data.sizeBytes;
    this.conversationId = data.conversationId;
    this.messageId = data.messageId;
    this.userId = data.userId; // Usuario que subió el archivo
    this.uploadedBy = data.uploadedBy;
    this.uploadedAt = data.uploadedAt || new Date();
    this.expiresAt = data.expiresAt;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
    this.downloadCount = data.downloadCount || 0;
    this.lastAccessedAt = data.lastAccessedAt;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Crear un nuevo archivo con indexación
   */
  static async create(fileData) {
    const file = new File(fileData);

    // Preparar datos para Firestore
    const cleanData = prepareForFirestore({
      ...file,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Guardar en Firestore
    await firestore.collection('files').doc(file.id).set(cleanData);

    // Crear índices adicionales para consultas eficientes
    await this.createIndexes(file);

    return file;
  }

  /**
   * Crear índices para consultas eficientes
   */
  static async createIndexes(file) {
    const batch = firestore.batch();

    // Índice por conversación (solo si conversationId existe y no es temporal)
    if (file.conversationId && file.conversationId !== 'temp-webhook') {
      const conversationIndexRef = firestore
        .collection('files_by_conversation')
        .doc(file.conversationId)
        .collection('files')
        .doc(file.id);

      batch.set(conversationIndexRef, {
        fileId: file.id,
        category: file.category,
        uploadedAt: file.uploadedAt,
        size: file.sizeBytes,
        isActive: file.isActive
      });
    }

    // Índice por usuario (solo si uploadedBy existe)
    if (file.uploadedBy && file.uploadedBy !== 'webhook') {
      const userIndexRef = firestore
        .collection('files_by_user')
        .doc(file.uploadedBy)
        .collection('files')
        .doc(file.id);

      batch.set(userIndexRef, {
        fileId: file.id,
        category: file.category,
        conversationId: file.conversationId,
        uploadedAt: file.uploadedAt,
        size: file.sizeBytes,
        isActive: file.isActive
      });
    }

    // Índice por categoría (solo si category existe)
    if (file.category) {
      const categoryIndexRef = firestore
        .collection('files_by_category')
        .doc(file.category)
        .collection('files')
        .doc(file.id);

      batch.set(categoryIndexRef, {
        fileId: file.id,
        conversationId: file.conversationId,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
        size: file.sizeBytes,
        isActive: file.isActive
      });
    }

    // Índice por fecha (para consultas por período)
    let dateKey;
    try {
      if (file.uploadedAt && typeof file.uploadedAt.toDate === 'function') {
        // Es un Timestamp de Firestore
        dateKey = file.uploadedAt.toDate().toISOString().split('T')[0];
      } else if (file.uploadedAt instanceof Date) {
        // Es un Date
        dateKey = file.uploadedAt.toISOString().split('T')[0];
      } else {
        // Usar fecha actual como fallback
        dateKey = new Date().toISOString().split('T')[0];
      }
    } catch (dateError) {
      // 🔧 CORRECCIÓN CRÍTICA: Manejar errores de fecha
      logger.error('⚠️ Error procesando fecha para índice:', { category: '_ERROR_PROCESANDO_FECHA_PARA_N', 
        error: dateError.message,
        uploadedAt: file.uploadedAt,
        uploadedAtType: typeof file.uploadedAt
       });
      dateKey = new Date().toISOString().split('T')[0];
    }
    const dateIndexRef = firestore
      .collection('files_by_date')
      .doc(dateKey)
      .collection('files')
      .doc(file.id);

    batch.set(dateIndexRef, {
      fileId: file.id,
      category: file.category,
      conversationId: file.conversationId,
      uploadedBy: file.uploadedBy,
      size: file.sizeBytes,
      isActive: file.isActive
    });

    // Ejecutar batch
    try {
      await batch.commit();
    } catch (batchError) {
      // 🔧 CORRECCIÓN: No fallar completamente si hay problemas con índices
      // Solo loggear el error pero continuar
      logger.error('⚠️ Error ejecutando batch de índices (no crítico):', { category: '_ERROR_EJECUTANDO_BATCH_DE_NDI', 
        fileId: file.id,
        error: batchError.message,
        stack: batchError.stack?.split('\n').slice(0, 3)
       });
      // No lanzar el error para evitar que falle todo el proceso
      // throw batchError;
    }
  }

  /**
   * Obtener archivo por ID
   */
  static async getById(id) {
    const doc = await firestore.collection('files').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new File({ id: doc.id, ...doc.data() });
  }

  /**
   * Buscar archivo por storage path
   */
  static async getByStoragePath(storagePath) {
    const snapshot = await firestore
      .collection('files')
      .where('storagePath', '==', storagePath)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new File({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar archivos por conversación (eficiente)
   * 🔧 ACTUALIZADO: Compatible con nueva estructura de base de datos
   */
  static async listByConversation(conversationId, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        category = null,
        isActive = true
      } = options;

      logger.info('📋 File.listByConversation - Iniciando búsqueda', {
        conversationId,
        limit,
        category,
        isActive
      });

      // 🔧 SOLUCIÓN SIN ÍNDICES: Consulta simple y filtrado local
      let query = firestore
        .collection('files')
        .where('conversationId', '==', conversationId)
        .limit(limit * 2); // Obtener más para filtrar localmente

      // NO agregar .where('isActive') ni .orderBy() para evitar índices compuestos

      const snapshot = await query.get();
      
      logger.info('📋 File.listByConversation - Consulta ejecutada', {
        conversationId,
        foundFiles: snapshot.docs.length,
        isEmpty: snapshot.empty
      });

      // 🔧 FILTRADO LOCAL: Aplicar filtros sin usar índices
      let files = snapshot.docs
        .map(doc => new File({ id: doc.id, ...doc.data() }))
        .filter(file => {
          // Filtrar por isActive
          if (isActive !== undefined && file.isActive !== isActive) {
            return false;
          }
          
          // Filtrar por categoría si se especifica
          if (category && file.category !== category) {
            return false;
          }
          
          return true;
        })
        .sort((a, b) => {
          // Ordenar por uploadedAt desc (más recientes primero)
          const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : new Date(a.uploadedAt);
          const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit); // Aplicar límite después del filtrado y ordenamiento

      logger.info('✅ File.listByConversation - Archivos obtenidos exitosamente', {
        conversationId,
        totalFound: snapshot.docs.length,
        afterFiltering: files.length,
        category,
        isActive
      });

      return files;

    } catch (error) {
      logger.error('❌ File.listByConversation - Error crítico', {
        conversationId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        options
      });
      throw error;
    }
  }

  /**
   * Obtener conteo de archivos por conversación
   * 🔧 ACTUALIZADO: Compatible con nueva estructura de base de datos
   */
  static async getCountByConversation(conversationId, options = {}) {
    try {
      const { category = null, isActive = true } = options;

      logger.info('📊 File.getCountByConversation - Iniciando conteo', {
        conversationId,
        category,
        isActive
      });

      // 🔧 SOLUCIÓN SIN ÍNDICES: Consulta simple y conteo local
      let query = firestore
        .collection('files')
        .where('conversationId', '==', conversationId);

      const snapshot = await query.get();
      
      // 🔧 CONTEO LOCAL: Aplicar filtros sin usar índices
      const count = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          
          // Filtrar por isActive
          if (isActive !== undefined && data.isActive !== isActive) {
            return false;
          }
          
          // Filtrar por categoría si se especifica
          if (category && data.category !== category) {
            return false;
          }
          
          return true;
        }).length;
      
      logger.info('✅ File.getCountByConversation - Conteo completado', {
        conversationId,
        totalFound: snapshot.size,
        afterFiltering: count,
        category,
        isActive
      });

      return count;
    } catch (error) {
      logger.error('❌ Error obteniendo conteo de archivos por conversación', {
        conversationId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      return 0;
    }
  }

  /**
   * Listar archivos por usuario (eficiente)
   */
  static async listByUser(userId, options = {}) {
    const {
      limit = 50,
      startAfter = null,
      category = null,
      isActive = true
    } = options;

    let query = firestore
      .collection('files_by_user')
      .doc(userId)
      .collection('files')
      .where('isActive', '==', isActive)
      .orderBy('uploadedAt', 'desc')
      .limit(limit);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    const fileIds = snapshot.docs.map(doc => doc.data().fileId);

    // Obtener archivos completos
    const files = [];
    for (const fileId of fileIds) {
      const file = await this.getById(fileId);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Listar archivos por categoría (eficiente)
   */
  static async listByCategory(category, options = {}) {
    const {
      limit = 50,
      startAfter = null,
      isActive = true
    } = options;

    let query = firestore
      .collection('files_by_category')
      .doc(category)
      .collection('files')
      .where('isActive', '==', isActive)
      .orderBy('uploadedAt', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    const fileIds = snapshot.docs.map(doc => doc.data().fileId);

    // Obtener archivos completos
    const files = [];
    for (const fileId of fileIds) {
      const file = await this.getById(fileId);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Listar archivos por fecha (eficiente)
   */
  static async listByDate(date, options = {}) {
    const {
      limit = 50,
      startAfter = null,
      category = null,
      isActive = true
    } = options;

    const dateKey = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    let query = firestore
      .collection('files_by_date')
      .doc(dateKey)
      .collection('files')
      .where('isActive', '==', isActive)
      .orderBy('uploadedAt', 'desc')
      .limit(limit);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    const fileIds = snapshot.docs.map(doc => doc.data().fileId);

    // Obtener archivos completos
    const files = [];
    for (const fileId of fileIds) {
      const file = await this.getById(fileId);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Buscar archivos por texto (eficiente)
   */
  static async search(searchTerm, options = {}) {
    const {
      limit = 50,
      category = null,
      userId = null,
      isActive = true
    } = options;

    let query = firestore.collection('files').where('isActive', '==', isActive);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (userId) {
      query = query.where('uploadedBy', '==', userId);
    }

    const snapshot = await query.get();
    const searchLower = searchTerm.toLowerCase();

    return snapshot.docs
      .map(doc => new File({ id: doc.id, ...doc.data() }))
      .filter(file =>
        file.originalName.toLowerCase().includes(searchLower) ||
        file.category.toLowerCase().includes(searchLower) ||
        (file.metadata && JSON.stringify(file.metadata).toLowerCase().includes(searchLower))
      )
      .slice(0, limit);
  }

  /**
   * Obtener estadísticas de archivos
   */
  static async getStats(options = {}) {
    const {
      userId = null,
      conversationId = null,
      category = null,
      startDate = null,
      endDate = null
    } = options;

    let query = firestore.collection('files').where('isActive', '==', true);

    if (userId) {
      query = query.where('uploadedBy', '==', userId);
    }

    if (conversationId) {
      query = query.where('conversationId', '==', conversationId);
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    const files = snapshot.docs.map(doc => new File({ id: doc.id, ...doc.data() }));

    // Filtrar por fecha si se especifica
    let filteredFiles = files;
    if (startDate || endDate) {
      filteredFiles = files.filter(file => {
        const uploadDate = file.uploadedAt.toDate();
        if (startDate && uploadDate < new Date(startDate)) return false;
        if (endDate && uploadDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Calcular estadísticas
    const stats = {
      total: filteredFiles.length,
      totalSize: filteredFiles.reduce((sum, file) => sum + (file.sizeBytes || 0), 0),
      byCategory: {},
      byUser: {},
      averageSize: 0,
      largestFile: null,
      mostRecentFile: null
    };

    // Contar por categoría
    for (const file of filteredFiles) {
      stats.byCategory[file.category] = (stats.byCategory[file.category] || 0) + 1;
      stats.byUser[file.uploadedBy] = (stats.byUser[file.uploadedBy] || 0) + 1;
    }

    // Calcular promedio
    if (filteredFiles.length > 0) {
      stats.averageSize = stats.totalSize / filteredFiles.length;
    }

    // Encontrar archivo más grande
    if (filteredFiles.length > 0) {
      stats.largestFile = filteredFiles.reduce((largest, file) => 
        (file.sizeBytes || 0) > (largest.sizeBytes || 0) ? file : largest
      );
    }

    // Encontrar archivo más reciente
    if (filteredFiles.length > 0) {
      stats.mostRecentFile = filteredFiles.reduce((recent, file) => 
        file.uploadedAt.toDate() > recent.uploadedAt.toDate() ? file : recent
      );
    }

    return stats;
  }

  /**
   * Actualizar archivo
   */
  async update(updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('files').doc(this.id).update(validUpdates);

    // Actualizar índices si es necesario
    if (updates.category || updates.isActive !== undefined) {
      await File.updateIndexes(this.id, updates);
    }

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Actualizar índices existentes
   */
  static async updateIndexes(fileId, updates) {
    const batch = firestore.batch();

    // Obtener archivo actual
    const file = await this.getById(fileId);
    if (!file) return;

    // Actualizar índices con nuevos datos
    const indexUpdates = {};

    if (updates.category) {
      indexUpdates.category = updates.category;
    }

    if (updates.isActive !== undefined) {
      indexUpdates.isActive = updates.isActive;
    }

    if (Object.keys(indexUpdates).length === 0) return;

    // Actualizar índice por conversación
    const conversationIndexRef = firestore
      .collection('files_by_conversation')
      .doc(file.conversationId)
      .collection('files')
      .doc(fileId);

    batch.update(conversationIndexRef, indexUpdates);

    // Actualizar índice por usuario
    if (file.uploadedBy) {
      const userIndexRef = firestore
        .collection('files_by_user')
        .doc(file.uploadedBy)
        .collection('files')
        .doc(fileId);

      batch.update(userIndexRef, indexUpdates);
    }

    // Actualizar índice por categoría
    const categoryIndexRef = firestore
      .collection('files_by_category')
      .doc(file.category)
      .collection('files')
      .doc(fileId);

    batch.update(categoryIndexRef, indexUpdates);

    // Actualizar índice por fecha
    const dateKey = file.uploadedAt.toDate().toISOString().split('T')[0];
    const dateIndexRef = firestore
      .collection('files_by_date')
      .doc(dateKey)
      .collection('files')
      .doc(fileId);

    batch.update(dateIndexRef, indexUpdates);

    await batch.commit();
  }

  /**
   * Eliminar archivo (soft delete)
   */
  async delete() {
    await this.update({ 
      isActive: false, 
      deletedAt: FieldValue.serverTimestamp() 
    });
  }

  /**
   * Eliminar archivo permanentemente
   */
  async hardDelete() {
    const batch = firestore.batch();

    // Eliminar documento principal
    batch.delete(firestore.collection('files').doc(this.id));

    // Eliminar de todos los índices
    const conversationIndexRef = firestore
      .collection('files_by_conversation')
      .doc(this.conversationId)
      .collection('files')
      .doc(this.id);

    batch.delete(conversationIndexRef);

    if (this.uploadedBy) {
      const userIndexRef = firestore
        .collection('files_by_user')
        .doc(this.uploadedBy)
        .collection('files')
        .doc(this.id);

      batch.delete(userIndexRef);
    }

    const categoryIndexRef = firestore
      .collection('files_by_category')
      .doc(this.category)
      .collection('files')
      .doc(this.id);

    batch.delete(categoryIndexRef);

    const dateKey = this.uploadedAt.toDate().toISOString().split('T')[0];
    const dateIndexRef = firestore
      .collection('files_by_date')
      .doc(dateKey)
      .collection('files')
      .doc(this.id);

    batch.delete(dateIndexRef);

    await batch.commit();
  }

  /**
   * Incrementar contador de descargas
   */
  async incrementDownloadCount() {
    await this.update({
      downloadCount: FieldValue.increment(1),
      lastAccessedAt: FieldValue.serverTimestamp()
    });
  }

  /**
   * Agregar tags
   */
  async addTags(newTags) {
    const uniqueTags = [...new Set([...this.tags, ...newTags])];
    await this.update({ tags: uniqueTags });
  }

  /**
   * Remover tags
   */
  async removeTags(tagsToRemove) {
    const filteredTags = this.tags.filter(tag => !tagsToRemove.includes(tag));
    await this.update({ tags: filteredTags });
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON() {
    return {
      id: this.id,
      originalName: this.originalName,
      storagePath: this.storagePath,
      storageUrl: this.storageUrl,
      publicUrl: this.publicUrl,
      category: this.category,
      mimeType: this.mimeType,
      size: this.size,
      sizeBytes: this.sizeBytes,
      conversationId: this.conversationId,
      messageId: this.messageId,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt?.toDate?.()?.toISOString() || this.uploadedAt,
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      metadata: this.metadata,
      tags: this.tags,
      downloadCount: this.downloadCount,
      lastAccessedAt: this.lastAccessedAt?.toDate?.()?.toISOString() || this.lastAccessedAt,
      createdAt: this.createdAt?.toDate?.()?.toISOString() || this.createdAt,
      updatedAt: this.updatedAt?.toDate?.()?.toISOString() || this.updatedAt
    };
  }
}

module.exports = File; 