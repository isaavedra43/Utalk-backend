const Employee = require('../models/Employee');
const PayrollPeriod = require('../models/PayrollPeriod');
const AttendanceRecord = require('../models/AttendanceRecord');
const VacationRequest = require('../models/VacationRequest');
const VacationBalance = require('../models/VacationBalance');
const EmployeeDocument = require('../models/EmployeeDocument');
const Incident = require('../models/Incident');
const { Evaluation } = require('../models/Evaluation');
const { Skill, Certification } = require('../models/Skill');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Controlador de Empleados - Gestión integral de recursos humanos
 * Maneja todas las operaciones CRUD y funcionalidades avanzadas
 */
class EmployeeController {
  /**
   * Lista todos los empleados con filtros y paginación
   * GET /api/employees
   */
  static async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        department = '',
        status = '',
        position = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        department,
        status,
        position,
        sortBy,
        sortOrder
      };

      const result = await Employee.list(options);
      const summary = await Employee.getSummary();

      res.json({
        success: true,
        data: {
          employees: result.employees,
          pagination: result.pagination,
          summary: {
            total: summary.total,
            active: summary.active,
            inactive: summary.inactive,
            pending: summary.terminated, // Usar terminated como pending
            expired: summary.on_leave // Usar on_leave como expired
          }
        }
      });
    } catch (error) {
      console.error('Error listing employees:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener la lista de empleados',
        details: error.message
      });
    }
  }

  /**
   * Obtiene un empleado específico con toda su información relacionada
   * GET /api/employees/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      
      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener datos relacionados en paralelo para mejor rendimiento
      const [
        payrollSummary,
        attendanceSummary,
        vacationsSummary,
        documents,
        incidents,
        evaluations,
        skills,
        certifications,
        recentHistory
      ] = await Promise.all([
        PayrollPeriod.getSummaryByEmployee(id).catch(() => ({})),
        AttendanceRecord.getSummary(id, 
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        ).catch(() => ({})),
        VacationBalance.getSummary(id).catch(() => ({})),
        EmployeeDocument.listByEmployee(id, { limit: 10 }).catch(() => []),
        Incident.listByEmployee(id, { limit: 5 }).catch(() => []),
        Evaluation.listByEmployee(id, { limit: 5 }).catch(() => []),
        Skill.listByEmployee(id, { limit: 20 }).catch(() => []),
        Certification.listByEmployee(id).catch(() => []),
        EmployeeHistory.listByEmployee(id, { limit: 10 }).catch(() => [])
      ]);

      res.json({
        success: true,
        data: {
          employee,
          relatedData: {
            payroll: payrollSummary,
            attendance: attendanceSummary,
            vacations: vacationsSummary,
            documents: documents.slice(0, 10),
            incidents: incidents.slice(0, 5),
            evaluations: evaluations.slice(0, 5),
            skills: skills.slice(0, 20),
            certifications: certifications.slice(0, 10),
            history: recentHistory.slice(0, 10)
          }
        }
      });
    } catch (error) {
      console.error('Error getting employee by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener el empleado',
        details: error.message
      });
    }
  }

  /**
   * Crea un nuevo empleado
   * POST /api/employees
   */
  static async create(req, res) {
    try {
      const employeeData = req.body;
      const createdBy = req.user?.id || null;

      // Validar unicidad de email, teléfono y RFC si se proporcionan
      const validationPromises = [];
      
      if (employeeData.personalInfo?.email) {
        validationPromises.push(
          Employee.emailExists(employeeData.personalInfo.email)
            .then(exists => exists ? 'email' : null)
        );
      }
      
      if (employeeData.personalInfo?.phone) {
        validationPromises.push(
          Employee.phoneExists(employeeData.personalInfo.phone)
            .then(exists => exists ? 'phone' : null)
        );
      }
      
      if (employeeData.personalInfo?.rfc) {
        validationPromises.push(
          Employee.rfcExists(employeeData.personalInfo.rfc)
            .then(exists => exists ? 'rfc' : null)
        );
      }

      const validationResults = await Promise.all(validationPromises);
      const duplicateFields = validationResults.filter(result => result !== null);

      if (duplicateFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Los siguientes campos ya existen: ${duplicateFields.join(', ')}`
        });
      }

      // Crear empleado
      const employee = new Employee({
        ...employeeData,
        createdBy
      });

      await employee.save();

      // Crear balance inicial de vacaciones
      if (employee.position?.startDate) {
        try {
          await VacationBalance.getOrCreateCurrent(employee.id, employee.position.startDate);
        } catch (vacationError) {
          console.warn('Error creating vacation balance:', vacationError);
        }
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employee.id,
        'personal_info_update',
        'Empleado creado en el sistema',
        {
          action: 'create',
          employeeNumber: employee.employeeNumber,
          department: employee.position.department,
          position: employee.position.title
        },
        createdBy,
        req
      );

      res.status(201).json({
        success: true,
        data: { employee },
        message: 'Empleado creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear el empleado',
        details: error.message
      });
    }
  }

  /**
   * Actualiza un empleado existente
   * PUT /api/employees/:id
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user?.id || null;

      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Guardar valores anteriores para el historial
      const oldValues = {
        personalInfo: { ...employee.personalInfo },
        position: { ...employee.position },
        location: { ...employee.location },
        contract: { ...employee.contract },
        status: employee.status
      };

      // Validar unicidad solo si los campos han cambiado
      const validationPromises = [];
      
      if (updateData.personalInfo?.email && 
          updateData.personalInfo.email !== employee.personalInfo.email) {
        validationPromises.push(
          Employee.emailExists(updateData.personalInfo.email, id)
            .then(exists => exists ? 'email' : null)
        );
      }
      
      if (updateData.personalInfo?.phone && 
          updateData.personalInfo.phone !== employee.personalInfo.phone) {
        validationPromises.push(
          Employee.phoneExists(updateData.personalInfo.phone, id)
            .then(exists => exists ? 'phone' : null)
        );
      }
      
      if (updateData.personalInfo?.rfc && 
          updateData.personalInfo.rfc !== employee.personalInfo.rfc) {
        validationPromises.push(
          Employee.rfcExists(updateData.personalInfo.rfc, id)
            .then(exists => exists ? 'rfc' : null)
        );
      }

      const validationResults = await Promise.all(validationPromises);
      const duplicateFields = validationResults.filter(result => result !== null);

      if (duplicateFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Los siguientes campos ya existen: ${duplicateFields.join(', ')}`
        });
      }

      // Actualizar empleado
      await employee.update(updateData, updatedBy);

      // Registrar cambios en historial
      const changes = [];
      
      // Detectar cambios específicos
      if (updateData.personalInfo && JSON.stringify(oldValues.personalInfo) !== JSON.stringify(employee.personalInfo)) {
        changes.push({
          type: 'personal_info_update',
          description: 'Información personal actualizada',
          details: { oldValue: oldValues.personalInfo, newValue: employee.personalInfo }
        });
      }
      
      if (updateData.position && JSON.stringify(oldValues.position) !== JSON.stringify(employee.position)) {
        changes.push({
          type: 'position_change',
          description: 'Información laboral actualizada',
          details: { oldValue: oldValues.position, newValue: employee.position }
        });
      }
      
      if (updateData.contract && JSON.stringify(oldValues.contract) !== JSON.stringify(employee.contract)) {
        changes.push({
          type: 'contract_update',
          description: 'Contrato actualizado',
          details: { oldValue: oldValues.contract, newValue: employee.contract }
        });
      }
      
      if (updateData.status && oldValues.status !== employee.status) {
        changes.push({
          type: 'status_change',
          description: `Estado cambiado de ${oldValues.status} a ${employee.status}`,
          details: { oldValue: oldValues.status, newValue: employee.status }
        });
      }

      // Crear registros de historial para cada cambio
      for (const change of changes) {
        await EmployeeHistory.createHistoryRecord(
          employee.id,
          change.type,
          change.description,
          change.details,
          updatedBy,
          req
        );
      }

      res.json({
        success: true,
        data: { employee },
        message: 'Empleado actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar el empleado',
        details: error.message
      });
    }
  }

  /**
   * Elimina un empleado (soft delete)
   * DELETE /api/employees/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const deletedBy = req.user?.id || null;

      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      await employee.delete(deletedBy);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employee.id,
        'status_change',
        'Empleado dado de baja del sistema',
        {
          action: 'delete',
          previousStatus: employee.status,
          employeeNumber: employee.employeeNumber
        },
        deletedBy,
        req
      );

      res.json({
        success: true,
        message: 'Empleado eliminado exitosamente',
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar el empleado',
        details: error.message
      });
    }
  }

  /**
   * Importa empleados desde archivo Excel
   * POST /api/employees/import
   */
  static async importEmployees(req, res) {
    try {
      const file = req.file;
      const options = req.body.options ? JSON.parse(req.body.options) : {};

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo para importar'
        });
      }

      // TODO: Implementar lógica de importación de Excel
      // Por ahora devolver respuesta simulada
      res.json({
        success: true,
        data: {
          imported: 0,
          updated: 0,
          errors: []
        },
        message: 'Funcionalidad de importación en desarrollo'
      });
    } catch (error) {
      console.error('Error importing employees:', error);
      res.status(500).json({
        success: false,
        error: 'Error al importar empleados',
        details: error.message
      });
    }
  }

  /**
   * Exporta empleados a Excel/CSV
   * GET /api/employees/export
   */
  static async exportEmployees(req, res) {
    try {
      const { format = 'excel', filters = {}, fields = [] } = req.query;

      // TODO: Implementar lógica de exportación
      // Por ahora devolver respuesta simulada
      res.json({
        success: true,
        message: 'Funcionalidad de exportación en desarrollo',
        format,
        filters,
        fields
      });
    } catch (error) {
      console.error('Error exporting employees:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar empleados',
        details: error.message
      });
    }
  }

  /**
   * Obtiene empleados por departamento
   * GET /api/employees/department/:department
   */
  static async getByDepartment(req, res) {
    try {
      const { department } = req.params;
      
      const employees = await Employee.getByDepartment(department);
      
      res.json({
        success: true,
        data: { employees },
        count: employees.length
      });
    } catch (error) {
      console.error('Error getting employees by department:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener empleados por departamento',
        details: error.message
      });
    }
  }

  /**
   * Busca empleados por término de búsqueda
   * GET /api/employees/search
   */
  static async search(req, res) {
    try {
      const { q: search = '', limit = 10 } = req.query;

      if (!search || search.length < 2) {
        return res.json({
          success: true,
          data: { employees: [] },
          message: 'Término de búsqueda muy corto'
        });
      }

      const result = await Employee.list({
        search,
        limit: parseInt(limit),
        page: 1
      });

      res.json({
        success: true,
        data: { 
          employees: result.employees,
          total: result.pagination.total
        }
      });
    } catch (error) {
      console.error('Error searching employees:', error);
      res.status(500).json({
        success: false,
        error: 'Error al buscar empleados',
        details: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas generales de empleados
   * GET /api/employees/stats
   */
  static async getStats(req, res) {
    try {
      const summary = await Employee.getSummary();
      
      // Obtener estadísticas adicionales
      const departmentStats = {};
      const levelStats = {};
      
      // TODO: Implementar estadísticas más detalladas
      
      res.json({
        success: true,
        data: {
          summary,
          byDepartment: departmentStats,
          byLevel: levelStats,
          trends: {
            // TODO: Implementar tendencias
          }
        }
      });
    } catch (error) {
      console.error('Error getting employee stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas de empleados',
        details: error.message
      });
    }
  }

  /**
   * Obtiene el organigrama de la empresa
   * GET /api/employees/org-chart
   */
  static async getOrgChart(req, res) {
    try {
      const { department = null } = req.query;
      
      let query = { status: 'active' };
      if (department) {
        query.department = department;
      }
      
      const result = await Employee.list({ 
        ...query,
        limit: 1000, // Obtener todos los empleados activos
        page: 1
      });
      
      const employees = result.employees;
      
      // Construir estructura jerárquica
      const orgChart = EmployeeController.buildOrgChart(employees);
      
      res.json({
        success: true,
        data: { orgChart }
      });
    } catch (error) {
      console.error('Error getting org chart:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener organigrama',
        details: error.message
      });
    }
  }

  /**
   * Construye la estructura jerárquica del organigrama
   */
  static buildOrgChart(employees) {
    const employeeMap = new Map();
    const rootEmployees = [];
    
    // Crear mapa de empleados
    employees.forEach(employee => {
      employeeMap.set(employee.id, {
        id: employee.id,
        name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        position: employee.position.title,
        department: employee.position.department,
        level: employee.position.level,
        reportsTo: employee.position.reportsTo,
        avatar: employee.personalInfo.avatar,
        children: []
      });
    });
    
    // Construir jerarquía
    employeeMap.forEach(employee => {
      if (employee.reportsTo && employeeMap.has(employee.reportsTo)) {
        employeeMap.get(employee.reportsTo).children.push(employee);
      } else {
        rootEmployees.push(employee);
      }
    });
    
    return rootEmployees;
  }

  /**
   * Obtiene empleados próximos a cumpleaños
   * GET /api/employees/birthdays
   */
  static async getUpcomingBirthdays(req, res) {
    try {
      const { days = 30 } = req.query;
      
      // TODO: Implementar lógica para obtener cumpleaños próximos
      // Por ahora devolver array vacío
      
      res.json({
        success: true,
        data: { birthdays: [] },
        message: 'Funcionalidad de cumpleaños en desarrollo'
      });
    } catch (error) {
      console.error('Error getting upcoming birthdays:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener cumpleaños próximos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene empleados próximos a jubilarse
   * GET /api/employees/retirement
   */
  static async getUpcomingRetirements(req, res) {
    try {
      const { years = 2 } = req.query;
      
      // TODO: Implementar lógica para calcular jubilaciones próximas
      
      res.json({
        success: true,
        data: { retirements: [] },
        message: 'Funcionalidad de jubilaciones en desarrollo'
      });
    } catch (error) {
      console.error('Error getting upcoming retirements:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener jubilaciones próximas',
        details: error.message
      });
    }
  }
}

module.exports = EmployeeController;
