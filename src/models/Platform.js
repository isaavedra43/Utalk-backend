/**
 * 🚛 MODELO DE PLATAFORMA
 * 
 * Gestiona plataformas de recepción de materiales.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class Platform {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    
    // ✅ NUEVOS CAMPOS PARA SOPORTE DE CARGAS DE CLIENTE
    this.platformType = data.platformType || 'provider'; // 'provider' | 'client'
    this.ticketNumber = data.ticketNumber || null; // Solo para cargas de cliente
    
    // ✅ CAMPOS DE WORKSPACE PARA COLABORACIÓN ENTRE USUARIOS
    this.workspaceId = data.workspaceId || 'default_workspace';
    this.tenantId = data.tenantId || 'default_tenant';
    
    // ✅ CAMPOS EXISTENTES (OPCIONALES para backward compatibility)
    this.providerId = data.providerId || null; // Opcional para cargas de cliente
    this.provider = data.provider || ''; // Opcional para cargas de cliente
    
    // ✅ CAMPOS COMUNES (REQUERIDOS siempre)
    this.platformNumber = data.platformNumber || '';
    this.receptionDate = data.receptionDate || new Date();
    this.materialTypes = data.materialTypes || []; // Opcional para cargas de cliente
    this.driver = data.driver || '';
    this.standardWidth = data.standardWidth !== undefined ? data.standardWidth : 0.3;
    this.pieces = data.pieces || [];
    this.totalLinearMeters = data.totalLinearMeters || 0;
    this.totalLength = data.totalLength || 0;
    this.status = data.status || 'in_progress'; // in_progress | completed | exported
    this.notes = data.notes || '';
    this.evidenceCount = data.evidenceCount || 0;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Valida los datos de la plataforma según el tipo
   */
  validate() {
    const errors = [];

    // Campos siempre requeridos
    if (!this.platformNumber?.trim()) {
      errors.push('platformNumber es requerido');
    }
    if (!this.driver?.trim()) {
      errors.push('driver es requerido');
    }
    if (!this.platformType) {
      errors.push('platformType es requerido');
    }

    // Validar platformType
    if (this.platformType && !['provider', 'client'].includes(this.platformType)) {
      errors.push('platformType debe ser "provider" o "client"');
    }

    // Validación condicional por tipo
    if (this.platformType === 'provider') {
      if (!this.providerId?.trim()) {
        errors.push('providerId es requerido para cargas de proveedor');
      }
      if (!this.provider?.trim()) {
        errors.push('provider es requerido para cargas de proveedor');
      }
      if (!this.materialTypes || this.materialTypes.length === 0) {
        errors.push('materialTypes es requerido para cargas de proveedor');
      }
    }

    if (this.platformType === 'client') {
      if (!this.ticketNumber?.trim()) {
        errors.push('ticketNumber es requerido para cargas de cliente');
      }
      // materialTypes es OPCIONAL para cargas de cliente
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Calcula totales automáticamente
   */
  calculateTotals() {
    this.totalLength = this.pieces.reduce((sum, piece) => sum + (piece.length || 0), 0);
    this.totalLinearMeters = this.pieces.reduce((sum, piece) => sum + (piece.linearMeters || 0), 0);
    
    // Extraer tipos de materiales únicos (solo si hay pieces)
    if (this.pieces && this.pieces.length > 0) {
      const materialsSet = new Set();
      this.pieces.forEach(piece => {
        if (piece.material) materialsSet.add(piece.material);
      });
      this.materialTypes = Array.from(materialsSet);
    }
    // Para cargas de cliente, materialTypes puede estar vacío
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      userId: this.userId,
      platformType: this.platformType,
      ticketNumber: this.ticketNumber,
      workspaceId: this.workspaceId,
      tenantId: this.tenantId,
      providerId: this.providerId,
      provider: this.provider,
      platformNumber: this.platformNumber,
      receptionDate: this.receptionDate,
      materialTypes: this.materialTypes,
      driver: this.driver,
      standardWidth: this.standardWidth,
      pieces: this.pieces,
      totalLinearMeters: this.totalLinearMeters,
      totalLength: this.totalLength,
      status: this.status,
      notes: this.notes,
      evidenceCount: this.evidenceCount,
      createdBy: this.createdBy,
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
    return new Platform({
      id: doc.id,
      ...data,
      receptionDate: data.receptionDate?.toDate?.() || data.receptionDate,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda la plataforma en Firestore
   */
  async save() {
    try {
      this.calculateTotals();
      this.updatedAt = new Date();
      
      let docRef;
      
      if (this.platformType === 'provider') {
        // Para cargas de proveedor: providers/{providerId}/platforms/{platformId}
        if (!this.providerId) {
          throw new Error('providerId es requerido para cargas de proveedor');
        }
        docRef = db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.id);
      } else {
        // Para cargas de cliente: client_platforms/{platformId}
        docRef = db.collection('client_platforms').doc(this.id);
      }
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando plataforma:', error);
      throw error;
    }
  }

  /**
   * Actualiza la plataforma en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.calculateTotals();
      this.updatedAt = new Date();
      
      let docRef;
      
      if (this.platformType === 'provider') {
        // Para cargas de proveedor: providers/{providerId}/platforms/{platformId}
        if (!this.providerId) {
          throw new Error('providerId es requerido para cargas de proveedor');
        }
        docRef = db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.id);
      } else {
        // Para cargas de cliente: client_platforms/{platformId}
        docRef = db.collection('client_platforms').doc(this.id);
      }
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando plataforma:', error);
      throw error;
    }
  }

  /**
   * Elimina la plataforma
   */
  async delete() {
    try {
      let docRef;
      
      if (this.platformType === 'provider') {
        // Para cargas de proveedor: providers/{providerId}/platforms/{platformId}
        if (!this.providerId) {
          throw new Error('providerId es requerido para cargas de proveedor');
        }
        docRef = db.collection('providers').doc(this.providerId)
          .collection('platforms').doc(this.id);
      } else {
        // Para cargas de cliente: client_platforms/{platformId}
        docRef = db.collection('client_platforms').doc(this.id);
      }
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando plataforma:', error);
      throw error;
    }
  }

  /**
   * Busca una plataforma por ID
   */
  static async findById(userId, providerId, platformId) {
    try {
      console.log('🔍 Platform.findById llamado con:', { userId, providerId, platformId });
      
      // ✅ OBTENER WORKSPACE DEL USUARIO (tolerante a IDs normalizados)
      const usersCol = db.collection('users');
      let userDoc = await usersCol.doc(userId).get();
      if (!userDoc.exists) {
        // Algunos entornos guardan el email con puntos reemplazados por guiones bajos
        const normalizedId = userId.replace(/\./g, '_');
        userDoc = await usersCol.doc(normalizedId).get();
      }
      if (!userDoc.exists) {
        // Fallback definitivo: buscar por campo email
        const snap = await usersCol.where('email', '==', userId).limit(1).get();
        if (!snap.empty) {
          userDoc = snap.docs[0];
        }
      }

      if (!userDoc.exists) {
        console.log('❌ Usuario no encontrado en Firestore (probadas variantes):', { raw: userId, normalized: userId.replace(/\./g, '_') });
        return null;
      }

      const userData = userDoc.data();
      const userWorkspaceId = userData.workspaceId || 'default_workspace';
      const userTenantId = userData.tenantId || 'default_tenant';
      console.log('✅ Usuario encontrado:', { userId, userWorkspaceId, userTenantId });
      
      let doc;
      let platform;
      
      // 1️⃣ BUSCAR EN CLIENT_PLATFORMS (más común)
      console.log('🔍 Buscando en client_platforms:', `client_platforms/${platformId}`);
      doc = await db.collection('client_platforms').doc(platformId).get();
      
      if (doc.exists) {
        console.log('✅ Plataforma encontrada en client_platforms');
        platform = Platform.fromFirestore(doc);
        const platformWorkspaceId = platform.workspaceId || 'default_workspace';
        const platformTenantId = platform.tenantId || 'default_tenant';
        
        console.log('🔍 Comparando workspaces:', { 
          userWorkspaceId, 
          platformWorkspaceId,
          userTenantId,
          platformTenantId
        });
        
        // Verificar workspace Y tenant
        if (userWorkspaceId === platformWorkspaceId && userTenantId === platformTenantId) {
          console.log('✅ Workspace y tenant coinciden - Acceso permitido');
          return platform;
        } else {
          console.log('❌ Workspace o tenant NO coinciden - Acceso denegado');
          return null;
        }
      }
      
      // 2️⃣ BUSCAR EN PROVIDERS (menos común)
      if (providerId) {
        console.log('🔍 Buscando en providers:', `providers/${providerId}/platforms/${platformId}`);
        doc = await db.collection('providers').doc(providerId)
          .collection('platforms').doc(platformId).get();
        
        if (doc.exists) {
          console.log('✅ Plataforma encontrada en providers collection');
          platform = Platform.fromFirestore(doc);
          const platformWorkspaceId = platform.workspaceId || 'default_workspace';
          const platformTenantId = platform.tenantId || 'default_tenant';
          
          console.log('🔍 Comparando workspaces:', { 
            userWorkspaceId, 
            platformWorkspaceId,
            userTenantId,
            platformTenantId
          });
          
          // Verificar workspace Y tenant
          if (userWorkspaceId === platformWorkspaceId && userTenantId === platformTenantId) {
            console.log('✅ Workspace y tenant coinciden - Acceso permitido');
            return platform;
          } else {
            console.log('❌ Workspace o tenant NO coinciden - Acceso denegado');
            return null;
          }
        }
      }
      
      console.log('❌ Plataforma no encontrada en ninguna colección');
      return null;
    } catch (error) {
      console.error('❌ Error buscando plataforma:', error);
      throw error;
    }
  }

  /**
   * Lista todas las plataformas de un proveedor
   */
  static async listByProvider(userId, providerId, options = {}) {
    try {
      const {
        status = '',
        startDate = null,
        endDate = null,
        limit = 50,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('platforms');

      // Filtrar por estado
      if (status) {
        query = query.where('status', '==', status);
      }

      // Ordenar por fecha de recepción descendente
      query = query.orderBy('receptionDate', 'desc');

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      let platforms = snapshot.docs.map(doc => Platform.fromFirestore(doc));

      // Filtros de fecha (locales)
      if (startDate) {
        const start = new Date(startDate);
        platforms = platforms.filter(p => new Date(p.receptionDate) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        platforms = platforms.filter(p => new Date(p.receptionDate) <= end);
      }

      // Contar total (global)
      const totalQuery = status 
        ? db.collection('providers').doc(providerId).collection('platforms').where('status', '==', status)
        : db.collection('providers').doc(providerId).collection('platforms');
      
      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        platforms,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + platforms.length) < total
        }
      };
    } catch (error) {
      console.error('Error listando plataformas:', error);
      throw error;
    }
  }

  /**
   * Lista todas las plataformas del workspace (across all providers + client platforms)
   * ✅ SOLUCIÓN: Filtra por workspaceId y tenantId para permitir colaboración entre usuarios
   */
  static async listByWorkspace(userId, workspaceId, tenantId, options = {}) {
    try {
      const {
        status = '',
        providerId = '',
        provider = '',
        materialType = '',
        platformType = '', // ⭐ NUEVO: filtrar por tipo de plataforma
        ticketNumber = '', // ⭐ NUEVO: filtrar por número de ticket
        startDate = null,
        endDate = null,
        search = '',
        sortBy = 'receptionDate',
        sortOrder = 'desc',
        limit = 50,
        offset = 0
      } = options;

      let allPlatforms = [];

      // ✅ OBTENER CARGAS DE PROVEEDOR
      if (!platformType || platformType === 'provider') {
        // Obtener todos los proveedores (global)
        const providersSnapshot = await db.collection('providers').get();

        // Obtener plataformas de cada proveedor
        for (const providerDoc of providersSnapshot.docs) {
          const providerData = providerDoc.data();
        const currentProviderId = providerDoc.id;

        // Filtrar por providerId si se especifica
        if (providerId && currentProviderId !== providerId) continue;
        if (provider && providerData.name !== provider) continue;

        let query = db.collection('providers').doc(currentProviderId)
          .collection('platforms');

        // Filtrar por estado
        if (status) {
          query = query.where('status', '==', status);
        }

        const platformsSnapshot = await query.get();
        const platforms = platformsSnapshot.docs.map(doc => {
          const platform = Platform.fromFirestore(doc);
          platform.provider = providerData.name;
          platform.providerId = currentProviderId;
          return platform;
        });

        allPlatforms = allPlatforms.concat(platforms);
        }
      }

      // ✅ OBTENER CARGAS DE CLIENTE - SOLUCIÓN: Filtrar por workspaceId y tenantId
      if (!platformType || platformType === 'client') {
        let clientQuery = db.collection('client_platforms');

        // ✅ SOLUCIÓN CRÍTICA: Filtrar por workspaceId y tenantId en lugar de userId individual
        // Esto permite que todos los usuarios del mismo workspace vean las cargas
        // ✅ VALIDACIÓN: Asegurar que workspaceId y tenantId no sean undefined
        if (workspaceId && tenantId) {
          clientQuery = clientQuery.where('workspaceId', '==', workspaceId)
                                  .where('tenantId', '==', tenantId);
        } else {
          // ✅ FALLBACK: Si no hay workspaceId/tenantId, usar filtro por userId (comportamiento legacy)
          console.warn('⚠️ workspaceId o tenantId undefined, usando filtro por userId como fallback', {
            workspaceId,
            tenantId,
            userId
          });
          clientQuery = clientQuery.where('userId', '==', userId);
        }

        // Filtrar por estado
        if (status) {
          clientQuery = clientQuery.where('status', '==', status);
        }

        // Filtrar por ticketNumber
        if (ticketNumber) {
          clientQuery = clientQuery.where('ticketNumber', '==', ticketNumber);
        }

        const clientPlatformsSnapshot = await clientQuery.get();
        const clientPlatforms = clientPlatformsSnapshot.docs.map(doc => {
          const platform = Platform.fromFirestore(doc);
          platform.platformType = 'client'; // Asegurar que tenga el tipo correcto
          return platform;
        });

        allPlatforms = allPlatforms.concat(clientPlatforms);
      }

      // Aplicar filtros locales
      if (materialType) {
        allPlatforms = allPlatforms.filter(p => p.materialTypes.includes(materialType));
      }

      if (search) {
        const searchLower = search.toLowerCase();
        allPlatforms = allPlatforms.filter(p =>
          p.platformNumber.toLowerCase().includes(searchLower) ||
          p.driver.toLowerCase().includes(searchLower) ||
          p.notes.toLowerCase().includes(searchLower) ||
          (p.ticketNumber && p.ticketNumber.toLowerCase().includes(searchLower)) ||
          (p.provider && p.provider.toLowerCase().includes(searchLower))
        );
      }

      if (startDate) {
        const start = new Date(startDate);
        allPlatforms = allPlatforms.filter(p => new Date(p.receptionDate) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        allPlatforms = allPlatforms.filter(p => new Date(p.receptionDate) <= end);
      }

      // Ordenar
      allPlatforms.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      const total = allPlatforms.length;
      const paginatedPlatforms = allPlatforms.slice(offset, offset + limit);

      return {
        platforms: paginatedPlatforms,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + paginatedPlatforms.length) < total,
          nextOffset: offset + limit
        }
      };
    } catch (error) {
      console.error('Error listando plataformas del workspace:', error);
      throw error;
    }
  }

  /**
   * Lista todas las plataformas del usuario (across all providers + client platforms)
   * ⚠️ MÉTODO LEGACY: Mantenido para compatibilidad, pero usa listByWorkspace internamente
   */
  static async listByUser(userId, options = {}) {
    try {
      // ✅ OBTENER INFORMACIÓN DEL USUARIO PARA WORKSPACE
      const User = require('./User');
      const user = await User.getByEmail(userId);
      
      if (!user) {
        console.warn(`Usuario ${userId} no encontrado, usando valores por defecto`);
      }

      const workspaceId = user?.workspaceId || 'default_workspace';
      const tenantId = user?.tenantId || 'default_tenant';

      // ✅ DELEGAR AL NUEVO MÉTODO
      return await Platform.listByWorkspace(userId, workspaceId, tenantId, options);
    } catch (error) {
      console.error('Error listando plataformas del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas globales de plataformas
   */
  static async getGlobalStats(userId, workspaceId, tenantId, options = {}) {
    try {
      const {
        period = 'month',
        providerId = '',
        materialType = ''
      } = options;

      // Calcular rango de fechas según período
      const now = new Date();
      let startDate, endDate = now;

      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'quarter':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      // Obtener plataformas con filtros usando el nuevo método
      const result = await Platform.listByWorkspace(userId, workspaceId, tenantId, {
        providerId,
        materialType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 10000 // Sin límite para stats
      });

      const platforms = result.platforms;

      // Calcular estadísticas
      const totals = {
        totalPlatforms: platforms.length,
        inProgress: platforms.filter(p => p.status === 'in_progress').length,
        completed: platforms.filter(p => p.status === 'completed').length,
        exported: platforms.filter(p => p.status === 'exported').length
      };

      const materials = {
        totalLinearMeters: platforms.reduce((sum, p) => sum + p.totalLinearMeters, 0),
        totalLength: platforms.reduce((sum, p) => sum + p.totalLength, 0),
        averageLinearMetersPerPlatform: platforms.length > 0 
          ? platforms.reduce((sum, p) => sum + p.totalLinearMeters, 0) / platforms.length 
          : 0
      };

      // Materiales más usados
      const materialUsage = {};
      platforms.forEach(platform => {
        platform.pieces.forEach(piece => {
          if (!materialUsage[piece.material]) {
            materialUsage[piece.material] = {
              count: 0,
              linearMeters: 0
            };
          }
          materialUsage[piece.material].count++;
          materialUsage[piece.material].linearMeters += piece.linearMeters || 0;
        });
      });

      const materialsBreakdown = Object.entries(materialUsage)
        .map(([material, data]) => ({
          material,
          platforms: data.count,
          linearMeters: data.linearMeters,
          percentage: materials.totalLinearMeters > 0 
            ? (data.linearMeters / materials.totalLinearMeters * 100).toFixed(1)
            : 0
        }))
        .sort((a, b) => b.linearMeters - a.linearMeters);

      // Proveedores breakdown
      const providerUsage = {};
      platforms.forEach(platform => {
        const key = platform.providerId;
        if (!providerUsage[key]) {
          providerUsage[key] = {
            providerId: platform.providerId,
            provider: platform.provider,
            platforms: 0,
            linearMeters: 0
          };
        }
        providerUsage[key].platforms++;
        providerUsage[key].linearMeters += platform.totalLinearMeters;
      });

      const providersBreakdown = Object.values(providerUsage)
        .map(p => ({
          ...p,
          percentage: platforms.length > 0 ? (p.platforms / platforms.length * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.linearMeters - a.linearMeters);

      return {
        period: {
          type: period,
          startDate,
          endDate
        },
        totals,
        materials,
        providers: {
          active: providersBreakdown.length,
          topProvider: providersBreakdown[0] || null
        },
        breakdown: {
          byStatus: {
            in_progress: totals.inProgress,
            completed: totals.completed,
            exported: totals.exported
          },
          byMaterial: materialsBreakdown,
          byProvider: providersBreakdown
        }
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas globales:', error);
      throw error;
    }
  }
}

module.exports = Platform;

