const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Modelo de Empleado - Núcleo del sistema de Recursos Humanos
 * Gestiona toda la información integral de los empleados
 */
class Employee {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeNumber = data.employeeNumber || null; // Se genera automáticamente
    
    // Información Personal
    this.personalInfo = {
      firstName: data.personalInfo?.firstName || data.firstName || '',
      lastName: data.personalInfo?.lastName || data.lastName || '',
      email: data.personalInfo?.email || data.email || null,
      phone: data.personalInfo?.phone || data.phone || '',
      avatar: data.personalInfo?.avatar || null,
      dateOfBirth: data.personalInfo?.dateOfBirth || data.personalInfo?.birthDate || null,
      gender: data.personalInfo?.gender || null, // 'M' | 'F' | 'O'
      maritalStatus: data.personalInfo?.maritalStatus || null,
      nationality: data.personalInfo?.nationality || null,
      rfc: data.personalInfo?.rfc || null,
      curp: data.personalInfo?.curp || null,
      nss: data.personalInfo?.nss || null,
      address: {
        street: data.personalInfo?.address?.street || '',
        city: data.personalInfo?.address?.city || '',
        state: data.personalInfo?.address?.state || '',
        country: data.personalInfo?.address?.country || 'México',
        postalCode: data.personalInfo?.address?.postalCode || '',
        number: data.personalInfo?.address?.number || '',
        neighborhood: data.personalInfo?.address?.neighborhood || '',
        zipCode: data.personalInfo?.address?.zipCode || ''
      },
      emergencyContact: data.personalInfo?.emergencyContact || null,
      bankInfo: data.personalInfo?.bankInfo || null
    };
    
    // Información Laboral
    this.position = {
      id: data.position?.id || '',
      title: data.position?.title || '',
      department: data.position?.department || '',
      level: data.position?.level || 'Junior', // 'Entry' | 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Manager' | 'Director' | 'Executive'
      reportsTo: data.position?.reportsTo || null,
      jobDescription: data.position?.jobDescription || null,
      requirements: data.position?.requirements || [],
      skills: data.position?.skills || [],
      salaryRange: data.position?.salaryRange || { min: 0, max: 0 },
      startDate: data.position?.startDate || new Date().toISOString(),
      endDate: data.position?.endDate || null
    };
    
    // Ubicación
    this.location = {
      id: data.location?.id || '',
      name: data.location?.name || '',
      office: data.location?.office || '',
      address: data.location?.address || data.location?.address || '',
      street: data.location?.address?.street || '',
      number: data.location?.address?.number || '',
      neighborhood: data.location?.address?.neighborhood || '',
      city: data.location?.city || '',
      state: data.location?.state || '',
      country: data.location?.country || 'México',
      postalCode: data.location?.postalCode || '',
      zipCode: data.location?.address?.zipCode || '',
      timezone: data.location?.timezone || 'America/Mexico_City',
      isRemote: data.location?.isRemote || false
    };
    
    // Contrato
    this.contract = {
      type: data.contract?.type || 'permanent', // 'permanent' | 'temporary' | 'intern' | 'contractor'
      startDate: data.contract?.startDate || data.hireDate || new Date().toISOString(),
      endDate: data.contract?.endDate || null,
      salary: data.contract?.salary || data.salary?.baseSalary || 0,
      currency: data.contract?.currency || 'MXN',
      workingDays: data.contract?.workingDays || 'Lunes a Viernes',
      workingHoursRange: data.contract?.workingHoursRange || '09:00-18:00',
      customSchedule: data.contract?.customSchedule || {
        enabled: false,
        days: {
          lunes: { enabled: true, startTime: '09:00', endTime: '18:00' },
          martes: { enabled: true, startTime: '09:00', endTime: '18:00' },
          miercoles: { enabled: true, startTime: '09:00', endTime: '18:00' },
          jueves: { enabled: true, startTime: '09:00', endTime: '18:00' },
          viernes: { enabled: true, startTime: '09:00', endTime: '18:00' },
          sabado: { enabled: false, startTime: '09:00', endTime: '18:00' },
          domingo: { enabled: false, startTime: '09:00', endTime: '18:00' }
        }
      },
      benefits: data.contract?.benefits || [],
      clauses: data.contract?.clauses || [],
      schedule: data.contract?.schedule || '',
      notes: data.contract?.notes || null
    };
    
    // Estado del empleado
    this.status = data.status || 'active'; // 'active' | 'inactive' | 'terminated' | 'on_leave'
    
    // Información de salario (estructura del frontend)
    this.salary = data.salary || {
      baseSalary: data.salary?.baseSalary || 0,
      currency: data.salary?.currency || 'MXN',
      frequency: data.salary?.frequency || 'monthly',
      paymentMethod: data.salary?.paymentMethod || 'bank_transfer',
      allowances: data.salary?.allowances || [],
      deductions: data.salary?.deductions || []
    };
    
    // Campos adicionales
    this.sbc = data.sbc || 0;
    this.vacationBalance = data.vacationBalance || 0;
    this.sickLeaveBalance = data.sickLeaveBalance || 0;
    this.metrics = data.metrics || {
      totalEarnings: 0,
      totalDeductions: 0,
      netPay: 0,
      attendanceRate: 100,
      lateArrivals: 0,
      absences: 0,
      vacationDaysUsed: 0,
      vacationDaysRemaining: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      incidentsCount: 0,
      incidentsLast30Days: 0,
      documentCompliance: 0,
      trainingCompletion: 0,
      performanceScore: 0
    };
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || null;
    this.updatedBy = data.updatedBy || null;
  }

  /**
   * Genera automáticamente el número de empleado
   */
  static async generateEmployeeNumber() {
    try {
      const employeesRef = db.collection('employees');
      const snapshot = await employeesRef
        .orderBy('employeeNumber', 'desc')
        .limit(1)
        .get();
      
      let lastNumber = 0;
      if (!snapshot.empty) {
        const lastEmployee = snapshot.docs[0].data();
        if (lastEmployee.employeeNumber) {
          lastNumber = parseInt(lastEmployee.employeeNumber.replace('EMP', ''));
        }
      }
      
      return `EMP${String(lastNumber + 1).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating employee number:', error);
      return `EMP001`;
    }
  }

  /**
   * Valida los datos del empleado
   */
  validate() {
    const errors = [];

    // Validaciones de información personal
    if (!this.personalInfo.firstName || this.personalInfo.firstName.length < 2) {
      errors.push('El nombre es requerido y debe tener al menos 2 caracteres');
    }

    if (!this.personalInfo.lastName || this.personalInfo.lastName.length < 2) {
      errors.push('Los apellidos son requeridos y deben tener al menos 2 caracteres');
    }

    if (!this.personalInfo.phone) {
      errors.push('El teléfono es requerido');
    }

    // Validaciones de información laboral
    if (!this.position.title) {
      errors.push('El puesto es requerido');
    }

    if (!this.position.department) {
      errors.push('El departamento es requerido');
    }

    const validLevels = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive'];
    if (!validLevels.includes(this.position.level)) {
      errors.push('El nivel del puesto no es válido');
    }

    // Validaciones de contrato
    const validContractTypes = ['permanent', 'temporary', 'intern', 'contractor'];
    if (!validContractTypes.includes(this.contract.type)) {
      errors.push('El tipo de contrato no es válido');
    }

    if (this.contract.salary < 0) {
      errors.push('El salario debe ser mayor o igual a 0');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeNumber: this.employeeNumber,
      personalInfo: this.personalInfo,
      position: this.position,
      location: this.location,
      contract: this.contract,
      status: this.status,
      salary: this.salary,
      sbc: this.sbc,
      vacationBalance: this.vacationBalance,
      sickLeaveBalance: this.sickLeaveBalance,
      metrics: this.metrics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy
    };
  }

  /**
   * Crea un empleado desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new Employee({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el empleado en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      // Generar número de empleado si no existe
      if (!this.employeeNumber) {
        this.employeeNumber = await Employee.generateEmployeeNumber();
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.id);
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving employee:', error);
      throw error;
    }
  }

  /**
   * Actualiza el empleado
   */
  async update(data, updatedBy = null) {
    try {
      // Actualizar solo los campos proporcionados
      if (data.personalInfo) {
        this.personalInfo = { ...this.personalInfo, ...data.personalInfo };
      }
      if (data.position) {
        this.position = { ...this.position, ...data.position };
      }
      if (data.location) {
        this.location = { ...this.location, ...data.location };
      }
      if (data.contract) {
        this.contract = { ...this.contract, ...data.contract };
      }
      if (data.status) {
        this.status = data.status;
      }
      if (data.salary) {
        this.salary = { ...this.salary, ...data.salary };
      }
      if (data.sbc !== undefined) {
        this.sbc = data.sbc;
      }
      if (data.vacationBalance !== undefined) {
        this.vacationBalance = data.vacationBalance;
      }
      if (data.sickLeaveBalance !== undefined) {
        this.sickLeaveBalance = data.sickLeaveBalance;
      }
      if (data.metrics) {
        this.metrics = { ...this.metrics, ...data.metrics };
      }

      this.updatedAt = new Date().toISOString();
      this.updatedBy = updatedBy;

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.id);
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }

  /**
   * Elimina el empleado (soft delete)
   */
  async delete(deletedBy = null) {
    try {
      this.status = 'terminated';
      this.updatedAt = new Date().toISOString();
      this.updatedBy = deletedBy;

      const docRef = db.collection('employees').doc(this.id);
      await docRef.update({
        status: this.status,
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy,
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy
      });

      return this;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

  /**
   * Busca un empleado por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('employees').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return Employee.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding employee by ID:', error);
      throw error;
    }
  }

  /**
   * Busca un empleado por número de empleado
   */
  static async findByEmployeeNumber(employeeNumber) {
    try {
      const snapshot = await db.collection('employees')
        .where('employeeNumber', '==', employeeNumber)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      return Employee.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      console.error('Error finding employee by number:', error);
      throw error;
    }
  }

  /**
   * Lista empleados con filtros y paginación
   */
  static async list(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        department = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      let query = db.collection('employees');

      // Filtros
      if (department) {
        query = query.where('position.department', '==', department);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      // Ordenamiento
      query = query.orderBy(sortBy, sortOrder);

      // Paginación
      const offset = (page - 1) * limit;
      if (offset > 0) {
        const offsetSnapshot = await query.limit(offset).get();
        if (!offsetSnapshot.empty) {
          const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      const employees = [];

      snapshot.forEach(doc => {
        const employee = Employee.fromFirestore(doc);
        
        // Filtro de búsqueda (se hace en memoria por limitaciones de Firestore)
        if (search) {
          const searchLower = search.toLowerCase();
          const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.toLowerCase();
          const email = (employee.personalInfo.email || '').toLowerCase();
          const employeeNumber = (employee.employeeNumber || '').toLowerCase();
          
          if (fullName.includes(searchLower) || 
              email.includes(searchLower) || 
              employeeNumber.includes(searchLower)) {
            employees.push(employee);
          }
        } else {
          employees.push(employee);
        }
      });

      // Obtener total para paginación
      let totalQuery = db.collection('employees');
      if (department) {
        totalQuery = totalQuery.where('position.department', '==', department);
      }
      if (status) {
        totalQuery = totalQuery.where('status', '==', status);
      }

      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        employees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error listing employees:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de empleados por estado
   */
  static async getSummary() {
    try {
      const snapshot = await db.collection('employees').get();
      
      const summary = {
        total: 0,
        active: 0,
        inactive: 0,
        terminated: 0,
        on_leave: 0
      };

      snapshot.forEach(doc => {
        const employee = doc.data();
        summary.total++;
        summary[employee.status] = (summary[employee.status] || 0) + 1;
      });

      return summary;
    } catch (error) {
      console.error('Error getting employees summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene empleados por departamento
   */
  static async getByDepartment(department) {
    try {
      const snapshot = await db.collection('employees')
        .where('position.department', '==', department)
        .where('status', '==', 'active')
        .get();

      const employees = [];
      snapshot.forEach(doc => {
        employees.push(Employee.fromFirestore(doc));
      });

      return employees;
    } catch (error) {
      console.error('Error getting employees by department:', error);
      throw error;
    }
  }

  /**
   * Verifica si un email ya existe
   */
  static async emailExists(email, excludeId = null) {
    try {
      if (!email) return false;
      
      let query = db.collection('employees').where('personalInfo.email', '==', email);
      
      if (excludeId) {
        query = query.where(FieldValue.documentId(), '!=', excludeId);
      }

      const snapshot = await query.limit(1).get();
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking email existence:', error);
      return false;
    }
  }

  /**
   * Verifica si un teléfono ya existe
   */
  static async phoneExists(phone, excludeId = null) {
    try {
      if (!phone) return false;
      
      let query = db.collection('employees').where('personalInfo.phone', '==', phone);
      
      if (excludeId) {
        query = query.where(FieldValue.documentId(), '!=', excludeId);
      }

      const snapshot = await query.limit(1).get();
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking phone existence:', error);
      return false;
    }
  }

  /**
   * Verifica si un RFC ya existe
   */
  static async rfcExists(rfc, excludeId = null) {
    try {
      if (!rfc) return false;
      
      let query = db.collection('employees').where('personalInfo.rfc', '==', rfc);
      
      if (excludeId) {
        query = query.where(FieldValue.documentId(), '!=', excludeId);
      }

      const snapshot = await query.limit(1).get();
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking RFC existence:', error);
      return false;
    }
  }
}

module.exports = Employee;
