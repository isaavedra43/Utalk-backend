const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

/**
 * MODELO DE USUARIO - EMAIL-FIRST
 * 
 * Maneja usuarios con email como identificador principal
 * Compatible con Firestore y autenticación por email
 * 
 * @version 2.0.0
 * @author Backend Team
 */
class User {
  constructor(data) {
    // EMAIL como identificador principal (NO más UID)
    this.email = data.email;
    this.id = data.email; // Usar email como ID para compatibilidad
    this.password = data.password; // Hash de bcrypt
    this.name = data.name || data.displayName;
    this.phone = data.phone || null;
    
    // Metadata y permisos de Firestore únicamente
    this.role = data.role || 'viewer';
    this.permissions = data.permissions || [];
    this.department = data.department || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.lastLoginAt = data.lastLoginAt || null;
    this.settings = data.settings || {
      notifications: true,
      language: 'es',
      timezone: 'America/Mexico_City',
    };
    
    // Timestamps
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    
    // Datos de rendimiento
    this.performance = data.performance || null;
  }

  /**
   * 📊 Actualizar última actividad del usuario
   */
  async updateLastActivity() {
    try {
      this.lastActivityAt = new Date();
      
      await firestore
        .collection('users')
        .where('email', '==', this.email)
        .limit(1)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return doc.ref.update({
              lastActivityAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });
          }
        });

      logger.info('Última actividad actualizada', {
        email: this.email,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error actualizando última actividad', {
        email: this.email,
        error: error.message
      });
      // No lanzar error para no bloquear la validación del token
    }
  }

  /**
   * OBTENER usuario por EMAIL (identificador principal)
   */
  static async getByEmail(email) {
    try {
      if (!email) {
        throw new Error('Email es requerido');
      }

      logger.info('🔍 Buscando usuario por email', { email });

      const usersQuery = await firestore
        .collection('users')
        .where('email', '==', email)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        logger.warn('⚠️ Usuario no encontrado', { email });
        return null;
      }

      const userData = usersQuery.docs[0].data();
      const user = new User(userData);

      logger.info('Usuario encontrado', {
        email: user.email,
        role: user.role,
        name: user.name,
      });

      return user;
    } catch (error) {
      logger.error('Error obteniendo usuario por email', {
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 🚨 VALIDAR contraseña del usuario (TEXTO PLANO - SOLO PRUEBAS)
   * ACEPTA password O passwordHash en texto plano
   */
  static async validatePassword(email, passwordInput) {
    try {
      if (!email || !passwordInput) {
        throw new Error('Email y contraseña son requeridos');
      }

      logger.info('🔐 Validando contraseña para usuario (TEXTO PLANO)', { email });

      // Obtener usuario completo
      const userData = await this.getByEmail(email);
      if (!userData) {
        logger.warn('Usuario no encontrado para validación', { email });
        return false;
      }

      // 🚨 ACEPTAR password O passwordHash en texto plano
      let isValid = false;
      
      if (userData.password && userData.password === passwordInput) {
        isValid = true;
        logger.info('Contraseña válida (campo password)', { email });
      } else if (userData.passwordHash && userData.passwordHash === passwordInput) {
        isValid = true;
        logger.info('Contraseña válida (campo passwordHash)', { email });
      } else {
        logger.warn('Contraseña inválida (TEXTO PLANO)', { 
          email,
          hasPassword: !!userData.password,
          hasPasswordHash: !!userData.passwordHash,
          passwordMatch: false
        });
      }

      return isValid;
    } catch (error) {
      logger.error('💥 Error validando contraseña', {
        email,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * CREAR usuario nuevo
   */
  static async create(userData) {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email y contraseña son requeridos');
      }

      logger.info('👤 Creando nuevo usuario', { email: userData.email });

      // Verificar que no exista ya
      const existingUser = await this.getByEmail(userData.email);
      if (existingUser) {
        throw new Error('Usuario ya existe');
      }

      // 🚨 GUARDAR CONTRASEÑA EN TEXTO PLANO (SOLO PRUEBAS)
      // const saltRounds = 12;
      // const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      const newUserData = {
        email: userData.email,
        password: userData.password, // 🚨 TEXTO PLANO
        passwordHash: userData.password, // 🚨 TEXTO PLANO (ambos campos)
        name: userData.name || userData.email.split('@')[0],
        phone: userData.phone || null,
        role: userData.role || 'viewer',
        permissions: userData.permissions || [],
        department: userData.department || null,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        settings: userData.settings || {
          notifications: true,
          language: 'es',
          timezone: 'America/Mexico_City',
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: null,
        performance: null,
      };

      // Usar email como document ID para facilitar búsquedas
      const docId = userData.email.replace(/[.#$[\]]/g, '_'); // Firestore safe ID
      await firestore.collection('users').doc(docId).set(prepareForFirestore(newUserData));

      logger.info('Usuario creado exitosamente', {
        email: userData.email,
        role: newUserData.role,
      });

      return new User(newUserData);
    } catch (error) {
      logger.error('Error creando usuario', {
        email: userData.email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * LISTAR usuarios con filtros
   * 🔧 ACTUALIZADO: Sin dependencia de índices compuestos
   */
  static async list(options = {}) {
    try {
      const {
        limit = 50,
        role = null,
        department = null,
        isActive = true,
      } = options;

      logger.info('📋 User.list - Listando usuarios', { options });

      // 🔧 SOLUCIÓN SIN ÍNDICES: Consulta simple y filtrado local
      let query = firestore.collection('users').limit(limit * 2);

      // SOLO aplicar filtros que NO requieren índices compuestos
      // Evitar .where() + .orderBy() que requiere índices

      const snapshot = await query.get();
      
      logger.info('📋 User.list - Consulta ejecutada', {
        totalFound: snapshot.docs.length,
        isEmpty: snapshot.empty
      });

      // 🔧 FILTRADO LOCAL: Aplicar filtros sin usar índices
      let rawUsers = snapshot.docs.map(doc => {
        const userData = doc.data();
        // No incluir contraseña en listados
        delete userData.password;
        return new User(userData);
      });

      logger.info('🔍 User.list - Usuarios RAW obtenidos', {
        totalRaw: rawUsers.length,
        sampleUser: rawUsers.length > 0 ? {
          email: rawUsers[0].email,
          isActive: rawUsers[0].isActive,
          role: rawUsers[0].role,
          department: rawUsers[0].department
        } : null,
        allUsersData: rawUsers.map(u => ({
          email: u.email,
          isActive: u.isActive,
          role: u.role,
          department: u.department
        }))
      });

      let users = rawUsers
        .filter(user => {
          // 🔍 DEBUGGING: Log cada filtro individual
          logger.info('🔍 User.list - Evaluando filtros para usuario', {
            userEmail: user.email,
            userIsActive: user.isActive,
            filterIsActive: isActive,
            userRole: user.role,
            filterRole: role,
            userDepartment: user.department,
            filterDepartment: department
          });

          // Filtrar por isActive
          if (isActive !== null && user.isActive !== isActive) {
            logger.info('🚫 Usuario filtrado por isActive', {
              userEmail: user.email,
              userIsActive: user.isActive,
              filterIsActive: isActive
            });
            return false;
          }
          
          // Filtrar por role si se especifica
          if (role && user.role !== role) {
            logger.info('🚫 Usuario filtrado por role', {
              userEmail: user.email,
              userRole: user.role,
              filterRole: role
            });
            return false;
          }
          
          // Filtrar por department si se especifica
          if (department && user.department !== department) {
            logger.info('🚫 Usuario filtrado por department', {
              userEmail: user.email,
              userDepartment: user.department,
              filterDepartment: department
            });
            return false;
          }
          
          logger.info('✅ Usuario PASÓ todos los filtros', {
            userEmail: user.email
          });
          return true;
        })
        .sort((a, b) => {
          // Ordenar por createdAt desc (más recientes primero)
          const dateA = a.createdAt instanceof Date ? a.createdAt : 
                       (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : 
                       (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit); // Aplicar límite después del filtrado y ordenamiento

      logger.info('✅ User.list - Usuarios listados exitosamente', {
        totalFound: snapshot.docs.length,
        afterFiltering: users.length,
        filters: options
      });

      return users;
    } catch (error) {
      logger.error('❌ User.list - Error listando usuarios', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        options
      });
      throw error;
    }
  }

  /**
   * ACTUALIZAR usuario
   */
  async update(updates) {
    try {
      logger.info('✏️ Actualizando usuario', {
        email: this.email,
        updates: Object.keys(updates),
      });

      // 🚨 SI SE ACTUALIZA LA CONTRASEÑA, GUARDAR EN TEXTO PLANO (SOLO PRUEBAS)
      if (updates.password) {
        // const saltRounds = 12;
        // updates.password = await bcrypt.hash(updates.password, saltRounds);
        // 🚨 NO HACER HASH - GUARDAR TEXTO PLANO EN AMBOS CAMPOS
        updates.passwordHash = updates.password; // Mantener ambos campos sincronizados
        logger.info('🚨 Actualizando contraseña en texto plano (SOLO PRUEBAS)', {
          email: this.email,
          bothFields: true
        });
      }

      const cleanData = prepareForFirestore({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const docId = this.email.replace(/[.#$[\]]/g, '_');
      await firestore.collection('users').doc(docId).update(cleanData);

      // Actualizar instancia local
      Object.assign(this, updates);
      this.updatedAt = Timestamp.now();

      logger.info('Usuario actualizado', { email: this.email });
    } catch (error) {
      logger.error('Error actualizando usuario', {
        email: this.email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * MAPEO: Encontrar email por número de teléfono
   */
  static async findEmailByPhone(phone) {
    try {
      if (!phone) {
        throw new Error('Teléfono es requerido');
      }

      logger.info('🔍 Buscando email por teléfono', {
        phone,
      });

      const usersQuery = await firestore
        .collection('users')
        .where('phone', '==', phone)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        logger.warn('⚠️ No se encontró email para el teléfono', {
          phone,
        });
        return null;
      }

      const userData = usersQuery.docs[0].data();
      const email = userData.email;

      logger.info('Email encontrado por teléfono', {
        phone,
        email,
        userName: userData.name,
      });

      return email;
    } catch (error) {
      logger.error('Error buscando email por teléfono', {
        phone,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * ACTUALIZAR último login
   */
  async updateLastLogin() {
    try {
      const docId = this.email.replace(/[.#$[\]]/g, '_');
      const userRef = firestore.collection('users').doc(docId);
      
      // ✅ VERIFICAR si el documento existe antes de actualizar
      const doc = await userRef.get();
      
      if (!doc.exists) {
        logger.warn('⚠️ No se encontró el documento de usuario para actualizar el último login. Puede que el usuario haya sido eliminado o el email sea incorrecto.', { 
          email: this.email,
          docId: docId 
        });
        return; // No proceder con la actualización si el documento no existe
      }

      await userRef.update({
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      this.lastLoginAt = Timestamp.now();
      
      logger.info('✅ Último login actualizado para usuario', { email: this.email });
    } catch (error) {
      logger.error('💥 Error actualizando último login', {
        email: this.email,
        error: error.message,
      });
      // No lanzar error para no bloquear el login
    }
  }

  /**
   * SERIALIZACIÓN para frontend (SIN contraseña)
   */
  toJSON() {
    return {
      id: this.id, // ID para compatibilidad con RefreshToken
      email: this.email, // Identificador principal
      name: this.name,
      phone: this.phone,
      role: this.role,
      permissions: this.permissions,
      department: this.department,
      isActive: this.isActive,
      settings: this.settings,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      performance: this.performance,
      // NO incluir password en JSON
    };
  }

  /**
   * VALIDAR permisos
   */
  hasPermission(permission) {
    if (this.role === 'admin' || this.role === 'superadmin') return true;
    return this.permissions.includes(permission);
  }

  /**
   * VALIDAR rol
   */
  hasRole(role) {
    return this.role === role;
  }

  /**
   * ACTIVAR usuario
   */
  async setActive(isActive) {
    await this.update({ isActive });
  }
}

module.exports = User;
