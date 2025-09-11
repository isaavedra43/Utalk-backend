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
}

module.exports = AttendanceRecord;
