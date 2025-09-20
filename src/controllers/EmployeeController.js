const Employee = require('../models/Employee');
// PayrollPeriod eliminado - solo funcionalidad individual
const AttendanceRecord = require('../models/AttendanceRecord');
const VacationRequest = require('../models/VacationRequest');
const VacationBalance = require('../models/VacationBalance');
const EmployeeDocument = require('../models/EmployeeDocument');
const Incident = require('../models/Incident');
const { Evaluation } = require('../models/Evaluation');
const { Skill, Certification } = require('../models/Skill');
const EmployeeHistory = require('../models/EmployeeHistory');
const ExcelJS = require('exceljs');

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
        Promise.resolve({}), // PayrollPeriod eliminado
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

      try {
        await employee.save();
      } catch (error) {
        if (error.message.includes('Errores de validación:')) {
          return res.status(400).json({
            success: false,
            error: 'Error al crear el empleado',
            details: error.message
          });
        }
        throw error;
      }

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
      const options = req.body.options ? JSON.parse(req.body.options) : {
        updateExisting: false,
        skipErrors: false,
        validateData: true
      };

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo para importar'
        });
      }

      // Leer archivo Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const worksheet = workbook.worksheets[0];
      
      const jsonData = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezados
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = worksheet.getRow(1).getCell(colNumber).value;
          if (header) {
            rowData[header] = cell.value;
          }
        });
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData);
        }
      });

      if (jsonData.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'El archivo Excel está vacío o no contiene datos válidos'
        });
      }

      const results = {
        imported: 0,
        updated: 0,
        errors: [],
        skipped: 0,
        total: jsonData.length
      };

      const createdBy = req.user?.id || null;

      // Procesar cada fila
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la fila 1 es encabezado

        try {
          // Mapear datos del Excel a estructura Employee
          const employeeData = EmployeeController.mapExcelRowToEmployee(row);
          
          // Validar datos requeridos
          if (options.validateData) {
            const validationErrors = EmployeeController.validateEmployeeData(employeeData);
            if (validationErrors.length > 0) {
              results.errors.push({
                row: rowNumber,
                field: 'validation',
                message: validationErrors.join(', ')
              });
              if (!options.skipErrors) continue;
            }
          }

          // Verificar si el empleado ya existe
          const existingEmployee = await Employee.findByEmployeeNumber(employeeData.employeeNumber);
          
          if (existingEmployee) {
            if (options.updateExisting) {
              // Actualizar empleado existente
              await existingEmployee.update(employeeData, createdBy);
              results.updated++;
              
              // Registrar en historial
              await EmployeeHistory.createHistoryRecord(
                existingEmployee.id,
                'personal_info_update',
                'Empleado actualizado mediante importación masiva',
                { action: 'import_update', rowNumber, employeeNumber: employeeData.employeeNumber },
                createdBy,
                req
              );
            } else {
              results.errors.push({
                row: rowNumber,
                field: 'employeeNumber',
                message: `Empleado con número ${employeeData.employeeNumber} ya existe`
              });
              if (!options.skipErrors) continue;
            }
          } else {
            // Crear nuevo empleado
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
                console.warn('Error creating vacation balance for imported employee:', vacationError);
              }
            }

            // Registrar en historial
            await EmployeeHistory.createHistoryRecord(
              employee.id,
              'personal_info_update',
              'Empleado creado mediante importación masiva',
              { action: 'import_create', rowNumber, employeeNumber: employeeData.employeeNumber },
              createdBy,
              req
            );

            results.imported++;
          }

        } catch (error) {
          results.errors.push({
            row: rowNumber,
            field: 'general',
            message: error.message
          });
          
          if (!options.skipErrors) {
            console.error(`Error processing row ${rowNumber}:`, error);
          }
        }
      }

      // Determinar mensaje de resultado
      let message = '';
      if (results.errors.length === 0) {
        message = `Importación exitosa: ${results.imported} empleados creados, ${results.updated} actualizados`;
      } else if (results.imported > 0 || results.updated > 0) {
        message = `Importación parcial: ${results.imported} creados, ${results.updated} actualizados, ${results.errors.length} errores`;
      } else {
        message = `Importación falló: ${results.errors.length} errores encontrados`;
      }

      res.json({
        success: results.errors.length === 0 || results.imported > 0 || results.updated > 0,
        data: results,
        message
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
   * Mapea una fila de Excel a la estructura de datos Employee
   */
  static mapExcelRowToEmployee(row) {
    // Mapeo de valores en español a inglés para tipos de contrato
    const contractTypeMap = {
      'Permanente': 'permanent',
      'Temporal': 'temporary',
      'Interno': 'intern',
      'Contratista': 'contractor',
      'Contrato': 'contractor'
    };

    // Mapeo de valores en español a inglés para estados
    const statusMap = {
      'Activo': 'active',
      'Inactivo': 'inactive',
      'Terminado': 'terminated',
      'En Licencia': 'on_leave',
      'Suspendido': 'inactive'
    };

    // Mapeo de valores en español a inglés para niveles
    const levelMap = {
      'Entrada': 'Entry',
      'Junior': 'Junior',
      'Medio': 'Mid',
      'Senior': 'Senior',
      'Líder': 'Lead',
      'Gerente': 'Manager',
      'Director': 'Director',
      'Ejecutivo': 'Executive'
    };

    // Mapeo de valores en español a inglés para géneros
    const genderMap = {
      'Masculino': 'M',
      'Femenino': 'F',
      'Otro': 'O',
      'No especificado': null
    };

    // Obtener valor de tipo de contrato y mapearlo
    const contractTypeRaw = row['Tipo de Contrato'] || row['Contract Type'] || row['contractType'] || 'Permanente';
    const contractType = contractTypeMap[contractTypeRaw] || contractTypeRaw;

    // Obtener valor de estado del empleado y mapearlo (no el estado geográfico)
    const statusRaw = row['Estado del Empleado'] || row['Employee Status'] || row['Estado'] || row['Status'] || row['status'] || 'Activo';
    const status = statusMap[statusRaw] || statusRaw;

    // Obtener valor de nivel y mapearlo
    const levelRaw = row['Nivel'] || row['Level'] || row['level'] || 'Junior';
    const level = levelMap[levelRaw] || levelRaw;

    // Obtener valor de género y mapearlo
    const genderRaw = row['Género'] || row['Gender'] || row['gender'] || null;
    const gender = genderMap[genderRaw] || genderRaw;

    return {
      employeeNumber: row['Número de Empleado'] || row['Employee Number'] || row['employeeNumber'],
      personalInfo: {
        firstName: row['Nombre'] || row['First Name'] || row['firstName'] || '',
        lastName: row['Apellido'] || row['Last Name'] || row['lastName'] || '',
        email: row['Email'] || row['email'] || null,
        phone: row['Teléfono'] || row['Phone'] || row['phone'] || '',
        dateOfBirth: row['Fecha de Nacimiento'] || row['Date of Birth'] || row['dateOfBirth'] || null,
        gender: gender,
        maritalStatus: row['Estado Civil'] || row['Marital Status'] || row['maritalStatus'] || null,
        nationality: row['Nacionalidad'] || row['Nationality'] || row['nationality'] || 'Mexicana',
        rfc: row['RFC'] || row['rfc'] || null,
        curp: row['CURP'] || row['curp'] || null,
        nss: row['NSS'] || row['nss'] || null,
        address: {
          street: row['Calle'] || row['Street'] || row['street'] || '',
          number: row['Número'] || row['Number'] || row['number'] || '',
          neighborhood: row['Colonia'] || row['Neighborhood'] || row['neighborhood'] || '',
          city: row['Ciudad'] || row['City'] || row['city'] || '',
          state: row['Estado'] || row['State'] || row['state'] || '',
          country: row['País'] || row['Country'] || row['country'] || 'México',
          postalCode: row['Código Postal'] || row['Postal Code'] || row['postalCode'] || '',
          zipCode: row['Código Postal'] || row['Postal Code'] || row['zipCode'] || ''
        }
      },
      position: {
        title: row['Puesto'] || row['Position'] || row['title'] || '',
        department: row['Departamento'] || row['Department'] || row['department'] || '',
        level: level,
        reportsTo: row['Reporta a'] || row['Reports To'] || row['reportsTo'] || null,
        jobDescription: row['Descripción del Puesto'] || row['Job Description'] || row['jobDescription'] || null,
        startDate: row['Fecha de Inicio'] || row['Start Date'] || row['startDate'] || new Date().toISOString(),
        endDate: row['Fecha de Fin'] || row['End Date'] || row['endDate'] || null
      },
      location: {
        name: row['Ubicación'] || row['Location'] || row['location'] || '',
        office: row['Oficina'] || row['Office'] || row['office'] || '',
        address: {
          street: row['Calle Oficina'] || row['Office Street'] || row['officeStreet'] || '',
          number: row['Número Oficina'] || row['Office Number'] || row['officeNumber'] || '',
          neighborhood: row['Colonia Oficina'] || row['Office Neighborhood'] || row['officeNeighborhood'] || '',
          city: row['Ciudad Oficina'] || row['Office City'] || row['officeCity'] || '',
          state: row['Estado Oficina'] || row['Office State'] || row['officeState'] || '',
          country: row['País Oficina'] || row['Office Country'] || row['officeCountry'] || 'México',
          postalCode: row['Código Postal Oficina'] || row['Office Postal Code'] || row['officePostalCode'] || ''
        }
      },
      contract: {
        type: contractType,
        startDate: row['Fecha de Contrato'] || row['Contract Start'] || row['contractStart'] || new Date().toISOString(),
        endDate: row['Fecha de Fin Contrato'] || row['Contract End'] || row['contractEnd'] || null,
        salary: parseFloat(row['Salario'] || row['Salary'] || row['salary'] || 0),
        benefits: row['Beneficios'] || row['Benefits'] || row['benefits'] || [],
        notes: row['Notas Contrato'] || row['Contract Notes'] || row['contractNotes'] || null
      },
      salary: {
        baseSalary: parseFloat(row['Salario Base'] || row['Base Salary'] || row['baseSalary'] || row['Salario'] || row['Salary'] || row['salary'] || 0),
        currency: row['Moneda'] || row['Currency'] || row['currency'] || 'MXN',
        frequency: row['Frecuencia'] || row['Frequency'] || row['frequency'] || 'monthly',
        paymentMethod: row['Método de Pago'] || row['Payment Method'] || row['paymentMethod'] || 'bank_transfer'
      },
      sbc: parseFloat(row['SBC'] || row['sbc'] || 0),
      vacationBalance: parseFloat(row['Días de Vacaciones'] || row['Vacation Days'] || row['vacationDays'] || 0),
      sickLeaveBalance: parseFloat(row['Días de Enfermedad'] || row['Sick Leave Days'] || row['sickLeaveDays'] || 0),
      status: status
    };
  }

  /**
   * Valida los datos de un empleado antes de guardar
   */
  static validateEmployeeData(employeeData) {
    const errors = [];

    // Validar campos requeridos
    if (!employeeData.personalInfo?.firstName || employeeData.personalInfo.firstName.length < 2) {
      errors.push('El nombre es requerido y debe tener al menos 2 caracteres');
    }

    if (!employeeData.personalInfo?.lastName || employeeData.personalInfo.lastName.length < 2) {
      errors.push('Los apellidos son requeridos y deben tener al menos 2 caracteres');
    }

    if (!employeeData.personalInfo?.phone || employeeData.personalInfo.phone.length < 10) {
      errors.push('El teléfono es requerido');
    }

    if (!employeeData.position?.level) {
      errors.push('El nivel del puesto es requerido');
    } else {
      const validLevels = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive'];
      if (!validLevels.includes(employeeData.position.level)) {
        errors.push('El nivel del puesto no es válido');
      }
    }

    // Validar email si se proporciona
    if (employeeData.personalInfo?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(employeeData.personalInfo.email)) {
        errors.push('El formato del email no es válido');
      }
    }

    // Validar salario
    if (employeeData.salary?.baseSalary && (isNaN(employeeData.salary.baseSalary) || employeeData.salary.baseSalary < 0)) {
      errors.push('El salario debe ser un número válido mayor o igual a 0');
    }

    return errors;
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

  /**
   * Corrige el status de empleados que tienen valores incorrectos
   * POST /api/employees/fix-status
   */
  static async fixEmployeeStatus(req, res) {
    try {
      const { employeeId } = req.params;
      
      if (employeeId) {
        // Corregir empleado específico
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          return res.status(404).json({
            success: false,
            error: 'Empleado no encontrado'
          });
        }

        // Si el status es "CDMX", cambiarlo a "active"
        if (employee.status === 'CDMX') {
          await employee.update({ status: 'active' }, req.user?.id || null);
          
          res.json({
            success: true,
            message: 'Status del empleado corregido exitosamente',
            data: { employeeId, oldStatus: 'CDMX', newStatus: 'active' }
          });
        } else {
          res.json({
            success: true,
            message: 'El empleado ya tiene un status válido',
            data: { employeeId, currentStatus: employee.status }
          });
        }
      } else {
        // Corregir todos los empleados con status incorrecto
        const result = await Employee.fixInvalidStatuses();
        
        res.json({
          success: true,
          message: `Corregidos ${result.fixed} empleados con status inválido`,
          data: result
        });
      }
    } catch (error) {
      console.error('Error fixing employee status:', error);
      res.status(500).json({
        success: false,
        error: 'Error al corregir status de empleados',
        details: error.message
      });
    }
  }
}

module.exports = EmployeeController;
