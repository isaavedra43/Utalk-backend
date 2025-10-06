const VacationRequest = require('../models/VacationRequest');
const VacationData = require('../models/VacationData');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');
const { db } = require('../config/firebase');

/**
 * Controlador de Vacaciones
 * Alineado 100% con especificaciones del Frontend
 * Endpoints según requerimientos exactos del modal
 */
class VacationController {
  
  /**
   * POST /api/employees/:employeeId/vacations/calculate-payment
   * Calcula el pago de vacaciones sin persistir
   */
  static async calculatePayment(req, res) {
    try {
      const employeeId = req.params?.id || req.body?.employeeId || req.body?.id || null;
      const { startDate, endDate, dailySalary: clientDailySalary, sbc: clientSbc, baseSalary: clientBaseSalary } = req.body || {};

      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'startDate y endDate son requeridos' });
      }

      // Intentar obtener empleado si hay id; si no, continuar con datos suministrados por el cliente
      let employee = null;
      if (employeeId) {
        employee = await Employee.findById(employeeId);
        if (!employee) {
          return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }
      }

      // Calcular días hábiles igual a calculateDays
      const start = new Date(startDate);
      const end = new Date(endDate);
      let days = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) days++;
      }
      if (days <= 0) {
        return res.status(400).json({ success: false, error: 'El rango no contiene días laborales' });
      }

      // Salario diario consistente con nómina: baseSalary / 30 o SBC si existe
      const salaryInfo = employee?.salary || {};
      const currency = (salaryInfo.currency || 'MXN');
      const sdiOrSbc = (employee?.sbc ?? clientSbc ?? clientBaseSalary ?? salaryInfo.baseSalary);
      const inferredDaily = sdiOrSbc ? Number(sdiOrSbc) / 30 : null;
      const dailySalary = clientDailySalary ? Number(clientDailySalary) : inferredDaily;
      if (!dailySalary || dailySalary <= 0) {
        return res.status(400).json({ success: false, error: 'Salario diario inválido' });
      }

      const baseAmount = parseFloat((dailySalary * days).toFixed(2));
      // Política: usar rate >= 0.25
      let vacationData = null;
      if (employeeId) {
        vacationData = await VacationData.getOrCreate(employeeId, {
          firstName: employee?.personalInfo?.firstName || '',
          lastName: employee?.personalInfo?.lastName || '',
          position: employee?.position?.title || '',
          department: employee?.position?.department || '',
          hireDate: employee?.position?.startDate || new Date().toISOString()
        });
      }
      const policyRate = vacationData?.policy?.vacationPremiumRate || 0.25;
      const vacationPremiumRate = Math.max(0.25, policyRate);
      const vacationPremiumAmount = parseFloat((baseAmount * vacationPremiumRate).toFixed(2));
      const totalAmount = parseFloat((baseAmount + vacationPremiumAmount).toFixed(2));

      return res.json({
        success: true,
        data: {
          dailySalary: parseFloat(dailySalary.toFixed(2)),
          days,
          baseAmount,
          vacationPremiumRate,
          vacationPremiumAmount,
          totalAmount,
          currency: currency || 'MXN'
        }
      });
    } catch (error) {
      console.error('Error calculating vacation payment:', error);
      res.status(500).json({ success: false, error: 'Error al calcular pago', details: error.message });
    }
  }
  
  /**
   * 1. GET /api/employees/:employeeId/vacations
   * Obtener todos los datos de vacaciones del empleado
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener datos de vacaciones
      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      // Actualizar estadísticas
      await vacationData.updateStatistics();

      res.json({
        success: true,
        data: vacationData.toFirestore()
      });
    } catch (error) {
      console.error('Error getting vacations by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener vacaciones del empleado',
        details: error.message
      });
    }
  }

  /**
   * 2. GET /api/employees/:employeeId/vacations/balance
   * Obtener solo el balance de vacaciones
   */
  static async getBalance(req, res) {
    try {
      const { id: employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      await vacationData.updateStatistics();

      res.json({
        success: true,
        data: vacationData.balance
      });
    } catch (error) {
      console.error('Error getting vacation balance:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener balance de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * 3. GET /api/employees/:employeeId/vacations/requests
   * Obtener todas las solicitudes
   */
  static async getRequests(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { status, type, year } = req.query;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      let query = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list');

      // Filtros
      if (status) {
        query = query.where('status', '==', status);
      }
      if (type) {
        query = query.where('type', '==', type);
      }
      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query.where('startDate', '>=', startOfYear)
                     .where('startDate', '<=', endOfYear);
      }

      query = query.orderBy('requestedDate', 'desc');

      const snapshot = await query.get();
      const requests = [];

      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() });
      });

      res.json({
        success: true,
        data: requests,
        count: requests.length
      });
    } catch (error) {
      console.error('Error getting vacation requests:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener solicitudes de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * 4. POST /api/employees/:employeeId/vacations/requests
   * Crear nueva solicitud
   */
  static async createRequest(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate, type, reason, comments, attachments, payment } = req.body;
      const userId = req.user?.id || null;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener datos de vacaciones
      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      // Crear solicitud
      const request = new VacationRequest({
        employeeId,
        startDate,
        endDate,
        type,
        reason,
        comments: comments || '',
        attachments: attachments || []
      });

      // Calcular días
      request.calculateTotalDays();

      // Validar días disponibles
      await vacationData.updateStatistics();
      if (vacationData.balance.available < request.days) {
        return res.status(400).json({
          success: false,
          error: 'No hay suficientes días de vacaciones disponibles',
          available: vacationData.balance.available,
          requested: request.days
        });
      }

      // Verificar períodos restringidos
      const inBlackoutPeriod = vacationData.policy.blackoutPeriods.some(period => {
        const periodStart = new Date(period.startDate);
        const periodEnd = new Date(period.endDate);
        const reqStart = new Date(request.startDate);
        const reqEnd = new Date(request.endDate);
        
        return (reqStart <= periodEnd && reqEnd >= periodStart);
      });

      if (inBlackoutPeriod) {
        return res.status(400).json({
          success: false,
          error: 'Las fechas solicitadas están en un período restringido'
        });
      }

      // Verificar conflictos
      const conflicts = await VacationRequest.checkDateConflicts(
        employeeId,
        startDate,
        endDate
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Existen conflictos con solicitudes ya aprobadas',
          conflicts
        });
      }

      // Calcular pago (server authority)
      const paymentCalcRes = await VacationController.calculatePayment({ params: { id: employeeId }, body: { startDate, endDate } }, { json: (r)=>r, status: ()=>({ json: (r)=>r }) });
      const paymentData = paymentCalcRes?.data || null;
      if (paymentData) {
        request.payment = {
          dailySalary: paymentData.dailySalary,
          days: paymentData.days,
          baseAmount: paymentData.baseAmount,
          vacationPremiumRate: paymentData.vacationPremiumRate,
          vacationPremiumAmount: paymentData.vacationPremiumAmount,
          totalAmount: paymentData.totalAmount,
          currency: paymentData.currency,
          plan: payment?.plan || null,
          paidAmount: payment?.paidAmount || 0,
          calculatedAt: new Date().toISOString(),
          calculatedBy: req.user?.id || 'system'
        };
        request.paymentTotals = {
          totalCalculated: paymentData.totalAmount,
          totalPaid: 0,
          remaining: paymentData.totalAmount,
          lastPaymentAt: null
        };
      }

      // Guardar solicitud
      await request.save();

      // Reservar días
      await vacationData.reserveDays(request.days);

      // Actualizar estadísticas
      await vacationData.updateStatistics();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_request',
        `Solicitud de vacaciones creada: ${request.startDate} - ${request.endDate}`,
        {
          requestId: request.id,
          startDate: request.startDate,
          endDate: request.endDate,
          days: request.days,
          type: request.type
        },
        userId,
        req
      );

      // Si viene paidAmount > 0, registrar movimiento inicial
      if (payment?.paidAmount && payment.paidAmount > 0) {
        // Validar contra remaining
        const remaining = request.paymentTotals?.remaining ?? request.payment?.totalAmount ?? 0;
        if (payment.paidAmount > remaining) {
          return res.status(400).json({ success: false, error: 'El abono excede el monto restante' });
        }
        const movement = {
          id: require('uuid').v4(),
          amount: payment.paidAmount,
          method: payment.method || 'bank_transfer',
          reference: payment.reference || null,
          notes: payment.notes || null,
          createdAt: new Date().toISOString(),
          createdBy: req.user?.id || 'system',
          idempotencyKey: payment.idempotencyKey || req.headers['idempotency-key'] || null
        };
        await request.addPaymentMovement(movement);
      }

      res.status(201).json({
        success: true,
        data: request.toFirestore(),
        message: 'Solicitud de vacaciones creada exitosamente'
      });
    } catch (error) {
      console.error('Error creating vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear solicitud de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * 5. PUT /api/employees/:employeeId/vacations/requests/:requestId
   * Actualizar solicitud (solo si status = pending)
   */
  static async updateRequest(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const updateData = req.body;
      const userId = req.user?.id || null;

      // Buscar solicitud
      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(requestId);
      
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const request = new VacationRequest({ id: doc.id, ...doc.data() });

      // Solo permitir editar si está pendiente
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden editar solicitudes pendientes'
        });
      }

      const oldDays = request.days;

      // Actualizar campos
      Object.assign(request, updateData);
      request.calculateTotalDays();

      // Validar
      const errors = request.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: errors
        });
      }

      request.updatedAt = new Date().toISOString();
      // Si se envía payment, recalcular server-side y persistir
      if (updateData.payment !== undefined) {
        const calcRes = await VacationController.calculatePayment({ params: { id: employeeId }, body: { startDate: request.startDate, endDate: request.endDate } }, { json: (r)=>r, status: ()=>({ json: (r)=>r }) });
        const pay = calcRes?.data;
        if (pay) {
          request.payment = {
            dailySalary: pay.dailySalary,
            days: pay.days,
            baseAmount: pay.baseAmount,
            vacationPremiumRate: pay.vacationPremiumRate,
            vacationPremiumAmount: pay.vacationPremiumAmount,
            totalAmount: pay.totalAmount,
            currency: pay.currency,
            plan: updateData.payment?.plan || request.payment?.plan || null,
            paidAmount: request.payment?.paidAmount || 0,
            calculatedAt: new Date().toISOString(),
            calculatedBy: req.user?.id || 'system'
          };
          // Actualizar totales consistente
          const totalPaid = request.paymentTotals?.totalPaid || 0;
          request.paymentTotals = {
            totalCalculated: pay.totalAmount,
            totalPaid,
            remaining: Math.max(0, pay.totalAmount - totalPaid),
            lastPaymentAt: request.paymentTotals?.lastPaymentAt || null
          };
        }
      }

      await docRef.update(request.toFirestore());

      // Actualizar balance si cambió la cantidad de días
      if (oldDays !== request.days) {
        const vacationData = await VacationData.findByEmployee(employeeId);
        if (vacationData) {
          vacationData.balance.pending -= oldDays;
          vacationData.balance.pending += request.days;
          vacationData.calculateAvailableBalance();
          await vacationData.save();
        }
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_updated',
        `Solicitud de vacaciones actualizada: ${request.id}`,
        { requestId: request.id, changes: updateData },
        userId,
        req
      );

      // Si se envió un nuevo paidAmount, registrar movimiento
      if (updateData.payment?.paidAmount && updateData.payment.paidAmount > 0) {
        if (request.status === 'cancelled') {
          return res.status(422).json({ success: false, error: 'No se pueden registrar pagos en solicitudes canceladas' });
        }
        // Validar restante antes de agregar
        const remaining = request.paymentTotals?.remaining ?? request.payment?.totalAmount ?? 0;
        if (updateData.payment.paidAmount > remaining) {
          return res.status(400).json({ success: false, error: 'El abono excede el monto restante' });
        }
        const movement = {
          id: require('uuid').v4(),
          amount: updateData.payment.paidAmount,
          method: updateData.payment.method || 'bank_transfer',
          reference: updateData.payment.reference || null,
          notes: updateData.payment.notes || null,
          createdAt: new Date().toISOString(),
          createdBy: req.user?.id || 'system',
          idempotencyKey: updateData.payment.idempotencyKey || req.headers['idempotency-key'] || null
        };
        await request.addPaymentMovement(movement);
      }

      res.json({
        success: true,
        data: request.toFirestore(),
        message: 'Solicitud actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error updating vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar solicitud',
        details: error.message
      });
    }
  }

  /**
   * 6. DELETE /api/employees/:employeeId/vacations/requests/:requestId
   * Eliminar solicitud (solo si status = pending)
   */
  static async deleteRequest(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const userId = req.user?.id || null;

      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(requestId);
      
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const request = doc.data();

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden eliminar solicitudes pendientes'
        });
      }

      // Liberar días
      const vacationData = await VacationData.findByEmployee(employeeId);
      if (vacationData) {
        await vacationData.releaseDays(request.days);
        await vacationData.updateStatistics();
      }

      // Eliminar
      await docRef.delete();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_deleted',
        `Solicitud de vacaciones eliminada: ${request.id}`,
        { requestId: request.id },
        userId,
        req
      );

      res.json({
        success: true,
        message: 'Solicitud eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error deleting vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar solicitud',
        details: error.message
      });
    }
  }

  /**
   * 7. PUT /api/employees/:employeeId/vacations/requests/:requestId/approve
   * Aprobar solicitud
   */
  static async approveRequest(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const { comments } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(requestId);
      
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const request = new VacationRequest({ id: doc.id, ...doc.data() });

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'La solicitud ya fue procesada'
        });
      }

      // Actualizar solicitud
      request.status = 'approved';
      request.approvedBy = userId;
      request.approvedByName = userName;
      request.approvedDate = new Date().toISOString();
      if (comments) request.comments = comments;
      request.updatedAt = new Date().toISOString();

      await docRef.update(request.toFirestore());

      // Confirmar días en balance
      const vacationData = await VacationData.findByEmployee(employeeId);
      if (vacationData) {
        await vacationData.confirmDays(request.days);
        await vacationData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_approved',
        `Solicitud de vacaciones aprobada: ${request.startDate} - ${request.endDate}`,
        {
          requestId: request.id,
          approvedBy: userName,
          days: request.days
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: request.toFirestore(),
        message: 'Solicitud aprobada exitosamente'
      });
    } catch (error) {
      console.error('Error approving vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al aprobar solicitud',
        details: error.message
      });
    }
  }

  /**
   * 8. PUT /api/employees/:employeeId/vacations/requests/:requestId/reject
   * Rechazar solicitud
   */
  static async rejectRequest(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'El motivo del rechazo es requerido'
        });
      }

      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(requestId);
      
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const request = new VacationRequest({ id: doc.id, ...doc.data() });

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'La solicitud ya fue procesada'
        });
      }

      // Actualizar solicitud
      request.status = 'rejected';
      request.approvedBy = userId;
      request.approvedByName = userName;
      request.approvedDate = new Date().toISOString();
      request.rejectedReason = reason;
      request.updatedAt = new Date().toISOString();

      await docRef.update(request.toFirestore());

      // Liberar días
      const vacationData = await VacationData.findByEmployee(employeeId);
      if (vacationData) {
        await vacationData.releaseDays(request.days);
        await vacationData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_rejected',
        `Solicitud de vacaciones rechazada: ${reason}`,
        {
          requestId: request.id,
          rejectedBy: userName,
          reason
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: request.toFirestore(),
        message: 'Solicitud rechazada'
      });
    } catch (error) {
      console.error('Error rejecting vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al rechazar solicitud',
        details: error.message
      });
    }
  }

  /**
   * 9. PUT /api/employees/:employeeId/vacations/requests/:requestId/cancel
   * Cancelar solicitud
   */
  static async cancelRequest(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id || null;

      const docRef = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list').doc(requestId);
      
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        });
      }

      const request = new VacationRequest({ id: doc.id, ...doc.data() });

      // Actualizar solicitud
      request.status = 'cancelled';
      if (reason) request.comments = reason;
      request.updatedAt = new Date().toISOString();

      await docRef.update(request.toFirestore());

      // Liberar días si estaba pendiente o devolver si estaba aprobada
      const vacationData = await VacationData.findByEmployee(employeeId);
      if (vacationData) {
        if (request.status === 'pending') {
          await vacationData.releaseDays(request.days);
        } else if (request.status === 'approved') {
          vacationData.balance.used -= request.days;
          vacationData.calculateAvailableBalance();
          await vacationData.save();
        }
        await vacationData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_cancelled',
        `Solicitud de vacaciones cancelada${reason ? ': ' + reason : ''}`,
        { requestId: request.id },
        userId,
        req
      );

      res.json({
        success: true,
        data: request.toFirestore(),
        message: 'Solicitud cancelada exitosamente'
      });
    } catch (error) {
      console.error('Error cancelling vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cancelar solicitud',
        details: error.message
      });
    }
  }

  /**
   * 10. GET /api/employees/:employeeId/vacations/policy
   * Obtener política de vacaciones
   */
  static async getPolicy(req, res) {
    try {
      const { id: employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      res.json({
        success: true,
        data: vacationData.policy
      });
    } catch (error) {
      console.error('Error getting vacation policy:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener política de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * 11. GET /api/employees/:employeeId/vacations/history
   * Obtener historial de vacaciones
   */
  static async getHistory(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { year } = req.query;

      let query = db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list')
        .where('status', 'in', ['approved', 'rejected']);

      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query.where('startDate', '>=', startOfYear)
                     .where('startDate', '<=', endOfYear);
      }

      query = query.orderBy('startDate', 'desc');

      const snapshot = await query.get();
      const history = [];

      snapshot.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
      });

      res.json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error) {
      console.error('Error getting vacation history:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener historial',
        details: error.message
      });
    }
  }

  /**
   * 12. GET /api/employees/:employeeId/vacations/summary
   * Obtener resumen estadístico
   */
  static async getSummary(req, res) {
    try {
      const { id: employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      await vacationData.updateStatistics();

      res.json({
        success: true,
        data: vacationData.summary
      });
    } catch (error) {
      console.error('Error getting vacation summary:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen',
        details: error.message
      });
    }
  }

  /**
   * 13. POST /api/employees/:employeeId/vacations/calculate-days
   * Calcular días entre fechas
   */
  static async calculateDays(req, res) {
    try {
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate y endDate son requeridos'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      let businessDays = 0;
      let weekends = 0;
      let totalDays = 0;
      let currentDate = new Date(start);

      while (currentDate <= end) {
        totalDays++;
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekends++;
        } else {
          businessDays++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true,
        data: {
          days: totalDays,
          businessDays,
          weekends
        }
      });
    } catch (error) {
      console.error('Error calculating days:', error);
      res.status(500).json({
        success: false,
        error: 'Error al calcular días',
        details: error.message
      });
    }
  }

  /**
   * 14. POST /api/employees/:employeeId/vacations/check-availability
   * Verificar disponibilidad de fechas
   */
  static async checkAvailability(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate y endDate son requeridos'
        });
      }

      // Verificar conflictos
      const conflicts = await VacationRequest.checkDateConflicts(
        employeeId,
        startDate,
        endDate
      );

      // Verificar períodos restringidos
      const vacationData = await VacationData.findByEmployee(employeeId);
      const blackoutConflicts = [];

      if (vacationData) {
        vacationData.policy.blackoutPeriods.forEach(period => {
          const periodStart = new Date(period.startDate);
          const periodEnd = new Date(period.endDate);
          const reqStart = new Date(startDate);
          const reqEnd = new Date(endDate);
          
          if (reqStart <= periodEnd && reqEnd >= periodStart) {
            blackoutConflicts.push(period);
          }
        });
      }

      const available = conflicts.length === 0 && blackoutConflicts.length === 0;

      res.json({
        success: true,
        data: {
          available,
          conflicts: conflicts.map(c => ({
            startDate: c.startDate,
            endDate: c.endDate,
            type: c.type
          })),
          blackoutPeriods: blackoutConflicts,
          suggestions: available ? [] : ['Intenta seleccionar otras fechas']
        }
      });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({
        success: false,
        error: 'Error al verificar disponibilidad',
        details: error.message
      });
    }
  }

  /**
   * 17. GET /api/employees/:employeeId/vacations/calendar
   * Obtener calendario de vacaciones
   */
  static async getCalendar(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { year, month } = req.query;

      const currentYear = year || new Date().getFullYear();
      const currentMonth = month || (new Date().getMonth() + 1);

      let startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      let endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('vacations').doc('requests').collection('list')
        .where('status', '==', 'approved')
        .where('startDate', '>=', startDate)
        .where('startDate', '<=', endDate)
        .orderBy('startDate', 'asc')
        .get();

      const calendar = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        calendar.push({
          id: doc.id,
          startDate: data.startDate,
          endDate: data.endDate,
          days: data.days,
          type: data.type
        });
      });

      res.json({
        success: true,
        data: calendar,
        period: { year: currentYear, month: currentMonth }
      });
    } catch (error) {
      console.error('Error getting calendar:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener calendario',
        details: error.message
      });
    }
  }

  /**
   * 16. GET /api/employees/:employeeId/vacations/export
   * Exportar reporte de vacaciones
   */
  static async exportReport(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { format = 'excel', year = new Date().getFullYear() } = req.query;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener datos completos
      const vacationData = await VacationData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department,
        hireDate: employee.position.startDate
      });

      await vacationData.updateStatistics();

      // Obtener historial
      const history = await VacationController.getHistory(req, res);
      
      // Preparar datos para exportación
      const exportData = {
        employee: {
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          employeeNumber: employee.employeeNumber,
          position: employee.position.title,
          department: employee.position.department,
          hireDate: employee.position.startDate
        },
        balance: vacationData.balance,
        summary: vacationData.summary,
        policy: vacationData.policy,
        year: parseInt(year),
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.name || 'Sistema'
      };

      if (format === 'excel') {
        // TODO: Implementar generación de Excel
        res.json({
          success: true,
          message: 'Exportación a Excel en desarrollo',
          data: exportData
        });
      } else if (format === 'pdf') {
        // TODO: Implementar generación de PDF
        res.json({
          success: true,
          message: 'Exportación a PDF en desarrollo',
          data: exportData
        });
      } else {
        res.json({
          success: true,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Error exporting vacation report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar reporte',
        details: error.message
      });
    }
  }
}

module.exports = VacationController;
