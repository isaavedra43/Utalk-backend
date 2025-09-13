const { db } = require('../config/firebase');

/**
 * Controlador para configuración de asistencia automática
 * (Preparado para futuras configuraciones)
 */
class AutoAttendanceConfigController {
  
  /**
   * Obtiene la configuración actual de asistencia automática
   * GET /api/auto-attendance/config
   */
  static async getConfig(req, res) {
    try {
      // Por ahora retornamos configuración por defecto
      // En el futuro esto vendrá de la base de datos
      const defaultConfig = {
        enabled: true,
        schedule: {
          daily: {
            enabled: true,
            time: '06:00',
            timezone: 'America/Mexico_City'
          },
          verification: {
            enabled: true,
            time: '18:00',
            timezone: 'America/Mexico_City'
          }
        },
        settings: {
          autoGenerateForWorkingDays: true,
          includeWeekends: false,
          defaultStatus: 'present',
          defaultLocation: 'office',
          calculateOvertime: true,
          overtimeThreshold: 8 // horas
        },
        notifications: {
          enabled: true,
          channels: ['email', 'system'],
          recipients: ['hr@company.com']
        }
      };
      
      res.json({
        success: true,
        data: defaultConfig,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo configuración de asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Actualiza la configuración de asistencia automática
   * PUT /api/auto-attendance/config
   */
  static async updateConfig(req, res) {
    try {
      const { config } = req.body;
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: 'Configuración es requerida'
        });
      }
      
      // Por ahora solo validamos la estructura
      // En el futuro guardaremos en la base de datos
      const validatedConfig = {
        enabled: config.enabled !== undefined ? config.enabled : true,
        schedule: {
          daily: {
            enabled: config.schedule?.daily?.enabled !== undefined ? config.schedule.daily.enabled : true,
            time: config.schedule?.daily?.time || '06:00',
            timezone: config.schedule?.daily?.timezone || 'America/Mexico_City'
          },
          verification: {
            enabled: config.schedule?.verification?.enabled !== undefined ? config.schedule.verification.enabled : true,
            time: config.schedule?.verification?.time || '18:00',
            timezone: config.schedule?.verification?.timezone || 'America/Mexico_City'
          }
        },
        settings: {
          autoGenerateForWorkingDays: config.settings?.autoGenerateForWorkingDays !== undefined ? config.settings.autoGenerateForWorkingDays : true,
          includeWeekends: config.settings?.includeWeekends !== undefined ? config.settings.includeWeekends : false,
          defaultStatus: config.settings?.defaultStatus || 'present',
          defaultLocation: config.settings?.defaultLocation || 'office',
          calculateOvertime: config.settings?.calculateOvertime !== undefined ? config.settings.calculateOvertime : true,
          overtimeThreshold: config.settings?.overtimeThreshold || 8
        },
        notifications: {
          enabled: config.notifications?.enabled !== undefined ? config.notifications.enabled : true,
          channels: config.notifications?.channels || ['email', 'system'],
          recipients: config.notifications?.recipients || ['hr@company.com']
        },
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.email || 'system'
      };
      
      // TODO: Guardar en base de datos
      // await db.collection('system_config').doc('auto_attendance').set(validatedConfig);
      
      res.json({
        success: true,
        message: 'Configuración actualizada exitosamente',
        data: validatedConfig,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      res.status(500).json({
        success: false,
        error: 'Error actualizando configuración de asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Obtiene configuración por empleado
   * GET /api/auto-attendance/config/employee/:id
   */
  static async getEmployeeConfig(req, res) {
    try {
      const { id: employeeId } = req.params;
      
      // Por ahora retornamos configuración por defecto
      // En el futuro esto vendrá de la base de datos
      const defaultEmployeeConfig = {
        employeeId,
        autoAttendance: {
          enabled: true,
          customSchedule: null, // Usar horario del contrato
          exceptions: [], // Fechas específicas donde no generar
          preferences: {
            defaultLocation: 'office',
            notifyOnGeneration: true
          }
        }
      };
      
      res.json({
        success: true,
        data: defaultEmployeeConfig,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error obteniendo configuración del empleado:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo configuración del empleado',
        details: error.message
      });
    }
  }
  
  /**
   * Actualiza configuración por empleado
   * PUT /api/auto-attendance/config/employee/:id
   */
  static async updateEmployeeConfig(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { config } = req.body;
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: 'Configuración es requerida'
        });
      }
      
      const validatedConfig = {
        employeeId,
        autoAttendance: {
          enabled: config.autoAttendance?.enabled !== undefined ? config.autoAttendance.enabled : true,
          customSchedule: config.autoAttendance?.customSchedule || null,
          exceptions: config.autoAttendance?.exceptions || [],
          preferences: {
            defaultLocation: config.autoAttendance?.preferences?.defaultLocation || 'office',
            notifyOnGeneration: config.autoAttendance?.preferences?.notifyOnGeneration !== undefined ? config.autoAttendance.preferences.notifyOnGeneration : true
          }
        },
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.email || 'system'
      };
      
      // TODO: Guardar en base de datos
      // await db.collection('employees').doc(employeeId).collection('config').doc('auto_attendance').set(validatedConfig);
      
      res.json({
        success: true,
        message: 'Configuración del empleado actualizada exitosamente',
        data: validatedConfig,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error actualizando configuración del empleado:', error);
      res.status(500).json({
        success: false,
        error: 'Error actualizando configuración del empleado',
        details: error.message
      });
    }
  }
}

module.exports = AutoAttendanceConfigController;
