const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo Unificado de Movimientos de Nómina
 * Gestiona todos los tipos de movimientos que impactan la nómina
 */
class PayrollMovement {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.type = data.type || 'bonus'; // 'overtime' | 'absence' | 'bonus' | 'deduction' | 'discount' | 'loan' | 'damage'
    this.date = data.date || new Date().toISOString().split('T')[0];
    
    // Información básica
    this.description = data.description || '';
    this.reason = data.reason || '';
    this.amount = data.amount || 0;
    this.calculatedAmount = data.calculatedAmount || 0; // Monto calculado automáticamente
    this.currency = data.currency || 'MXN';
    
    // Campos específicos por tipo
    this.hours = data.hours || 0; // Para horas extra
    this.duration = data.duration || 1; // Para ausencias (días)
    this.overtimeType = data.overtimeType || 'regular'; // 'regular' | 'weekend' | 'holiday'
    this.absenceType = data.absenceType || 'personal_leave'; // 'sick_leave' | 'personal_leave' | 'vacation' | 'emergency' | 'medical_appointment' | 'other'
    this.bonusType = data.bonusType || 'performance'; // 'performance' | 'attendance' | 'special' | 'holiday'
    this.deductionType = data.deductionType || 'voluntary'; // 'voluntary' | 'disciplinary' | 'equipment' | 'other'
    this.discountType = data.discountType || 'early_payment'; // 'early_payment' | 'loyalty' | 'volume' | 'special' | 'other'
    this.damageType = data.damageType || 'equipment'; // 'equipment' | 'property' | 'vehicle' | 'other'
    
    // Préstamos específicos
    this.totalAmount = data.totalAmount || 0; // Para préstamos
    this.monthlyPayment = data.monthlyPayment || 0;
    this.totalInstallments = data.totalInstallments || 1;
    this.paidInstallments = data.paidInstallments || 0;
    this.remainingAmount = data.remainingAmount || 0;
    
    // Estado y aprobación
    this.status = data.status || 'pending'; // 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled'
    this.approvedBy = data.approvedBy || null;
    this.approvedAt = data.approvedAt || null;
    this.rejectedReason = data.rejectedReason || null;
    
    // Ubicación y evidencia
    this.location = data.location || 'office'; // 'office' | 'remote' | 'field'
    this.justification = data.justification || '';
    this.attachments = data.attachments || []; // URLs de archivos
    
    // 🆕 IMPACTO EN NÓMINA MEJORADO
    this.impactType = data.impactType || this.getImpactType(); // 'add' | 'subtract'
    this.payrollPeriod = data.payrollPeriod || null; // Período donde se aplicó
    this.payrollId = data.payrollId || null; // ID del período de nómina
    this.appliedToPayroll = data.appliedToPayroll || false; // Si ya fue aplicado a una nómina
    this.payrollDetailId = data.payrollDetailId || null; // ID del detalle de nómina generado
    this.isRecurring = data.isRecurring || false; // Si es un movimiento recurrente
    this.recurringFrequency = data.recurringFrequency || null; // 'monthly' | 'biweekly' | 'weekly'
    this.nextApplicationDate = data.nextApplicationDate || null; // Próxima fecha de aplicación
    
    // 🆕 CONTROL DE DUPLICADOS Y TRACKING
    this.payrollHistory = data.payrollHistory || []; // Historial completo de aplicaciones
    this.isDuplicate = data.isDuplicate || false; // Marcado como posible duplicado
    this.originalMovementId = data.originalMovementId || null; // ID del movimiento original
    this.preventDuplication = data.preventDuplication !== undefined ? data.preventDuplication : true;
    this.duplicateCheckFields = data.duplicateCheckFields || ['type', 'amount', 'date', 'employeeId'];
    this.applicationSource = data.applicationSource || 'manual'; // 'manual' | 'automatic' | 'import'
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.registeredBy = data.registeredBy || null;
    this.notes = data.notes || '';
  }

  /**
   * Determina si el movimiento suma o resta de la nómina
   */
  getImpactType() {
    const addTypes = ['overtime', 'bonus'];
    const subtractTypes = ['absence', 'deduction', 'discount', 'loan', 'damage'];
    
    if (addTypes.includes(this.type)) return 'add';
    if (subtractTypes.includes(this.type)) return 'subtract';
    return 'add';
  }

  /**
   * Calcula automáticamente el monto según el tipo de movimiento
   */
  async calculateAmount(employee) {
    try {
      if (!employee) {
        throw new Error('Información del empleado requerida para cálculo');
      }

      const baseSalary = employee.contract?.salary || employee.salary?.baseSalary || 0;
      const dailySalary = baseSalary / 30;
      const hourlyRate = dailySalary / 8;

      switch (this.type) {
        case 'overtime':
          this.calculatedAmount = this.calculateOvertimeAmount(hourlyRate);
          break;
          
        case 'absence':
          this.calculatedAmount = this.calculateAbsenceAmount(dailySalary);
          break;
          
        case 'bonus':
          this.calculatedAmount = this.amount; // Los bonos usan el monto directo
          break;
          
        case 'deduction':
          this.calculatedAmount = this.amount; // Las deducciones usan el monto directo
          break;
          
        case 'discount':
          this.calculatedAmount = this.amount; // Los descuentos usan el monto directo
          break;
          
        case 'loan':
          this.calculatedAmount = this.calculateLoanAmount();
          break;
          
        case 'damage':
          this.calculatedAmount = this.amount; // Los daños usan el monto directo
          break;
          
        default:
          this.calculatedAmount = this.amount;
      }

      return this.calculatedAmount;
    } catch (error) {
      console.error('Error calculating movement amount:', error);
      this.calculatedAmount = this.amount;
      return this.calculatedAmount;
    }
  }

  /**
   * Calcula monto de horas extra
   */
  calculateOvertimeAmount(hourlyRate) {
    const multipliers = {
      regular: 1.5,
      weekend: 2.0,
      holiday: 3.0
    };
    
    const multiplier = multipliers[this.overtimeType] || 1.5;
    return this.hours * hourlyRate * multiplier;
  }

  /**
   * Calcula descuento por ausencia
   */
  calculateAbsenceAmount(dailySalary) {
    const deductionRates = {
      sick_leave: 0.4,      // 60% del salario (40% descuento)
      personal_leave: 1.0,   // 100% descuento
      vacation: 0.0,         // Sin descuento si tiene días disponibles
      emergency: 0.5,        // 50% descuento
      medical_appointment: 0.25, // 25% descuento
      other: 1.0            // 100% descuento
    };
    
    const rate = deductionRates[this.absenceType] || 1.0;
    return dailySalary * this.duration * rate;
  }

  /**
   * Calcula pago mensual de préstamo
   */
  calculateLoanAmount() {
    if (this.totalInstallments > 0) {
      this.monthlyPayment = this.totalAmount / this.totalInstallments;
      this.remainingAmount = this.totalAmount - (this.paidInstallments * this.monthlyPayment);
      return this.monthlyPayment;
    }
    return 0;
  }

  /**
   * Valida los datos del movimiento
   */
  validate() {
    const errors = [];

    // Validaciones básicas
    if (!this.employeeId) errors.push('ID de empleado es requerido');
    if (!this.type) errors.push('Tipo de movimiento es requerido');
    if (!this.date) errors.push('Fecha es requerida');
    if (!this.description) errors.push('Descripción es requerida');

    // Validaciones específicas por tipo
    switch (this.type) {
      case 'overtime':
        if (!this.hours || this.hours <= 0) errors.push('Horas extra debe ser mayor a 0');
        if (this.hours > 12) errors.push('Máximo 12 horas extra por día');
        if (!this.reason) errors.push('Razón es requerida para horas extra');
        break;

      case 'absence':
        if (!this.duration || this.duration <= 0) errors.push('Duración debe ser mayor a 0');
        if (!this.reason) errors.push('Razón es requerida para ausencias');
        if (this.absenceType === 'sick_leave' && this.attachments.length === 0) {
          errors.push('Justificante médico requerido para incapacidades');
        }
        break;

      case 'loan':
        if (!this.totalAmount || this.totalAmount <= 0) errors.push('Monto total debe ser mayor a 0');
        if (!this.totalInstallments || this.totalInstallments <= 0) errors.push('Número de cuotas debe ser mayor a 0');
        if (!this.justification) errors.push('Justificación requerida para préstamos');
        if (this.attachments.length === 0) errors.push('Documentos requeridos para préstamos');
        break;

      case 'damage':
        if (!this.amount || this.amount <= 0) errors.push('Monto del daño debe ser mayor a 0');
        if (!this.justification) errors.push('Justificación requerida para daños');
        if (this.attachments.length === 0) errors.push('Evidencia fotográfica requerida para daños');
        break;

      case 'bonus':
        if (!this.amount || this.amount <= 0) errors.push('Monto del bono debe ser mayor a 0');
        if (!this.bonusType) errors.push('Tipo de bono es requerido');
        if (!this.reason) errors.push('Razón es requerida para bonos');
        break;

      case 'deduction':
        if (!this.amount || this.amount <= 0) errors.push('Monto de deducción debe ser mayor a 0');
        if (!this.deductionType) errors.push('Tipo de deducción es requerido');
        if (!this.reason) errors.push('Razón es requerida para deducciones');
        break;

      case 'discount':
        if (!this.amount || this.amount <= 0) errors.push('Monto del descuento debe ser mayor a 0');
        if (!this.discountType) errors.push('Tipo de descuento es requerido');
        if (!this.reason) errors.push('Razón es requerida para descuentos');
        if (this.attachments.length === 0) errors.push('Documentos de respaldo requeridos para descuentos');
        break;
    }

    // Validaciones de fecha
    const movementDate = new Date(this.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Final del día actual

    if (this.type !== 'loan' && movementDate > today) {
      errors.push('La fecha no puede ser futura (excepto préstamos)');
    }

    return errors;
  }

  /**
   * Convierte a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      type: this.type,
      date: this.date,
      description: this.description,
      reason: this.reason,
      amount: this.amount,
      calculatedAmount: this.calculatedAmount,
      currency: this.currency,
      hours: this.hours,
      duration: this.duration,
      overtimeType: this.overtimeType,
      absenceType: this.absenceType,
      bonusType: this.bonusType,
      deductionType: this.deductionType,
      discountType: this.discountType,
      damageType: this.damageType,
      totalAmount: this.totalAmount,
      monthlyPayment: this.monthlyPayment,
      totalInstallments: this.totalInstallments,
      paidInstallments: this.paidInstallments,
      remainingAmount: this.remainingAmount,
      status: this.status,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      rejectedReason: this.rejectedReason,
      location: this.location,
      justification: this.justification,
      attachments: this.attachments,
      impactType: this.impactType,
      payrollPeriod: this.payrollPeriod,
      payrollId: this.payrollId,
      appliedToPayroll: this.appliedToPayroll,
      payrollDetailId: this.payrollDetailId,
      isRecurring: this.isRecurring,
      recurringFrequency: this.recurringFrequency,
      nextApplicationDate: this.nextApplicationDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      registeredBy: this.registeredBy,
      notes: this.notes
    };
  }

  /**
   * Crea desde documento Firestore
   */
  static fromFirestore(doc) {
    return new PayrollMovement({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('movements').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving payroll movement:', error);
      throw error;
    }
  }

  /**
   * Encuentra por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('movements').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      return PayrollMovement.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding payroll movement:', error);
      throw error;
    }
  }

  /**
   * Encuentra movimientos por empleado
   */
  static async findByEmployee(employeeId, options = {}) {
    try {
      let query = db.collection('employees').doc(employeeId)
        .collection('movements');

      // Filtros
      if (options.type) {
        query = query.where('type', '==', options.type);
      }

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      if (options.startDate) {
        query = query.where('date', '>=', options.startDate);
      }

      if (options.endDate) {
        query = query.where('date', '<=', options.endDate);
      }

      // Ordenamiento
      query = query.orderBy('date', 'desc');

      // Límite
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => PayrollMovement.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding movements by employee:', error);
      throw error;
    }
  }

  /**
   * Aprueba el movimiento
   */
  async approve(approvedBy, comments = '') {
    this.status = 'approved';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date().toISOString();
    if (comments) this.notes = comments;
    
    return await this.save();
  }

  /**
   * Rechaza el movimiento
   */
  async reject(rejectedBy, reason) {
    this.status = 'rejected';
    this.approvedBy = rejectedBy;
    this.approvedAt = new Date().toISOString();
    this.rejectedReason = reason;
    
    return await this.save();
  }

  /**
   * Actualiza el movimiento
   */
  async update(data) {
    try {
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();
      
      return await this.save();
    } catch (error) {
      console.error('Error updating payroll movement:', error);
      throw error;
    }
  }

  /**
   * Elimina el movimiento
   */
  async delete() {
    try {
      await db.collection('employees').doc(this.employeeId)
        .collection('movements').doc(this.id).delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting payroll movement:', error);
      throw error;
    }
  }

  /**
   * 🆕 Marcar como aplicado a nómina (MEJORADO)
   */
  async markAsAppliedToPayroll(payrollId, payrollDetailId = null, payrollPeriod = null) {
    try {
      // Actualizar estado principal
      this.appliedToPayroll = true;
      this.payrollId = payrollId;
      this.payrollDetailId = payrollDetailId;
      this.payrollPeriod = payrollPeriod;
      this.updatedAt = new Date().toISOString();
      
      // 🆕 Agregar al historial de aplicaciones
      const historyEntry = {
        payrollId,
        payrollDetailId,
        payrollPeriod,
        appliedAt: new Date().toISOString(),
        amount: this.calculatedAmount || this.amount,
        status: 'applied',
        notes: `Aplicado automáticamente a nómina ${payrollPeriod || payrollId}`
      };
      
      this.payrollHistory.push(historyEntry);
      
      await this.save();
      
      console.log('✅ Movimiento aplicado a nómina:', {
        movementId: this.id,
        type: this.type,
        amount: this.amount,
        payrollId,
        payrollPeriod,
        historyCount: this.payrollHistory.length
      });
      
      return this;
    } catch (error) {
      console.error('❌ Error marcando movimiento como aplicado:', error);
      throw error;
    }
  }

  /**
   * Desmarcar como aplicado a nómina
   */
  async unmarkAsAppliedToPayroll() {
    try {
      this.appliedToPayroll = false;
      this.payrollId = null;
      this.payrollDetailId = null;
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return this;
    } catch (error) {
      console.error('Error unmarking movement from payroll:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos no aplicados a nómina por empleado
   */
  static async findUnappliedByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('movements')
        .where('appliedToPayroll', '==', false)
        .where('status', '==', 'active')
        .orderBy('date', 'desc')
        .get();

      return snapshot.docs.map(doc => PayrollMovement.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding unapplied movements:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos por período de nómina
   */
  static async findByPayrollPeriod(startDate, endDate, employeeId = null) {
    try {
      let query = db.collection('employees');
      
      if (employeeId) {
        query = query.doc(employeeId).collection('movements');
      } else {
        // Para buscar en todos los empleados, necesitaríamos usar collection group
        query = db.collectionGroup('movements');
      }

      const snapshot = await query
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('status', '==', 'active')
        .orderBy('date', 'desc')
        .get();

      return snapshot.docs.map(doc => PayrollMovement.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding movements by payroll period:', error);
      throw error;
    }
  }

  /**
   * 🆕 DETECCIÓN DE DUPLICADOS
   */
  async checkForDuplicates() {
    try {
      if (!this.preventDuplication) {
        return { isDuplicate: false, duplicates: [] };
      }

      // Buscar movimientos similares del mismo empleado
      const snapshot = await db.collection('employees')
        .doc(this.employeeId)
        .collection('movements')
        .where('type', '==', this.type)
        .where('amount', '==', this.amount)
        .where('date', '==', this.date)
        .where('status', '==', 'active')
        .get();

      const duplicates = snapshot.docs
        .map(doc => PayrollMovement.fromFirestore(doc))
        .filter(movement => movement.id !== this.id);

      const isDuplicate = duplicates.length > 0;

      if (isDuplicate) {
        this.isDuplicate = true;
        this.originalMovementId = duplicates[0].id;
        
        console.warn('⚠️ Posible duplicado detectado:', {
          movementId: this.id,
          type: this.type,
          amount: this.amount,
          date: this.date,
          duplicatesFound: duplicates.length,
          originalId: this.originalMovementId
        });
      }

      return { isDuplicate, duplicates };
    } catch (error) {
      console.error('❌ Error verificando duplicados:', error);
      return { isDuplicate: false, duplicates: [] };
    }
  }

  /**
   * 🆕 BUSCAR MOVIMIENTOS NO APLICADOS PARA UN PERÍODO
   */
  static async findPendingForPeriod(employeeId, startDate, endDate) {
    try {
      const snapshot = await db.collection('employees')
        .doc(employeeId)
        .collection('movements')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('appliedToPayroll', '==', false)
        .where('status', '==', 'active')
        .where('isDuplicate', '==', false)
        .orderBy('date', 'asc')
        .get();

      return snapshot.docs.map(doc => PayrollMovement.fromFirestore(doc));
    } catch (error) {
      console.error('❌ Error buscando movimientos pendientes:', error);
      throw error;
    }
  }

  /**
   * 🆕 OBTENER RESUMEN DE IMPACTO EN NÓMINA
   */
  static async getPayrollImpactSummary(employeeId, startDate, endDate) {
    try {
      const movements = await PayrollMovement.findPendingForPeriod(employeeId, startDate, endDate);
      
      const summary = {
        totalMovements: movements.length,
        perceptions: 0,
        deductions: 0,
        netImpact: 0,
        byType: {},
        duplicatesFound: 0,
        readyToApply: 0
      };

      movements.forEach(movement => {
        const amount = movement.calculatedAmount || movement.amount;
        
        if (movement.impactType === 'add') {
          summary.perceptions += amount;
        } else {
          summary.deductions += amount;
        }

        if (movement.isDuplicate) {
          summary.duplicatesFound++;
        } else {
          summary.readyToApply++;
        }

        summary.byType[movement.type] = (summary.byType[movement.type] || 0) + amount;
      });

      summary.netImpact = summary.perceptions - summary.deductions;

      return summary;
    } catch (error) {
      console.error('❌ Error calculando resumen de impacto:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos aplicados a una nómina específica
   */
  static async findByPayrollId(payrollId) {
    try {
      const snapshot = await db.collectionGroup('movements')
        .where('payrollId', '==', payrollId)
        .get();

      return snapshot.docs.map(doc => PayrollMovement.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding movements by payroll ID:', error);
      throw error;
    }
  }

  /**
   * Verificar si puede ser aplicado a nómina
   */
  canBeAppliedToPayroll() {
    return this.status === 'active' && !this.appliedToPayroll;
  }

  /**
   * Obtener descripción para detalle de nómina
   */
  getPayrollDescription() {
    const typeDescriptions = {
      overtime: 'Horas Extra',
      absence: 'Falta/Ausencia',
      bonus: 'Bono',
      deduction: 'Deducción',
      discount: 'Descuento',
      loan: 'Préstamo',
      damage: 'Daño/Rotura'
    };

    const baseDescription = typeDescriptions[this.type] || 'Movimiento';
    
    if (this.reason) {
      return `${baseDescription}: ${this.reason}`;
    }
    
    return baseDescription;
  }

  /**
   * Calcular próxima fecha de aplicación para movimientos recurrentes
   */
  calculateNextApplicationDate() {
    if (!this.isRecurring || !this.recurringFrequency) {
      return null;
    }

    const currentDate = new Date(this.date);
    let nextDate = new Date(currentDate);

    switch (this.recurringFrequency) {
      case 'weekly':
        nextDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(currentDate.getMonth() + 1);
        break;
      default:
        return null;
    }

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Crear movimiento recurrente para próximo período
   */
  async createNextRecurringMovement() {
    if (!this.isRecurring || !this.nextApplicationDate) {
      return null;
    }

    try {
      const nextMovement = new PayrollMovement({
        ...this.toFirestore(),
        id: undefined, // Generar nuevo ID
        date: this.nextApplicationDate,
        appliedToPayroll: false,
        payrollId: null,
        payrollDetailId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Calcular próxima fecha para el nuevo movimiento
      nextMovement.nextApplicationDate = nextMovement.calculateNextApplicationDate();

      await nextMovement.save();
      return nextMovement;
    } catch (error) {
      console.error('Error creating next recurring movement:', error);
      throw error;
    }
  }
}

module.exports = PayrollMovement;
