const express = require('express');
const MessageController = require('../controllers/MessageController');
const { schemas } = require('../utils/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/messages/webhook
 * @desc Webhook PÚBLICO para recibir mensajes de Twilio WhatsApp
 * @access Public (SIN autenticación - Twilio accede directamente)
 * @security Validación opcional de firma Twilio
 *
 * CRÍTICO: Esta ruta DEBE responder SIEMPRE 200 OK a Twilio
 * para evitar reintentos infinitos y errores 11200
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // ✅ RAILWAY LOGGING: Log visible en Railway console
    console.log('🔗 WEBHOOK TWILIO - Mensaje recibido', {
      timestamp: new Date().toISOString(),
      from: req.body.From,
      to: req.body.To,
      messageSid: req.body.MessageSid,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
    });

    // Log detallado para debugging
    logger.info('🔗 Webhook Twilio recibido', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'x-twilio-signature': req.headers['x-twilio-signature'] ? 'presente' : 'ausente',
        'user-agent': req.headers['user-agent'],
      },
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    // ✅ VALIDACIÓN FLEXIBLE CON JOI: Usar schema preparado para Twilio
    const webhookData = req.body;

    // Validación con Joi (flexible para campos adicionales de Twilio)
    const { error, value } = schemas.message.webhook.validate(webhookData, {
      allowUnknown: true, // Permitir campos no definidos
      stripUnknown: false, // No eliminar campos extra
      abortEarly: false, // Obtener todos los errores
    });

    if (error) {
      // ⚠️ VALIDACIÓN FALLÓ: Log error pero responder 200 OK
      console.log('⚠️ WEBHOOK - Validación falló pero procesando', {
        errors: error.details.map(d => ({ field: d.path, message: d.message })),
        receivedFields: Object.keys(webhookData),
      });

      logger.warn('⚠️ Webhook validación falló pero respondiendo 200 OK', {
        validationErrors: error.details,
        receivedFields: Object.keys(webhookData),
        webhookData,
      });

      // IMPORTANTE: Responder 200 incluso con errores de validación
      return res.status(200).json({
        status: 'validation_warning',
        message: 'Webhook recibido con advertencias de validación',
        warnings: error.details.map(d => d.message),
        processTime: Date.now() - startTime,
      });
    }

    // ✅ VALIDACIÓN EXITOSA: Procesar con datos validados
    console.log('✅ WEBHOOK - Validación exitosa, procesando mensaje', {
      from: value.From,
      to: value.To,
      messageSid: value.MessageSid,
      hasBody: !!value.Body,
      numMedia: value.NumMedia || 0,
    });

    // Llamar al controlador para procesar el mensaje
    await MessageController.handleWebhookSafe(req, res);
  } catch (error) {
    // ❌ ERROR CRÍTICO: Log visible en Railway + responder 200 OK
    console.error('❌ WEBHOOK - Error crítico (respondiendo 200 OK):', {
      error: error.message,
      stack: error.stack.split('\n')[0], // Solo primera línea del stack
      webhookData: req.body,
      processTime: Date.now() - startTime,
    });

    logger.error('❌ Error crítico en webhook pero respondiendo 200 OK', {
      error: error.message,
      stack: error.stack,
      webhookData: req.body,
      processTime: Date.now() - startTime,
    });

    // ✅ RESPONDER SIEMPRE 200 OK A TWILIO
    res.status(200).json({
      status: 'error_handled',
      message: 'Error procesado, reintento no requerido',
      error: error.message,
      processTime: Date.now() - startTime,
    });
  }
});

/**
 * @route GET /api/messages/webhook
 * @desc Verificación del webhook para Twilio (webhook verification)
 * @access Public
 */
router.get('/', (req, res) => {
  console.log('🔍 WEBHOOK - Verificación Twilio');
  logger.info('🔍 Verificación webhook Twilio', { query: req.query });

  // Respuesta simple para verificación
  res.status(200).send('Webhook endpoint activo y funcionando');
});

// EXPORT PATTERN: Standard Express router
// USAGE: app.use('/api/messages/webhook', require('./routes/webhook'));
module.exports = router;
