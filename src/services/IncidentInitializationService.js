const IncidentData = require('../models/IncidentData');
const Employee = require('../models/Employee');

/**
 * Servicio de Inicialización de Incidentes
 * Se ejecuta automáticamente cuando se crea un empleado nuevo
 */
class IncidentInitializationService {
  
  /**
   * Inicializa datos de incidentes para un empleado nuevo
   * Se llama automáticamente desde EmployeeService.createCompleteEmployee
   */
  static async initializeForNewEmployee(employeeId, employeeData) {
    try {
      console.log('🚨 Inicializando datos de incidentes para empleado:', employeeId);
      
      // Crear datos de incidentes
      const incidentData = await IncidentData.getOrCreate(employeeId, {
        firstName: employeeData.personalInfo.firstName,
        lastName: employeeData.personalInfo.lastName,
        position: employeeData.position.title,
        department: employeeData.position.department
      });

      console.log('✅ Datos de incidentes inicializados:', {
        employeeId,
        totalIncidents: incidentData.summary.totalIncidents,
        openIncidents: incidentData.summary.openIncidents
      });

      return incidentData;
    } catch (error) {
      console.error('❌ Error inicializando datos de incidentes:', error);
      throw error;
    }
  }

  /**
   * Migra empleados existentes que no tienen datos de incidentes
   */
  static async migrateExistingEmployees() {
    try {
      console.log('🔄 Iniciando migración de datos de incidentes para empleados existentes...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      let migrated = 0;
      let errors = 0;

      for (const employee of employees) {
        try {
          // Verificar si ya tiene datos de incidentes
          const existingData = await IncidentData.findByEmployee(employee.id);
          
          if (!existingData) {
            await IncidentInitializationService.initializeForNewEmployee(employee.id, {
              personalInfo: employee.personalInfo,
              position: employee.position
            });
            migrated++;
            console.log(`✅ Migrado empleado: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
          }
        } catch (error) {
          console.error(`❌ Error migrando empleado ${employee.id}:`, error);
          errors++;
        }
      }

      console.log(`🎉 Migración completada: ${migrated} empleados migrados, ${errors} errores`);
      
      return {
        total: employees.length,
        migrated,
        errors,
        success: true
      };
    } catch (error) {
      console.error('❌ Error en migración masiva:', error);
      throw error;
    }
  }

  /**
   * Recalcula estadísticas de incidentes para todos los empleados
   */
  static async recalculateAllStatistics() {
    try {
      console.log('📊 Recalculando estadísticas de incidentes para todos los empleados...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      let recalculated = 0;
      let errors = 0;

      for (const employee of employees) {
        try {
          const incidentData = await IncidentData.findByEmployee(employee.id);
          
          if (incidentData) {
            // Actualizar estadísticas
            await incidentData.updateStatistics();
            await incidentData.save();
            
            recalculated++;
            console.log(`✅ Estadísticas recalculadas para: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
          }
        } catch (error) {
          console.error(`❌ Error recalculando empleado ${employee.id}:`, error);
          errors++;
        }
      }

      console.log(`🎉 Recalculación completada: ${recalculated} empleados procesados, ${errors} errores`);
      
      return {
        total: employees.length,
        recalculated,
        errors,
        success: true
      };
    } catch (error) {
      console.error('❌ Error recalculando estadísticas masivamente:', error);
      throw error;
    }
  }

  /**
   * Genera reporte de incidentes por departamento
   */
  static async generateDepartmentReport() {
    try {
      console.log('📋 Generando reporte de incidentes por departamento...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      const departmentStats = {};

      for (const employee of employees) {
        try {
          const incidentData = await IncidentData.findByEmployee(employee.id);
          
          if (incidentData) {
            const department = employee.position.department || 'Sin departamento';
            
            if (!departmentStats[department]) {
              departmentStats[department] = {
                totalEmployees: 0,
                totalIncidents: 0,
                openIncidents: 0,
                closedIncidents: 0,
                totalCost: 0,
                paidCost: 0,
                pendingCost: 0,
                byType: {},
                bySeverity: {}
              };
            }
            
            departmentStats[department].totalEmployees++;
            departmentStats[department].totalIncidents += incidentData.summary.totalIncidents;
            departmentStats[department].openIncidents += incidentData.summary.openIncidents;
            departmentStats[department].closedIncidents += incidentData.summary.closedIncidents;
            departmentStats[department].totalCost += incidentData.summary.totalCost;
            departmentStats[department].paidCost += incidentData.summary.paidCost;
            departmentStats[department].pendingCost += incidentData.summary.pendingCost;
            
            // Agregar por tipo
            Object.entries(incidentData.summary.byType).forEach(([type, count]) => {
              departmentStats[department].byType[type] = (departmentStats[department].byType[type] || 0) + count;
            });
            
            // Agregar por severidad
            Object.entries(incidentData.summary.bySeverity).forEach(([severity, count]) => {
              departmentStats[department].bySeverity[severity] = (departmentStats[department].bySeverity[severity] || 0) + count;
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando empleado ${employee.id}:`, error);
        }
      }

      console.log('🎉 Reporte por departamento generado exitosamente');
      
      return {
        departments: departmentStats,
        generatedAt: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      console.error('❌ Error generando reporte por departamento:', error);
      throw error;
    }
  }

  /**
   * Identifica empleados con incidentes críticos pendientes
   */
  static async identifyCriticalIncidents() {
    try {
      console.log('🚨 Identificando empleados con incidentes críticos pendientes...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      const criticalIncidents = [];

      for (const employee of employees) {
        try {
          const incidentData = await IncidentData.findByEmployee(employee.id);
          
          if (incidentData && incidentData.summary.bySeverity.critical > 0) {
            criticalIncidents.push({
              employeeId: employee.id,
              employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              department: employee.position.department,
              criticalIncidents: incidentData.summary.bySeverity.critical,
              openIncidents: incidentData.summary.openIncidents,
              totalCost: incidentData.summary.totalCost
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando empleado ${employee.id}:`, error);
        }
      }

      console.log(`🎉 Identificación completada: ${criticalIncidents.length} empleados con incidentes críticos`);
      
      return {
        criticalIncidents,
        count: criticalIncidents.length,
        generatedAt: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      console.error('❌ Error identificando incidentes críticos:', error);
      throw error;
    }
  }

  /**
   * Limpia datos de incidentes obsoletos
   */
  static async cleanupObsoleteData() {
    try {
      console.log('🧹 Limpiando datos obsoletos de incidentes...');
      
      const result = await Employee.list({ status: 'inactive', limit: 1000 });
      const inactiveEmployees = result.employees;
      
      let cleaned = 0;
      let errors = 0;

      for (const employee of inactiveEmployees) {
        try {
          // Verificar si el empleado está inactivo hace más de 2 años
          const lastActivity = new Date(employee.updatedAt || employee.createdAt);
          const twoYearsAgo = new Date();
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
          
          if (lastActivity < twoYearsAgo) {
            // TODO: Implementar limpieza de datos si es necesario
            // Por ahora solo log
            console.log(`🗑️ Empleado inactivo hace más de 2 años: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
            cleaned++;
          }
        } catch (error) {
          console.error(`❌ Error limpiando empleado ${employee.id}:`, error);
          errors++;
        }
      }

      console.log(`🎉 Limpieza completada: ${cleaned} empleados marcados para limpieza, ${errors} errores`);
      
      return {
        total: inactiveEmployees.length,
        cleaned,
        errors,
        success: true
      };
    } catch (error) {
      console.error('❌ Error en limpieza masiva:', error);
      throw error;
    }
  }
}

module.exports = IncidentInitializationService;
