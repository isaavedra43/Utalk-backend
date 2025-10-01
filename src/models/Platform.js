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
    this.providerId = data.providerId;
    this.provider = data.provider || '';
    this.platformNumber = data.platformNumber || '';
    this.receptionDate = data.receptionDate || new Date();
    this.materialTypes = data.materialTypes || [];
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
   * Calcula totales automáticamente
   */
  calculateTotals() {
    this.totalLength = this.pieces.reduce((sum, piece) => sum + (piece.length || 0), 0);
    this.totalLinearMeters = this.pieces.reduce((sum, piece) => sum + (piece.linearMeters || 0), 0);
    
    // Extraer tipos de materiales únicos
    const materialsSet = new Set();
    this.pieces.forEach(piece => {
      if (piece.material) materialsSet.add(piece.material);
    });
    this.materialTypes = Array.from(materialsSet);
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      userId: this.userId,
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
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('platforms').doc(this.id);
      
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
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('platforms').doc(this.id);
      
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
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('platforms').doc(this.id);
      
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
      const doc = await db.collection('providers').doc(providerId)
        .collection('platforms').doc(platformId).get();
      
      const platform = Platform.fromFirestore(doc);
      
      // Antes se validaba por userId; ahora es global
      return platform;
    } catch (error) {
      console.error('Error buscando plataforma:', error);
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
   * Lista todas las plataformas del usuario (across all providers)
   */
  static async listByUser(userId, options = {}) {
    try {
      const {
        status = '',
        providerId = '',
        provider = '',
        materialType = '',
        startDate = null,
        endDate = null,
        search = '',
        sortBy = 'receptionDate',
        sortOrder = 'desc',
        limit = 50,
        offset = 0
      } = options;

      // Obtener todos los proveedores (global)
      const providersSnapshot = await db.collection('providers').get();

      let allPlatforms = [];

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

      // Aplicar filtros locales
      if (materialType) {
        allPlatforms = allPlatforms.filter(p => p.materialTypes.includes(materialType));
      }

      if (search) {
        const searchLower = search.toLowerCase();
        allPlatforms = allPlatforms.filter(p =>
          p.platformNumber.toLowerCase().includes(searchLower) ||
          p.driver.toLowerCase().includes(searchLower) ||
          p.notes.toLowerCase().includes(searchLower)
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
      console.error('Error listando plataformas del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas globales de plataformas
   */
  static async getGlobalStats(userId, options = {}) {
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

      // Obtener plataformas con filtros
      const result = await Platform.listByUser(userId, {
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

