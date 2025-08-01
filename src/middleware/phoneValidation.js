/**
 * 📞 MIDDLEWARE DE VALIDACIÓN DE TELÉFONOS CENTRALIZADO
 * 
 * Centraliza toda la lógica de validación y normalización de teléfonos
 * para evitar duplicación en modelos, controladores y servicios.
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const logger = require('../utils/logger');

/**
 * Middleware para validar teléfono en body
 */
function validatePhoneInBody(fieldName = 'phone') {
  return (req, res, next) => {
    try {
      const phone = req.body[fieldName];
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'PHONE_REQUIRED',
          message: `Campo ${fieldName} es requerido`,
          timestamp: new Date().toISOString()
        });
      }

      const validation = validateAndNormalizePhone(phone);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PHONE',
          message: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      // Reemplazar con teléfono normalizado
      req.body[fieldName] = validation.normalized;
      req.validatedPhone = validation;

      // Log removido para reducir ruido en producción

      next();

    } catch (error) {
      logger.error('Error en validación de teléfono:', error);
      return res.status(500).json({
        success: false,
        error: 'PHONE_VALIDATION_ERROR',
        message: 'Error interno validando teléfono',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware para validar teléfono en query params
 */
function validatePhoneInQuery(fieldName = 'phone') {
  return (req, res, next) => {
    try {
      const phone = req.query[fieldName];
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'PHONE_REQUIRED',
          message: `Parámetro ${fieldName} es requerido`,
          timestamp: new Date().toISOString()
        });
      }

      const validation = validateAndNormalizePhone(phone);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PHONE',
          message: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      // Reemplazar con teléfono normalizado
      req.query[fieldName] = validation.normalized;
      req.validatedPhone = validation;

      // Log removido para reducir ruido en producción

      next();

    } catch (error) {
      logger.error('Error en validación de teléfono en query:', error);
      return res.status(500).json({
        success: false,
        error: 'PHONE_VALIDATION_ERROR',
        message: 'Error interno validando teléfono',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware para validar teléfono en params
 */
function validatePhoneInParams(fieldName = 'phone') {
  return (req, res, next) => {
    try {
      const phone = req.params[fieldName];
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'PHONE_REQUIRED',
          message: `Parámetro ${fieldName} es requerido`,
          timestamp: new Date().toISOString()
        });
      }

      const validation = validateAndNormalizePhone(phone);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PHONE',
          message: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      // Reemplazar con teléfono normalizado
      req.params[fieldName] = validation.normalized;
      req.validatedPhone = validation;

      // Log removido para reducir ruido en producción

      next();

    } catch (error) {
      logger.error('Error en validación de teléfono en params:', error);
      return res.status(500).json({
        success: false,
        error: 'PHONE_VALIDATION_ERROR',
        message: 'Error interno validando teléfono',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware para validar múltiples teléfonos en body
 */
function validateMultiplePhonesInBody(phoneFields = ['phone', 'customerPhone', 'from', 'to']) {
  return (req, res, next) => {
    try {
      const validations = {};
      const errors = [];

      for (const fieldName of phoneFields) {
        const phone = req.body[fieldName];
        
        if (phone) {
          const validation = validateAndNormalizePhone(phone);
          
          if (!validation.isValid) {
            errors.push({
              field: fieldName,
              message: validation.error
            });
          } else {
            validations[fieldName] = validation;
            req.body[fieldName] = validation.normalized;
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PHONES',
          message: 'Uno o más teléfonos son inválidos',
          details: errors,
          timestamp: new Date().toISOString()
        });
      }

      req.validatedPhones = validations;

      // Log removido para reducir ruido en producción

      next();

    } catch (error) {
      logger.error('Error en validación de múltiples teléfonos:', error);
      return res.status(500).json({
        success: false,
        error: 'PHONE_VALIDATION_ERROR',
        message: 'Error interno validando teléfonos',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware para validar teléfono opcional
 */
function validateOptionalPhoneInBody(fieldName = 'phone') {
  return (req, res, next) => {
    try {
      const phone = req.body[fieldName];
      
      if (phone) {
        const validation = validateAndNormalizePhone(phone);
        
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_PHONE',
            message: validation.error,
            timestamp: new Date().toISOString()
          });
        }

        // Reemplazar con teléfono normalizado
        req.body[fieldName] = validation.normalized;
        req.validatedPhone = validation;

        // Log removido para reducir ruido en producción
      }

      next();

    } catch (error) {
      logger.error('Error en validación de teléfono opcional:', error);
      return res.status(500).json({
        success: false,
        error: 'PHONE_VALIDATION_ERROR',
        message: 'Error interno validando teléfono',
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = {
  validatePhoneInBody,
  validatePhoneInQuery,
  validatePhoneInParams,
  validateMultiplePhonesInBody,
  validateOptionalPhoneInBody
}; 