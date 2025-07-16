const express = require('express');
const MessageController = require('../controllers/MessageController');
const { validate, schemas } = require('../utils/validation');
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
    // Log de entrada del webhook
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

    // Validación flexible del webhook (no bloquea por datos extra)
    const webhookData = req.body;

    // Validación mínima requerida
    if (!webhookData.From || !webhookData.To || !webhookData.MessageSid) {
      logger.warn('⚠️ Webhook con datos insuficientes pero respondiendo 200 OK', {
        receivedFields: Object.keys(webhookData),
        from: webhookData.From,
        to: webhookData.To,
        messageSid: webhookData.MessageSid,
      });

      // IMPORTANTE: Responder 200 incluso con datos insuficientes
      return res.status(200).json({
        status: 'ok',
        message: 'Webhook recibido con datos insuficientes',
        processTime: Date.now() - startTime,
      });
    }

    // Llamar al controlador para procesar el mensaje
    await MessageController.handleWebhookSafe(req, res);
  } catch (error) {
    // ERROR CRÍTICO: NUNCA responder con 4xx o 5xx a Twilio
    logger.error('❌ Error crítico en webhook pero respondiendo 200 OK', {
      error: error.message,
      stack: error.stack,
      webhookData: req.body,
      processTime: Date.now() - startTime,
    });

    // RESPONDER SIEMPRE 200 OK A TWILIO
    res.status(200).json({
      status: 'error_handled',
      message: 'Error procesado, reintento no requerido',
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
  logger.info('🔍 Verificación webhook Twilio', { query: req.query });

  // Respuesta simple para verificación
  res.status(200).send('Webhook endpoint activo');
});

// EXPORT PATTERN: Standard Express router
// USAGE: app.use('/webhook', require('./routes/webhook'));
module.exports = router;
