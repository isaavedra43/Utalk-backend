const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');

class User {
  constructor (data) {
    this.id = data.id; // Anteriormente uid
    this.email = data.email;
    this.name = data.name; // Anteriormente displayName
    this.role = data.role || 'viewer';
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || Timestamp.now();
    this.performance = data.performance || null;
  }

  /**
   * Crear un nuevo usuario en Firestore
   */
  static async create (userData) {
    const user = new User(userData);

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanData = prepareForFirestore({
      ...user,
      createdAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('users').doc(user.id).set(cleanData);
    return user;
  }

  /**
   * Obtener usuario por ID
   */
  static async getById (id) {
    const doc = await firestore.collection('users').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new User({ id: doc.id, ...doc.data() });
  }

  /**
   * Obtener usuario por email
   */
  static async getByEmail (email) {
    const snapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new User({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar usuarios con filtros y paginación
   */
  static async list ({ limit = 20, startAfter = null, role = null, status = null } = {}) {
    let query = firestore.collection('users');

    if (role) {
      query = query.where('role', '==', role);
    }

    if (status !== null) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new User({ id: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar usuario
   */
  async update (updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
    });

    await firestore.collection('users').doc(this.id).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
  }

  // Método eliminado: updateLastLogin ya no es necesario bajo el contrato centralizado
  async updateLastLogin () {
    // Deprecado intencionalmente
    return Promise.resolve();
  }

  /**
   * Cambiar rol del usuario
   */
  async changeRole (newRole) {
    await this.update({ role: newRole });
  }

  /**
   * Activar/desactivar usuario
   */
  async setActive (isActive) {
    await this.update({ status: isActive ? 'active' : 'inactive' });
  }

  /**
   * Actualizar configuraciones del usuario
   */
  async updateSettings (newSettings) {
    const settings = { ...this.settings, ...newSettings };
    await this.update({ settings });
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async delete () {
    await this.update({ status: 'inactive', deletedAt: FieldValue.serverTimestamp() });
  }

  /**
   * Eliminar usuario permanentemente
   */
  async hardDelete () {
    await firestore.collection('users').doc(this.id).delete();
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      performance: this.performance,
      
      // Se mantienen para uso interno/compatibilidad si es necesario, pero no en el contrato principal
      // email: this.email,
      // photoURL: this.photoURL,
      // createdAt: this.createdAt,
      // lastLoginAt: this.lastLoginAt,
    };
  }
}

module.exports = User;
