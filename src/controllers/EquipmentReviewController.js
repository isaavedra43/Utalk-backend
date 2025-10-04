const EquipmentReview = require('../models/EquipmentReview');
const Equipment = require('../models/Equipment');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');
const { 
  getErrorMessage, 
  getSuccessMessage,
  hasPermission,
  getNextReviewType,
  calculateNextReviewDate
} = require('../config/equipmentConfig');
const logger = require('../utils/logger');

/**
 * 🎯 CONTROLADOR DE REVISIONES DE EQUIPOS
 * 
 * Maneja todas las operaciones relacionadas con revisiones de equipos
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EquipmentReviewController {
  /**
   * Crear nueva revisión
   */
  static async create(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const reviewData = req.body;
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

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'CREATE_REVIEW')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Crear revisión
      const review = new EquipmentReview({
        ...reviewData,
        equipmentId,
        employeeId,
        reviewedBy: userId,
        reviewedByName: userName
      });

      // Validar datos
      const errors = review.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: errors
        });
      }

      // Guardar revisión
      await review.save();

      // Actualizar condición del equipo si es necesario
      if (review.condition !== equipment.condition) {
        await equipment.update({ condition: review.condition });
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_reviewed',
        {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          reviewId: review.id,
          reviewType: review.reviewType,
          condition: review.condition,
          score: review.score,
          reviewedBy: userName
        },
        userId
      );

      logger.info('Revisión de equipo creada exitosamente', {
        reviewId: review.id,
        equipmentId: equipment.id,
        employeeId,
        reviewedBy: userName
      });

      res.status(201).json({
        success: true,
        data: review,
        message: getSuccessMessage('REVIEW_CREATED')
      });
    } catch (error) {
      logger.error('Error al crear revisión de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener revisiones de un equipo
   */
  static async getByEquipment(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const { 
        reviewType, 
        condition,
        page = 1, 
        limit = 20,
        orderBy = 'reviewDate',
        orderDirection = 'desc'
      } = req.query;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Construir opciones de búsqueda
      const options = {
        reviewType,
        condition,
        orderBy,
        orderDirection,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      // Obtener revisiones
      const reviews = await EquipmentReview.listByEquipment(employeeId, equipmentId, options);

      res.json({
        success: true,
        data: reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: reviews.length
        }
      });
    } catch (error) {
      logger.error('Error al obtener revisiones de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener revisión específica
   */
  static async getById(req, res) {
    try {
      const { id: employeeId, equipmentId, reviewId } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Obtener revisión
      const review = await EquipmentReview.findById(employeeId, equipmentId, reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Revisión no encontrada'
        });
      }

      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      logger.error('Error al obtener revisión de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        reviewId: req.params.reviewId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de revisiones
   */
  static async getStats(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Obtener estadísticas
      const stats = await EquipmentReview.getReviewStats(employeeId, equipmentId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de revisiones', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Programar próxima revisión
   */
  static async scheduleReview(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const { reviewType, scheduledDate, notes } = req.body;
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

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'CREATE_REVIEW')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Obtener última revisión
      const lastReview = await EquipmentReview.getLastReview(employeeId, equipmentId);
      
      // Determinar tipo de revisión si no se proporciona
      const nextReviewType = reviewType || (lastReview ? getNextReviewType(lastReview.reviewType) : 'monthly');
      
      // Calcular fecha si no se proporciona
      const nextReviewDate = scheduledDate || (lastReview ? 
        calculateNextReviewDate(lastReview.reviewDate, nextReviewType) : 
        new Date().toISOString().split('T')[0]
      );

      // Crear revisión programada (con estado especial)
      const scheduledReview = new EquipmentReview({
        equipmentId,
        employeeId,
        reviewDate: nextReviewDate,
        reviewType: nextReviewType,
        condition: 'good', // Valor por defecto
        cleanliness: 'good',
        functionality: 'good',
        reviewedBy: userId,
        reviewedByName: userName,
        notes: notes || `Revisión ${nextReviewType} programada`
      });

      // Marcar como programada (podríamos agregar un campo status a la revisión)
      await scheduledReview.save();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_review_scheduled',
        {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          reviewId: scheduledReview.id,
          reviewType: nextReviewType,
          scheduledDate: nextReviewDate,
          scheduledBy: userName
        },
        userId
      );

      logger.info('Revisión de equipo programada exitosamente', {
        reviewId: scheduledReview.id,
        equipmentId: equipment.id,
        employeeId,
        scheduledBy: userName
      });

      res.status(201).json({
        success: true,
        data: {
          reviewId: scheduledReview.id,
          reviewType: nextReviewType,
          scheduledDate: nextReviewDate,
          notes: notes || `Revisión ${nextReviewType} programada`
        },
        message: 'Revisión programada exitosamente'
      });
    } catch (error) {
      logger.error('Error al programar revisión de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Eliminar revisión
   */
  static async delete(req, res) {
    try {
      const { id: employeeId, equipmentId, reviewId } = req.params;
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

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'DELETE_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Verificar que la revisión existe
      const review = await EquipmentReview.findById(employeeId, equipmentId, reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Revisión no encontrada'
        });
      }

      // Eliminar revisión
      await EquipmentReview.delete(employeeId, equipmentId, reviewId);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_review_deleted',
        {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          reviewId: review.id,
          reviewType: review.reviewType,
          deletedBy: userName
        },
        userId
      );

      logger.info('Revisión de equipo eliminada exitosamente', {
        reviewId: review.id,
        equipmentId: equipment.id,
        employeeId,
        deletedBy: userName
      });

      res.json({
        success: true,
        message: getSuccessMessage('REVIEW_DELETED')
      });
    } catch (error) {
      logger.error('Error al eliminar revisión de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        reviewId: req.params.reviewId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener última revisión de un equipo
   */
  static async getLastReview(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar que el equipo existe
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Obtener última revisión
      const lastReview = await EquipmentReview.getLastReview(employeeId, equipmentId);

      res.json({
        success: true,
        data: lastReview
      });
    } catch (error) {
      logger.error('Error al obtener última revisión de equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = EquipmentReviewController;
