const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Registro de Asistencia
 * Gestiona los registros diarios de entrada/salida de empleados
 */
class AttendanceRecord {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.clockIn = data.clockIn || null;
    this.clockOut = data.clockOut || null;
    this.breakStart = data.breakStart || null;
    this.breakEnd = data.breakEnd || null;
    
    // Cálculos automáticos
    this.totalHours = data.totalHours || 0;
    this.regularHours = data.regularHours || 0;
    this.overtimeHours = data.overtimeHours || 0;
    this.breakHours = data.breakHours || 0;
    
    // Información de salario
    this.dailySalary = data.dailySalary || 0;
    this.salaryCalculated = data.salaryCalculated || false;
    this.salaryCalculationDate = data.salaryCalculationDate || null;
    
    // Estado
    this.status = data.status || 'present'; // 'present' | 'absent' | 'late' | 'early_leave' | 'half_day'
    this.isHoliday = data.isHoliday || false;
    this.isWeekend = data.isWeekend || false;
    
    // Justificaciones
    this.justification = data.justification || null;
    this.approvedBy = data.approvedBy || null;
    this.approvedAt = data.approvedAt || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || null;
  }

  /**
   * Calcula el salario diario basado en el salario base del empleado
   */
  async calculateDailySalary() {
    try {
      const Employee = require('./Employee');
      const employee = await Employee.findById(this.employeeId);
      
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      const baseSalary = employee.salary?.baseSalary || employee.contract?.salary || 0;
      const frequency = employee.salary?.frequency || 'monthly';
      
      let dailySalary = 0;
      
      switch (frequency) {
        case 'monthly':
          // Salario mensual / 30 días
          dailySalary = baseSalary / 30;
          break;
        case 'weekly':
          // Salario semanal / 7 días
          dailySalary = baseSalary / 7;
          break;
        case 'daily':
          // Salario diario directo
          dailySalary = baseSalary;
          break;
        case 'hourly':
          // Salario por hora * 8 horas estándar
          dailySalary = baseSalary * 8;
          break;
        default:
          // Por defecto asumir mensual
          dailySalary = baseSalary / 30;
      }
      
      this.dailySalary = Math.round(dailySalary * 100) / 100; // Redondear a 2 decimales
      this.salaryCalculated = true;
      this.salaryCalculationDate = new Date().toISOString();
      
      return this.dailySalary;
    } catch (error) {
      console.error('Error calculating daily salary:', error);
      this.dailySalary = 0;
      this.salaryCalculated = false;
      throw error;
    }
  }

  /**
   * Calcula automáticamente las horas trabajadas
   */
  calculateHours() {
    if (!this.clockIn || !this.clockOut) {
      this.totalHours = 0;
      this.regularHours = 0;
      this.overtimeHours = 0;
      this.breakHours = 0;
      return;
    }

    const clockInTime = new Date(`${this.date}T${this.clockIn}`);
    const clockOutTime = new Date(`${this.date}T${this.clockOut}`);
    
    // Calcular horas totales
    const totalMinutes = (clockOutTime - clockInTime) / (1000 * 60);
    this.totalHours = Math.max(0, totalMinutes / 60);
    
    // Calcular horas de descanso
    if (this.breakStart && this.breakEnd) {
      const breakStartTime = new Date(`${this.date}T${this.breakStart}`);
      const breakEndTime = new Date(`${this.date}T${this.breakEnd}`);
      const breakMinutes = (breakEndTime - breakStartTime) / (1000 * 60);
      this.breakHours = Math.max(0, breakMinutes / 60);
    } else {
      this.breakHours = 0;
    }
    
    // Restar horas de descanso del total
    const workingHours = this.totalHours - this.breakHours;
    
    // Calcular horas regulares y extra (8 horas es el estándar)
    const standardHours = 8;
    this.regularHours = Math.min(workingHours, standardHours);
    this.overtimeHours = Math.max(0, workingHours - standardHours);
    
    // Actualizar estado basado en las horas
    this.updateStatus();
  }

  /**
   * Actualiza el estado basado en los horarios
   */
  updateStatus() {
    if (!this.clockIn && !this.clockOut) {
      this.status = 'absent';
      return;
    }

    if (this.totalHours < 4) {
      this.status = 'half_day';
      return;
    }

    // Verificar si llegó tarde (después de las 9:15 AM)
    if (this.clockIn) {
      const clockInTime = new Date(`${this.date}T${this.clockIn}`);
      const lateThreshold = new Date(`${this.date}T09:15:00`);
      
      if (clockInTime > lateThreshold) {
        this.status = 'late';
        return;
      }
    }

    // Verificar si se fue temprano (antes de las 5:30 PM)
    if (this.clockOut) {
      const clockOutTime = new Date(`${this.date}T${this.clockOut}`);
      const earlyThreshold = new Date(`${this.date}T17:30:00`);
      
      if (clockOutTime < earlyThreshold && this.totalHours < 8) {
        this.status = 'early_leave';
        return;
      }
    }

    this.status = 'present';
  }

  /**
   * Verifica si es fin de semana
   */
  checkWeekend() {
    const date = new Date(this.date);
    const dayOfWeek = date.getDay();
    this.isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Domingo = 0, Sábado = 6
  }

  /**
   * Valida los datos del registro
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.date) {
      errors.push('La fecha es requerida');
    }

    if (this.clockIn && this.clockOut) {
      const clockInTime = new Date(`${this.date}T${this.clockIn}`);
      const clockOutTime = new Date(`${this.date}T${this.clockOut}`);
      
      if (clockInTime >= clockOutTime) {
        errors.push('La hora de entrada debe ser anterior a la hora de salida');
      }
    }

    if (this.breakStart && this.breakEnd) {
      const breakStartTime = new Date(`${this.date}T${this.breakStart}`);
      const breakEndTime = new Date(`${this.date}T${this.breakEnd}`);
      
      if (breakStartTime >= breakEndTime) {
        errors.push('El inicio del descanso debe ser anterior al fin del descanso');
      }
    }

    const validStatuses = ['present', 'absent', 'late', 'early_leave', 'half_day'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado del registro no es válido');
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
      date: this.date,
      clockIn: this.clockIn,
      clockOut: this.clockOut,
      breakStart: this.breakStart,
      breakEnd: this.breakEnd,
      totalHours: this.totalHours,
      regularHours: this.regularHours,
      overtimeHours: this.overtimeHours,
      breakHours: this.breakHours,
      dailySalary: this.dailySalary,
      salaryCalculated: this.salaryCalculated,
      salaryCalculationDate: this.salaryCalculationDate,
      status: this.status,
      isHoliday: this.isHoliday,
      isWeekend: this.isWeekend,
      justification: this.justification,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy
    };
  }

  /**
   * Crea un registro desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new AttendanceRecord({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el registro en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      // Calcular horas automáticamente
      this.checkWeekend();
      this.calculateHours();
      
      // Calcular salario diario si no está calculado
      if (!this.salaryCalculated) {
        await this.calculateDailySalary();
      }
      
      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('attendance').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving attendance record:', error);
      throw error;
    }
  }

  /**
   * Actualiza el registro
   */
  async update(data) {
    try {
      Object.assign(this, data);
      
      // Recalcular horas si se actualizaron los horarios
      if (data.clockIn || data.clockOut || data.breakStart || data.breakEnd) {
        this.calculateHours();
      }
      
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('attendance').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating attendance record:', error);
      throw error;
    }
  }

  /**
   * Encuentra registro por empleado y fecha
   */
  static async findByEmployeeAndDate(employeeId, date) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('attendance')
        .where('date', '==', date)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return AttendanceRecord.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding attendance by employee and date:', error);
      throw error;
    }
  }

  /**
   * Encuentra registros por empleado y rango de fechas
   */
  static async findByEmployeeAndDateRange(employeeId, startDate, endDate) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc')
        .get();

      return snapshot.docs.map(doc => AttendanceRecord.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding attendance by date range:', error);
      throw error;
    }
  }

  /**
   * Busca un registro por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('attendance').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return AttendanceRecord.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding attendance record by ID:', error);
      throw error;
    }
  }

  /**
   * Busca un registro por fecha
   */
  static async findByDate(employeeId, date) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('attendance')
        .where('date', '==', date)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      return AttendanceRecord.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      console.error('Error finding attendance record by date:', error);
      throw error;
    }
  }

  /**
   * Lista registros de un empleado en un rango de fechas
   */
  static async listByDateRange(employeeId, startDate, endDate, options = {}) {
    try {
      const {
        includeWeekends = false,
        includeHolidays = false,
        status = null
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc');

      const snapshot = await query.get();
      const records = [];

      snapshot.forEach(doc => {
        const record = AttendanceRecord.fromFirestore(doc);
        
        // Aplicar filtros
        if (!includeWeekends && record.isWeekend) return;
        if (!includeHolidays && record.isHoliday) return;
        if (status && record.status !== status) return;
        
        records.push(record);
      });

      return records;
    } catch (error) {
      console.error('Error listing attendance records:', error);
      throw error;
    }
  }

  /**
   * Registra entrada (clock in)
   */
  static async clockIn(employeeId, time = null, createdBy = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const clockInTime = time || new Date().toTimeString().split(' ')[0];
      
      // Verificar si ya existe un registro para hoy
      let record = await AttendanceRecord.findByDate(employeeId, today);
      
      if (record) {
        // Actualizar registro existente
        await record.update({ clockIn: clockInTime });
      } else {
        // Crear nuevo registro
        record = new AttendanceRecord({
          employeeId,
          date: today,
          clockIn: clockInTime,
          createdBy
        });
        await record.save();
      }
      
      return record;
    } catch (error) {
      console.error('Error clocking in:', error);
      throw error;
    }
  }

  /**
   * Registra salida (clock out)
   */
  static async clockOut(employeeId, time = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const clockOutTime = time || new Date().toTimeString().split(' ')[0];
      
      // Buscar registro del día
      const record = await AttendanceRecord.findByDate(employeeId, today);
      
      if (!record) {
        throw new Error('No se encontró registro de entrada para el día de hoy');
      }
      
      await record.update({ clockOut: clockOutTime });
      return record;
    } catch (error) {
      console.error('Error clocking out:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de asistencia de un empleado
   */
  static async getSummary(employeeId, startDate, endDate) {
    try {
      const records = await AttendanceRecord.listByDateRange(employeeId, startDate, endDate, {
        includeWeekends: false,
        includeHolidays: false
      });

      const summary = {
        employeeId,
        periodStart: startDate,
        periodEnd: endDate,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalHours: 0,
        overtimeHours: 0,
        punctualityScore: 0
      };

      // Calcular días laborales en el período
      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Excluir fines de semana
          summary.totalDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Procesar registros
      records.forEach(record => {
        if (record.status === 'present' || record.status === 'late' || record.status === 'early_leave') {
          summary.presentDays++;
          summary.totalHours += record.totalHours;
          summary.overtimeHours += record.overtimeHours;
        } else if (record.status === 'absent') {
          summary.absentDays++;
        }
        
        if (record.status === 'late') {
          summary.lateDays++;
        }
      });

      // Calcular días ausentes (días laborales sin registro)
      summary.absentDays = summary.totalDays - summary.presentDays;

      // Calcular puntuación de puntualidad (0-100)
      if (summary.totalDays > 0) {
        const punctualDays = summary.presentDays - summary.lateDays;
        summary.punctualityScore = Math.round((punctualDays / summary.totalDays) * 100);
      }

      return summary;
    } catch (error) {
      console.error('Error getting attendance summary:', error);
      throw error;
    }
  }

  /**
   * Recalcula el salario diario para todos los registros de un empleado
   * Se usa cuando se actualiza el salario base del empleado
   */
  static async recalculateDailySalaries(employeeId, startDate = null, endDate = null) {
    try {
      console.log(`🔄 Recalculando salarios diarios para empleado: ${employeeId}`);
      
      let query = db.collection('employees').doc(employeeId)
        .collection('attendance')
        .orderBy('date', 'desc');
      
      if (startDate && endDate) {
        query = query.where('date', '>=', startDate).where('date', '<=', endDate);
      }
      
      const snapshot = await query.get();
      const results = {
        processed: 0,
        updated: 0,
        errors: 0,
        details: []
      };
      
      for (const doc of snapshot.docs) {
        try {
          const record = AttendanceRecord.fromFirestore(doc);
          
          // Recalcular salario diario
          await record.calculateDailySalary();
          
          // Actualizar en Firebase
          await doc.ref.update({
            dailySalary: record.dailySalary,
            salaryCalculated: record.salaryCalculated,
            salaryCalculationDate: record.salaryCalculationDate,
            updatedAt: new Date().toISOString()
          });
          
          results.processed++;
          results.updated++;
          results.details.push({
            recordId: record.id,
            date: record.date,
            newDailySalary: record.dailySalary,
            status: 'updated'
          });
          
        } catch (error) {
          console.error(`❌ Error actualizando registro ${doc.id}:`, error);
          results.errors++;
          results.details.push({
            recordId: doc.id,
            status: 'error',
            error: error.message
          });
        }
      }
      
      console.log(`✅ Recalculación completada:`, results);
      return results;
      
    } catch (error) {
      console.error('❌ Error recalculando salarios diarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene el resumen de salarios de un empleado en un período
   */
  static async getSalarySummary(employeeId, startDate, endDate) {
    try {
      const records = await AttendanceRecord.listByDateRange(employeeId, startDate, endDate, {
        includeWeekends: false,
        includeHolidays: false
      });

      const summary = {
        employeeId,
        periodStart: startDate,
        periodEnd: endDate,
        totalDays: 0,
        presentDays: 0,
        totalDailySalary: 0,
        averageDailySalary: 0,
        salaryBreakdown: {
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0
        }
      };

      // Calcular días laborales en el período
      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Excluir fines de semana
          summary.totalDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Procesar registros
      records.forEach(record => {
        if (record.status === 'present' || record.status === 'late' || record.status === 'early_leave') {
          summary.presentDays++;
          summary.totalDailySalary += record.dailySalary || 0;
          summary.salaryBreakdown[record.status] += record.dailySalary || 0;
        } else if (record.status === 'half_day') {
          summary.salaryBreakdown.halfDay += (record.dailySalary || 0) / 2;
        } else if (record.status === 'absent') {
          summary.salaryBreakdown.absent += 0; // No se paga por ausencias
        }
      });

      // Calcular promedio
      if (summary.presentDays > 0) {
        summary.averageDailySalary = summary.totalDailySalary / summary.presentDays;
      }

      return summary;
    } catch (error) {
      console.error('Error getting salary summary:', error);
      throw error;
    }
  }
}

module.exports = AttendanceRecord;
