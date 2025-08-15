const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getRefreshTokenConfig } = require('../config/jwt');

/**
 * 🔄 MODELO DE REFRESH TOKENS
 * 
 * Maneja refresh tokens de forma segura con:
 * - Almacenamiento en Firestore
 * - Invalidación por logout
 * - Rotación de tokens
 * - Protección contra replay attacks
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class RefreshToken {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.token = data.token;
    this.userEmail = data.userEmail;
    this.userId = data.userId;
    this.familyId = data.familyId || uuidv4(); // Para rotación de tokens
    this.deviceId = data.deviceId;
    this.deviceInfo = data.deviceInfo || {};
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || Timestamp.now();
    this.expiresAt = data.expiresAt;
    this.lastUsedAt = data.lastUsedAt;
    this.usedCount = data.usedCount || 0;
    this.maxUses = data.maxUses || 100; // Límite de usos por token
  }

  /**
   * Crear un nuevo refresh token
   */
  static async create(tokenData) {
    console.log('🔍 [REFRESH_TOKEN] Creando refresh token...');
    console.log('🔍 [REFRESH_TOKEN] tokenData recibido:', { 
      userEmail: tokenData.userEmail, 
      userId: tokenData.userId,
      deviceId: tokenData.deviceId 
    });

    const refreshToken = new RefreshToken(tokenData);

    // Preparar datos para Firestore
    const cleanData = {
      token: refreshToken.token,
      userEmail: refreshToken.userEmail,
      userId: refreshToken.userId,
      familyId: refreshToken.familyId,
      deviceId: refreshToken.deviceId,
      deviceInfo: refreshToken.deviceInfo,
      ipAddress: refreshToken.ipAddress,
      userAgent: refreshToken.userAgent,
      isActive: refreshToken.isActive,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: refreshToken.expiresAt,
      lastUsedAt: refreshToken.lastUsedAt,
      usedCount: refreshToken.usedCount,
      maxUses: refreshToken.maxUses
    };

    console.log('🔍 [REFRESH_TOKEN] Guardando en Firestore...');
    // Guardar en Firestore
    await firestore.collection('refresh_tokens').doc(refreshToken.id).set(cleanData);
    console.log('✅ [REFRESH_TOKEN] Guardado en Firestore exitosamente');

    console.log('🔍 [REFRESH_TOKEN] Creando índices...');
    // Crear índices para consultas eficientes
    await this.createIndexes(refreshToken);
    console.log('✅ [REFRESH_TOKEN] Índices creados exitosamente');

    console.log('🔍 [REFRESH_TOKEN] Loggeando con logger...');
    console.log('🔍 [REFRESH_TOKEN] logger existe:', !!logger);
    console.log('🔍 [REFRESH_TOKEN] logger.info existe:', !!(logger && typeof logger.info === 'function'));

    if (logger && typeof logger.info === 'function') {
      console.log('🔍 [REFRESH_TOKEN] Logger.info ejecutado');
      logger.info('🔄 Refresh token creado', {
        tokenId: refreshToken.id,
        userEmail: refreshToken.userEmail,
        familyId: refreshToken.familyId,
        deviceId: refreshToken.deviceId
      });
      console.log('✅ [REFRESH_TOKEN] logger.info ejecutado exitosamente');
    } else {
      console.log('❌ [REFRESH_TOKEN] logger.info NO disponible');
    }

    console.log('✅ [REFRESH_TOKEN] Refresh token creado exitosamente');
    return refreshToken;
  }

  /**
   * Crear índices para consultas eficientes
   */
  static async createIndexes(refreshToken) {
    const batch = firestore.batch();

    // Índice por usuario
    const userIndexRef = firestore
      .collection('refresh_tokens_by_user')
      .doc(refreshToken.userEmail)
      .collection('tokens')
      .doc(refreshToken.id);

    batch.set(userIndexRef, {
      tokenId: refreshToken.id,
      familyId: refreshToken.familyId,
      deviceId: refreshToken.deviceId,
      isActive: refreshToken.isActive,
      expiresAt: refreshToken.expiresAt,
      createdAt: refreshToken.createdAt
    });

    // Índice por token (para búsqueda rápida)
    const tokenIndexRef = firestore
      .collection('refresh_tokens_by_token')
      .doc(refreshToken.token)
      .collection('metadata')
      .doc(refreshToken.id);

    batch.set(tokenIndexRef, {
      tokenId: refreshToken.id,
      userEmail: refreshToken.userEmail,
      familyId: refreshToken.familyId,
      isActive: refreshToken.isActive,
      expiresAt: refreshToken.expiresAt
    });

    // Índice por familia (para rotación)
    const familyIndexRef = firestore
      .collection('refresh_tokens_by_family')
      .doc(refreshToken.familyId)
      .collection('tokens')
      .doc(refreshToken.id);

    batch.set(familyIndexRef, {
      tokenId: refreshToken.id,
      userEmail: refreshToken.userEmail,
      deviceId: refreshToken.deviceId,
      isActive: refreshToken.isActive,
      expiresAt: refreshToken.expiresAt
    });

    await batch.commit();
  }

  /**
   * Obtener refresh token por ID
   */
  static async getById(id) {
    const doc = await firestore.collection('refresh_tokens').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new RefreshToken({ id: doc.id, ...doc.data() });
  }

  /**
   * Obtener refresh token por token string
   */
  static async getByToken(token) {
    try {
      const snapshot = await firestore
        .collection('refresh_tokens_by_token')
        .doc(token)
        .collection('metadata')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const tokenId = doc.data().tokenId;

      return await this.getById(tokenId);
    } catch (error) {
      logger.error('Error obteniendo refresh token por token string', {
        error: error.message,
        token: token ? token.substring(0, 20) + '...' : 'null'
      });
      return null;
    }
  }

  /**
   * Listar refresh tokens activos de un usuario
   */
  static async listByUser(userEmail, options = {}) {
    const { limit = 50, activeOnly = true } = options;

    try {
      let query = firestore
        .collection('refresh_tokens_by_user')
        .doc(userEmail)
        .collection('tokens')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (activeOnly) {
        query = query.where('isActive', '==', true);
      }

      const snapshot = await query.get();
      const tokens = [];

      for (const doc of snapshot.docs) {
        const token = await this.getById(doc.data().tokenId);
        if (token) {
          tokens.push(token);
        }
      }

      return tokens;
    } catch (error) {
      logger.error('Error listando refresh tokens por usuario', {
        userEmail,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Invalidar refresh token
   */
  async invalidate() {
    try {
      await this.update({ isActive: false });
      
      // Invalidar en índices
      await this.updateIndexes({ isActive: false });

      logger.info('🔄 Refresh token invalidado', {
        tokenId: this.id,
        userEmail: this.userEmail,
        familyId: this.familyId
      });

      return true;
    } catch (error) {
      logger.error('Error invalidando refresh token', {
        tokenId: this.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Invalidar todos los refresh tokens de un usuario
   */
  static async invalidateAllForUser(userEmail) {
    try {
      const tokens = await this.listByUser(userEmail, { activeOnly: true });
      
      const batch = firestore.batch();
      
      for (const token of tokens) {
        batch.update(firestore.collection('refresh_tokens').doc(token.id), {
          isActive: false,
          invalidatedAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      logger.info('🔄 Todos los refresh tokens invalidados para usuario', {
        userEmail,
        count: tokens.length
      });

      return tokens.length;
    } catch (error) {
      logger.error('Error invalidando todos los refresh tokens', {
        userEmail,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Invalidar todos los refresh tokens de una familia
   */
  static async invalidateFamily(familyId) {
    try {
      const snapshot = await firestore
        .collection('refresh_tokens_by_family')
        .doc(familyId)
        .collection('tokens')
        .where('isActive', '==', true)
        .get();

      const batch = firestore.batch();
      
      for (const doc of snapshot.docs) {
        batch.update(firestore.collection('refresh_tokens').doc(doc.data().tokenId), {
          isActive: false,
          invalidatedAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      logger.info('🔄 Familia de refresh tokens invalidada', {
        familyId,
        count: snapshot.docs.length
      });

      return snapshot.docs.length;
    } catch (error) {
      logger.error('Error invalidando familia de refresh tokens', {
        familyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar refresh token
   */
  async update(updates) {
    const validUpdates = {
      ...updates,
      lastUsedAt: updates.lastUsedAt || FieldValue.serverTimestamp()
    };

    if (updates.usedCount) {
      validUpdates.usedCount = FieldValue.increment(updates.usedCount);
    }

    await firestore.collection('refresh_tokens').doc(this.id).update(validUpdates);

    // Actualizar índices si es necesario
    if (updates.isActive !== undefined) {
      await this.updateIndexes(updates);
    }

    // Actualizar propiedades locales
    Object.assign(this, updates);
  }

  /**
   * Actualizar índices
   */
  static async updateIndexes(tokenId, updates) {
    const batch = firestore.batch();

    // Obtener token para actualizar índices
    const token = await this.getById(tokenId);
    if (!token) return;

    // Actualizar índice por usuario
    const userIndexRef = firestore
      .collection('refresh_tokens_by_user')
      .doc(token.userEmail)
      .collection('tokens')
      .doc(tokenId);

    batch.update(userIndexRef, updates);

    // Actualizar índice por token
    const tokenIndexRef = firestore
      .collection('refresh_tokens_by_token')
      .doc(token.token)
      .collection('metadata')
      .doc(tokenId);

    batch.update(tokenIndexRef, updates);

    // Actualizar índice por familia
    const familyIndexRef = firestore
      .collection('refresh_tokens_by_family')
      .doc(token.familyId)
      .collection('tokens')
      .doc(tokenId);

    batch.update(familyIndexRef, updates);

    await batch.commit();
  }

  /**
   * Verificar si el token está expirado
   */
  isExpired() {
    if (!this.expiresAt) return false;
    
    const now = new Date();
    const expiresAt = this.expiresAt.toDate ? this.expiresAt.toDate() : new Date(this.expiresAt);
    
    return now > expiresAt;
  }

  /**
   * Verificar si el token ha excedido el límite de usos
   */
  hasExceededMaxUses() {
    return this.usedCount >= this.maxUses;
  }

  /**
   * Verificar si el token es válido
   */
  isValid() {
    return this.isActive && !this.isExpired() && !this.hasExceededMaxUses();
  }

  /**
   * Generar nuevo refresh token
   */
  static async generate(userEmail, userId, deviceInfo = {}) {
    console.log('🔍 [REFRESH_TOKEN] Generando refresh token...');
    console.log('🔍 [REFRESH_TOKEN] Parámetros recibidos:', { 
      userEmail, 
      userId, 
      deviceInfoExists: !!deviceInfo 
    });

    // Validar que userId no sea undefined
    if (!userId) {
      console.log('❌ [REFRESH_TOKEN] userId es undefined, usando userEmail como fallback');
      userId = userEmail; // Usar userEmail como fallback
    }

    const refreshConfig = getRefreshTokenConfig();
    const token = jwt.sign(
      {
        type: 'refresh',
        userEmail,
        userId,
        workspaceId: 'default',  // 🔧 CORRECCIÓN: Agregar workspaceId
        tenantId: 'na',          // 🔧 CORRECCIÓN: Agregar tenantId
        familyId: uuidv4(),
        deviceId: deviceInfo.deviceId || uuidv4(),
        iat: Math.floor(Date.now() / 1000)
      },
      refreshConfig.secret,
      {
        expiresIn: refreshConfig.expiresIn,
        issuer: refreshConfig.issuer,
        audience: refreshConfig.audience
      }
    );

    const expiresIn = refreshConfig.expiresIn;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días por defecto

    console.log('🔍 [REFRESH_TOKEN] Creando refresh token con datos:', {
      userEmail,
      userId,
      deviceId: deviceInfo.deviceId || uuidv4(),
      expiresAt: expiresAt.toISOString()
    });

    const refreshToken = await this.create({
      token,
      userEmail,
      userId,
      familyId: uuidv4(),
      deviceId: deviceInfo.deviceId || uuidv4(),
      deviceInfo,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      expiresAt,
      maxUses: 100
    });

    console.log('✅ [REFRESH_TOKEN] Refresh token generado exitosamente');
    return refreshToken;
  }

  /**
   * Limpiar tokens expirados
   */
  static async cleanupExpiredTokens() {
    try {
      const now = new Date();
      
      const snapshot = await firestore
        .collection('refresh_tokens')
        .where('expiresAt', '<', now)
        .where('isActive', '==', true)
        .get();

      const batch = firestore.batch();
      
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
          isActive: false,
          cleanedUpAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      logger.info('🧹 Tokens expirados limpiados', {
        count: snapshot.docs.length
      });

      return snapshot.docs.length;
    } catch (error) {
      logger.error('Error limpiando tokens expirados', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de refresh tokens
   */
  static async getStats(userEmail = null) {
    try {
      let query = firestore.collection('refresh_tokens');
      
      if (userEmail) {
        query = query.where('userEmail', '==', userEmail);
      }

      const snapshot = await query.get();
      const tokens = snapshot.docs.map(doc => new RefreshToken({ id: doc.id, ...doc.data() }));

      const stats = {
        total: tokens.length,
        active: tokens.filter(t => t.isActive).length,
        expired: tokens.filter(t => t.isExpired()).length,
        byDevice: {},
        byFamily: {}
      };

      // Agrupar por dispositivo
      for (const token of tokens) {
        if (!stats.byDevice[token.deviceId]) {
          stats.byDevice[token.deviceId] = 0;
        }
        stats.byDevice[token.deviceId]++;
      }

      // Agrupar por familia
      for (const token of tokens) {
        if (!stats.byFamily[token.familyId]) {
          stats.byFamily[token.familyId] = 0;
        }
        stats.byFamily[token.familyId]++;
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de refresh tokens', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convertir a objeto plano
   */
  toJSON() {
    return {
      id: this.id,
      userEmail: this.userEmail,
      userId: this.userId,
      familyId: this.familyId,
      deviceId: this.deviceId,
      deviceInfo: this.deviceInfo,
      isActive: this.isActive,
      createdAt: this.createdAt?.toDate?.()?.toISOString() || this.createdAt,
      expiresAt: this.expiresAt?.toDate?.()?.toISOString() || this.expiresAt,
      lastUsedAt: this.lastUsedAt?.toDate?.()?.toISOString() || this.lastUsedAt,
      usedCount: this.usedCount,
      maxUses: this.maxUses,
      isValid: this.isValid(),
      isExpired: this.isExpired()
    };
  }
}

module.exports = RefreshToken; 