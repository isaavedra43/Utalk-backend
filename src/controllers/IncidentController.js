const Incident = require('../models/Incident');
const IncidentData = require('../models/IncidentData');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');
const { db } = require('../config/firebase');
const { getErrorMessage, getSuccessMessage, canEditIncident, canDeleteIncident } = require('../config/incidentConfig');

/**
 * Controlador de Incidentes
 * Alineado 100% con especificaciones del Frontend
 * Endpoints según requerimientos exactos del modal
 */
class IncidentController {
  
  /**
   * 1. GET /api/employees/:employeeId/incidents
   * Obtener todos los incidentes del empleado
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { status, type, severity, year } = req.query;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Obtener datos de incidentes
      const incidentData = await IncidentData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department
      });

      // Obtener lista de incidentes
      const incidents = await Incident.listByEmployee(employeeId, {
        status,
        type,
        severity,
        year: year ? parseInt(year) : null
      });

      // Actualizar estadísticas
      await incidentData.updateStatistics();

      res.json({
        success: true,
        data: {
          summary: incidentData.summary,
          incidents: incidents.map(incident => incident.toFirestore()),
          count: incidents.length
        }
      });
    } catch (error) {
      console.error('Error getting incidents by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener incidentes del empleado',
        details: error.message
      });
    }
  }

  /**
   * 2. GET /api/employees/:employeeId/incidents/:incidentId
   * Obtener incidente específico
   */
  static async getById(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      res.json({
        success: true,
        data: incident.toFirestore()
      });
    } catch (error) {
      console.error('Error getting incident by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener incidente',
        details: error.message
      });
    }
  }

  /**
   * 3. POST /api/employees/:employeeId/incidents
   * Crear nuevo incidente
   */
  static async create(req, res) {
    try {
      const { id: employeeId } = req.params;
      const incidentData = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Crear incidente
      const incident = new Incident({
        ...incidentData,
        employeeId
      });

      // Validar datos
      const errors = incident.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: errors
        });
      }

      // Guardar incidente
      await incident.save();

      // Actualizar estadísticas
      const incidentDataDoc = await IncidentData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department
      });

      await incidentDataDoc.updateStatistics();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_created',
        `Incidente creado: ${incident.title}`,
        {
          incidentId: incident.id,
          title: incident.title,
          type: incident.type,
          severity: incident.severity,
          status: incident.status
        },
        userId,
        req
      );

      res.status(201).json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('INCIDENT_CREATED')
      });
    } catch (error) {
      console.error('Error creating incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear incidente',
        details: error.message
      });
    }
  }

  /**
   * 4. PUT /api/employees/:employeeId/incidents/:incidentId
   * Actualizar incidente
   */
  static async update(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const updateData = req.body;
      const userId = req.user?.id || null;

      // Buscar incidente
      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      // Verificar si se puede editar
      if (!canEditIncident(incident.status)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('CANNOT_EDIT_CLOSED')
        });
      }

      // Actualizar campos
      Object.assign(incident, updateData);

      // Validar
      const errors = incident.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: errors
        });
      }

      await incident.update(updateData);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_updated',
        `Incidente actualizado: ${incident.title}`,
        {
          incidentId: incident.id,
          changes: updateData
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('INCIDENT_UPDATED')
      });
    } catch (error) {
      console.error('Error updating incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar incidente',
        details: error.message
      });
    }
  }

  /**
   * 5. DELETE /api/employees/:employeeId/incidents/:incidentId
   * Eliminar incidente
   */
  static async delete(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const userId = req.user?.id || null;

      // Buscar incidente
      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      // Verificar si se puede eliminar
      if (!canDeleteIncident(incident.status)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('CANNOT_DELETE_CLOSED')
        });
      }

      // Eliminar
      await Incident.delete(employeeId, incidentId);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_deleted',
        `Incidente eliminado: ${incident.title}`,
        {
          incidentId: incident.id,
          title: incident.title
        },
        userId,
        req
      );

      res.json({
        success: true,
        message: getSuccessMessage('INCIDENT_DELETED')
      });
    } catch (error) {
      console.error('Error deleting incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar incidente',
        details: error.message
      });
    }
  }

  /**
   * 6. PUT /api/employees/:employeeId/incidents/:incidentId/approve
   * Aprobar incidente
   */
  static async approve(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const { comments } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      if (incident.approval.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'El incidente ya fue procesado'
        });
      }

      // Aprobar
      await incident.approve(userId, userName, comments);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_approved',
        `Incidente aprobado: ${incident.title}`,
        {
          incidentId: incident.id,
          approvedBy: userName,
          comments
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('INCIDENT_APPROVED')
      });
    } catch (error) {
      console.error('Error approving incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al aprobar incidente',
        details: error.message
      });
    }
  }

  /**
   * 7. PUT /api/employees/:employeeId/incidents/:incidentId/reject
   * Rechazar incidente
   */
  static async reject(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const { comments } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      if (!comments) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('COMMENTS_REQUIRED')
        });
      }

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      if (incident.approval.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'El incidente ya fue procesado'
        });
      }

      // Rechazar
      await incident.reject(userId, userName, comments);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_rejected',
        `Incidente rechazado: ${incident.title}`,
        {
          incidentId: incident.id,
          rejectedBy: userName,
          comments
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('INCIDENT_REJECTED')
      });
    } catch (error) {
      console.error('Error rejecting incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al rechazar incidente',
        details: error.message
      });
    }
  }

  /**
   * 8. PUT /api/employees/:employeeId/incidents/:incidentId/close
   * Cerrar incidente
   */
  static async close(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const { resolution, followUpRequired, followUpDate } = req.body;
      const userId = req.user?.id || null;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('RESOLUTION_REQUIRED')
        });
      }

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      // Cerrar
      await incident.close(userId, resolution, followUpRequired, followUpDate);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_closed',
        `Incidente cerrado: ${incident.title}`,
        {
          incidentId: incident.id,
          resolution,
          followUpRequired,
          followUpDate
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('INCIDENT_CLOSED')
      });
    } catch (error) {
      console.error('Error closing incident:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cerrar incidente',
        details: error.message
      });
    }
  }

  /**
   * 9. PUT /api/employees/:employeeId/incidents/:incidentId/mark-paid
   * Marcar costo como pagado
   */
  static async markPaid(req, res) {
    try {
      const { id: employeeId, incidentId } = req.params;
      const { receipts } = req.body;
      const userId = req.user?.id || null;

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      if (!incident.cost.amount || incident.cost.amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'El incidente no tiene costo asociado'
        });
      }

      // Marcar como pagado
      await incident.markAsPaid(userId, receipts || []);

      // Actualizar estadísticas
      const incidentData = await IncidentData.findByEmployee(employeeId);
      if (incidentData) {
        await incidentData.updateStatistics();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'incident_cost_paid',
        `Costo marcado como pagado: ${incident.title}`,
        {
          incidentId: incident.id,
          amount: incident.cost.amount,
          receipts
        },
        userId,
        req
      );

      res.json({
        success: true,
        data: incident.toFirestore(),
        message: getSuccessMessage('COST_MARKED_PAID')
      });
    } catch (error) {
      console.error('Error marking incident as paid:', error);
      res.status(500).json({
        success: false,
        error: 'Error al marcar costo como pagado',
        details: error.message
      });
    }
  }

  /**
   * 10. GET /api/employees/:employeeId/incidents/summary
   * Obtener resumen estadístico
   */
  static async getSummary(req, res) {
    try {
      const { id: employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      const incidentData = await IncidentData.getOrCreate(employeeId, {
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        position: employee.position.title,
        department: employee.position.department
      });

      await incidentData.updateStatistics();

      res.json({
        success: true,
        data: incidentData.summary
      });
    } catch (error) {
      console.error('Error getting incident summary:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen',
        details: error.message
      });
    }
  }

  /**
   * 12. GET /api/employees/:employeeId/incidents/export
   * Exportar incidentes
   */
  static async export(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { format = 'excel', year, status } = req.query;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Obtener incidentes
      const incidents = await Incident.listByEmployee(employeeId, {
        year: year ? parseInt(year) : null,
        status
      });

      // Obtener resumen
      const incidentData = await IncidentData.findByEmployee(employeeId);
      await incidentData?.updateStatistics();

      // Preparar datos para exportación
      const exportData = {
        employee: {
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          employeeNumber: employee.employeeNumber,
          position: employee.position.title,
          department: employee.position.department
        },
        summary: incidentData?.summary || {},
        incidents: incidents.map(incident => incident.toFirestore()),
        filters: {
          year: year ? parseInt(year) : null,
          status
        },
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
      console.error('Error exporting incidents:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar incidentes',
        details: error.message
      });
    }
  }

  /**
   * 13. GET /api/employees/:employeeId/incidents/:incidentId/report/:type
   * Generar reporte específico
   */
  static async generateReport(req, res) {
    try {
      const { id: employeeId, incidentId, type } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      const incident = await Incident.findById(employeeId, incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('INCIDENT_NOT_FOUND')
        });
      }

      // Preparar datos del reporte
      const reportData = {
        employee: {
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          employeeNumber: employee.employeeNumber,
          position: employee.position.title,
          department: employee.position.department
        },
        incident: incident.toFirestore(),
        reportType: type,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.name || 'Sistema'
      };

      // TODO: Implementar generación de PDF según tipo
      res.json({
        success: true,
        message: `Reporte ${type} en desarrollo`,
        data: reportData
      });
    } catch (error) {
      console.error('Error generating incident report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte',
        details: error.message
      });
    }
  }
}

module.exports = IncidentController;
