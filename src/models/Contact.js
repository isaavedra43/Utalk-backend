const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { prepareForFirestore } = require('../utils/firestore');

class Contact {
  constructor (data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.phone = data.phone;
    this.email = data.email || null;
    this.tags = data.tags || [];
    this.customFields = data.customFields || {};
    this.userId = data.userId; // Usuario que creó el contacto
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.lastContactAt = data.lastContactAt;
    this.totalMessages = data.totalMessages || 0;
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    this.conversationIds = data.conversationIds || []; // ✅ NUEVA REFERENCIA A CONVERSACIONES
  }

  /**
   * Crear un nuevo contacto
   */
  static async create (contactData) {
    // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
    if (contactData.phone) {
      contactData.phone = contactData.phone.startsWith('whatsapp:') 
        ? contactData.phone 
        : `whatsapp:${contactData.phone}`;
    }
    
    const contact = new Contact(contactData);

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanData = prepareForFirestore({
      ...contact,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('contacts').doc(contact.id).set(cleanData);
    return contact;
  }

  /**
   * 🎯 MÉTODO CENTRALIZADO: Obtener o crear contacto por teléfono
   * ÚNICO punto de entrada para evitar duplicados
   */
  static async getOrCreateByPhone(phone, name = null, metadata = {}) {
    // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
    const normalizedPhone = phone.startsWith('whatsapp:') 
      ? phone 
      : `whatsapp:${phone}`;
    
    // Buscar contacto existente
    const existingContact = await this.getByPhone(normalizedPhone);
    if (existingContact) {
      return existingContact;
    }
    
    // Crear nuevo contacto con datos normalizados
    const contactData = {
      phone: normalizedPhone,
      name: name || normalizedPhone,
      metadata: {
        createdVia: 'centralized_create',
        createdAt: new Date().toISOString(),
        originalPhone: phone,
        ...metadata
      }
    };
    
    return await this.create(contactData);
  }

  /**
   * Obtener contacto por ID
   */
  static async getById (id) {
    const doc = await firestore.collection('contacts').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Contact({ id: doc.id, ...doc.data() });
  }

  /**
   * Obtener contacto por teléfono
   */
  static async getByPhone (phone) {
    try {
      // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
      const normalizedPhone = phone.startsWith('whatsapp:') 
        ? phone 
        : `whatsapp:${phone}`;
        
      // Primero intentar buscar contactos activos
      let snapshot = await firestore
        .collection('contacts')
        .where('phone', '==', normalizedPhone)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      // Si no encuentra contactos activos, buscar cualquier contacto con ese teléfono
      if (snapshot.empty) {
        snapshot = await firestore
          .collection('contacts')
          .where('phone', '==', normalizedPhone)
          .limit(1)
          .get();
      }

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return new Contact({ id: doc.id, ...doc.data() });
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error buscando contacto por teléfono', {
        phone,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Actualizar contacto por ID (método estático)
   */
  static async update (id, updates) {
    try {
      // Verificar que el documento existe
      const docRef = firestore.collection('contacts').doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }

      // Preparar datos para Firestore
      const validUpdates = prepareForFirestore({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Realizar update con merge para preservar campos existentes
      await docRef.update(validUpdates);

      // Obtener el documento actualizado
      const updatedDoc = await docRef.get();
      return new Contact({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error actualizando contacto', {
        category: 'CONTACT_UPDATE_ERROR',
        contactId: id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Agregar tags a contacto por ID (método estático)
   */
  static async addTags (id, newTags) {
    try {
      // Obtener el contacto actual
      const contact = await Contact.getById(id);
      if (!contact) {
        return null;
      }

      // Agregar tags únicos
      const uniqueTags = [...new Set([...contact.tags, ...newTags])];
      
      // Actualizar con los nuevos tags
      return await Contact.update(id, { tags: uniqueTags });
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error agregando tags al contacto', {
        category: 'CONTACT_ADD_TAGS_ERROR',
        contactId: id,
        newTags,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Eliminar contacto por ID (método estático - soft delete)
   */
  static async delete (id) {
    try {
      // Verificar que el documento existe
      const docRef = firestore.collection('contacts').doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }

      // Soft delete - marcar como inactivo
      await docRef.update({
        isActive: false,
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { id, deleted: true };
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error eliminando contacto', {
        category: 'CONTACT_DELETE_ERROR',
        contactId: id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Listar contactos con filtros y paginación
   */
  static async list ({
    limit = 20,
    startAfter = null,
    search = null,
    tags = null,
    userId = null,
    isActive = true,
  } = {}) {
    let query = firestore.collection('contacts');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (isActive !== null) {
      query = query.where('isActive', '==', isActive);
    }

    if (tags && tags.length > 0) {
      query = query.where('tags', 'array-contains-any', tags);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    let contacts = snapshot.docs.map(doc => new Contact({ id: doc.id, ...doc.data() }));

    // Filtro de búsqueda por texto (cliente side debido a limitaciones de Firestore)
    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchLower) ||
        contact.phone.includes(search) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)),
      );
    }

    return contacts;
  }

  /**
   * Buscar contactos por texto
   */
  static async search (searchTerm, userId = null) {
    let query = firestore.collection('contacts').where('isActive', '==', true);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const searchLower = searchTerm.toLowerCase();

    return snapshot.docs
      .map(doc => new Contact({ id: doc.id, ...doc.data() }))
      .filter(contact =>
        contact.name.toLowerCase().includes(searchLower) ||
        contact.phone.includes(searchTerm) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)),
      );
  }

  /**
   * Obtener contactos por tags
   */
  static async getByTags (tags, userId = null) {
    let query = firestore.collection('contacts')
      .where('tags', 'array-contains-any', tags)
      .where('isActive', '==', true);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Contact({ id: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar contacto
   */
  async update (updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('contacts').doc(this.id).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Agregar tags
   */
  async addTags (newTags) {
    const uniqueTags = [...new Set([...this.tags, ...newTags])];
    await this.update({ tags: uniqueTags });
  }

  /**
   * Remover tags
   */
  async removeTags (tagsToRemove) {
    const filteredTags = this.tags.filter(tag => !tagsToRemove.includes(tag));
    await this.update({ tags: filteredTags });
  }

  /**
   * Actualizar último contacto
   */
  async updateLastContact () {
    await this.update({
      lastContactAt: FieldValue.serverTimestamp(),
      totalMessages: FieldValue.increment(1),
    });
  }

  /**
   * Eliminar contacto (soft delete)
   */
  async delete () {
    await this.update({ isActive: false, deletedAt: FieldValue.serverTimestamp() });
  }

  /**
   * Eliminar contacto permanentemente
   */
  async hardDelete () {
    await firestore.collection('contacts').doc(this.id).delete();
  }

  /**
   * Exportar contactos a CSV
   */
  static async exportToCSV (userId = null) {
    let query = firestore.collection('contacts').where('isActive', '==', true);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const contacts = snapshot.docs.map(doc => {
      const contact = new Contact({ id: doc.id, ...doc.data() });
      return {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email || '',
        tags: contact.tags.join(', '),
        totalMessages: contact.totalMessages,
        createdAt: contact.createdAt?.toDate?.()?.toISOString() || '',
        lastContactAt: contact.lastContactAt?.toDate?.()?.toISOString() || '',
      };
    });

    return contacts;
  }

  /**
   * Obtener todos los tags únicos de contactos
   */
  static async getAllTags (userId = null) {
    try {
      let query = firestore.collection('contacts').where('isActive', '==', true);

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();
      const allTags = new Set();

      snapshot.docs.forEach(doc => {
        const contact = new Contact({ id: doc.id, ...doc.data() });
        if (contact.tags && Array.isArray(contact.tags)) {
          contact.tags.forEach(tag => allTags.add(tag));
        }
      });

      return Array.from(allTags).sort();
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo tags de contactos', {
        category: 'CONTACT_GET_TAGS_ERROR',
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Convertir a objeto plano para respuestas JSON con timestamps ISO
   */
  toJSON () {
    // Convertir timestamps a formato ISO string
    let createdAtISO = '';
    if (this.createdAt && typeof this.createdAt.toDate === 'function') {
      createdAtISO = this.createdAt.toDate().toISOString();
    } else if (this.createdAt instanceof Date) {
      createdAtISO = this.createdAt.toISOString();
    } else if (typeof this.createdAt === 'string') {
      createdAtISO = this.createdAt;
    }

    let updatedAtISO = '';
    if (this.updatedAt && typeof this.updatedAt.toDate === 'function') {
      updatedAtISO = this.updatedAt.toDate().toISOString();
    } else if (this.updatedAt instanceof Date) {
      updatedAtISO = this.updatedAt.toISOString();
    } else if (typeof this.updatedAt === 'string') {
      updatedAtISO = this.updatedAt;
    }

    let lastContactAtISO = '';
    if (this.lastContactAt && typeof this.lastContactAt.toDate === 'function') {
      lastContactAtISO = this.lastContactAt.toDate().toISOString();
    } else if (this.lastContactAt instanceof Date) {
      lastContactAtISO = this.lastContactAt.toISOString();
    } else if (typeof this.lastContactAt === 'string') {
      lastContactAtISO = this.lastContactAt;
    }

    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      email: this.email || '', // No null
      tags: this.tags || [], // No null
      createdAt: createdAtISO,
      updatedAt: updatedAtISO,
      lastContactAt: lastContactAtISO,
      totalMessages: this.totalMessages || 0,
      isActive: this.isActive !== false,
      waId: this.waId || this.phone?.replace('+', '') || '',
      profilePhotoUrl: this.profilePhotoUrl || null,
      customFields: this.customFields || {},
      company: this.company || '',
      lastModifiedBy: this.lastModifiedBy || '',
      createdBy: this.createdBy || '',
      conversationIds: this.conversationIds || [] // ✅ NUEVA REFERENCIA A CONVERSACIONES
    };
  }
}

module.exports = Contact;
