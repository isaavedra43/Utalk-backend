const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const logger = require('../utils/logger');

/**
 * Modelo para movimientos de extras (horas extra, ausencias, préstamos, bonos, deducciones)
 * NO incluye lógica de nómina individual
 */
class ExtrasMovement {
  constructor(data = {}) {
    this.id = data.id;
    this.employeeId = data.employeeId;
    this.type = data.type; // 'overtime', 'absence', 'loan', 'bonus', 'deduction'
    this.subtype = data.subtype;
    this.description = data.description;
    this.amount = data.amount;
    this.quantity = data.quantity; // horas, días, etc.
    this.unit = data.unit; // 'hours', 'days', 'currency'
    this.rate = data.rate; // tarifa por hora, porcentaje, etc.
    this.date = data.date;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status || 'pending'; // 'pending', 'approved', 'rejected', 'paid'
    this.approvedBy = data.approvedBy;
    this.rejectedBy = data.rejectedBy;
    this.approvalDate = data.approvalDate;
    this.rejectionDate = data.rejectionDate;
    this.rejectionReason = data.rejectionReason;
    this.approvalComments = data.approvalComments;
    this.registeredBy = data.registeredBy;
    this.attachments = data.attachments || [];
    this.notes = data.notes;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Guardar movimiento en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('extrasMovements').doc();
      this.id = docRef.id;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();

      await docRef.set({
        ...this,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      });

      logger.info('ExtrasMovement guardado', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type,
        amount: this.amount
      });

      return this;
    } catch (error) {
      logger.error('Error guardando ExtrasMovement:', error);
      throw error;
    }
  }

  /**
   * Actualizar movimiento
   */
  async update(updateData) {
    try {
      this.updatedAt = new Date().toISOString();
      
      await db.collection('extrasMovements').doc(this.id).update({
        ...updateData,
        updatedAt: this.updatedAt
      });

      // Actualizar propiedades locales
      Object.assign(this, updateData);

      logger.info('ExtrasMovement actualizado', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando ExtrasMovement:', error);
      throw error;
    }
  }

  /**
   * Eliminar movimiento
   */
  async delete() {
    try {
      await db.collection('extrasMovements').doc(this.id).delete();
      
      logger.info('ExtrasMovement eliminado', {
        id: this.id,
        employeeId: this.employeeId
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando ExtrasMovement:', error);
      throw error;
    }
  }

  /**
   * Calcular monto automáticamente basado en el tipo
   */
  async calculateAmount(employee) {
    switch (this.type) {
      case 'overtime':
        if (this.quantity && this.rate) {
          this.amount = this.quantity * this.rate;
        }
        break;
      
      case 'absence':
        // Para ausencias, el monto se calcula como deducción
        if (employee.salary && employee.salary.baseSalary) {
          const dailySalary = employee.salary.baseSalary / 30; // Aproximación mensual
          this.amount = dailySalary * this.quantity;
        }
        break;
      
      case 'loan':
        // Los préstamos ya tienen el monto definido
        break;
      
      case 'bonus':
      case 'deduction':
        // Bonos y deducciones ya tienen el monto definido
        break;
      
      default:
        logger.warn('Tipo de movimiento no reconocido para cálculo automático:', this.type);
    }
  }

  /**
   * Buscar movimientos por empleado
   */
  static async findByEmployee(employeeId, filters = {}) {
    try {
      let query = db.collection('extrasMovements')
        .where('employeeId', '==', employeeId);

      // Aplicar filtros
      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }
      
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      
      if (filters.startDate) {
        query = query.where('date', '>=', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.where('date', '<=', filters.endDate);
      }

      const snapshot = await query.orderBy('date', 'desc').get();
      const movements = [];

      snapshot.forEach(doc => {
        movements.push(new ExtrasMovement({
          id: doc.id,
          ...doc.data()
        }));
      });

      return movements;
    } catch (error) {
      logger.error('Error buscando movimientos por empleado:', error);
      throw error;
    }
  }

  /**
   * Buscar movimiento por ID
   */
  static async findById(employeeId, movementId) {
    try {
      const doc = await db.collection('extrasMovements').doc(movementId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      
      // Verificar que pertenece al empleado
      if (data.employeeId !== employeeId) {
        throw new Error('Movimiento no pertenece al empleado especificado');
      }

      return new ExtrasMovement({
        id: doc.id,
        ...data
      });
    } catch (error) {
      logger.error('Error buscando movimiento por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de movimientos
   */
  static async getMovementStats(employeeId, startDate, endDate) {
    try {
      const movements = await this.findByEmployee(employeeId, {
        startDate,
        endDate
      });

      const stats = {
        totalMovements: movements.length,
        byType: {},
        byStatus: {},
        totalAmount: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0
      };

      movements.forEach(movement => {
        // Por tipo
        if (!stats.byType[movement.type]) {
          stats.byType[movement.type] = {
            count: 0,
            totalAmount: 0
          };
        }
        stats.byType[movement.type].count++;
        stats.byType[movement.type].totalAmount += movement.amount || 0;

        // Por estado
        if (!stats.byStatus[movement.status]) {
          stats.byStatus[movement.status] = 0;
        }
        stats.byStatus[movement.status]++;

        // Totales
        stats.totalAmount += movement.amount || 0;

        if (movement.status === 'pending') stats.pendingCount++;
        if (movement.status === 'approved') stats.approvedCount++;
        if (movement.status === 'rejected') stats.rejectedCount++;
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de movimientos:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos pendientes por múltiples empleados
   */
  static async findPendingByEmployees(employeeIds) {
    try {
      const movements = [];
      
      for (const employeeId of employeeIds) {
        const employeeMovements = await this.findByEmployee(employeeId, {
          status: 'pending'
        });
        movements.push(...employeeMovements);
      }

      return movements;
    } catch (error) {
      logger.error('Error buscando movimientos pendientes por empleados:', error);
      throw error;
    }
  }

  /**
   * Calcular impacto neto en nómina
   */
  static async calculatePayrollImpact(employeeId, periodStart, periodEnd) {
    try {
      const movements = await this.findByEmployee(employeeId, {
        startDate: periodStart,
        endDate: periodEnd,
        status: 'approved'
      });

      let totalToAdd = 0;
      let totalToSubtract = 0;

      movements.forEach(movement => {
        switch (movement.type) {
          case 'overtime':
          case 'bonus':
            totalToAdd += movement.amount || 0;
            break;
          case 'absence':
          case 'deduction':
            totalToSubtract += movement.amount || 0;
            break;
          case 'loan':
            // Los préstamos no afectan directamente la nómina
            break;
        }
      });

      return {
        totalToAdd,
        totalToSubtract,
        netImpact: totalToAdd - totalToSubtract,
        movementsCount: movements.length
      };
    } catch (error) {
      logger.error('Error calculando impacto en nómina:', error);
      throw error;
    }
  }
}

module.exports = ExtrasMovement;
