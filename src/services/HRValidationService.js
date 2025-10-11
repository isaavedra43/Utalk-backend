const Employee = require('../models/Employee');
const VacationRequest = require('../models/VacationRequest');

/**
 * Servicio de Validaciones de Recursos Humanos
 * Centraliza todas las reglas de negocio y validaciones del módulo HR
 */
class HRValidationService {
  /**
   * Reglas de negocio para empleados
   */
  static BUSINESS_RULES = {
    employee: {
      minAge: 18,
      maxAge: 65,
      minSalary: 5000, // Salario mínimo en MXN
      maxSalary: 500000, // Salario máximo en MXN
      maxNameLength: 50,
      minNameLength: 2,
      phonePattern: /^\+?[1-9]\d{1,14}$/,
      emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      rfcPattern: /^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/,
      curpPattern: /^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$/
    },
    vacation: {
      minDays: 1,
      maxDays: 30,
      minAdvanceNotice: 7, // días
      maxAdvanceRequest: 365 // días
    }
  };

  /**
   * Valida datos completos de un empleado
   */
  static async validateEmployee(employeeData, isUpdate = false, existingEmployeeId = null) {
    const errors = [];
    const warnings = [];

    try {
      // Validaciones de información personal
      if (!isUpdate || employeeData.personalInfo) {
        const personalErrors = this.validatePersonalInfo(employeeData.personalInfo || {});
        errors.push(...personalErrors);
      }

      // Validaciones de información laboral
      if (!isUpdate || employeeData.position) {
        const positionErrors = this.validatePosition(employeeData.position || {});
        errors.push(...positionErrors);
      }

      // Validaciones de contrato
      if (!isUpdate || employeeData.contract) {
        const contractErrors = await this.validateContract(employeeData.contract || {});
        errors.push(...contractErrors);
      }

      // Validaciones de unicidad
      if (employeeData.personalInfo) {
        const uniquenessErrors = await this.validateUniqueness(
          employeeData.personalInfo,
          existingEmployeeId
        );
        errors.push(...uniquenessErrors);
      }

      // Validaciones de reglas de negocio
      const businessRuleWarnings = this.validateBusinessRules(employeeData);
      warnings.push(...businessRuleWarnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error validating employee:', error);
      return {
        isValid: false,
        errors: ['Error interno de validación'],
        warnings: []
      };
    }
  }

  /**
   * Valida información personal
   */
  static validatePersonalInfo(personalInfo) {
    const errors = [];
    const rules = this.BUSINESS_RULES.employee;

    // Nombre
    if (!personalInfo.firstName) {
      errors.push('El nombre es requerido');
    } else if (personalInfo.firstName.length < rules.minNameLength) {
      errors.push(`El nombre debe tener al menos ${rules.minNameLength} caracteres`);
    } else if (personalInfo.firstName.length > rules.maxNameLength) {
      errors.push(`El nombre no puede exceder ${rules.maxNameLength} caracteres`);
    }

    // Apellidos
    if (!personalInfo.lastName) {
      errors.push('Los apellidos son requeridos');
    } else if (personalInfo.lastName.length < rules.minNameLength) {
      errors.push(`Los apellidos deben tener al menos ${rules.minNameLength} caracteres`);
    } else if (personalInfo.lastName.length > rules.maxNameLength) {
      errors.push(`Los apellidos no pueden exceder ${rules.maxNameLength} caracteres`);
    }

    // Teléfono
    if (!personalInfo.phone) {
      errors.push('El teléfono es requerido');
    } else if (!rules.phonePattern.test(personalInfo.phone)) {
      errors.push('El formato del teléfono no es válido');
    }

    // Email (opcional)
    if (personalInfo.email && !rules.emailPattern.test(personalInfo.email)) {
      errors.push('El formato del email no es válido');
    }

    // RFC (opcional)
    if (personalInfo.rfc && !rules.rfcPattern.test(personalInfo.rfc)) {
      errors.push('El formato del RFC no es válido');
    }

    // CURP (opcional)
    if (personalInfo.curp && !rules.curpPattern.test(personalInfo.curp)) {
      errors.push('El formato del CURP no es válido');
    }

    // Fecha de nacimiento
    if (personalInfo.dateOfBirth) {
      const age = this.calculateAge(personalInfo.dateOfBirth);
      if (age < rules.minAge) {
        errors.push(`La edad mínima permitida es ${rules.minAge} años`);
      } else if (age > rules.maxAge) {
        errors.push(`La edad máxima permitida es ${rules.maxAge} años`);
      }
    }

    return errors;
  }

  /**
   * Valida información de posición
   */
  static validatePosition(position) {
    const errors = [];

    if (!position.title) {
      errors.push('El puesto es requerido');
    }

    if (!position.department) {
      errors.push('El departamento es requerido');
    }

    const validLevels = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director'];
    if (position.level && !validLevels.includes(position.level)) {
      errors.push('El nivel del puesto no es válido');
    }

    if (!position.startDate) {
      errors.push('La fecha de inicio es requerida');
    } else {
      const startDate = new Date(position.startDate);
      const today = new Date();
      
      if (startDate > today) {
        errors.push('La fecha de inicio no puede ser futura');
      }
    }

    return errors;
  }

  /**
   * Valida información de contrato
   */
  static async validateContract(contract) {
    const errors = [];
    const rules = this.BUSINESS_RULES.employee;

    if (contract.salary !== undefined) {
      if (contract.salary < rules.minSalary) {
        errors.push(`El salario mínimo permitido es $${rules.minSalary.toLocaleString()}`);
      } else if (contract.salary > rules.maxSalary) {
        errors.push(`El salario máximo permitido es $${rules.maxSalary.toLocaleString()}`);
      }
    }

    const validContractTypes = ['permanent', 'temporary', 'intern', 'contractor'];
    if (contract.type && !validContractTypes.includes(contract.type)) {
      errors.push('El tipo de contrato no es válido');
    }

    if (contract.startDate && contract.endDate) {
      const startDate = new Date(contract.startDate);
      const endDate = new Date(contract.endDate);
      
      if (startDate >= endDate) {
        errors.push('La fecha de fin del contrato debe ser posterior a la fecha de inicio');
      }
    }

    return errors;
  }

  /**
   * Valida unicidad de campos
   */
  static async validateUniqueness(personalInfo, excludeEmployeeId = null) {
    const errors = [];

    try {
      // Validar email único
      if (personalInfo.email) {
        const emailExists = await Employee.emailExists(personalInfo.email, excludeEmployeeId);
        if (emailExists) {
          errors.push('El email ya está registrado para otro empleado');
        }
      }

      // Validar teléfono único
      if (personalInfo.phone) {
        const phoneExists = await Employee.phoneExists(personalInfo.phone, excludeEmployeeId);
        if (phoneExists) {
          errors.push('El teléfono ya está registrado para otro empleado');
        }
      }

      // Validar RFC único
      if (personalInfo.rfc) {
        const rfcExists = await Employee.rfcExists(personalInfo.rfc, excludeEmployeeId);
        if (rfcExists) {
          errors.push('El RFC ya está registrado para otro empleado');
        }
      }
    } catch (error) {
      console.error('Error validating uniqueness:', error);
      errors.push('Error al validar unicidad de datos');
    }

    return errors;
  }

  /**
   * Valida reglas de negocio específicas
   */
  static validateBusinessRules(employeeData) {
    const warnings = [];

    // Validar coherencia entre posición y salario
    if (employeeData.position?.level && employeeData.contract?.salary) {
      const expectedSalaryRange = this.getSalaryRangeByLevel(employeeData.position.level);
      
      if (employeeData.contract.salary < expectedSalaryRange.min) {
        warnings.push(`El salario está por debajo del rango esperado para ${employeeData.position.level} ($${expectedSalaryRange.min.toLocaleString()} - $${expectedSalaryRange.max.toLocaleString()})`);
      } else if (employeeData.contract.salary > expectedSalaryRange.max) {
        warnings.push(`El salario está por encima del rango esperado para ${employeeData.position.level} ($${expectedSalaryRange.min.toLocaleString()} - $${expectedSalaryRange.max.toLocaleString()})`);
      }
    }

    return warnings;
  }

  /**
   * Valida solicitud de vacaciones
   */
  static async validateVacationRequest(requestData, employeeId) {
    const errors = [];
    const warnings = [];
    const rules = this.BUSINESS_RULES.vacation;

    try {
      // Validaciones básicas
      if (!requestData.startDate) {
        errors.push('La fecha de inicio es requerida');
      }

      if (!requestData.endDate) {
        errors.push('La fecha de fin es requerida');
      }

      if (requestData.startDate && requestData.endDate) {
        const startDate = new Date(requestData.startDate);
        const endDate = new Date(requestData.endDate);
        const today = new Date();

        // Validar que las fechas sean coherentes
        if (startDate >= endDate) {
          errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
        }

        // Validar que no sea en el pasado
        if (startDate < today) {
          errors.push('No se pueden solicitar vacaciones en fechas pasadas');
        }

        // Validar aviso previo
        const daysNotice = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
        if (daysNotice < rules.minAdvanceNotice) {
          warnings.push(`Se recomienda solicitar vacaciones con al menos ${rules.minAdvanceNotice} días de anticipación`);
        }

        // Validar máximo de anticipación
        if (daysNotice > rules.maxAdvanceRequest) {
          warnings.push(`No se recomienda solicitar vacaciones con más de ${rules.maxAdvanceRequest} días de anticipación`);
        }

        // Calcular días solicitados
        const totalDays = this.calculateWorkingDays(startDate, endDate);
        
        if (totalDays < rules.minDays) {
          errors.push(`El mínimo de días de vacaciones es ${rules.minDays}`);
        } else if (totalDays > rules.maxDays) {
          warnings.push(`Se solicitan ${totalDays} días, se recomienda no exceder ${rules.maxDays} días consecutivos`);
        }

        // Validar disponibilidad de días
        const employee = await Employee.findById(employeeId);
        if (employee) {
          const VacationBalance = require('../models/VacationBalance');
          const balance = await VacationBalance.getOrCreateCurrent(
            employeeId,
            employee.position.startDate
          );

          if (totalDays > balance.availableDays) {
            errors.push(`No hay suficientes días disponibles. Disponibles: ${balance.availableDays}, Solicitados: ${totalDays}`);
          }
        }

        // Validar conflictos con otras solicitudes
        const conflicts = await VacationRequest.checkDateConflicts(
          employeeId,
          requestData.startDate,
          requestData.endDate
        );

        if (conflicts.length > 0) {
          errors.push('Existen conflictos con otras solicitudes de vacaciones aprobadas');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error validating vacation request:', error);
      return {
        isValid: false,
        errors: ['Error interno de validación'],
        warnings: []
      };
    }
  }


  /**
   * Utilidades
   */

  /**
   * Calcula la edad basada en fecha de nacimiento
   */
  static calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Obtiene rango salarial por nivel
   */
  static getSalaryRangeByLevel(level) {
    const ranges = {
      'Junior': { min: 8000, max: 15000 },
      'Mid': { min: 15000, max: 25000 },
      'Senior': { min: 25000, max: 40000 },
      'Lead': { min: 40000, max: 60000 },
      'Manager': { min: 60000, max: 80000 },
      'Director': { min: 80000, max: 150000 }
    };
    
    return ranges[level] || { min: 5000, max: 500000 };
  }

  /**
   * Calcula días laborales entre dos fechas
   */
  static calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // No contar sábados y domingos
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Valida horario de trabajo personalizado
   */
  static validateCustomSchedule(schedule) {
    const errors = [];

    if (!schedule || !schedule.enabled) {
      return { isValid: true, errors: [] };
    }

    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    
    for (const day of days) {
      if (schedule.days[day] && schedule.days[day].enabled) {
        const startTime = schedule.days[day].startTime;
        const endTime = schedule.days[day].endTime;
        
        if (!startTime || !endTime) {
          errors.push(`Horario incompleto para ${day}`);
          continue;
        }

        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);
        
        if (start >= end) {
          errors.push(`Horario inválido para ${day}: la hora de fin debe ser posterior a la de inicio`);
        }

        const hoursWorked = (end - start) / (1000 * 60 * 60);
        if (hoursWorked > 12) { // Máximo 12 horas por día
          errors.push(`Demasiadas horas programadas para ${day}: ${hoursWorked.toFixed(1)} horas`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = HRValidationService;
