const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Solicitud de Vacaciones
 * Gestiona las solicitudes de tiempo libre de los empleados
 * Alineado 100% con especificaciones del Frontend
 */
class VacationRequest {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.startDate = data.startDate || '';
    this.endDate = data.endDate || '';
    this.days = data.days || data.totalDays || 0; // Frontend usa "days"
    this.type = data.type || 'vacation'; // 'vacation' | 'personal' | 'sick_leave' | 'maternity' | 'paternity' | 'compensatory' | 'unpaid'
    this.reason = data.reason || '';
    this.status = data.status || 'pending'; // 'pending' | 'approved' | 'rejected' | 'cancelled'
    this.requestedDate = data.requestedDate || new Date().toISOString();
    this.approvedBy = data.approvedBy || null;
    this.approvedByName = data.approvedByName || null;
    this.approvedDate = data.approvedDate || null;
    this.rejectedReason = data.rejectedReason || null;
    this.attachments = data.attachments || [];
    this.comments = data.comments || '';
    // Pago de vacaciones (extensión)
    this.payment = data.payment || null; // { dailySalary, days, baseAmount, vacationPremiumRate, vacationPremiumAmount, totalAmount, currency, plan, paidAmount, calculatedAt, calculatedBy }
    this.paymentMovements = Array.isArray(data.paymentMovements) ? data.paymentMovements : []; // [{ id, amount, method, reference, notes, createdAt, createdBy, idempotencyKey }]
    this.paymentTotals = data.paymentTotals || null; // { totalCalculated, totalPaid, remaining, lastPaymentAt }
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Calcula automáticamente los días totales (excluyendo fines de semana)
   */
  calculateTotalDays() {
    if (!this.startDate || !this.endDate) {
      this.days = 0;
      return;
    }

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    let totalDays = 0;
    let currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      // Contar solo días laborales (excluir sábado = 6 y domingo = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    this.days = totalDays;
  }

  /**
   * Valida los datos de la solicitud
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.startDate) {
      errors.push('La fecha de inicio es requerida');
    }

    if (!this.endDate) {
      errors.push('La fecha de fin es requerida');
    }

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      
      if (start > end) {
        errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
      }

      // No permitir solicitudes en el pasado (excepto para administradores)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (start < today) {
        errors.push('No se pueden solicitar vacaciones en fechas pasadas');
      }
    }

    const validTypes = ['vacation', 'personal', 'sick_leave', 'maternity', 'paternity', 'compensatory', 'unpaid'];
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de solicitud no es válido');
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado de la solicitud no es válido');
    }

    if (this.days <= 0) {
      errors.push('La solicitud debe incluir al menos un día laboral');
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
      startDate: this.startDate,
      endDate: this.endDate,
      days: this.days,
      type: this.type,
      reason: this.reason,
      status: this.status,
      requestedDate: this.requestedDate,
      approvedBy: this.approvedBy,
      approvedByName: this.approvedByName,
      approvedDate: this.approvedDate,
      rejectedReason: this.rejectedReason,
      attachments: this.attachments,
      comments: this.comments,
      payment: this.payment,
      paymentMovements: this.paymentMovements,
      paymentTotals: this.paymentTotals,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una solicitud desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new VacationRequest({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la solicitud en Firebase
   * Estructura: employees/{employeeId}/vacations/requests/{requestId}
   */
  async save() {
    try {
      this.calculateTotalDays();
      
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacations').doc('requests')
        .collection('list').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving vacation request:', error);
      throw error;
    }
  }

  /**
   * Actualiza la solicitud
   */
  async update(data) {
    try {
      Object.assign(this, data);
      
      // Recalcular días si se actualizaron las fechas
      if (data.startDate || data.endDate) {
        this.calculateTotalDays();
      }
      
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacations').doc('requests').collection('list').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating vacation request:', error);
      throw error;
    }
  }

  /**
   * Agrega un movimiento de pago de manera inmutable con idempotencia
   */
  async addPaymentMovement(movement) {
    try {
      if (!this.paymentMovements) this.paymentMovements = [];
      // Idempotencia por idempotencyKey si viene
      if (movement.idempotencyKey) {
        const exists = this.paymentMovements.some(m => m.idempotencyKey && m.idempotencyKey === movement.idempotencyKey);
        if (exists) {
          return this; // no duplica
        }
      }

      this.paymentMovements.push(movement);

      // Actualizar totales
      if (!this.paymentTotals) {
        this.paymentTotals = {
          totalCalculated: this.payment?.totalAmount || 0,
          totalPaid: 0,
          remaining: this.payment?.totalAmount || 0,
          lastPaymentAt: null
        };
      }

      this.paymentTotals.totalPaid = (this.paymentTotals.totalPaid || 0) + (movement.amount || 0);
      this.paymentTotals.remaining = Math.max(0, (this.paymentTotals.totalCalculated || 0) - (this.paymentTotals.totalPaid || 0));
      this.paymentTotals.lastPaymentAt = movement.createdAt || new Date().toISOString();

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('vacations').doc('requests').collection('list').doc(this.id);

      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error adding payment movement:', error);
      throw error;
    }
  }

  /**
   * Aprueba la solicitud
   */
  async approve(approvedBy) {
    try {
      this.status = 'approved';
      this.approvedBy = approvedBy;
      this.approvedAt = new Date().toISOString();
      this.rejectionReason = null;
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error approving vacation request:', error);
      throw error;
    }
  }

  /**
   * Rechaza la solicitud
   */
  async reject(rejectedBy, reason) {
    try {
      this.status = 'rejected';
      this.approvedBy = rejectedBy;
      this.approvedAt = new Date().toISOString();
      this.rejectionReason = reason;
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error rejecting vacation request:', error);
      throw error;
    }
  }

  /**
   * Cancela la solicitud
   */
  async cancel() {
    try {
      if (this.status === 'approved') {
        throw new Error('No se puede cancelar una solicitud ya aprobada');
      }
      
      this.status = 'cancelled';
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error cancelling vacation request:', error);
      throw error;
    }
  }

  /**
   * Busca una solicitud por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return VacationRequest.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding vacation request by ID:', error);
      throw error;
    }
  }

  /**
   * Lista solicitudes de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        year = new Date().getFullYear(),
        status = null,
        type = null,
        limit = 50
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list');

      // Filtro por año
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.where('startDate', '>=', startOfYear)
                   .where('startDate', '<=', endOfYear);

      // Filtros adicionales
      if (status) {
        query = query.where('status', '==', status);
      }

      if (type) {
        query = query.where('type', '==', type);
      }

      query = query.orderBy('startDate', 'desc').limit(limit);

      const snapshot = await query.get();
      const requests = [];

      snapshot.forEach(doc => {
        requests.push(VacationRequest.fromFirestore(doc));
      });

      return requests;
    } catch (error) {
      console.error('Error listing vacation requests:', error);
      throw error;
    }
  }

  /**
   * Verifica conflictos de fechas con otras solicitudes aprobadas
   */
  static async checkDateConflicts(employeeId, startDate, endDate, excludeId = null) {
    try {
      let query = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list')
        .where('status', '==', 'approved');

      const snapshot = await query.get();
      const conflicts = [];

      snapshot.forEach(doc => {
        const request = doc.data();
        
        // Excluir la solicitud actual si se está editando
        if (excludeId && request.id === excludeId) {
          return;
        }

        const requestStart = new Date(request.startDate);
        const requestEnd = new Date(request.endDate);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        // Verificar solapamiento de fechas
        if (newStart <= requestEnd && newEnd >= requestStart) {
          conflicts.push(VacationRequest.fromFirestore(doc));
        }
      });

      return conflicts;
    } catch (error) {
      console.error('Error checking date conflicts:', error);
      throw error;
    }
  }

  /**
   * Obtiene solicitudes pendientes de aprobación
   */
  static async getPendingRequests(department = null) {
    try {
      // Primero obtener empleados del departamento si se especifica
      let employeeIds = [];
      
      if (department) {
        const employeesSnapshot = await db.collection('employees')
          .where('position.department', '==', department)
          .where('status', '==', 'active')
          .get();
        
        employeeIds = employeesSnapshot.docs.map(doc => doc.id);
      } else {
        const employeesSnapshot = await db.collection('employees')
          .where('status', '==', 'active')
          .get();
        
        employeeIds = employeesSnapshot.docs.map(doc => doc.id);
      }

      const pendingRequests = [];

      // Buscar solicitudes pendientes para cada empleado
      for (const employeeId of employeeIds) {
        const snapshot = await db.collection('employees').doc(employeeId)
          .collection('vacations').doc('requests').collection('list')
          .where('status', '==', 'pending')
          .orderBy('requestedDate', 'asc')
          .get();

        snapshot.forEach(doc => {
          pendingRequests.push({
            ...VacationRequest.fromFirestore(doc),
            employeeId
          });
        });
      }

      return pendingRequests.sort((a, b) => new Date(a.requestedDate) - new Date(b.requestedDate));
    } catch (error) {
      console.error('Error getting pending requests:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de vacaciones por tipo
   */
  static async getStatsByType(employeeId, year = new Date().getFullYear()) {
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list')
        .where('startDate', '>=', startOfYear)
        .where('startDate', '<=', endOfYear)
        .where('status', '==', 'approved')
        .get();

      const stats = {
        vacation: 0,
        sick_leave: 0,
        personal: 0,
        maternity: 0,
        paternity: 0,
        compensatory: 0,
        unpaid: 0,
        total: 0
      };

      snapshot.forEach(doc => {
        const request = doc.data();
        stats[request.type] += request.days || 0;
        stats.total += request.days || 0;
      });

      return stats;
    } catch (error) {
      console.error('Error getting vacation stats by type:', error);
      throw error;
    }
  }

  /**
   * Obtiene el próximo período de vacaciones
   */
  static async getUpcomingVacations(employeeId, days = 30) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list')
        .where('startDate', '>=', today)
        .where('startDate', '<=', futureDateStr)
        .where('status', '==', 'approved')
        .orderBy('startDate', 'asc')
        .get();

      const upcomingVacations = [];
      snapshot.forEach(doc => {
        upcomingVacations.push(VacationRequest.fromFirestore(doc));
      });

      return upcomingVacations;
    } catch (error) {
      console.error('Error getting upcoming vacations:', error);
      throw error;
    }
  }
}

module.exports = VacationRequest;
