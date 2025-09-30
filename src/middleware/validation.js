/**
 * 🔍 MIDDLEWARE DE VALIDACIÓN
 * 
 * Middleware para validar parámetros de rutas y datos de entrada
 * específicos para el módulo de documentos de empleados.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const Joi = require('joi');
const { ResponseHandler } = require('../utils/responseHandler');
const Employee = require('../models/Employee');
const EmployeeDocument = require('../models/EmployeeDocument');
const logger = require('../utils/logger');

/**
 * Middleware genérico para validar requests con esquemas Joi
 * @param {Object} schemas - Objeto con esquemas para body, params, query
 * @returns {Function} Middleware de validación
 */
const validateRequest = (schemas = {}) => {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validar body
      if (schemas.body) {
        const { error, value } = schemas.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `body.${detail.path.join('.')}`,
            code: detail.type,
            message: detail.message
          })));
        } else {
          req.body = value;
        }
      }

      // Validar params
      if (schemas.params) {
        const { error, value } = schemas.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `params.${detail.path.join('.')}`,
            code: detail.type,
            message: detail.message
          })));
        } else {
          req.params = value;
        }
      }

      // Validar query
      if (schemas.query) {
        const { error, value } = schemas.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(detail => ({
            field: `query.${detail.path.join('.')}`,
            code: detail.type,
            message: detail.message
          })));
        } else {
          req.query = value;
        }
      }

      // Si hay errores, devolver respuesta de error
      if (errors.length > 0) {
        logger.warn('Validación de request falló', {
          requestId: req.id || 'unknown',
          errors: errors,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });

        return res.status(400).json({
          error: 'validation_error',
          message: 'Datos de entrada inválidos',
          details: errors
        });
      }

      next();
    } catch (error) {
      logger.error('Error en middleware de validación', {
        requestId: req.id || 'unknown',
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'internal_error',
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Valida que el employeeId sea válido y que el empleado exista
 */
const validateEmployeeId = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return ResponseHandler.validationError(res, 'El ID del empleado es requerido');
    }

    // Validar formato del ID (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(employeeId)) {
      return ResponseHandler.validationError(res, 'Formato de ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return ResponseHandler.notFoundError(res, 'Empleado no encontrado');
    }

    // Verificar que el empleado esté activo (opcional)
    if (employee.status !== 'active') {
      logger.warn('Acceso a empleado inactivo', {
        employeeId,
        status: employee.status,
        user: req.user?.email
      });
    }

    // Agregar empleado al request para uso posterior
    req.employee = employee;

    next();
  } catch (error) {
    logger.error('Error validando employeeId', {
      employeeId: req.params.employeeId,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'EMPLOYEE_VALIDATION_ERROR',
      message: 'Error validando empleado'
    }, 500);
  }
};

/**
 * Valida que el documentId sea válido y que el documento exista
 */
const validateDocumentId = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return ResponseHandler.validationError(res, 'El ID del documento es requerido');
    }

    // Validar formato del ID (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      return ResponseHandler.validationError(res, 'Formato de ID de documento inválido');
    }

    // Verificar que el documento existe
    const document = await EmployeeDocument.findById(documentId);
    if (!document) {
      return ResponseHandler.notFoundError(res, 'Documento no encontrado');
    }

    // Verificar que el documento no esté eliminado
    if (document.audit.deletedAt) {
      return ResponseHandler.notFoundError(res, 'Documento no encontrado');
    }

    // Agregar documento al request para uso posterior
    req.document = document;

    next();
  } catch (error) {
    logger.error('Error validando documentId', {
      documentId: req.params.documentId,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'DOCUMENT_VALIDATION_ERROR',
      message: 'Error validando documento'
    }, 500);
  }
};

/**
 * Valida que el usuario tenga acceso al empleado específico
 * (útil para supervisores que solo pueden ver empleados de su departamento)
 */
const validateEmployeeAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const employee = req.employee;

    // Admin y HR admin pueden acceder a todos los empleados
    if (['admin', 'hr_admin'].includes(user.role) || user.hrRole === 'HR_ADMIN') {
      return next();
    }

    // HR manager puede acceder a empleados de su departamento
    if (user.role === 'hr_manager' || user.hrRole === 'HR_MANAGER') {
      // Si el usuario tiene un departamento asignado, verificar que coincida
      if (user.department && user.department !== employee.position.department) {
        return ResponseHandler.authorizationError(res, 'No tienes acceso a empleados de otros departamentos');
      }
    }

    // Supervisor puede acceder a empleados de su equipo
    if (user.role === 'supervisor' || user.hrRole === 'SUPERVISOR') {
      // Verificar si el empleado reporta al supervisor
      if (employee.position.reportsTo !== user.id) {
        return ResponseHandler.authorizationError(res, 'No tienes acceso a este empleado');
      }
    }

    // Empleado solo puede acceder a sus propios documentos
    if (user.role === 'employee' || user.hrRole === 'EMPLOYEE') {
      if (employee.id !== user.id) {
        return ResponseHandler.authorizationError(res, 'Solo puedes acceder a tus propios documentos');
      }
    }

    next();
  } catch (error) {
    logger.error('Error validando acceso al empleado', {
      employeeId: req.params.employeeId,
      userId: req.user?.id,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'AUTHORIZATION_ERROR',
      code: 'EMPLOYEE_ACCESS_VALIDATION_ERROR',
      message: 'Error validando acceso al empleado'
    }, 500);
  }
};

/**
 * Valida parámetros de paginación
 */
const validatePagination = (req, res, next) => {
  try {
    const { page, limit } = req.query;

    if (page !== undefined) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        return ResponseHandler.validationError(res, 'La página debe ser un número mayor a 0');
      }
      req.query.page = pageNum;
    }

    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return ResponseHandler.validationError(res, 'El límite debe ser un número entre 1 y 100');
      }
      req.query.limit = limitNum;
    }

    next();
  } catch (error) {
    logger.error('Error validando paginación', {
      query: req.query,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'PAGINATION_VALIDATION_ERROR',
      message: 'Error validando parámetros de paginación'
    }, 500);
  }
};

/**
 * Valida parámetros de búsqueda
 */
const validateSearch = (req, res, next) => {
  try {
    const { search, category, confidential, sortBy, sortOrder } = req.query;

    // Validar búsqueda
    if (search !== undefined && typeof search !== 'string') {
      return ResponseHandler.validationError(res, 'El parámetro de búsqueda debe ser texto');
    }

    // Validar categoría
    if (category !== undefined) {
      const validCategories = ['contract', 'id', 'tax', 'certification', 'other'];
      if (!validCategories.includes(category)) {
        return ResponseHandler.validationError(res, `Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`);
      }
    }

    // Validar confidencialidad
    if (confidential !== undefined) {
      if (!['true', 'false'].includes(confidential)) {
        return ResponseHandler.validationError(res, 'confidential debe ser "true" o "false"');
      }
    }

    // Validar ordenamiento
    if (sortBy !== undefined) {
      const validSortFields = ['uploadedAt', 'originalName', 'fileSize', 'category'];
      if (!validSortFields.includes(sortBy)) {
        return ResponseHandler.validationError(res, `Campo de ordenamiento inválido. Debe ser uno de: ${validSortFields.join(', ')}`);
      }
    }

    if (sortOrder !== undefined) {
      if (!['asc', 'desc'].includes(sortOrder)) {
        return ResponseHandler.validationError(res, 'Orden inválido. Debe ser "asc" o "desc"');
      }
    }

    next();
  } catch (error) {
    logger.error('Error validando parámetros de búsqueda', {
      query: req.query,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'SEARCH_VALIDATION_ERROR',
      message: 'Error validando parámetros de búsqueda'
    }, 500);
  }
};

/**
 * Valida datos de actualización de documento
 */
const validateDocumentUpdate = (req, res, next) => {
  try {
    const { description, tags, isConfidential, expiresAt } = req.body;

    // Validar descripción
    if (description !== undefined && typeof description !== 'string') {
      return ResponseHandler.validationError(res, 'La descripción debe ser texto');
    }

    // Validar tags
    if (tags !== undefined) {
      if (typeof tags !== 'string' && !Array.isArray(tags)) {
        return ResponseHandler.validationError(res, 'Los tags deben ser texto o array');
      }
    }

    // Validar confidencialidad
    if (isConfidential !== undefined) {
      if (typeof isConfidential !== 'boolean' && !['true', 'false'].includes(isConfidential)) {
        return ResponseHandler.validationError(res, 'isConfidential debe ser true o false');
      }
    }

    // Validar fecha de expiración
    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== 'string' || isNaN(Date.parse(expiresAt))) {
        return ResponseHandler.validationError(res, 'expiresAt debe ser una fecha válida en formato ISO');
      }
    }

    next();
  } catch (error) {
    logger.error('Error validando datos de actualización', {
      body: req.body,
      error: error.message
    });

    return ResponseHandler.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'DOCUMENT_UPDATE_VALIDATION_ERROR',
      message: 'Error validando datos de actualización'
    }, 500);
  }
};

module.exports = {
  validateRequest,
  validateEmployeeId,
  validateDocumentId,
  validateEmployeeAccess,
  validatePagination,
  validateSearch,
  validateDocumentUpdate
};