const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Modelo para períodos de nómina masiva
 * Gestiona períodos que incluyen múltiples empleados
 */
class PayrollPeriod {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name; // Ej: "Septiembre 2025"
    this.startDate = data.startDate; // Fecha inicio del período
    this.endDate = data.endDate; // Fecha fin del período
    this.frequency = data.frequency; // weekly, biweekly, monthly
    this.status = data.status || 'draft'; // draft, calculated, approved, paid, closed
    
    // Configuraciones del período
    this.configurations = {
      calculateTaxes: data.configurations?.calculateTaxes !== undefined ? data.configurations.calculateTaxes : true,
      includeOvertime: data.configurations?.includeOvertime !== undefined ? data.configurations.includeOvertime : true,
      applyAbsenceDeductions: data.configurations?.applyAbsenceDeductions !== undefined ? data.configurations.applyAbsenceDeductions : true,
      includeLoans: data.configurations?.includeLoans !== undefined ? data.configurations.includeLoans : true,
      ...data.configurations
    };
    
    // Resumen del período
    this.summary = {
      totalEmployees: data.summary?.totalEmployees || 0,
      totalPayroll: data.summary?.totalPayroll || 0,
      totalPerceptions: data.summary?.totalPerceptions || 0,
      totalDeductions: data.summary?.totalDeductions || 0,
      averageSalary: data.summary?.averageSalary || 0,
      employeesProcessed: data.summary?.employeesProcessed || 0,
      employeesPending: data.summary?.employeesPending || 0,
      employeesApproved: data.summary?.employeesApproved || 0,
      employeesPaid: data.summary?.employeesPaid || 0,
      ...data.summary
    };
    
    // Metadatos
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.processedAt = data.processedAt || null;
    this.approvedAt = data.approvedAt || null;
    this.paidAt = data.paidAt || null;
    this.closedAt = data.closedAt || null;
  }

  /**
   * Guardar período en Firestore
   */
  async save() {
    try {
      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll_periods').doc(this.id);
      
      const data = {
        id: this.id,
        name: this.name,
        startDate: this.startDate,
        endDate: this.endDate,
        frequency: this.frequency,
        status: this.status,
        configurations: this.configurations,
        summary: this.summary,
        createdBy: this.createdBy,
        createdAt: this.createdAt,
        updatedAt: new Date().toISOString(),
        processedAt: this.processedAt,
        approvedAt: this.approvedAt,
        paidAt: this.paidAt,
        closedAt: this.closedAt
      };

      await docRef.set(data);

      logger.info('✅ Período de nómina guardado', {
        periodId: this.id,
        name: this.name,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('❌ Error guardando período de nómina', error);
      throw error;
    }
  }

  /**
   * Actualizar resumen del período
   */
  async updateSummary(summaryData) {
    try {
      this.summary = { ...this.summary, ...summaryData };
      this.updatedAt = new Date().toISOString();

      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll_periods').doc(this.id);
      
      await docRef.update({
        summary: this.summary,
        updatedAt: this.updatedAt
      });

      logger.info('✅ Resumen de período actualizado', {
        periodId: this.id,
        summary: this.summary
      });

      return this;
    } catch (error) {
      logger.error('❌ Error actualizando resumen de período', error);
      throw error;
    }
  }

  /**
   * Cambiar estado del período
   */
  async updateStatus(newStatus) {
    try {
      const oldStatus = this.status;
      this.status = newStatus;
      this.updatedAt = new Date().toISOString();

      // Actualizar timestamps específicos
      const now = new Date().toISOString();
      switch (newStatus) {
        case 'calculated':
          this.processedAt = now;
          break;
        case 'approved':
          this.approvedAt = now;
          break;
        case 'paid':
          this.paidAt = now;
          break;
        case 'closed':
          this.closedAt = now;
          break;
      }

      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll_periods').doc(this.id);
      
      const updateData = {
        status: this.status,
        updatedAt: this.updatedAt
      };

      if (this.processedAt) updateData.processedAt = this.processedAt;
      if (this.approvedAt) updateData.approvedAt = this.approvedAt;
      if (this.paidAt) updateData.paidAt = this.paidAt;
      if (this.closedAt) updateData.closedAt = this.closedAt;

      await docRef.update(updateData);

      logger.info('✅ Estado de período actualizado', {
        periodId: this.id,
        oldStatus,
        newStatus,
        timestamp: now
      });

      return this;
    } catch (error) {
      logger.error('❌ Error actualizando estado de período', error);
      throw error;
    }
  }

  /**
   * Buscar período por ID
   */
  static async findById(periodId) {
    try {
      const { db } = require('../config/firebase');
      const doc = await db.collection('payroll_periods').doc(periodId).get();
      
      if (!doc.exists) {
        return null;
      }

      return new PayrollPeriod(doc.data());
    } catch (error) {
      logger.error('❌ Error buscando período por ID', error);
      throw error;
    }
  }

  /**
   * Obtener todos los períodos con paginación
   */
  static async findAll(options = {}) {
    try {
      const { 
        status, 
        frequency, 
        page = 1, 
        limit = 10, 
        orderBy = 'createdAt', 
        orderDirection = 'desc' 
      } = options;

      const { db } = require('../config/firebase');
      let query = db.collection('payroll_periods');

      // Aplicar filtros
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }
      if (frequency) {
        query = query.where('frequency', '==', frequency);
      }

      // Aplicar ordenamiento
      query = query.orderBy(orderBy, orderDirection);

      // Aplicar paginación
      const offset = (page - 1) * limit;
      query = query.offset(offset).limit(limit);

      const snapshot = await query.get();
      const periods = [];
      
      snapshot.forEach(doc => {
        periods.push(new PayrollPeriod(doc.data()));
      });

      logger.info('📋 Períodos de nómina obtenidos', {
        count: periods.length,
        filters: { status, frequency },
        pagination: { page, limit }
      });

      return periods;
    } catch (error) {
      logger.error('❌ Error obteniendo períodos de nómina', error);
      throw error;
    }
  }

  /**
   * Obtener período actual activo
   */
  static async findCurrent() {
    try {
      const { db } = require('../config/firebase');
      const snapshot = await db.collection('payroll_periods')
        .where('status', 'in', ['draft', 'calculated', 'approved'])
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return new PayrollPeriod(doc.data());
    } catch (error) {
      logger.error('❌ Error obteniendo período actual', error);
      throw error;
    }
  }

  /**
   * Validar si se puede crear un período con las fechas dadas
   */
  static async validatePeriodDates(startDate, endDate, excludeId = null) {
    try {
      const { db } = require('../config/firebase');
      let query = db.collection('payroll_periods')
        .where('status', '!=', 'closed');

      const snapshot = await query.get();
      
      const conflicts = [];
      snapshot.forEach(doc => {
        const period = doc.data();
        
        // Excluir el período actual si se está editando
        if (excludeId && period.id === excludeId) {
          return;
        }

        const periodStart = new Date(period.startDate);
        const periodEnd = new Date(period.endDate);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        // Verificar superposición
        if ((newStart <= periodEnd && newEnd >= periodStart)) {
          conflicts.push({
            id: period.id,
            name: period.name,
            startDate: period.startDate,
            endDate: period.endDate
          });
        }
      });

      return {
        isValid: conflicts.length === 0,
        conflicts
      };
    } catch (error) {
      logger.error('❌ Error validando fechas de período', error);
      throw error;
    }
  }

  /**
   * Eliminar período (solo si está en draft)
   */
  async delete() {
    try {
      if (this.status !== 'draft') {
        throw new Error('Solo se pueden eliminar períodos en borrador');
      }

      const { db } = require('../config/firebase');
      await db.collection('payroll_periods').doc(this.id).delete();

      logger.info('✅ Período de nómina eliminado', {
        periodId: this.id,
        name: this.name
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando período de nómina', error);
      throw error;
    }
  }

  /**
   * Obtener información básica del período
   */
  getBasicInfo() {
    return {
      id: this.id,
      name: this.name,
      startDate: this.startDate,
      endDate: this.endDate,
      frequency: this.frequency,
      status: this.status,
      summary: this.summary,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      processedAt: this.processedAt,
      approvedAt: this.approvedAt,
      paidAt: this.paidAt,
      closedAt: this.closedAt
    };
  }

  /**
   * Obtener información completa del período
   */
  getFullInfo() {
    return {
      id: this.id,
      name: this.name,
      startDate: this.startDate,
      endDate: this.endDate,
      frequency: this.frequency,
      status: this.status,
      configurations: this.configurations,
      summary: this.summary,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      processedAt: this.processedAt,
      approvedAt: this.approvedAt,
      paidAt: this.paidAt,
      closedAt: this.closedAt
    };
  }

  /**
   * Validar si el período puede ser procesado
   */
  canBeProcessed() {
    return this.status === 'draft';
  }

  /**
   * Validar si el período puede ser aprobado
   */
  canBeApproved() {
    return this.status === 'calculated';
  }

  /**
   * Validar si el período puede ser marcado como pagado
   */
  canBePaid() {
    return this.status === 'approved';
  }

  /**
   * Validar si el período puede ser cerrado
   */
  canBeClosed() {
    return this.status === 'paid';
  }
}

module.exports = PayrollPeriod;