const MessageStatus = require('../models/MessageStatus');
const { logger } = require('../utils/logger');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const { safeDateToISOString } = require('../utils/dateHelpers');

/**
 * 📊 CONTROLADOR DE STATUS DE MENSAJES TWILIO
 * 
 * Maneja los webhooks de status de mensajes de Twilio:
 * - Callbacks de status (delivered, read, failed, etc.)
 * - Actualización de información de contacto
 * - Guardado de metadatos completos
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class TwilioStatusController {
  /**
   * 📊 POST /api/twilio/status-callback
   * Endpoint para recibir callbacks de status de mensajes de Twilio
   */
  static async handleStatusCallback(req, res, next) {
    try {
      const webhookData = req.body;

      logger.info('📊 Recibiendo callback de status de Twilio', {
        messageSid: webhookData.MessageSid,
        messageStatus: webhookData.MessageStatus,
        errorCode: webhookData.ErrorCode,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      // Validar datos requeridos
      if (!webhookData.MessageSid) {
        logger.warn('⚠️ Callback sin MessageSid', {
          webhookData: Object.keys(webhookData),
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'MISSING_MESSAGE_SID',
          'MessageSid es requerido en el callback',
          'Verifica que el webhook incluya el MessageSid',
          400
        ));
      }

      if (!webhookData.MessageStatus) {
        logger.warn('⚠️ Callback sin MessageStatus', {
          messageSid: webhookData.MessageSid,
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'MISSING_MESSAGE_STATUS',
          'MessageStatus es requerido en el callback',
          'Verifica que el webhook incluya el MessageStatus',
          400
        ));
      }

      // Procesar el status del mensaje
      const messageStatus = await MessageStatus.processStatusWebhook(webhookData);

      if (!messageStatus) {
        logger.warn('⚠️ No se pudo procesar el status del mensaje', {
          messageSid: webhookData.MessageSid,
          messageStatus: webhookData.MessageStatus
        });

        return ResponseHandler.error(res, new ApiError(
          'MESSAGE_NOT_FOUND',
          'No se encontró el mensaje para actualizar',
          'El mensaje puede no existir en la base de datos',
          404
        ));
      }

      logger.info('✅ Status de mensaje procesado exitosamente', {
        messageId: messageStatus.messageId,
        twilioSid: messageStatus.twilioSid,
        status: messageStatus.status,
        previousStatus: messageStatus.previousStatus
      });

      // Responder a Twilio (debe ser 200 OK)
      return ResponseHandler.success(res, {
        processed: true,
        messageId: messageStatus.messageId,
        status: messageStatus.status,
        timestamp: messageStatus.timestamp?.toDate?.()?.toISOString() || messageStatus.timestamp
      }, 'Status procesado correctamente');

    } catch (error) {
      logger.error('❌ Error procesando callback de status', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        webhookData: {
          MessageSid: req.body?.MessageSid,
          MessageStatus: req.body?.MessageStatus,
          ErrorCode: req.body?.ErrorCode
        },
        ip: req.ip
      });

      // IMPORTANTE: Siempre responder 200 OK a Twilio para evitar reintentos
      return res.status(200).json({
        success: false,
        error: error.message,
        processed: false,
        timestamp: safeDateToISOString(new Date())
      });
    }
  }

  /**
   * 📊 GET /api/twilio/status/:messageId
   * Obtener historial de status de un mensaje
   */
  static async getMessageStatusHistory(req, res, next) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_MESSAGE_ID',
          'ID de mensaje es requerido',
          'Especifica el ID del mensaje en la URL',
          400
        ));
      }

      logger.info('📊 Obteniendo historial de status', { messageId });

      const statusHistory = await MessageStatus.getStatusHistory(messageId);

      logger.info('✅ Historial de status obtenido', {
        messageId,
        statusCount: statusHistory.length
      });

      return ResponseHandler.success(res, {
        messageId,
        statusHistory: statusHistory.map(status => status.toJSON()),
        count: statusHistory.length,
        lastStatus: statusHistory[0]?.toJSON() || null
      }, 'Historial de status obtenido');

    } catch (error) {
      logger.error('❌ Error obteniendo historial de status', {
        messageId: req.params?.messageId,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'STATUS_HISTORY_ERROR',
        'Error obteniendo historial de status',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/twilio/status/:messageId/last
   * Obtener último status de un mensaje
   */
  static async getLastMessageStatus(req, res, next) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_MESSAGE_ID',
          'ID de mensaje es requerido',
          'Especifica el ID del mensaje en la URL',
          400
        ));
      }

      logger.info('📊 Obteniendo último status', { messageId });

      const lastStatus = await MessageStatus.getLastStatus(messageId);

      if (!lastStatus) {
        return ResponseHandler.error(res, new ApiError(
          'STATUS_NOT_FOUND',
          'No se encontró status para el mensaje',
          'El mensaje puede no tener status registrado',
          404
        ));
      }

      logger.info('✅ Último status obtenido', {
        messageId,
        status: lastStatus.status,
        timestamp: lastStatus.timestamp
      });

      return ResponseHandler.success(res, lastStatus.toJSON(), 'Último status obtenido');

    } catch (error) {
      logger.error('❌ Error obteniendo último status', {
        messageId: req.params?.messageId,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'LAST_STATUS_ERROR',
        'Error obteniendo último status',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/twilio/status/stats
   * Obtener estadísticas de status de mensajes
   */
  static async getStatusStats(req, res, next) {
    try {
      const { 
        startDate = null, 
        endDate = null, 
        status = null,
        period = '7d'
      } = req.query;

      logger.info('📊 Obteniendo estadísticas de status', {
        startDate,
        endDate,
        status,
        period
      });

      // Calcular fechas por período si no se especifican
      let start, end;
      if (!startDate || !endDate) {
        const now = new Date();
        end = endDate ? new Date(endDate) : now;
        
        if (!startDate) {
          const daysToSubtract = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
          start = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
        } else {
          start = new Date(startDate);
        }
      } else {
        start = new Date(startDate);
        end = new Date(endDate);
      }

      const stats = await MessageStatus.getStatusStats({
        startDate: start,
        endDate: end,
        status
      });

      logger.info('✅ Estadísticas de status obtenidas', {
        total: stats.total,
        byStatus: Object.keys(stats.byStatus).length,
        period
      });

      return ResponseHandler.success(res, {
        stats,
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }, 'Estadísticas de status obtenidas');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de status', {
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'STATS_ERROR',
        'Error obteniendo estadísticas de status',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 POST /api/twilio/status/bulk-update
   * Actualizar status de múltiples mensajes (para sincronización)
   */
  static async bulkUpdateStatus(req, res, next) {
    try {
      const { statusUpdates } = req.body;

      if (!statusUpdates || !Array.isArray(statusUpdates)) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_STATUS_UPDATES',
          'Array de statusUpdates es requerido',
          'Incluye un array con las actualizaciones de status',
          400
        ));
      }

      logger.info('📊 Actualización masiva de status', {
        updateCount: statusUpdates.length
      });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const update of statusUpdates) {
        try {
          const { messageId, twilioSid, status, metadata } = update;

          if (!messageId || !twilioSid || !status) {
            results.push({
              messageId,
              twilioSid,
              success: false,
              error: 'Datos incompletos'
            });
            errorCount++;
            continue;
          }

          const statusData = {
            messageId,
            twilioSid,
            status,
            metadata: metadata || {},
            timestamp: new Date()
          };

          const messageStatus = await MessageStatus.create(statusData);
          
          results.push({
            messageId,
            twilioSid,
            success: true,
            statusId: messageStatus.id
          });
          successCount++;

        } catch (error) {
          results.push({
            messageId: update.messageId,
            twilioSid: update.twilioSid,
            success: false,
            error: error.message
          });
          errorCount++;
        }
      }

      logger.info('✅ Actualización masiva completada', {
        total: statusUpdates.length,
        success: successCount,
        errors: errorCount
      });

      return ResponseHandler.success(res, {
        results,
        summary: {
          total: statusUpdates.length,
          success: successCount,
          errors: errorCount
        }
      }, 'Actualización masiva completada');

    } catch (error) {
      logger.error('❌ Error en actualización masiva de status', {
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'BULK_UPDATE_ERROR',
        'Error en actualización masiva de status',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 POST /api/twilio/status/sync
   * Sincronizar status desde Twilio API
   */
  static async syncStatusFromTwilio(req, res, next) {
    try {
      const { messageSids } = req.body;

      if (!messageSids || !Array.isArray(messageSids)) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_MESSAGE_SIDS',
          'Array de messageSids es requerido',
          'Incluye un array con los SIDs de mensajes a sincronizar',
          400
        ));
      }

      logger.info('📊 Sincronizando status desde Twilio', {
        messageCount: messageSids.length
      });

      // Importar MessageService dinámicamente
      const { getMessageService } = require('../services/MessageService');
              const messageService = getMessageService();

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const messageSid of messageSids) {
        try {
          // Obtener status desde Twilio API
          const message = await messageService.client.messages(messageSid).fetch();
          
          // Crear webhook data simulado
          const webhookData = {
            MessageSid: message.sid,
            MessageStatus: message.status,
            ErrorCode: message.errorCode,
            ErrorMessage: message.errorMessage,
            To: message.to,
            From: message.from,
            AccountSid: message.accountSid,
            ApiVersion: message.apiVersion,
            Price: message.price,
            PriceUnit: message.priceUnit,
            NumSegments: message.numSegments,
            NumMedia: message.numMedia,
            Body: message.body
          };

          // Procesar como webhook normal
          const messageStatus = await MessageStatus.processStatusWebhook(webhookData);

          results.push({
            messageSid,
            success: true,
            status: message.status,
            messageId: messageStatus?.messageId
          });
          successCount++;

        } catch (error) {
          results.push({
            messageSid,
            success: false,
            error: error.message
          });
          errorCount++;
        }
      }

      logger.info('✅ Sincronización desde Twilio completada', {
        total: messageSids.length,
        success: successCount,
        errors: errorCount
      });

      return ResponseHandler.success(res, {
        results,
        summary: {
          total: messageSids.length,
          success: successCount,
          errors: errorCount
        }
      }, 'Sincronización completada');

    } catch (error) {
      logger.error('❌ Error sincronizando status desde Twilio', {
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'SYNC_ERROR',
        'Error sincronizando status desde Twilio',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }
}

module.exports = TwilioStatusController; 