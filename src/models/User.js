const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');

class User {
  constructor (data) {
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName;
    this.photoURL = data.photoURL;
    this.role = data.role || 'viewer';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    this.lastLoginAt = data.lastLoginAt;
    this.settings = data.settings || {};
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
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('users').doc(user.uid).set(cleanData);
    return user;
  }

  /**
   * Obtener usuario por UID
   */
  static async getByUid (uid) {
    const doc = await firestore.collection('users').doc(uid).get();
    if (!doc.exists) {
      return null;
    }
    return new User({ uid: doc.id, ...doc.data() });
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
    return new User({ uid: doc.id, ...doc.data() });
  }

  /**
   * Listar usuarios con filtros y paginación
   */
  static async list ({ limit = 20, startAfter = null, role = null, isActive = null } = {}) {
    let query = firestore.collection('users');

    if (role) {
      query = query.where('role', '==', role);
    }

    if (isActive !== null) {
      query = query.where('isActive', '==', isActive);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new User({ uid: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar usuario
   */
  async update (updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('users').doc(this.uid).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin () {
    const now = FieldValue.serverTimestamp();
    await firestore.collection('users').doc(this.uid).update({
      lastLoginAt: now,
      updatedAt: now,
    });
    this.lastLoginAt = Timestamp.now();
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
    await this.update({ isActive });
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
    await this.update({ isActive: false, deletedAt: FieldValue.serverTimestamp() });
  }

  /**
   * Eliminar usuario permanentemente
   */
  async hardDelete () {
    await firestore.collection('users').doc(this.uid).delete();
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      settings: this.settings,
    };
  }
}

module.exports = User;
