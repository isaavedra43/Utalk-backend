const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Modelo de Nómina General - Gestión masiva de nóminas
 * Maneja la nómina de toda la plantilla en un período específico
 * Se integra automáticamente con nóminas individuales
 */
class GeneralPayroll {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.folio = data.folio || null; // Se genera al cerrar
    
    // Información del período
    this.period = {
      startDate: data.period?.startDate || data.startDate || '',
      endDate: data.period?.endDate || data.endDate || '',
      frequency: data.period?.frequency || data.frequency || 'monthly'
    };
    
    // Estado de la nómina general
    this.status = data.status || 'draft'; // 'draft' | 'calculated' | 'approved' | 'closed' | 'cancelled'
    
    // Lista de empleados incluidos
    this.employees = data.employees || [];
    
    // Totales calculados
    this.totals = {
      totalEmployees: data.totals?.totalEmployees || 0,
      totalGrossSalary: data.totals?.totalGrossSalary || 0,
      totalDeductions: data.totals?.totalDeductions || 0,
      totalNetSalary: data.totals?.totalNetSalary || 0,
      totalOvertime: data.totals?.totalOvertime || 0,
      totalBonuses: data.totals?.totalBonuses || 0,
      totalTaxes: data.totals?.totalTaxes || 0,
      averageSalary: data.totals?.averageSalary || 0
    };
    
    // Metadatos de creación y aprobación
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.approvedBy = data.approvedBy || null;
    this.approvedAt = data.approvedAt || null;
    this.closedBy = data.closedBy || null;
    this.closedAt = data.closedAt || null;
    
    // Configuración de impuestos
    this.taxesConfiguration = data.taxesConfiguration || {
      globalTaxesEnabled: false, // Por defecto SIN impuestos
      employeeOverrides: {}, // Overrides individuales por empleado
      updatedAt: null,
      updatedBy: null
    };
    
    // Notas adicionales
    this.notes = data.notes || '';
  }

  /**
   * Validar datos de la nómina general
   */
  validate() {
    const errors = [];

    if (!this.period.startDate) {
      errors.push('La fecha de inicio del período es requerida');
    }

    if (!this.period.endDate) {
      errors.push('La fecha de fin del período es requerida');
    }

    if (this.period.startDate && this.period.endDate) {
      const startDate = new Date(this.period.startDate);
      const endDate = new Date(this.period.endDate);
      
      if (startDate >= endDate) {
        errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
      }
    }

    const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(this.period.frequency)) {
      errors.push('Frecuencia inválida');
    }

    const validStatuses = ['draft', 'calculated', 'approved', 'closed', 'cancelled'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Estado inválido');
    }

    if (!this.createdBy) {
      errors.push('El campo createdBy es requerido');
    }

    return errors;
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      folio: this.folio,
      period: this.period,
      status: this.status,
      employees: this.employees,
      totals: this.totals,
      taxesConfiguration: this.taxesConfiguration,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      closedBy: this.closedBy,
      closedAt: this.closedAt,
      notes: this.notes
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new GeneralPayroll({
      id: doc.id,
      ...data
    });
  }

  /**
   * Guardar en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      await db.collection('generalPayrolls').doc(this.id).set(this.toFirestore());
      
      logger.info('✅ Nómina general guardada', {
        id: this.id,
        folio: this.folio,
        status: this.status,
        period: this.period,
        totalEmployees: this.totals.totalEmployees
      });
      
      return this;
    } catch (error) {
      logger.error('❌ Error guardando nómina general', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('generalPayrolls').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return GeneralPayroll.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando nómina general por ID', error);
      throw error;
    }
  }

  /**
   * Buscar nómina general por período
   */
  static async findByPeriod(startDate, endDate) {
    try {
      const snapshot = await db.collection('generalPayrolls')
        .where('period.startDate', '==', startDate)
        .where('period.endDate', '==', endDate)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return GeneralPayroll.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      logger.error('❌ Error buscando nómina general por período', error);
      throw error;
    }
  }

  /**
   * Listar nóminas generales con filtros
   */
  static async list(options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        status = null,
        year = null,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = options;

      let query = db.collection('generalPayrolls');

      // Filtrar por estado
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }

      // Filtrar por año
      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query
          .where('period.startDate', '>=', startOfYear)
          .where('period.startDate', '<=', endOfYear);
      }

      // Ordenar
      query = query.orderBy(orderBy, orderDirection);

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const snapshot = await query.get();
      const payrolls = snapshot.docs.map(doc => GeneralPayroll.fromFirestore(doc));

      // Contar total para paginación
      let totalQuery = db.collection('generalPayrolls');
      if (status && status !== 'all') {
        totalQuery = totalQuery.where('status', '==', status);
      }
      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        totalQuery = totalQuery
          .where('period.startDate', '>=', startOfYear)
          .where('period.startDate', '<=', endOfYear);
      }

      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        payrolls,
        pagination: {
          total,
          limit,
          offset,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('❌ Error listando nóminas generales', error);
      throw error;
    }
  }

  /**
   * Calcular totales a partir de empleados
   */
  calculateTotals() {
    if (!this.employees || this.employees.length === 0) {
      this.totals = {
        totalEmployees: 0,
        totalGrossSalary: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        totalOvertime: 0,
        totalBonuses: 0,
        totalTaxes: 0,
        averageSalary: 0
      };
      return this.totals;
    }

    const totals = this.employees.reduce((acc, emp) => {
      // Función auxiliar para convertir a número seguro
      const toNumber = (value) => {
        if (typeof value === 'number') return isNaN(value) ? 0 : value;
        if (typeof value === 'string') {
          const num = parseFloat(value);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      // Asegurar que todos los valores sean números válidos
      acc.totalGrossSalary += toNumber(emp.grossSalary);
      acc.totalDeductions += toNumber(emp.deductions);
      acc.totalNetSalary += toNumber(emp.netSalary);
      acc.totalOvertime += toNumber(emp.overtime);
      acc.totalBonuses += toNumber(emp.bonuses);
      acc.totalTaxes += toNumber(emp.taxes);
      return acc;
    }, {
      totalGrossSalary: 0,
      totalDeductions: 0,
      totalNetSalary: 0,
      totalOvertime: 0,
      totalBonuses: 0,
      totalTaxes: 0
    });

    this.totals = {
      totalEmployees: this.employees.length,
      ...totals,
      averageSalary: this.employees.length > 0 ? totals.totalNetSalary / this.employees.length : 0
    };

    return this.totals;
  }

  /**
   * Generar número de folio único
   */
  generateFolio() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    this.folio = `NOM-${year}${month}-${timestamp}`;
    return this.folio;
  }

  /**
   * Cambiar estado de la nómina
   */
  async changeStatus(newStatus, userId, reason = '') {
    try {
      const validTransitions = {
        'draft': ['calculated', 'cancelled'],
        'calculated': ['approved', 'draft', 'cancelled'],
        'approved': ['closed'],
        'closed': [], // Estado final
        'cancelled': [] // Estado final
      };

      if (!validTransitions[this.status].includes(newStatus)) {
        throw new Error(`Transición inválida de ${this.status} a ${newStatus}`);
      }

      const oldStatus = this.status;
      this.status = newStatus;

      // Actualizar campos según el nuevo estado
      switch (newStatus) {
        case 'approved':
          this.approvedBy = userId;
          this.approvedAt = new Date().toISOString();
          break;
        case 'closed':
          if (!this.folio) {
            this.generateFolio();
          }
          this.closedBy = userId;
          this.closedAt = new Date().toISOString();
          break;
      }

      await this.save();

      logger.info('✅ Estado de nómina general cambiado', {
        id: this.id,
        oldStatus,
        newStatus,
        userId,
        reason
      });

      return this;
    } catch (error) {
      logger.error('❌ Error cambiando estado de nómina general', error);
      throw error;
    }
  }

  /**
   * Eliminar nómina general
   */
  async delete() {
    try {
      if (this.status === 'closed') {
        throw new Error('No se puede eliminar una nómina general cerrada');
      }

      await db.collection('generalPayrolls').doc(this.id).delete();

      logger.info('✅ Nómina general eliminada', {
        id: this.id,
        folio: this.folio,
        status: this.status
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando nómina general', error);
      throw error;
    }
  }
}

module.exports = GeneralPayroll;
