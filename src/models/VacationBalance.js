const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const VacationRequest = require('./VacationRequest');

/**
 * Modelo de Balance de Vacaciones
 * Gestiona el saldo de días de vacaciones por empleado
 */
class VacationBalance {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.year = data.year || new Date().getFullYear();
    this.totalDays = data.totalDays || 0;
    this.usedDays = data.usedDays || 0;
    this.pendingDays = data.pendingDays || 0;
    this.availableDays = data.availableDays || 0;
    this.carriedOverDays = data.carriedOverDays || 0;
    this.expiresAt = data.expiresAt || `${this.year}-12-31`;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Calcula automáticamente los días disponibles
   */
  calculateAvailableDays() {
    this.availableDays = this.totalDays + this.carriedOverDays - this.usedDays - this.pendingDays;
    this.availableDays = Math.max(0, this.availableDays); // No puede ser negativo
  }

  /**
   * Actualiza los días usados y pendientes basado en las solicitudes
   */
  async updateFromRequests() {
    try {
      const requests = await VacationRequest.listByEmployee(this.employeeId, {
        year: this.year
      });

      this.usedDays = 0;
      this.pendingDays = 0;

      requests.forEach(request => {
        if (request.status === 'approved') {
          this.usedDays += request.totalDays;
        } else if (request.status === 'pending') {
          this.pendingDays += request.totalDays;
        }
      });

      this.calculateAvailableDays();
    } catch (error) {
      console.error('Error updating balance from requests:', error);
      throw error;
    }
  }

  /**
   * Calcula días de vacaciones según la antigüedad del empleado
   */
  static calculateVacationDays(startDate, currentYear) {
    const start = new Date(startDate);
    const yearEnd = new Date(`${currentYear}-12-31`);
    
    // Calcular años de antigüedad al final del año
    const yearsOfService = yearEnd.getFullYear() - start.getFullYear();
    
    // Tabla de vacaciones según la Ley Federal del Trabajo (México)
    let vacationDays = 6; // Mínimo legal
    
    if (yearsOfService >= 1) vacationDays = 6;
    if (yearsOfService >= 2) vacationDays = 8;
    if (yearsOfService >= 3) vacationDays = 10;
    if (yearsOfService >= 4) vacationDays = 12;
    if (yearsOfService >= 5) vacationDays = 14;
    if (yearsOfService >= 6) vacationDays = 16;
    if (yearsOfService >= 7) vacationDays = 18;
    if (yearsOfService >= 8) vacationDays = 20;
    if (yearsOfService >= 9) vacationDays = 22;
    if (yearsOfService >= 10) vacationDays = 24;
    
    // A partir de 10 años, 2 días adicionales cada 5 años
    if (yearsOfService > 10) {
      const additionalPeriods = Math.floor((yearsOfService - 10) / 5);
      vacationDays += additionalPeriods * 2;
    }
    
    return vacationDays;
  }

  /**
   * Valida los datos del balance
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.year || this.year < 1900 || this.year > 2100) {
      errors.push('El año debe ser válido');
    }

    if (this.totalDays < 0) {
      errors.push('Los días totales no pueden ser negativos');
    }

    if (this.usedDays < 0) {
      errors.push('Los días usados no pueden ser negativos');
    }

    if (this.pendingDays < 0) {
      errors.push('Los días pendientes no pueden ser negativos');
    }

    if (this.carriedOverDays < 0) {
      errors.push('Los días acumulados no pueden ser negativos');
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
      year: this.year,
      totalDays: this.totalDays,
      usedDays: this.usedDays,
      pendingDays: this.pendingDays,
      availableDays: this.availableDays,
      carriedOverDays: this.carriedOverDays,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un balance desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new VacationBalance({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el balance en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.calculateAvailableDays();
      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacationBalances').doc(this.year.toString());
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving vacation balance:', error);
      throw error;
    }
  }

  /**
   * Actualiza el balance
   */
  async update(data) {
    try {
      Object.assign(this, data);
      this.calculateAvailableDays();
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacationBalances').doc(this.year.toString());
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating vacation balance:', error);
      throw error;
    }
  }

  /**
   * Busca un balance por empleado y año
   */
  static async findByEmployeeAndYear(employeeId, year) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('vacationBalances').doc(year.toString()).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return VacationBalance.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding vacation balance:', error);
      throw error;
    }
  }

  /**
   * Obtiene o crea el balance actual de un empleado
   */
  static async getOrCreateCurrent(employeeId, employeeStartDate) {
    try {
      const currentYear = new Date().getFullYear();
      let balance = await VacationBalance.findByEmployeeAndYear(employeeId, currentYear);
      
      if (!balance) {
        // Crear nuevo balance
        const totalDays = VacationBalance.calculateVacationDays(employeeStartDate, currentYear);
        
        // Verificar si hay días del año anterior que se pueden acumular
        let carriedOverDays = 0;
        const previousBalance = await VacationBalance.findByEmployeeAndYear(employeeId, currentYear - 1);
        
        if (previousBalance && previousBalance.availableDays > 0) {
          // Permitir acumular hasta un máximo (ej: 6 días)
          carriedOverDays = Math.min(previousBalance.availableDays, 6);
        }
        
        balance = new VacationBalance({
          employeeId,
          year: currentYear,
          totalDays,
          carriedOverDays,
          expiresAt: `${currentYear}-12-31`
        });
        
        await balance.updateFromRequests();
        await balance.save();
      } else {
        // Actualizar balance existente
        await balance.updateFromRequests();
        await balance.update({});
      }
      
      return balance;
    } catch (error) {
      console.error('Error getting or creating vacation balance:', error);
      throw error;
    }
  }

  /**
   * Lista balances de un empleado
   */
  static async listByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('vacationBalances')
        .orderBy('year', 'desc')
        .get();

      const balances = [];
      snapshot.forEach(doc => {
        balances.push(VacationBalance.fromFirestore(doc));
      });

      return balances;
    } catch (error) {
      console.error('Error listing vacation balances:', error);
      throw error;
    }
  }

  /**
   * Verifica si un empleado tiene suficientes días disponibles
   */
  async hasSufficientDays(requestedDays) {
    await this.updateFromRequests();
    return this.availableDays >= requestedDays;
  }

  /**
   * Reserva días para una solicitud pendiente
   */
  async reserveDays(days) {
    try {
      if (!await this.hasSufficientDays(days)) {
        throw new Error('No hay suficientes días de vacaciones disponibles');
      }
      
      this.pendingDays += days;
      this.calculateAvailableDays();
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error reserving vacation days:', error);
      throw error;
    }
  }

  /**
   * Confirma el uso de días (cuando se aprueba una solicitud)
   */
  async confirmDaysUsage(days) {
    try {
      this.pendingDays = Math.max(0, this.pendingDays - days);
      this.usedDays += days;
      this.calculateAvailableDays();
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error confirming days usage:', error);
      throw error;
    }
  }

  /**
   * Libera días reservados (cuando se rechaza o cancela una solicitud)
   */
  async releaseDays(days) {
    try {
      this.pendingDays = Math.max(0, this.pendingDays - days);
      this.calculateAvailableDays();
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error releasing vacation days:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de vacaciones para dashboard
   */
  static async getSummary(employeeId) {
    try {
      const currentYear = new Date().getFullYear();
      const balance = await VacationBalance.getOrCreateCurrent(employeeId, null);
      
      const requests = await VacationRequest.listByEmployee(employeeId, {
        year: currentYear
      });

      const upcomingVacations = await VacationRequest.getUpcomingVacations(employeeId);
      
      return {
        balance: balance,
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        approvedRequests: requests.filter(r => r.status === 'approved').length,
        upcomingVacations: upcomingVacations,
        lastVacation: requests.find(r => r.status === 'approved' && new Date(r.endDate) < new Date())
      };
    } catch (error) {
      console.error('Error getting vacation summary:', error);
      throw error;
    }
  }
}

module.exports = VacationBalance;
