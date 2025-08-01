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
  }

  /**
   * Crear un nuevo contacto
   */
  static async create (contactData) {
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
    const snapshot = await firestore
      .collection('contacts')
      .where('phone', '==', phone)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new Contact({ id: doc.id, ...doc.data() });
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
      console.error('Error obteniendo tags:', error);
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

    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      email: this.email || '', // No null
      tags: this.tags || [], // No null
      createdAt: createdAtISO,
      updatedAt: updatedAtISO,
    };
  }
}

module.exports = Contact;
