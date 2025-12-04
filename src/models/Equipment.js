const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Equipo
 * Gestiona los equipos y herramientas asignados a empleados
 * Alineado 100% con especificaciones del Frontend
 */
class Equipment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.name = data.name || '';
    this.category = data.category || 'other';
    this.brand = data.brand || null;
    this.model = data.model || null;
    this.serialNumber = data.serialNumber || null;
    this.description = data.description || '';
    this.condition = data.condition || 'good';
    this.purchaseDate = data.purchaseDate || new Date().toISOString().split('T')[0];
    this.purchasePrice = data.purchasePrice || 0;
    this.currentValue = data.currentValue || 0;
    this.currency = data.currency || 'MXN';
    this.assignedDate = data.assignedDate || new Date().toISOString().split('T')[0];
    this.returnDate = data.returnDate || null;
    this.status = data.status || 'assigned';
    this.location = data.location || null;
    
    // Información de factura
    this.invoice = {
      number: data.invoice?.number || '',
      date: data.invoice?.date || new Date().toISOString().split('T')[0],
      supplier: data.invoice?.supplier || '',
      amount: data.invoice?.amount || 0,
      attachments: data.invoice?.attachments || []
    };
    
    this.photos = data.photos || [];
    this.responsibilityDocument = data.responsibilityDocument || null;
    
    // Información de garantía
    this.warranty = {
      hasWarranty: data.warranty?.hasWarranty || false,
      expirationDate: data.warranty?.expirationDate || null,
      provider: data.warranty?.provider || null,
      document: data.warranty?.document || null
    };
    
    // Información de seguro
    this.insurance = {
      hasInsurance: data.insurance?.hasInsurance || false,
      policyNumber: data.insurance?.policyNumber || null,
      provider: data.insurance?.provider || null,
      expirationDate: data.insurance?.expirationDate || null
    };
    
    this.notes = data.notes || null;
    this.tags = data.tags || [];
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos del equipo
   */
  validate() {
    const errors = [];

    // Validaciones obligatorias
    if (!this.name.trim()) {
      errors.push('El nombre del equipo es requerido');
    }

    if (!this.description.trim()) {
      errors.push('La descripción es requerida');
    }

    if (!this.purchaseDate) {
      errors.push('La fecha de compra es requerida');
    }

    if (this.purchasePrice <= 0) {
      errors.push('El precio de compra debe ser mayor a 0');
    }

    if (this.currentValue < 0) {
      errors.push('El valor actual debe ser mayor o igual a 0');
    }

    if (!this.assignedDate) {
      errors.push('La fecha de asignación es requerida');
    }

    if (!this.invoice.number.trim()) {
      errors.push('El número de factura es requerido');
    }

    if (!this.invoice.supplier.trim()) {
      errors.push('El proveedor es requerido');
    }

    // Validaciones de negocio
    if (this.currentValue > this.purchasePrice) {
      errors.push('El valor actual no puede ser mayor al precio de compra');
    }

    // Validar formato de fecha de compra
    if (this.purchaseDate) {
      const purchaseDate = new Date(this.purchaseDate);
      if (isNaN(purchaseDate.getTime())) {
        errors.push('La fecha de compra no tiene un formato válido');
      }
    }

    // Validar formato de fecha de asignación
    if (this.assignedDate) {
      const assignedDate = new Date(this.assignedDate);
      if (isNaN(assignedDate.getTime())) {
        errors.push('La fecha de asignación no tiene un formato válido');
      }
    }

    // Validar que la fecha de asignación no sea anterior a la de compra
    if (this.purchaseDate && this.assignedDate) {
      const purchaseDate = new Date(this.purchaseDate);
      const assignedDate = new Date(this.assignedDate);
      if (assignedDate < purchaseDate) {
        errors.push('La fecha de asignación no puede ser anterior a la fecha de compra');
      }
    }

    // Validar garantía
    if (this.warranty.hasWarranty && !this.warranty.expirationDate) {
      errors.push('La fecha de vencimiento de garantía es requerida');
    }

    if (this.warranty.expirationDate) {
      const warrantyDate = new Date(this.warranty.expirationDate);
      if (isNaN(warrantyDate.getTime())) {
        errors.push('La fecha de vencimiento de garantía no tiene un formato válido');
      }
    }

    // Validar seguro
    if (this.insurance.hasInsurance && !this.insurance.expirationDate) {
      errors.push('La fecha de vencimiento del seguro es requerida');
    }

    if (this.insurance.expirationDate) {
      const insuranceDate = new Date(this.insurance.expirationDate);
      if (isNaN(insuranceDate.getTime())) {
        errors.push('La fecha de vencimiento del seguro no tiene un formato válido');
      }
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      name: this.name,
      category: this.category,
      brand: this.brand,
      model: this.model,
      serialNumber: this.serialNumber,
      description: this.description,
      condition: this.condition,
      purchaseDate: this.purchaseDate,
      purchasePrice: this.purchasePrice,
      currentValue: this.currentValue,
      currency: this.currency,
      assignedDate: this.assignedDate,
      returnDate: this.returnDate,
      status: this.status,
      location: this.location,
      invoice: this.invoice,
      photos: this.photos,
      responsibilityDocument: this.responsibilityDocument,
      warranty: this.warranty,
      insurance: this.insurance,
      notes: this.notes,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un equipo desde datos de Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new Equipment({
      id: doc.id,
      ...data
    });
  }

  /**
   * Guarda el equipo en Firebase
   */
  async save() {
    try {
      const equipmentRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.id);

      await equipmentRef.set(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al guardar equipo: ${error.message}`);
    }
  }

  /**
   * Actualiza el equipo en Firebase
   */
  async update(data) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.id);

      // Actualizar campos
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();

      await equipmentRef.update(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al actualizar equipo: ${error.message}`);
    }
  }

  /**
   * Busca un equipo por ID
   */
  static async findById(employeeId, id) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(id);

      const doc = await equipmentRef.get();
      if (!doc.exists) {
        return null;
      }

      return Equipment.fromFirestore(doc);
    } catch (error) {
      throw new Error(`Error al buscar equipo: ${error.message}`);
    }
  }

  /**
   * Lista equipos de un empleado con filtros
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      let query = db.collection('employees')
        .doc(employeeId)
        .collection('equipment');

      // Aplicar filtros
      if (options.category) {
        query = query.where('category', '==', options.category);
      }

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      if (options.condition) {
        query = query.where('condition', '==', options.condition);
      }

      // Ordenamiento
      const orderBy = options.orderBy || 'assignedDate';
      const orderDirection = options.orderDirection || 'desc';
      query = query.orderBy(orderBy, orderDirection);

      // Paginación
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      const snapshot = await query.get();
      const equipment = [];

      snapshot.forEach(doc => {
        equipment.push(Equipment.fromFirestore(doc));
      });

      return equipment;
    } catch (error) {
      throw new Error(`Error al listar equipos: ${error.message}`);
    }
  }

  /**
   * Devuelve el equipo
   */
  async return(returnDate, condition, notes = null, photos = []) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.id);

      this.returnDate = returnDate;
      this.condition = condition;
      this.status = 'returned';
      this.notes = notes;
      this.updatedAt = new Date().toISOString();

      if (photos.length > 0) {
        this.photos = [...this.photos, ...photos];
      }

      await equipmentRef.update(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al devolver equipo: ${error.message}`);
    }
  }

  /**
   * Reporta el equipo como perdido
   */
  async reportLost(lostDate, description, policeReportNumber = null) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.id);

      this.status = 'lost';
      this.notes = description;
      this.updatedAt = new Date().toISOString();

      await equipmentRef.update(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al reportar equipo perdido: ${error.message}`);
    }
  }

  /**
   * Reporta daño en el equipo
   */
  async reportDamage(description, severity, photos = [], estimatedCost = null) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.id);

      this.condition = severity;
      this.status = 'damaged';
      this.notes = description;
      this.updatedAt = new Date().toISOString();

      if (photos.length > 0) {
        this.photos = [...this.photos, ...photos];
      }

      await equipmentRef.update(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al reportar daño: ${error.message}`);
    }
  }

  /**
   * Elimina el equipo
   */
  static async delete(employeeId, id) {
    try {
      const equipmentRef = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(id);

      await equipmentRef.delete();
      return true;
    } catch (error) {
      throw new Error(`Error al eliminar equipo: ${error.message}`);
    }
  }

  /**
   * Calcula la depreciación del equipo
   */
  calculateDepreciation() {
    const purchaseDate = new Date(this.purchaseDate);
    const currentDate = new Date();
    const yearsDiff = (currentDate - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

    // Depreciación lineal del 20% anual
    const depreciationRate = 0.20;
    const totalDepreciation = Math.min(yearsDiff * depreciationRate, 1);
    const depreciatedValue = this.purchasePrice * (1 - totalDepreciation);

    return {
      yearsInUse: Math.round(yearsDiff * 10) / 10,
      depreciationRate: depreciationRate,
      totalDepreciation: Math.round(totalDepreciation * 100),
      depreciatedValue: Math.round(depreciatedValue * 100) / 100,
      currentValue: this.currentValue
    };
  }

  /**
   * Verifica si la garantía está por vencer (30 días)
   */
  isWarrantyExpiringSoon() {
    if (!this.warranty.hasWarranty || !this.warranty.expirationDate) {
      return false;
    }

    const expirationDate = new Date(this.warranty.expirationDate);
    const currentDate = new Date();
    const daysUntilExpiration = (expirationDate - currentDate) / (1000 * 60 * 60 * 24);

    return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  }

  /**
   * Verifica si el seguro está por vencer (30 días)
   */
  isInsuranceExpiringSoon() {
    if (!this.insurance.hasInsurance || !this.insurance.expirationDate) {
      return false;
    }

    const expirationDate = new Date(this.insurance.expirationDate);
    const currentDate = new Date();
    const daysUntilExpiration = (expirationDate - currentDate) / (1000 * 60 * 60 * 24);

    return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  }
}

module.exports = Equipment;
