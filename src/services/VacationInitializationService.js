const VacationData = require('../models/VacationData');
const Employee = require('../models/Employee');

/**
 * Servicio de Inicialización de Vacaciones
 * Se ejecuta automáticamente cuando se crea un empleado nuevo
 */
class VacationInitializationService {
  
  /**
   * Inicializa datos de vacaciones para un empleado nuevo
   * Se llama automáticamente desde EmployeeService.createCompleteEmployee
   */
  static async initializeForNewEmployee(employeeId, employeeData) {
    try {
      console.log('🏖️ Inicializando datos de vacaciones para empleado:', employeeId);
      
      // Crear datos de vacaciones
      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employeeData.personalInfo.firstName,
        lastName: employeeData.personalInfo.lastName,
        position: employeeData.position.title,
        department: employeeData.position.department,
        hireDate: employeeData.position.startDate
      });

      console.log('✅ Datos de vacaciones inicializados:', {
        employeeId,
        annualDays: vacationData.policy.annualDays,
        availableDays: vacationData.balance.available
      });

      return vacationData;
    } catch (error) {
      console.error('❌ Error inicializando datos de vacaciones:', error);
      throw error;
    }
  }

  /**
   * Migra empleados existentes que no tienen datos de vacaciones
   */
  static async migrateExistingEmployees() {
    try {
      console.log('🔄 Iniciando migración de datos de vacaciones para empleados existentes...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      let migrated = 0;
      let errors = 0;

      for (const employee of employees) {
        try {
          // Verificar si ya tiene datos de vacaciones
          const existingData = await VacationData.findByEmployee(employee.id);
          
          if (!existingData) {
            await VacationInitializationService.initializeForNewEmployee(employee.id, {
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
   * Actualiza política de vacaciones para todos los empleados
   */
  static async updatePolicyForAllEmployees(newPolicy) {
    try {
      console.log('📋 Actualizando política de vacaciones para todos los empleados...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      let updated = 0;
      let errors = 0;

      for (const employee of employees) {
        try {
          const vacationData = await VacationData.findByEmployee(employee.id);
          
          if (vacationData) {
            // Actualizar política
            vacationData.policy = {
              ...vacationData.policy,
              ...newPolicy
            };
            
            // Recalcular días anuales si cambió
            if (newPolicy.annualDays) {
              const newAnnualDays = VacationData.calculateAnnualDays(employee.position.startDate);
              vacationData.policy.annualDays = newAnnualDays;
              
              // Ajustar balance si es necesario
              const difference = newAnnualDays - vacationData.balance.total;
              vacationData.balance.total = newAnnualDays;
              vacationData.balance.available += difference;
              vacationData.calculateAvailableBalance();
            }
            
            await vacationData.save();
            updated++;
            console.log(`✅ Política actualizada para: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
          }
        } catch (error) {
          console.error(`❌ Error actualizando empleado ${employee.id}:`, error);
          errors++;
        }
      }

      console.log(`🎉 Actualización de política completada: ${updated} empleados actualizados, ${errors} errores`);
      
      return {
        total: employees.length,
        updated,
        errors,
        success: true
      };
    } catch (error) {
      console.error('❌ Error actualizando política masivamente:', error);
      throw error;
    }
  }

  /**
   * Recalcula balances de vacaciones para todos los empleados
   */
  static async recalculateAllBalances() {
    try {
      console.log('🧮 Recalculando balances de vacaciones para todos los empleados...');
      
      const result = await Employee.list({ status: 'active', limit: 1000 });
      const employees = result.employees;
      
      let recalculated = 0;
      let errors = 0;

      for (const employee of employees) {
        try {
          const vacationData = await VacationData.findByEmployee(employee.id);
          
          if (vacationData) {
            // Recalcular días anuales según antigüedad actual
            const newAnnualDays = VacationData.calculateAnnualDays(employee.position.startDate);
            
            // Actualizar si hay diferencia
            if (newAnnualDays !== vacationData.policy.annualDays) {
              const difference = newAnnualDays - vacationData.policy.annualDays;
              vacationData.policy.annualDays = newAnnualDays;
              vacationData.balance.total = newAnnualDays;
              vacationData.balance.available += difference;
              vacationData.calculateAvailableBalance();
              
              await vacationData.save();
            }
            
            // Actualizar estadísticas
            await vacationData.updateStatistics();
            
            recalculated++;
            console.log(`✅ Balance recalculado para: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
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
      console.error('❌ Error recalculando balances masivamente:', error);
      throw error;
    }
  }

  /**
   * Limpia datos de vacaciones obsoletos
   */
  static async cleanupObsoleteData() {
    try {
      console.log('🧹 Limpiando datos obsoletos de vacaciones...');
      
      const result = await Employee.list({ status: 'inactive', limit: 1000 });
      const inactiveEmployees = result.employees;
      
      let cleaned = 0;
      let errors = 0;

      for (const employee of inactiveEmployees) {
        try {
          // Verificar si el empleado está inactivo hace más de 1 año
          const lastActivity = new Date(employee.updatedAt || employee.createdAt);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          if (lastActivity < oneYearAgo) {
            // TODO: Implementar limpieza de datos si es necesario
            // Por ahora solo log
            console.log(`🗑️ Empleado inactivo hace más de 1 año: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
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

module.exports = VacationInitializationService;
