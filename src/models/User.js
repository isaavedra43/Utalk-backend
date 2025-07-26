const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');

class User {
  constructor(data) {
    // ✅ UID de Firebase Auth como identificador principal
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName || data.name;
    this.photoURL = data.photoURL || null;
    this.phone = data.phone || null;
    
    // ✅ Metadata y permisos de Firestore
    this.role = data.role || 'viewer';
    this.permissions = data.permissions || [];
    this.department = data.department || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.lastLoginAt = data.lastLoginAt || null;
    this.settings = data.settings || {};
    
    // ✅ Timestamps
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    
    // ✅ Datos de rendimiento
    this.performance = data.performance || null;
  }

  /**
   * ✅ SINCRONIZACIÓN AUTOMÁTICA: Crear o actualizar usuario desde Firebase Auth
   * Esta función debe llamarse en cada login
   */
  static async syncFromAuth(authUser, additionalData = {}) {
    try {
      if (!authUser || !authUser.uid) {
        throw new Error('authUser con UID es requerido para sincronización');
      }

      const uid = authUser.uid;
      
      logger.info('🔄 Sincronizando usuario desde Firebase Auth', {
        uid,
        email: authUser.email,
        hasDisplayName: !!authUser.displayName,
        hasPhone: !!authUser.phoneNumber,
      });

      // ✅ Verificar si el documento existe en Firestore
      const userRef = firestore.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      // ✅ Normalizar teléfono si existe
      let normalizedPhone = null;
      if (authUser.phoneNumber) {
        const phoneValidation = validateAndNormalizePhone(authUser.phoneNumber);
        if (phoneValidation.isValid) {
          normalizedPhone = phoneValidation.normalized;
        } else {
          logger.warn('Teléfono inválido en Auth durante sincronización', {
            uid,
            phoneNumber: authUser.phoneNumber,
            error: phoneValidation.error,
          });
        }
      }

      const now = Timestamp.now();
      
      if (userDoc.exists) {
        // ✅ ACTUALIZAR documento existente
        const existingData = userDoc.data();
        
        const updateData = {
          email: authUser.email,
          displayName: authUser.displayName || existingData.displayName,
          photoURL: authUser.photoURL || existingData.photoURL,
          phone: normalizedPhone || existingData.phone,
          lastLoginAt: now,
          updatedAt: now,
          ...additionalData // Permitir datos adicionales en la sincronización
        };

        await userRef.update(prepareForFirestore(updateData));
        
        logger.info('✅ Usuario actualizado en Firestore', {
          uid,
          email: authUser.email,
          updatedFields: Object.keys(updateData),
        });

        // Retornar usuario completo
        return new User({
          uid,
          ...existingData,
          ...updateData,
        });
      } else {
        // ✅ CREAR nuevo documento
        const newUserData = {
          uid,
          email: authUser.email,
          displayName: authUser.displayName || authUser.email,
          photoURL: authUser.photoURL,
          phone: normalizedPhone,
          role: 'viewer', // Rol por defecto
          permissions: [],
          department: null,
          isActive: true,
          settings: {
            notifications: true,
            language: 'es',
            timezone: 'America/Mexico_City',
          },
          lastLoginAt: now,
          createdAt: now,
          updatedAt: now,
          performance: null,
          ...additionalData
        };

        await userRef.set(prepareForFirestore(newUserData));
        
        logger.info('✅ Nuevo usuario creado en Firestore', {
          uid,
          email: authUser.email,
          role: newUserData.role,
        });

        return new User(newUserData);
      }
    } catch (error) {
      logger.error('❌ Error sincronizando usuario desde Auth', {
        uid: authUser?.uid,
        email: authUser?.email,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * ✅ MAPEO: Encontrar UID por número de teléfono
   * Esencial para webhooks de Twilio y mapeo phone -> UID
   */
  static async findUidByPhone(phone) {
    try {
      if (!phone) {
        throw new Error('Teléfono es requerido para mapeo a UID');
      }

      // ✅ Normalizar teléfono
      const phoneValidation = validateAndNormalizePhone(phone);
      if (!phoneValidation.isValid) {
        throw new Error(`Teléfono inválido: ${phoneValidation.error}`);
      }

      const normalizedPhone = phoneValidation.normalized;
      
      logger.info('🔍 Buscando UID por teléfono', {
        originalPhone: phone,
        normalizedPhone,
      });

      // ✅ Buscar en Firestore
      const usersQuery = await firestore
        .collection('users')
        .where('phone', '==', normalizedPhone)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        logger.warn('⚠️ No se encontró UID para el teléfono', {
          phone: normalizedPhone,
        });
        return null;
      }

      const userData = usersQuery.docs[0].data();
      const uid = userData.uid;

      logger.info('✅ UID encontrado por teléfono', {
        phone: normalizedPhone,
        uid,
        userEmail: userData.email,
      });

      return uid;
    } catch (error) {
      logger.error('❌ Error buscando UID por teléfono', {
        phone,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * ✅ MAPEO: Encontrar teléfono por UID
   * Para casos donde necesitamos el teléfono desde el UID
   */
  static async findPhoneByUid(uid) {
    try {
      if (!uid) {
        throw new Error('UID es requerido para mapeo a teléfono');
      }

      const userDoc = await firestore.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        logger.warn('⚠️ Usuario no encontrado por UID', { uid });
        return null;
      }

      const userData = userDoc.data();
      const phone = userData.phone;

      if (!phone) {
        logger.warn('⚠️ Usuario sin teléfono registrado', { uid });
        return null;
      }

      logger.info('✅ Teléfono encontrado por UID', {
        uid,
        phone,
        userEmail: userData.email,
      });

      return phone;
    } catch (error) {
      logger.error('❌ Error buscando teléfono por UID', {
        uid,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * ✅ OBTENER usuario por UID
   */
  static async getByUid(uid) {
    try {
      if (!uid) {
        throw new Error('UID es requerido');
      }

      const userDoc = await firestore.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return new User({ uid, ...userDoc.data() });
    } catch (error) {
      logger.error('Error obteniendo usuario por UID', {
        uid,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * ✅ OBTENER usuario por teléfono (DEPRECADO - usar findUidByPhone)
   * Mantenido solo para compatibilidad temporal
   */
  static async getByPhone(phone) {
    logger.warn('⚠️ getByPhone está DEPRECADO - usar findUidByPhone y luego getByUid', {
      phone,
      stack: new Error().stack.split('\n').slice(1, 3),
    });

    const uid = await this.findUidByPhone(phone);
    if (!uid) return null;
    
    return await this.getByUid(uid);
  }

  /**
   * ✅ CREAR usuario
   */
  static async create(userData) {
    const user = new User(userData);

    if (!user.uid) {
      throw new Error('UID es requerido para crear usuario');
    }

    const cleanData = prepareForFirestore({
      ...user,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('users').doc(user.uid).set(cleanData);
    return user;
  }

  /**
   * ✅ ACTUALIZAR usuario
   */
  async update(updates) {
    const cleanData = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('users').doc(this.uid).update(cleanData);

    // Actualizar instancia local
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * ✅ SERIALIZACIÓN para frontend
   * Incluye UID y toda la metadata de Firestore
   */
  toJSON() {
    return {
      uid: this.uid, // ✅ Identificador principal
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      phone: this.phone, // ✅ Solo metadata
      role: this.role,
      permissions: this.permissions,
      department: this.department,
      isActive: this.isActive,
      settings: this.settings,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      performance: this.performance,
    };
  }

  /**
   * ✅ VALIDAR permisos
   */
  hasPermission(permission) {
    if (this.role === 'admin') return true;
    return this.permissions.includes(permission);
  }

  /**
   * ✅ VALIDAR rol
   */
  hasRole(role) {
    return this.role === role;
  }
}

module.exports = User;
