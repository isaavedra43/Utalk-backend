const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Período de Nómina
 * Gestiona los períodos de pago y cálculos salariales
 */
class PayrollPeriod {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.periodStart = data.periodStart || '';
    this.periodEnd = data.periodEnd || '';
    this.weekNumber = data.weekNumber || 0;
    this.year = data.year || new Date().getFullYear();
    
    // Salarios
    this.grossSalary = data.grossSalary || 0;
    this.baseSalary = data.baseSalary || 0;
    this.overtime = data.overtime || 0;
    this.bonuses = data.bonuses || 0;
    this.commissions = data.commissions || 0;
    
    // Deducciones
    this.taxes = data.taxes || 0;
    this.socialSecurity = data.socialSecurity || 0;
    this.healthInsurance = data.healthInsurance || 0;
    this.retirement = data.retirement || 0;
    this.otherDeductions = data.otherDeductions || 0;
    
    // Resultado final
    this.netSalary = data.netSalary || 0;
    
    // Estado
    this.status = data.status || 'draft'; // 'draft' | 'calculated' | 'approved' | 'paid'
    this.paidDate = data.paidDate || null;
    this.paymentMethod = data.paymentMethod || null;
    
    // Archivos
    this.receiptUrl = data.receiptUrl || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Calcula el salario neto automáticamente
   */
  calculateNetSalary() {
    const totalPerceptions = this.grossSalary + this.overtime + this.bonuses + this.commissions;
    const totalDeductions = this.taxes + this.socialSecurity + this.healthInsurance + this.retirement + this.otherDeductions;
    this.netSalary = totalPerceptions - totalDeductions;
    return this.netSalary;
  }

  /**
   * Calcula las deducciones automáticamente basado en el salario bruto
   */
  calculateDeductions() {
    // Cálculo básico de deducciones (se puede personalizar según las leyes locales)
    this.taxes = this.grossSalary * 0.16; // ISR aproximado
    this.socialSecurity = this.grossSalary * 0.0725; // IMSS aproximado
    this.healthInsurance = this.grossSalary * 0.02; // Seguro médico aproximado
    this.retirement = this.grossSalary * 0.0625; // AFORE aproximado
    
    this.calculateNetSalary();
  }

  /**
   * Valida los datos del período de nómina
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.periodStart) {
      errors.push('La fecha de inicio del período es requerida');
    }

    if (!this.periodEnd) {
      errors.push('La fecha de fin del período es requerida');
    }

    if (new Date(this.periodStart) >= new Date(this.periodEnd)) {
      errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (this.grossSalary < 0) {
      errors.push('El salario bruto no puede ser negativo');
    }

    const validStatuses = ['draft', 'calculated', 'approved', 'paid'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado del período no es válido');
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
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      weekNumber: this.weekNumber,
      year: this.year,
      grossSalary: this.grossSalary,
      baseSalary: this.baseSalary,
      overtime: this.overtime,
      bonuses: this.bonuses,
      commissions: this.commissions,
      taxes: this.taxes,
      socialSecurity: this.socialSecurity,
      healthInsurance: this.healthInsurance,
      retirement: this.retirement,
      otherDeductions: this.otherDeductions,
      netSalary: this.netSalary,
      status: this.status,
      paidDate: this.paidDate,
      paymentMethod: this.paymentMethod,
      receiptUrl: this.receiptUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un período de nómina desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new PayrollPeriod({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el período de nómina en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('payroll').doc(this.id);
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving payroll period:', error);
      throw error;
    }
  }

  /**
   * Actualiza el período de nómina
   */
  async update(data) {
    try {
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('payroll').doc(this.id);
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating payroll period:', error);
      throw error;
    }
  }

  /**
   * Busca un período de nómina por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('payroll').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return PayrollPeriod.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding payroll period by ID:', error);
      throw error;
    }
  }

  /**
   * Lista períodos de nómina de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        year = new Date().getFullYear(),
        month = null,
        status = null,
        limit = 20
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('payroll');

      // Filtros
      if (year) {
        query = query.where('year', '==', year);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      // Ordenamiento
      query = query.orderBy('periodStart', 'desc').limit(limit);

      const snapshot = await query.get();
      const periods = [];

      snapshot.forEach(doc => {
        const period = PayrollPeriod.fromFirestore(doc);
        
        // Filtro por mes si se especifica
        if (month) {
          const periodMonth = new Date(period.periodStart).getMonth() + 1;
          if (periodMonth === month) {
            periods.push(period);
          }
        } else {
          periods.push(period);
        }
      });

      return periods;
    } catch (error) {
      console.error('Error listing payroll periods:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de nómina de un empleado
   */
  static async getSummaryByEmployee(employeeId, year = new Date().getFullYear()) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('payroll')
        .where('year', '==', year)
        .get();

      const summary = {
        totalGross: 0,
        totalNet: 0,
        totalDeductions: 0,
        totalPeriods: 0,
        averageGross: 0,
        averageNet: 0
      };

      snapshot.forEach(doc => {
        const period = doc.data();
        summary.totalGross += period.grossSalary || 0;
        summary.totalNet += period.netSalary || 0;
        summary.totalDeductions += (period.taxes + period.socialSecurity + period.healthInsurance + period.retirement + period.otherDeductions) || 0;
        summary.totalPeriods++;
      });

      if (summary.totalPeriods > 0) {
        summary.averageGross = summary.totalGross / summary.totalPeriods;
        summary.averageNet = summary.totalNet / summary.totalPeriods;
      }

      return summary;
    } catch (error) {
      console.error('Error getting payroll summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene nómina semanal para todos los empleados
   */
  static async getWeeklyPayroll(weekNumber, year, department = null) {
    try {
      // Primero obtener todos los empleados
      let employeesQuery = db.collection('employees').where('status', '==', 'active');
      
      if (department) {
        employeesQuery = employeesQuery.where('position.department', '==', department);
      }

      const employeesSnapshot = await employeesQuery.get();
      const weeklyData = {
        weekNumber,
        year,
        totalEmployees: 0,
        totalCost: 0,
        averagePerEmployee: 0,
        details: []
      };

      for (const employeeDoc of employeesSnapshot.docs) {
        const employee = employeeDoc.data();
        
        // Buscar período de nómina para esta semana
        const payrollSnapshot = await db.collection('employees').doc(employee.id)
          .collection('payroll')
          .where('weekNumber', '==', weekNumber)
          .where('year', '==', year)
          .limit(1)
          .get();

        let payrollData = null;
        if (!payrollSnapshot.empty) {
          payrollData = payrollSnapshot.docs[0].data();
        }

        const detail = {
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            employeeNumber: employee.employeeNumber,
            department: employee.position.department
          },
          gross: payrollData?.grossSalary || 0,
          net: payrollData?.netSalary || 0,
          deductions: payrollData ? (payrollData.taxes + payrollData.socialSecurity + payrollData.healthInsurance + payrollData.retirement + payrollData.otherDeductions) : 0,
          status: payrollData?.status || 'pending'
        };

        weeklyData.details.push(detail);
        weeklyData.totalCost += detail.net;
        weeklyData.totalEmployees++;
      }

      if (weeklyData.totalEmployees > 0) {
        weeklyData.averagePerEmployee = weeklyData.totalCost / weeklyData.totalEmployees;
      }

      return weeklyData;
    } catch (error) {
      console.error('Error getting weekly payroll:', error);
      throw error;
    }
  }
}

module.exports = PayrollPeriod;
