const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { prepareForFirestore } = require('../utils/firestore');

class Knowledge {
  constructor (data) {
    this.id = data.id || uuidv4();
    this.title = data.title;
    this.content = data.content;
    this.category = data.category || 'general';
    this.tags = data.tags || [];
    this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
    this.isPinned = data.isPinned || false;
    this.type = data.type || 'article'; // article, faq, video, document
    this.fileUrl = data.fileUrl; // Para documentos/archivos
    this.fileName = data.fileName;
    this.fileSize = data.fileSize;
    this.mimeType = data.mimeType;
    this.createdBy = data.createdBy;
    this.lastModifiedBy = data.lastModifiedBy;
    this.views = data.views || 0;
    this.helpful = data.helpful || 0;
    this.notHelpful = data.notHelpful || 0;
    this.rating = data.rating || 0;
    this.ratingCount = data.ratingCount || 0;
    this.relatedArticles = data.relatedArticles || [];
    this.attachments = data.attachments || [];
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    this.publishedAt = data.publishedAt;
  }

  /**
   * Crear nuevo documento de conocimiento
   */
  static async create (knowledgeData) {
    const knowledge = new Knowledge(knowledgeData);

    if (knowledge.isPublic) {
      knowledge.publishedAt = FieldValue.serverTimestamp();
    }

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanData = prepareForFirestore({
      ...knowledge,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('knowledge').doc(knowledge.id).set(cleanData);

    return knowledge;
  }

  /**
   * Obtener documento por ID
   */
  static async getById (id) {
    const doc = await firestore.collection('knowledge').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Knowledge({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar documentos con filtros
   */
  static async list ({
    limit = 20,
    startAfter = null,
    category = null,
    type = null,
    isPublic = null,
    isPinned = null,
    tags = null,
    createdBy = null,
    isActive = true,
  } = {}) {
    let query = firestore.collection('knowledge');

    if (isActive !== null) {
      query = query.where('isActive', '==', isActive);
    }

    if (isPublic !== null) {
      query = query.where('isPublic', '==', isPublic);
    }

    if (isPinned !== null) {
      query = query.where('isPinned', '==', isPinned);
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }

    if (tags && tags.length > 0) {
      query = query.where('tags', 'array-contains-any', tags);
    }

    // Ordenar por pinned primero, luego por fecha
    query = query.orderBy('isPinned', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Knowledge({ id: doc.id, ...doc.data() }));
  }

  /**
   * Buscar documentos por texto
   */
  static async search (searchTerm, { isPublic = null, category = null } = {}) {
    let query = firestore.collection('knowledge').where('isActive', '==', true);

    if (isPublic !== null) {
      query = query.where('isPublic', '==', isPublic);
    }

    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    const searchLower = searchTerm.toLowerCase();

    return snapshot.docs
      .map(doc => new Knowledge({ id: doc.id, ...doc.data() }))
      .filter(knowledge =>
        knowledge.title.toLowerCase().includes(searchLower) ||
        knowledge.content.toLowerCase().includes(searchLower) ||
        knowledge.tags.some(tag => tag.toLowerCase().includes(searchLower)),
      )
      .sort((a, b) => {
        // Priorizar por relevancia en título
        const aTitle = a.title.toLowerCase().includes(searchLower);
        const bTitle = b.title.toLowerCase().includes(searchLower);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return 0;
      });
  }

  /**
   * Obtener categorías disponibles
   */
  static async getCategories () {
    const snapshot = await firestore
      .collection('knowledge')
      .where('isActive', '==', true)
      .where('isPublic', '==', true)
      .get();

    const categories = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        categories.add(data.category);
      }
    });

    return Array.from(categories).sort();
  }

  /**
   * Obtener tags más populares
   */
  static async getPopularTags (limit = 20) {
    const snapshot = await firestore
      .collection('knowledge')
      .where('isActive', '==', true)
      .where('isPublic', '==', true)
      .get();

    const tagCount = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(tagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * Obtener artículos relacionados
   */
  async getRelatedArticles (limit = 5) {
    // Buscar por tags similares
    const relatedByTags = await firestore
      .collection('knowledge')
      .where('isActive', '==', true)
      .where('isPublic', '==', true)
      .where('tags', 'array-contains-any', this.tags.slice(0, 3))
      .limit(limit + 1)
      .get();

    const related = relatedByTags.docs
      .map(doc => new Knowledge({ id: doc.id, ...doc.data() }))
      .filter(knowledge => knowledge.id !== this.id)
      .slice(0, limit);

    return related;
  }

  /**
   * Actualizar documento
   */
  async update (updates) {
    const validUpdates = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
      lastModifiedBy: updates.lastModifiedBy || this.lastModifiedBy,
    };

    // Si se publica por primera vez
    if (updates.isPublic && !this.isPublic) {
      validUpdates.publishedAt = FieldValue.serverTimestamp();
    }

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanUpdates = prepareForFirestore(validUpdates);

    await firestore.collection('knowledge').doc(this.id).update(cleanUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Incrementar contador de vistas
   */
  async incrementViews () {
    await firestore.collection('knowledge').doc(this.id).update({
      views: FieldValue.increment(1),
    });
    this.views++;
  }

  /**
   * Votar como útil
   */
  async voteHelpful () {
    await firestore.collection('knowledge').doc(this.id).update({
      helpful: FieldValue.increment(1),
    });
    this.helpful++;
  }

  /**
   * Votar como no útil
   */
  async voteNotHelpful () {
    await firestore.collection('knowledge').doc(this.id).update({
      notHelpful: FieldValue.increment(1),
    });
    this.notHelpful++;
  }

  /**
   * Agregar calificación
   */
  async addRating (rating) {
    const newRatingCount = this.ratingCount + 1;
    const newRating = ((this.rating * this.ratingCount) + rating) / newRatingCount;

    await this.update({
      rating: newRating,
      ratingCount: newRatingCount,
    });
  }

  /**
   * Publicar documento
   */
  async publish () {
    await this.update({
      isPublic: true,
      publishedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Despublicar documento
   */
  async unpublish () {
    await this.update({
      isPublic: false,
    });
  }

  /**
   * Fijar documento
   */
  async pin () {
    await this.update({ isPinned: true });
  }

  /**
   * Desfijar documento
   */
  async unpin () {
    await this.update({ isPinned: false });
  }

  /**
   * Eliminar documento (soft delete)
   */
  async delete () {
    await this.update({
      isActive: false,
      deletedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Eliminar documento permanentemente
   */
  async hardDelete () {
    await firestore.collection('knowledge').doc(this.id).delete();
  }

  /**
   * Obtener estadísticas del documento
   */
  getStats () {
    const totalVotes = this.helpful + this.notHelpful;
    const helpfulRatio = totalVotes > 0 ? (this.helpful / totalVotes) * 100 : 0;

    return {
      views: this.views,
      helpful: this.helpful,
      notHelpful: this.notHelpful,
      totalVotes,
      helpfulRatio,
      rating: this.rating,
      ratingCount: this.ratingCount,
    };
  }

  /**
   * Convertir a objeto plano para respuestas JSON con timestamps ISO
   */
  toJSON () {
    // ✅ Función helper para convertir timestamps
    const toISOString = (timestamp) => {
      if (!timestamp) return '';
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
      }
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      if (typeof timestamp === 'string') {
        return timestamp;
      }
      return '';
    };

    return {
      id: this.id,
      title: this.title || '',
      content: this.content || '',
      category: this.category || '',
      tags: this.tags || [],
      isPublic: Boolean(this.isPublic),
      isPinned: Boolean(this.isPinned),
      type: this.type || 'article',
      fileUrl: this.fileUrl || '',
      fileName: this.fileName || '',
      fileSize: this.fileSize || 0,
      mimeType: this.mimeType || '',
      createdBy: this.createdBy || '',
      lastModifiedBy: this.lastModifiedBy || '',
      views: this.views || 0,
      helpful: this.helpful || 0,
      notHelpful: this.notHelpful || 0,
      rating: this.rating || 0,
      ratingCount: this.ratingCount || 0,
      relatedArticles: this.relatedArticles || [],
      attachments: this.attachments || [],
      stats: this.getStats(),
      isActive: Boolean(this.isActive),
      createdAt: toISOString(this.createdAt),
      updatedAt: toISOString(this.updatedAt),
      publishedAt: toISOString(this.publishedAt),
    };
  }
}

module.exports = Knowledge;
