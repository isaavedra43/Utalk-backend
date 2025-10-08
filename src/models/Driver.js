/**
 * 🚛 MODELO DE CHOFER
 * 
 * Gestiona choferes y sus vehículos asociados para el módulo de inventario.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class Driver {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.phone = data.phone || null;
    this.licenseNumber = data.licenseNumber || null;
    this.vehicleType = data.vehicleType;
    this.vehiclePlate = data.vehiclePlate;
    this.vehicleModel = data.vehicleModel || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    
    // ✅ CAMPOS DE WORKSPACE PARA COLABORACIÓN ENTRE USUARIOS
    this.workspaceId = data.workspaceId || 'default_workspace';
    this.tenantId = data.tenantId || 'default_tenant';
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Valida los datos del chofer
   */
  validate() {
    const errors = [];

    // Campos requeridos
    if (!this.name?.trim()) {
      errors.push('name es requerido');
    }
    
    if (!this.vehicleType?.trim()) {
      errors.push('vehicleType es requerido');
    }
    
    if (!this.vehiclePlate?.trim()) {
      errors.push('vehiclePlate es requerido');
    }

    // Validar tipos de vehículo
    const validVehicleTypes = ['Camión', 'Camioneta', 'Pickup', 'Van', 'Trailer', 'Otro'];
    if (this.vehicleType && !validVehicleTypes.includes(this.vehicleType)) {
      errors.push('vehicleType debe ser uno de: ' + validVehicleTypes.join(', '));
    }

    // Validar formato de teléfono (opcional pero si se proporciona debe ser válido)
    if (this.phone && this.phone.toString().trim()) {
      const phoneRegex = /^[\+]?[1-9][\d]{4,20}$/; // Entre 5 y 21 dígitos (incluyendo +)
      const cleanPhone = this.phone.toString().replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.push('phone debe tener entre 5 y 20 dígitos');
      }
    }

    // Validar que el nombre no sea muy corto
    if (this.name && this.name.trim().length < 2) {
      errors.push('name debe tener al menos 2 caracteres');
    }

    // Validar que la placa no sea muy corta (solo si se proporciona)
    if (this.vehiclePlate && this.vehiclePlate.toString().trim().length < 2) {
      errors.push('vehiclePlate debe tener al menos 2 caracteres');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      name: this.name,
      phone: this.phone || null,
      licenseNumber: this.licenseNumber || null,
      vehicleType: this.vehicleType,
      vehiclePlate: this.vehiclePlate,
      vehicleModel: this.vehicleModel || null,
      isActive: this.isActive,
      workspaceId: this.workspaceId,
      tenantId: this.tenantId,
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
    return new Driver({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda el chofer en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      
      const docRef = db.collection('drivers').doc(this.id);
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando chofer:', error);
      throw error;
    }
  }

  /**
   * Actualiza el chofer en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('drivers').doc(this.id);
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando chofer:', error);
      throw error;
    }
  }

  /**
   * Elimina el chofer
   */
  async delete() {
    try {
      const docRef = db.collection('drivers').doc(this.id);
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando chofer:', error);
      throw error;
    }
  }

  /**
   * Busca un chofer por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('drivers').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return Driver.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando chofer por ID:', error);
      throw error;
    }
  }

  /**
   * Lista choferes con filtros por workspace
   */
  static async listByWorkspace(workspaceId, tenantId, options = {}) {
    try {
      // ✅ VALIDACIÓN DE PARÁMETROS
      if (!workspaceId || !tenantId) {
        console.log('⚠️ Parámetros de workspace faltantes:', { workspaceId, tenantId });
        return {
          drivers: [],
          pagination: {
            total: 0,
            limit: options.limit || 1000,
            offset: options.offset || 0,
            hasMore: false
          }
        };
      }

      console.log('🔍 Iniciando consulta a Firestore con:', { workspaceId, tenantId, options });

      const {
        active = null,
        vehicleType = '',
        search = '',
        limit = 1000,
        offset = 0
      } = options;

      // ✅ CONSULTA SIMPLIFICADA - SOLO WORKSPACE Y TENANT
      let query = db.collection('drivers')
        .where('workspaceId', '==', workspaceId)
        .where('tenantId', '==', tenantId);

      console.log('🔍 Ejecutando consulta simplificada...');
      const snapshot = await query.get();
      let drivers = snapshot.docs.map(doc => Driver.fromFirestore(doc));

      // ✅ APLICAR FILTROS LOCALMENTE
      console.log(`🔍 Aplicando filtros locales a ${drivers.length} choferes...`);
      
      // Filtrar por estado activo
      if (active !== null) {
        drivers = drivers.filter(driver => driver.isActive === active);
        console.log(`✅ Filtro activo (${active}): ${drivers.length} choferes`);
      }

      // Filtrar por tipo de vehículo
      if (vehicleType) {
        drivers = drivers.filter(driver => driver.vehicleType === vehicleType);
        console.log(`✅ Filtro tipo vehículo (${vehicleType}): ${drivers.length} choferes`);
      }

      // Filtrar por búsqueda
      if (search) {
        const searchLower = search.toLowerCase();
        drivers = drivers.filter(driver => 
          driver.name.toLowerCase().includes(searchLower) ||
          (driver.vehiclePlate && driver.vehiclePlate.toLowerCase().includes(searchLower)) ||
          (driver.vehicleType && driver.vehicleType.toLowerCase().includes(searchLower)) ||
          (driver.vehicleModel && driver.vehicleModel.toLowerCase().includes(searchLower))
        );
        console.log(`✅ Filtro búsqueda (${search}): ${drivers.length} choferes`);
      }

      // Ordenar por nombre
      drivers = drivers.sort((a, b) => a.name.localeCompare(b.name));
      console.log(`✅ Ordenamiento por nombre: ${drivers.length} choferes`);

      // ✅ APLICAR PAGINACIÓN LOCAL
      const totalDrivers = drivers.length;
      const startIndex = offset;
      const endIndex = Math.min(startIndex + limit, totalDrivers);
      drivers = drivers.slice(startIndex, endIndex);

      console.log(`✅ Paginación aplicada: ${startIndex}-${endIndex} de ${totalDrivers} choferes`);

      return {
        drivers,
        pagination: {
          total: totalDrivers,
          limit,
          offset,
          hasMore: endIndex < totalDrivers
        }
      };
    } catch (error) {
      console.error('Error listando choferes:', error);
      throw error;
    }
  }

  /**
   * Lista choferes activos por workspace
   */
  static async listActiveByWorkspace(workspaceId, tenantId) {
    try {
      const result = await Driver.listByWorkspace(workspaceId, tenantId, {
        active: true,
        limit: 1000
      });
      
      return result.drivers;
    } catch (error) {
      console.error('Error listando choferes activos:', error);
      throw error;
    }
  }

  /**
   * Lista choferes por tipo de vehículo
   */
  static async listByVehicleType(workspaceId, tenantId, vehicleType) {
    try {
      const result = await Driver.listByWorkspace(workspaceId, tenantId, {
        vehicleType,
        limit: 1000
      });
      
      return result.drivers;
    } catch (error) {
      console.error('Error listando choferes por tipo de vehículo:', error);
      throw error;
    }
  }

  /**
   * Verifica si existe un chofer con la misma placa en el workspace
   */
  static async plateExistsInWorkspace(workspaceId, tenantId, plate, excludeId = null) {
    try {
      // Validar parámetros requeridos
      if (!workspaceId || !tenantId || !plate) {
        return false;
      }

      let query = db.collection('drivers')
        .where('workspaceId', '==', workspaceId)
        .where('tenantId', '==', tenantId)
        .where('vehiclePlate', '==', plate.toString().trim());

      const snapshot = await query.get();
      
      // Si hay resultados y no estamos excluyendo ningún ID, la placa existe
      if (snapshot.size > 0) {
        // Si estamos excluyendo un ID (para actualizaciones), verificar que no sea ese
        if (excludeId) {
          const exists = snapshot.docs.some(doc => doc.id !== excludeId);
          return exists;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error verificando existencia de placa:', error);
      throw error;
    }
  }
}

module.exports = Driver;
