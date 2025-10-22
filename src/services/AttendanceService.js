const AttendanceReport = require('../models/AttendanceReport');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceMovement = require('../models/AttendanceMovement');
const AttendanceException = require('../models/AttendanceException');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * Servicio principal de Asistencia
 * Contiene toda la lógica de negocio para gestión de asistencia diaria
 */
class AttendanceService {

  /**
   * Crear reporte de asistencia
   */
  static async createReport(reportData, createdBy) {
    try {
      // Validar fecha
      if (await AttendanceReport.findByDate(reportData.date)) {
        throw new Error('Ya existe un reporte para esta fecha');
      }

      const report = new AttendanceReport({
        ...reportData,
        createdBy,
        status: 'draft'
      });

      // Validar datos
      const validation = report.validate();
      if (!validation.isValid) {
        throw new Error(`Errores de validación: ${validation.errors.join(', ')}`);
      }

      // Si no se proporcionan empleados, generar automáticamente
      if (!reportData.employees || reportData.employees.length === 0) {
        reportData.employees = await this.generateEmployeeRecords(reportData.date);
      }

      await report.save();

      // Crear registros de asistencia
      const records = reportData.employees.map(emp => ({
        reportId: report.id,
        employeeId: emp.employeeId,
        status: emp.status,
        clockIn: emp.clockIn,
        clockOut: emp.clockOut,
        totalHours: emp.totalHours,
        overtimeHours: emp.overtimeHours,
        breakHours: emp.breakHours,
        notes: emp.notes
      }));

      await AttendanceRecord.createBatch(records);

      // Crear movimientos si existen
      if (reportData.movements && reportData.movements.length > 0) {
        const movements = reportData.movements.map(mov => ({
          reportId: report.id,
          employeeId: mov.employeeId,
          type: mov.type,
          subtype: mov.subtype,
          description: mov.description,
          amount: mov.amount,
          hours: mov.hours,
          createdBy
        }));

        await AttendanceMovement.createBatch(movements);
      }

      // Crear excepciones si existen
      if (reportData.exceptions && reportData.exceptions.length > 0) {
        const exceptions = reportData.exceptions.map(exc => ({
          reportId: report.id,
          employeeId: exc.employeeId,
          type: exc.type,
          description: exc.description,
          time: exc.time,
          duration: exc.duration,
          severity: exc.severity,
          createdBy
        }));

        await AttendanceException.createBatch(exceptions);
      }

      // Recalcular estadísticas
      await report.recalculateStats();

      logger.info('Reporte de asistencia creado', {
        reportId: report.id,
        date: report.date,
        createdBy,
        totalEmployees: report.totalEmployees
      });

      return report;
    } catch (error) {
      logger.error('Error creando reporte de asistencia:', error);
      throw error;
    }
  }

  /**
   * Obtener reporte por ID con detalles completos
   */
  static async getReportById(reportId) {
    try {
      const report = await AttendanceReport.findById(reportId);
      if (!report) {
        throw new Error('Reporte no encontrado');
      }

      // Obtener registros de asistencia
      const records = await AttendanceRecord.findByReport(reportId);

      // Enriquecer registros con información completa de empleados
      const enrichedRecords = await this.enrichRecordsWithEmployeeData(records);

      // Obtener movimientos
      const movements = await AttendanceMovement.findByReport(reportId);

      // Obtener excepciones
      const exceptions = await AttendanceException.findByReport(reportId);

      // Obtener estadísticas actualizadas
      const stats = await report.getStats();

      return {
        report,
        records: enrichedRecords,
        movements,
        exceptions,
        stats
      };
    } catch (error) {
      logger.error('Error obteniendo reporte por ID:', error);
      throw error;
    }
  }

  /**
   * Listar reportes con filtros
   */
  static async listReports(filters = {}) {
    try {
      const reports = await AttendanceReport.list(filters);

      return {
        reports,
        total: reports.length,
        filters
      };
    } catch (error) {
      logger.error('Error listando reportes:', error);
      throw error;
    }
  }

  /**
   * Actualizar reporte
   */
  static async updateReport(reportId, updateData, updatedBy) {
    try {
      const report = await AttendanceReport.findById(reportId);
      if (!report) {
        throw new Error('Reporte no encontrado');
      }

      // Si se actualizan empleados, sincronizar registros
      if (updateData.employees) {
        await this.syncEmployeeRecords(reportId, updateData.employees);
      }

      // Si se actualizan movimientos, sincronizar
      if (updateData.movements) {
        await this.syncMovements(reportId, updateData.movements, updatedBy);
      }

      // Si se actualizan excepciones, sincronizar
      if (updateData.exceptions) {
        await this.syncExceptions(reportId, updateData.exceptions, updatedBy);
      }

      await report.update(updateData);

      // Recalcular estadísticas
      await report.recalculateStats();

      logger.info('Reporte de asistencia actualizado', {
        reportId,
        updatedBy,
        changes: Object.keys(updateData)
      });

      return report;
    } catch (error) {
      logger.error('Error actualizando reporte:', error);
      throw error;
    }
  }

  /**
   * Eliminar reporte
   */
  static async deleteReport(reportId, deletedBy) {
    try {
      const report = await AttendanceReport.findById(reportId);
      if (!report) {
        throw new Error('Reporte no encontrado');
      }

      await report.delete();

      logger.info('Reporte de asistencia eliminado', {
        reportId,
        deletedBy,
        date: report.date
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando reporte:', error);
      throw error;
    }
  }

  /**
   * Generar registros de empleados automáticamente
   */
  static async generateEmployeeRecords(date) {
    try {
      // Obtener empleados activos
      const employees = await Employee.findActive();

      const records = [];

      for (const employee of employees) {
        // Verificar estado de vacaciones
        const vacationStatus = await this.checkEmployeeVacationStatus(employee.id, date);

        // Verificar extras del día
        const extras = await this.getEmployeeExtras(employee.id, date);

        // Determinar estado
        let status = 'present';
        let notes = '';

        if (vacationStatus.status === 'vacation') {
          status = 'vacation';
          notes = vacationStatus.reason;
        } else if (extras.hasAbsences) {
          status = 'absent';
          notes = 'Ausencia registrada en extras';
        } else if (extras.hasLoans && Math.random() > 0.8) {
          status = 'absent';
          notes = 'Posible ausencia por préstamo activo';
        }

        // Generar horarios para empleados presentes
        let clockIn = null;
        let clockOut = null;
        let totalHours = 0;

        if (status === 'present') {
          // Usar horario estándar del empleado
          if (employee.contract?.customSchedule?.enabled) {
            const daySchedule = employee.contract.customSchedule.days[this.getDayName(new Date(date))];
            if (daySchedule?.enabled) {
              clockIn = daySchedule.startTime;
              clockOut = daySchedule.endTime;
            }
          } else {
            // Horario estándar 9-18
            clockIn = '09:00';
            clockOut = '18:00';
          }

          totalHours = this.calculateHours(clockIn, clockOut, 60); // 1 hora de descanso
        }

        records.push({
          employeeId: employee.id,
          status,
          clockIn,
          clockOut,
          totalHours,
          overtimeHours: extras.overtimeHours,
          breakHours: 60,
          notes
        });
      }

      return records;
    } catch (error) {
      logger.error('Error generando registros de empleados:', error);
      throw error;
    }
  }

  /**
   * Sincronizar registros de empleados
   */
  static async syncEmployeeRecords(reportId, employees) {
    try {
      // Obtener registros existentes
      const existingRecords = await AttendanceRecord.findByReport(reportId);
      const existingEmployeeIds = existingRecords.map(r => r.employeeId);

      // Crear nuevos registros
      const newEmployees = employees.filter(emp => !existingEmployeeIds.includes(emp.employeeId));
      if (newEmployees.length > 0) {
        const records = newEmployees.map(emp => ({
          reportId,
          employeeId: emp.employeeId,
          status: emp.status,
          clockIn: emp.clockIn,
          clockOut: emp.clockOut,
          totalHours: emp.totalHours,
          overtimeHours: emp.overtimeHours,
          breakHours: emp.breakHours,
          notes: emp.notes
        }));

        await AttendanceRecord.createBatch(records);
      }

      // Actualizar registros existentes
      const updatedRecords = employees.filter(emp => existingEmployeeIds.includes(emp.employeeId));
      if (updatedRecords.length > 0) {
        const records = updatedRecords.map(emp => ({
          id: existingRecords.find(r => r.employeeId === emp.employeeId)?.id,
          status: emp.status,
          clockIn: emp.clockIn,
          clockOut: emp.clockOut,
          totalHours: emp.totalHours,
          overtimeHours: emp.overtimeHours,
          breakHours: emp.breakHours,
          notes: emp.notes
        })).filter(r => r.id);

        await AttendanceRecord.updateBatch(records);
      }

    } catch (error) {
      logger.error('Error sincronizando registros de empleados:', error);
      throw error;
    }
  }

  /**
   * Sincronizar movimientos
   */
  static async syncMovements(reportId, movements, updatedBy) {
    try {
      // Obtener movimientos existentes
      const existingMovements = await AttendanceMovement.findByReport(reportId);

      // Crear nuevos movimientos
      const newMovements = movements.filter(mov =>
        !existingMovements.some(em => em.employeeId === mov.employeeId && em.type === mov.type)
      );

      if (newMovements.length > 0) {
        const movementsData = newMovements.map(mov => ({
          reportId,
          employeeId: mov.employeeId,
          type: mov.type,
          subtype: mov.subtype,
          description: mov.description,
          amount: mov.amount,
          hours: mov.hours,
          createdBy: updatedBy
        }));

        await AttendanceMovement.createBatch(movementsData);
      }

    } catch (error) {
      logger.error('Error sincronizando movimientos:', error);
      throw error;
    }
  }

  /**
   * Sincronizar excepciones
   */
  static async syncExceptions(reportId, exceptions, updatedBy) {
    try {
      // Obtener excepciones existentes
      const existingExceptions = await AttendanceException.findByReport(reportId);

      // Crear nuevas excepciones
      const newExceptions = exceptions.filter(exc =>
        !existingExceptions.some(ee => ee.employeeId === exc.employeeId && ee.type === exc.type)
      );

      if (newExceptions.length > 0) {
        const exceptionsData = newExceptions.map(exc => ({
          reportId,
          employeeId: exc.employeeId,
          type: exc.type,
          description: exc.description,
          time: exc.time,
          duration: exc.duration,
          severity: exc.severity,
          createdBy: updatedBy
        }));

        await AttendanceException.createBatch(exceptionsData);
      }

    } catch (error) {
      logger.error('Error sincronizando excepciones:', error);
      throw error;
    }
  }

  /**
   * Aprobar reporte
   */
  static async approveReport(reportId, approvedBy, comments = '') {
    try {
      const report = await AttendanceReport.findById(reportId);
      if (!report) {
        throw new Error('Reporte no encontrado');
      }

      if (report.status !== 'completed') {
        throw new Error('Solo se pueden aprobar reportes completados');
      }

      await report.update({
        status: 'approved',
        approvedBy,
        approvedAt: new Date().toISOString(),
        approvalComments: comments
      });

      // Sincronizar con nómina si está disponible
      try {
        await this.syncWithPayroll(reportId);
      } catch (syncError) {
        logger.warn('Error sincronizando con nómina:', syncError);
      }

      logger.info('Reporte de asistencia aprobado', {
        reportId,
        approvedBy,
        date: report.date
      });

      return report;
    } catch (error) {
      logger.error('Error aprobando reporte:', error);
      throw error;
    }
  }

  /**
   * Rechazar reporte
   */
  static async rejectReport(reportId, rejectedBy, reason) {
    try {
      const report = await AttendanceReport.findById(reportId);
      if (!report) {
        throw new Error('Reporte no encontrado');
      }

      if (report.status !== 'completed') {
        throw new Error('Solo se pueden rechazar reportes completados');
      }

      await report.update({
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason
      });

      logger.info('Reporte de asistencia rechazado', {
        reportId,
        rejectedBy,
        date: report.date,
        reason
      });

      return report;
    } catch (error) {
      logger.error('Error rechazando reporte:', error);
      throw error;
    }
  }

  /**
   * Sincronizar con nómina
   */
  static async syncWithPayroll(reportId) {
    try {
      // Esta función se conectaría con el módulo de nómina cuando esté disponible
      logger.info('Sincronizando reporte con nómina', { reportId });

      // Por ahora, solo logueamos la acción
      // Cuando se implemente nómina, aquí se haría la integración real

      return true;
    } catch (error) {
      logger.error('Error sincronizando con nómina:', error);
      throw error;
    }
  }

  /**
   * Verificar estado de vacaciones de empleado
   */
  static async checkEmployeeVacationStatus(employeeId, date) {
    try {
      // Esta función se conectaría con el módulo de vacaciones cuando esté disponible
      // Por ahora, simulamos una respuesta

      // Simulación: 10% de probabilidad de estar en vacaciones
      if (Math.random() < 0.1) {
        return {
          status: 'vacation',
          reason: 'Vacaciones anuales aprobadas',
          approved: true
        };
      }

      return { status: 'working', approved: true };
    } catch (error) {
      logger.error('Error verificando estado de vacaciones:', error);
      return { status: 'working', approved: true };
    }
  }

  /**
   * Obtener extras del empleado para una fecha
   */
  static async getEmployeeExtras(employeeId, date) {
    try {
      // Esta función se conectaría con el módulo de extras cuando esté disponible
      // Por ahora, simulamos algunos datos

      return {
        overtimeHours: Math.random() * 2, // 0-2 horas extra
        hasLoans: Math.random() < 0.2, // 20% de probabilidad de tener préstamos
        hasAbsences: Math.random() < 0.05, // 5% de probabilidad de ausencias
        movements: []
      };
    } catch (error) {
      logger.error('Error obteniendo extras del empleado:', error);
      return {
        overtimeHours: 0,
        hasLoans: false,
        hasAbsences: false,
        movements: []
      };
    }
  }

  /**
   * Calcular horas trabajadas
   */
  static calculateHours(clockIn, clockOut, breakMinutes = 60) {
    if (!clockIn || !clockOut) return 0;

    try {
      const [inHour, inMinute] = clockIn.split(':').map(Number);
      const [outHour, outMinute] = clockOut.split(':').map(Number);

      const inMinutes = inHour * 60 + inMinute;
      const outMinutes = outHour * 60 + outMinute;

      let totalMinutes = outMinutes - inMinutes;

      // Si cruza medianoche
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
      }

      // Restar tiempo de descanso
      totalMinutes -= breakMinutes;

      const hours = totalMinutes / 60;
      return Math.max(0, Math.round(hours * 100) / 100);
    } catch (error) {
      logger.error('Error calculando horas:', error);
      return 0;
    }
  }

  /**
   * Obtener nombre del día de la semana
   */
  static getDayName(date) {
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return days[new Date(date).getDay()];
  }

  /**
   * Obtener estadísticas de asistencia
   */
  static async getAttendanceStats(filters = {}) {
    try {
      const reports = await AttendanceReport.list({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        status: 'approved'
      });

      const stats = {
        totalReports: reports.length,
        totalEmployees: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        vacationCount: 0,
        sickLeaveCount: 0,
        personalLeaveCount: 0,
        maternityLeaveCount: 0,
        paternityLeaveCount: 0,
        overtimeHours: 0,
        totalHours: 0,
        attendanceRate: 0,
        averageHoursPerDay: 0
      };

      reports.forEach(report => {
        stats.totalEmployees += report.totalEmployees;
        stats.presentCount += report.presentCount;
        stats.absentCount += report.absentCount;
        stats.lateCount += report.lateCount;
        stats.vacationCount += report.vacationCount;
        stats.sickLeaveCount += report.sickLeaveCount;
        stats.personalLeaveCount += report.personalLeaveCount;
        stats.maternityLeaveCount += report.maternityLeaveCount;
        stats.paternityLeaveCount += report.paternityLeaveCount;
        stats.overtimeHours += report.overtimeHours;
        stats.totalHours += report.totalHours;
      });

      // Calcular métricas
      if (stats.totalEmployees > 0) {
        stats.attendanceRate = ((stats.presentCount + stats.lateCount) / stats.totalEmployees) * 100;
      }

      if (reports.length > 0) {
        stats.averageHoursPerDay = stats.totalHours / reports.length;
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de asistencia:', error);
      throw error;
    }
  }

  /**
   * Generar reporte rápido
   */
  static async generateQuickReport(date, template = 'normal') {
    try {
      const employees = await this.generateEmployeeRecords(date);

      // Aplicar plantilla
      if (template === 'weekend') {
        // Más ausencias en fines de semana
        employees.forEach(emp => {
          if (Math.random() > 0.7) {
            emp.status = 'absent';
            emp.clockIn = null;
            emp.clockOut = null;
            emp.totalHours = 0;
          }
        });
      } else if (template === 'holiday') {
        // Muchas vacaciones en días festivos
        employees.forEach(emp => {
          if (Math.random() > 0.4) {
            emp.status = 'vacation';
            emp.clockIn = null;
            emp.clockOut = null;
            emp.totalHours = 0;
            emp.notes = 'Día festivo';
          }
        });
      }

      return {
        date,
        employees,
        notes: `Reporte generado automáticamente con plantilla: ${template}`,
        template
      };
    } catch (error) {
      logger.error('Error generando reporte rápido:', error);
      throw error;
    }
  }

  /**
   * Validar permisos de usuario
   */
  static async validateUserPermissions(userId, action) {
    try {
      // Esta función se conectaría con el sistema de permisos
      // Por ahora, simulamos permisos básicos

      const permissions = {
        canCreate: true,
        canEdit: true,
        canApprove: true,
        canReject: true,
        canDelete: false,
        canView: true
      };

      return permissions;
    } catch (error) {
      logger.error('Error validando permisos:', error);
      return {
        canCreate: false,
        canEdit: false,
        canApprove: false,
        canReject: false,
        canDelete: false,
        canView: false
      };
    }
  }



  /**
   * Enriquecer registros con información completa de empleados
   */
  static async enrichRecordsWithEmployeeData(records) {
    try {
      if (!records || records.length === 0) {
        return records;
      }

      // Obtener todos los IDs únicos de empleados
      const employeeIds = [...new Set(records.map(record => record.employeeId))];

      // Obtener información completa de todos los empleados
      const Employee = require('../models/Employee');
      const employees = [];

      for (const employeeId of employeeIds) {
        try {
          const employee = await Employee.findById(employeeId);
          if (employee) {
            employees.push(employee);
          }
        } catch (error) {
          logger.warn(`No se pudo obtener empleado ${employeeId}:`, error.message);
        }
      }

      // Crear un mapa para búsqueda rápida
      const employeeMap = {};
      employees.forEach(emp => {
        employeeMap[emp.id] = emp;
      });

      // Enriquecer cada registro con datos del empleado
      const enrichedRecords = records.map(record => {
        const employee = employeeMap[record.employeeId];
        
        if (employee) {
          const firstName = employee.personalInfo?.firstName || '';
          const lastName = employee.personalInfo?.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'Sin nombre';
          
          return {
            ...record,
            employeeName: fullName,
            employeeNumber: employee.employeeNumber || '',
            department: employee.position?.department || 'Sin departamento',
            position: employee.position?.title || 'Sin posición',
            email: employee.personalInfo?.email || '',
            phone: employee.personalInfo?.phone || '',
            avatar: employee.personalInfo?.avatar || null
          };
        } else {
          // Fallback si no se encuentra el empleado
          return {
            ...record,
            employeeName: `Empleado ${record.employeeId.slice(0, 8)}`,
            employeeNumber: '',
            department: 'Sin departamento',
            position: 'Sin posición',
            email: '',
            phone: '',
            avatar: null
          };
        }
      });

      logger.info('Registros enriquecidos con datos de empleados', {
        totalRecords: records.length,
        employeesFound: employees.length,
        employeesNotFound: records.length - employees.length
      });

      return enrichedRecords;
    } catch (error) {
      logger.error('Error enriqueciendo registros con datos de empleados:', error);
      // En caso de error, retornar registros originales
      return records;
    }
  }

  /**
   * Migrar registros existentes de colección general a subcolecciones de empleados
   * Este método es para migrar datos existentes de la estructura anterior
   */
  static async migrateToSubcollections() {
    try {
      logger.info('Iniciando migración de attendance_records a subcolecciones de empleados');

      // Obtener todos los registros de la colección general (estructura anterior)
      const oldRecordsSnapshot = await db.collection('attendance_records').get();
      
      if (oldRecordsSnapshot.empty) {
        logger.info('No hay registros para migrar');
        return { migrated: 0, errors: 0 };
      }

      let migrated = 0;
      let errors = 0;
      const batch = db.batch();

      // Procesar en lotes de 500 (límite de Firestore)
      const batchSize = 500;
      const totalRecords = oldRecordsSnapshot.docs.length;
      
      for (let i = 0; i < totalRecords; i += batchSize) {
        const batchDocs = oldRecordsSnapshot.docs.slice(i, i + batchSize);
        
        for (const doc of batchDocs) {
          try {
            const recordData = doc.data();
            const employeeId = recordData.employeeId;
            
            if (!employeeId) {
              logger.warn(`Registro ${doc.id} no tiene employeeId, saltando`);
              errors++;
              continue;
            }

            // Crear el registro en la subcolección del empleado
            const newDocRef = db.collection('employees').doc(employeeId).collection('attendance_records').doc(doc.id);
            batch.set(newDocRef, recordData);
            
            // Marcar el registro antiguo para eliminación
            batch.delete(doc.ref);
            
            migrated++;
          } catch (error) {
            logger.error(`Error migrando registro ${doc.id}:`, error);
            errors++;
          }
        }

        // Ejecutar el batch
        await batch.commit();
        logger.info(`Migrados ${migrated} registros, procesando lote ${Math.floor(i / batchSize) + 1}`);
      }

      logger.info('Migración completada', {
        totalRecords,
        migrated,
        errors
      });

      return { migrated, errors, totalRecords };
    } catch (error) {
      logger.error('Error durante la migración:', error);
      throw error;
    }
  }
}

module.exports = AttendanceService;
