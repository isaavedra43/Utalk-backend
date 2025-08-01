const express = require('express');
const router = express.Router();
const TwilioStatusController = require('../controllers/TwilioStatusController');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para Twilio
const twilioValidators = {
  validateWebhook: validateRequest({
    body: Joi.object({
      MessageSid: Joi.string().required(),
      From: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      To: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      Body: Joi.string().optional(),
      Status: Joi.string().valid('delivered', 'read', 'failed', 'sent').optional(),
      ErrorCode: Joi.string().optional(),
      ErrorMessage: Joi.string().optional()
    })
  }),

  validateStatusUpdate: validateRequest({
    body: Joi.object({
      MessageSid: Joi.string().required(),
      MessageStatus: Joi.string().valid('delivered', 'read', 'failed', 'sent').required(),
      ErrorCode: Joi.string().optional(),
      ErrorMessage: Joi.string().optional()
    })
  })
};

/**
 * @route POST /api/twilio/status-callback
 * @desc Callback de status de mensajes de Twilio
 * @access Public (webhook de Twilio)
 */
router.post('/status-callback',
  twilioValidators.validateWebhook,
  TwilioStatusController.handleStatusCallback
);

/**
 * @route GET /api/twilio/status/:messageId
 * @desc Obtener historial de status de un mensaje
 * @access Private (Admin, Agent)
 */
router.get('/status/:messageId',
  authMiddleware,
  requireReadAccess,
  TwilioStatusController.getMessageStatusHistory
);

/**
 * @route GET /api/twilio/status/:messageId/last
 * @desc Obtener último status de un mensaje
 * @access Private (Admin, Agent)
 */
router.get('/status/:messageId/last',
  authMiddleware,
  requireReadAccess,
  TwilioStatusController.getLastMessageStatus
);

/**
 * @route GET /api/twilio/status/stats
 * @desc Obtener estadísticas de status de mensajes
 * @access Private (Admin, Agent)
 */
router.get('/status/stats',
  authMiddleware,
  requireReadAccess,
  TwilioStatusController.getStatusStats
);

/**
 * @route POST /api/twilio/status/bulk-update
 * @desc Actualizar status de múltiples mensajes
 * @access Private (Admin)
 */
router.post('/status/bulk-update',
  authMiddleware,
  requireWriteAccess,
  TwilioStatusController.bulkUpdateStatus
);

/**
 * @route POST /api/twilio/status/sync
 * @desc Sincronizar status desde Twilio API
 * @access Private (Admin)
 */
router.post('/status/sync',
  authMiddleware,
  requireWriteAccess,
  TwilioStatusController.syncStatusFromTwilio
);

module.exports = router; 