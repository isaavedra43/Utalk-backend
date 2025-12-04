const AttendanceService = require('../services/AttendanceService');
const logger = require('../utils/logger');

/**
 * Middleware para verificar permisos de asistencia
 */

/**
 * Middleware general para verificar permisos de asistencia
 */
const requireAttendancePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const permissions = await AttendanceService.validateUserPermissions(userId, permission);

      if (!permissions[permission]) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acción',
          requiredPermission: permission
        });
      }

      // Agregar permisos al request para uso posterior
      req.attendancePermissions = permissions;

      next();
    } catch (error) {
      logger.error('Error verificando permisos de asistencia:', error);
      res.status(500).json({
        success: false,
        message: 'Error verificando permisos'
      });
    }
  };
};

/**
 * Middleware específico para creación de reportes
 */
const requireCreatePermission = requireAttendancePermission('canCreate');

/**
 * Middleware específico para edición de reportes
 */
const requireEditPermission = requireAttendancePermission('canEdit');

/**
 * Middleware específico para aprobación de reportes
 */
const requireApprovePermission = requireAttendancePermission('canApprove');

/**
 * Middleware específico para rechazo de reportes
 */
const requireRejectPermission = requireAttendancePermission('canReject');

/**
 * Middleware específico para eliminación de reportes
 */
const requireDeletePermission = requireAttendancePermission('canDelete');

/**
 * Middleware específico para visualización de reportes
 */
const requireViewPermission = requireAttendancePermission('canView');

/**
 * Middleware para verificar acceso a empleado específico
 */
const requireEmployeeAccess = (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const targetEmployeeId = req.params.employeeId || req.body.employeeId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Si es admin, puede acceder a cualquier empleado
    if (req.user.role === 'admin') {
      return next();
    }

    // Si es HR manager, puede acceder a cualquier empleado
    if (req.user.role === 'hr_manager') {
      return next();
    }

    // Si es HR user, puede acceder a cualquier empleado
    if (req.user.role === 'hr_user') {
      return next();
    }

    // Si es supervisor, verificar si el empleado está bajo su supervisión
    if (req.user.role === 'supervisor') {
      // Esta lógica se implementaría verificando la estructura organizacional
      // Por ahora, permitimos acceso
      return next();
    }

    // Si es empleado, solo puede acceder a sus propios datos
    if (req.user.role === 'employee' && userId !== targetEmployeeId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes acceder a tu propia información de asistencia'
      });
    }

    next();
  } catch (error) {
    logger.error('Error verificando acceso a empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando permisos de acceso'
    });
  }
};

/**
 * Middleware para verificar acceso a reporte específico
 */
const requireReportAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const reportId = req.params.reportId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Si es admin, puede acceder a cualquier reporte
    if (req.user.role === 'admin') {
      return next();
    }

    // Si es HR manager, puede acceder a cualquier reporte
    if (req.user.role === 'hr_manager') {
      return next();
    }

    // Si es HR user, puede acceder a cualquier reporte
    if (req.user.role === 'hr_user') {
      return next();
    }

    // Para otros roles, verificar si el usuario creó el reporte
    const AttendanceReport = require('../models/AttendanceReport');
    const report = await AttendanceReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    if (report.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes acceder a reportes que tú creaste'
      });
    }

    next();
  } catch (error) {
    logger.error('Error verificando acceso a reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando permisos de acceso'
    });
  }
};

/**
 * Middleware para verificar si el reporte puede ser editado
 */
const requireEditableReport = async (req, res, next) => {
  try {
    const reportId = req.params.reportId;

    const AttendanceReport = require('../models/AttendanceReport');
    const report = await AttendanceReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Solo se pueden editar reportes en estado draft o completed
    if (!['draft', 'completed'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden editar reportes en estado borrador o completado'
      });
    }

    next();
  } catch (error) {
    logger.error('Error verificando estado de reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estado del reporte'
    });
  }
};

/**
 * Middleware para verificar si el reporte puede ser aprobado/rechazado
 */
const requireApprovableReport = async (req, res, next) => {
  try {
    const reportId = req.params.reportId;

    const AttendanceReport = require('../models/AttendanceReport');
    const report = await AttendanceReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Solo se pueden aprobar/rechazar reportes completados
    if (report.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden aprobar/rechazar reportes completados'
      });
    }

    // Verificar que no esté ya aprobado/rechazado
    if (['approved', 'rejected'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: `Este reporte ya ha sido ${report.status === 'approved' ? 'aprobado' : 'rechazado'}`
      });
    }

    next();
  } catch (error) {
    logger.error('Error verificando estado de reporte para aprobación:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estado del reporte'
    });
  }
};

/**
 * Middleware compuesto para operaciones CRUD básicas
 */
const requireAttendanceCRUD = [
  requireViewPermission,
  (req, res, next) => {
    // Agregar permisos básicos al request
    req.attendancePermissions = req.attendancePermissions || {};
    next();
  }
];

module.exports = {
  requireAttendancePermission,
  requireCreatePermission,
  requireEditPermission,
  requireApprovePermission,
  requireRejectPermission,
  requireDeletePermission,
  requireViewPermission,
  requireEmployeeAccess,
  requireReportAccess,
  requireEditableReport,
  requireApprovableReport,
  requireAttendanceCRUD
};
