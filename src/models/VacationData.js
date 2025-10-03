const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Datos de Vacaciones del Empleado
 * Documento principal: employees/{employeeId}/vacations/vacationData
 * Alineado 100% con especificaciones del Frontend
 */
class VacationData {
  constructor(data = {}) {
    this.employeeId = data.employeeId || '';
    this.employeeName = data.employeeName || '';
    this.position = data.position || '';
    this.department = data.department || '';
    this.hireDate = data.hireDate || '';
    
    // Balance de vacaciones
    this.balance = {
      total: data.balance?.total || 0,
      used: data.balance?.used || 0,
      available: data.balance?.available || 0,
      pending: data.balance?.pending || 0,
      expired: data.balance?.expired || 0,
      nextExpiration: data.balance?.nextExpiration || `${new Date().getFullYear()}-12-31`
    };
    
    // Política de vacaciones
    this.policy = {
      annualDays: data.policy?.annualDays || 12,
      accrualRate: data.policy?.accrualRate || 1.0,
      maxCarryover: data.policy?.maxCarryover || 5,
      probationPeriod: data.policy?.probationPeriod || 6,
      advanceRequest: data.policy?.advanceRequest || 30,
      blackoutPeriods: data.policy?.blackoutPeriods || []
    };
    
    // Resumen estadístico
    this.summary = {
      totalRequests: data.summary?.totalRequests || 0,
      approvedRequests: data.summary?.approvedRequests || 0,
      pendingRequests: data.summary?.pendingRequests || 0,
      rejectedRequests: data.summary?.rejectedRequests || 0,
      cancelledRequests: data.summary?.cancelledRequests || 0,
      totalDaysUsed: data.summary?.totalDaysUsed || 0,
      totalDaysPending: data.summary?.totalDaysPending || 0,
      averageDaysPerRequest: data.summary?.averageDaysPerRequest || 0,
      mostUsedMonth: data.summary?.mostUsedMonth || '',
      lastVacation: data.summary?.lastVacation || null,
      byType: data.summary?.byType || {
        vacation: 0,
        personal: 0,
        sick_leave: 0,
        maternity: 0,
        paternity: 0,
        compensatory: 0,
        unpaid: 0
      },
      byMonth: data.summary?.byMonth || {},
      upcomingVacations: data.summary?.upcomingVacations || []
    };
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Calcula balance disponible
   */
  calculateAvailableBalance() {
    this.balance.available = this.balance.total - this.balance.used - this.balance.pending;
    this.balance.available = Math.max(0, this.balance.available);
  }

  /**
   * Actualiza estadísticas desde solicitudes
   */
  async updateStatistics() {
    try {
      const requestsRef = db.collection('employees').doc(this.employeeId)
        .collection('vacations').doc('requests').collection('list');
      
      const snapshot = await requestsRef.get();
      
      // Reiniciar contadores
      this.summary.totalRequests = 0;
      this.summary.approvedRequests = 0;
      this.summary.pendingRequests = 0;
      this.summary.rejectedRequests = 0;
      this.summary.cancelledRequests = 0;
      this.summary.totalDaysUsed = 0;
      this.summary.totalDaysPending = 0;
      
      // Reiniciar contadores por tipo
      Object.keys(this.summary.byType).forEach(type => {
        this.summary.byType[type] = 0;
      });
      
      // Reiniciar contadores por mes
      this.summary.byMonth = {};
      
      let totalDaysForAverage = 0;
      let lastVacationDate = null;
      
      snapshot.forEach(doc => {
        const request = doc.data();
        this.summary.totalRequests++;
        
        // Contadores por estado
        if (request.status === 'approved') {
          this.summary.approvedRequests++;
          this.summary.totalDaysUsed += request.days || 0;
          
          // Última vacación
          if (!lastVacationDate || new Date(request.startDate) > new Date(lastVacationDate)) {
            lastVacationDate = request.startDate;
            this.summary.lastVacation = {
              id: request.id,
              startDate: request.startDate,
              endDate: request.endDate
            };
          }
        } else if (request.status === 'pending') {
          this.summary.pendingRequests++;
          this.summary.totalDaysPending += request.days || 0;
        } else if (request.status === 'rejected') {
          this.summary.rejectedRequests++;
        } else if (request.status === 'cancelled') {
          this.summary.cancelledRequests++;
        }
        
        // Por tipo
        if (request.type && this.summary.byType.hasOwnProperty(request.type)) {
          this.summary.byType[request.type] += request.days || 0;
        }
        
        // Por mes
        if (request.startDate) {
          const month = new Date(request.startDate).toLocaleString('es-ES', { month: 'long' });
          this.summary.byMonth[month] = (this.summary.byMonth[month] || 0) + (request.days || 0);
        }
        
        totalDaysForAverage += request.days || 0;
      });
      
      // Calcular promedio
      if (this.summary.totalRequests > 0) {
        this.summary.averageDaysPerRequest = parseFloat((totalDaysForAverage / this.summary.totalRequests).toFixed(2));
      }
      
      // Mes más usado
      let maxDays = 0;
      Object.entries(this.summary.byMonth).forEach(([month, days]) => {
        if (days > maxDays) {
          maxDays = days;
          this.summary.mostUsedMonth = month;
        }
      });
      
      // Actualizar balance
      this.balance.used = this.summary.totalDaysUsed;
      this.balance.pending = this.summary.totalDaysPending;
      this.calculateAvailableBalance();
      
    } catch (error) {
      console.error('Error updating vacation statistics:', error);
      throw error;
    }
  }

  /**
   * Convierte a objeto Firestore
   */
  toFirestore() {
    return {
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      position: this.position,
      department: this.department,
      hireDate: this.hireDate,
      balance: this.balance,
      policy: this.policy,
      summary: this.summary,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea desde Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    return new VacationData({ ...doc.data() });
  }

  /**
   * Guarda en Firebase
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacations').doc('vacationData');
      
      await docRef.set(this.toFirestore());
      
      return this;
    } catch (error) {
      console.error('Error saving vacation data:', error);
      throw error;
    }
  }

  /**
   * Busca por empleado
   */
  static async findByEmployee(employeeId) {
    try {
      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('vacationData');
      
      const doc = await docRef.get();
      
      return VacationData.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding vacation data:', error);
      throw error;
    }
  }

  /**
   * Obtiene o crea datos de vacaciones para un empleado
   */
  static async getOrCreate(employeeId, employeeData) {
    try {
      let vacationData = await VacationData.findByEmployee(employeeId);
      
      if (!vacationData) {
        // Calcular días según antigüedad
        const annualDays = VacationData.calculateAnnualDays(employeeData.hireDate);
        
        vacationData = new VacationData({
          employeeId,
          employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
          position: employeeData.position || '',
          department: employeeData.department || '',
          hireDate: employeeData.hireDate || new Date().toISOString(),
          balance: {
            total: annualDays,
            used: 0,
            available: annualDays,
            pending: 0,
            expired: 0,
            nextExpiration: `${new Date().getFullYear()}-12-31`
          },
          policy: {
            annualDays,
            accrualRate: annualDays / 12,
            maxCarryover: 5,
            probationPeriod: 6,
            advanceRequest: 30,
            blackoutPeriods: []
          }
        });
        
        await vacationData.save();
      }
      
      return vacationData;
    } catch (error) {
      console.error('Error getting or creating vacation data:', error);
      throw error;
    }
  }

  /**
   * Calcula días anuales según Ley Federal del Trabajo (México)
   */
  static calculateAnnualDays(hireDate) {
    const start = new Date(hireDate);
    const now = new Date();
    const yearsOfService = now.getFullYear() - start.getFullYear();
    
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
   * Reserva días para solicitud pendiente
   */
  async reserveDays(days) {
    if (this.balance.available < days) {
      throw new Error('No hay suficientes días disponibles');
    }
    
    this.balance.pending += days;
    this.calculateAvailableBalance();
    await this.save();
  }

  /**
   * Confirma uso de días (aprobación)
   */
  async confirmDays(days) {
    this.balance.pending = Math.max(0, this.balance.pending - days);
    this.balance.used += days;
    this.calculateAvailableBalance();
    await this.save();
  }

  /**
   * Libera días (rechazo/cancelación)
   */
  async releaseDays(days) {
    this.balance.pending = Math.max(0, this.balance.pending - days);
    this.calculateAvailableBalance();
    await this.save();
  }
}

module.exports = VacationData;

