const Message = require('../models/Message');
const logger = require('../utils/logger');
const performanceMetrics = require('../services/PerformanceMetricsService');

/**
 * MessageRepository - Cascarón para operaciones de mensajes
 * 
 * Inicialmente delega a Message.js sin cambiar contratos.
 * Preparado para futuras optimizaciones (paginación, índices, etc.)
 */
class MessageRepository {
  /**
   * Crear mensaje
   */
  static async create(messageData, uniqueMessageId) {
    logger.debug('MessageRepository.create delegando a Message.create', {
      category: 'REPOSITORY_DELEGATION',
      conversationId: messageData.conversationId,
      type: messageData.type
    });
    return Message.create(messageData, uniqueMessageId);
  }

  /**
   * Obtener mensaje por Twilio SID
   */
  static async getByTwilioSid(twilioSid) {
    logger.debug('MessageRepository.getByTwilioSid delegando a Message.getByTwilioSid', {
      category: 'REPOSITORY_DELEGATION',
      twilioSid
    });
    return Message.getByTwilioSid(twilioSid);
  }

  /**
   * Obtener mensajes por conversación con paginación optimizada
   */
  static async getByConversation(conversationId, options = {}) {
    const startTime = Date.now();
    
    logger.debug('MessageRepository.getByConversation con paginación optimizada', {
      category: 'REPOSITORY_OPTIMIZED',
      conversationId,
      options: {
        limit: options.limit,
        cursor: options.cursor ? 'presente' : 'ausente',
        orderBy: options.orderBy,
        order: options.order
      }
    });

    try {
      // Validar y optimizar opciones
      const optimizedOptions = {
        limit: Math.min(Math.max(options.limit || 20, 1), 100), // Límite entre 1-100
        cursor: options.cursor,
        direction: options.direction,
        status: options.status,
        type: options.type,
        startDate: options.startDate,
        endDate: options.endDate,
        orderBy: options.orderBy || 'timestamp',
        order: ['asc', 'desc'].includes(options.order) ? options.order : 'desc'
      };

      // Ejecutar consulta optimizada
      const result = await Message.getByConversation(conversationId, optimizedOptions);
      
      const queryTime = Date.now() - startTime;
      
      // Registrar métrica de rendimiento
      performanceMetrics.recordRepository('MessageRepository', 'getByConversation', queryTime, true, false);
      
      logger.info('MessageRepository.getByConversation completado', {
        category: 'REPOSITORY_PERFORMANCE',
        conversationId,
        totalResults: result.messages?.length || 0,
        hasMore: result.pagination?.hasMore || false,
        queryTime: `${queryTime}ms`,
        limit: optimizedOptions.limit
      });

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      
      // Registrar métrica de error
      performanceMetrics.recordRepository('MessageRepository', 'getByConversation', queryTime, false, false);
      performanceMetrics.recordError('MessageRepository.getByConversation', error, { conversationId });
      
      logger.error('MessageRepository.getByConversation error', {
        category: 'REPOSITORY_ERROR',
        conversationId,
        error: error.message,
        queryTime: `${queryTime}ms`
      });
      
      throw error;
    }
  }

  /**
   * Obtener mensaje por ID
   */
  static async getById(conversationId, messageId) {
    logger.debug('MessageRepository.getById delegando a Message.getById', {
      category: 'REPOSITORY_DELEGATION',
      conversationId,
      messageId
    });
    return Message.getById(conversationId, messageId);
  }

  /**
   * Obtener estadísticas de conversación
   */
  static async getStats(conversationId, options = {}) {
    logger.debug('MessageRepository.getStats delegando a Message.getStats', {
      category: 'REPOSITORY_DELEGATION',
      conversationId,
      hasOptions: !!options
    });
    return Message.getStats(conversationId, options);
  }

  /**
   * Marcar mensajes como leídos
   */
  static async markManyAsRead(conversationId, messageIds, userEmail, readTimestamp = new Date()) {
    logger.debug('MessageRepository.markManyAsRead delegando a Message.markManyAsRead', {
      category: 'REPOSITORY_DELEGATION',
      conversationId,
      messageIdsCount: messageIds?.length,
      userEmail
    });
    return Message.markManyAsRead(conversationId, messageIds, userEmail, readTimestamp);
  }

  /**
   * Buscar en conversaciones de usuario
   */
  static async searchInUserConversations(options = {}) {
    logger.debug('MessageRepository.searchInUserConversations delegando a Message.searchInUserConversations', {
      category: 'REPOSITORY_DELEGATION',
      hasOptions: !!options
    });
    return Message.searchInUserConversations(options);
  }

  /**
   * Buscar mensajes en conversación con optimización de texto
   */
  static async search(conversationId, searchTerm, options = {}) {
    const startTime = Date.now();
    
    logger.debug('MessageRepository.search con optimización de texto', {
      category: 'REPOSITORY_SEARCH_OPTIMIZED',
      conversationId,
      searchTerm: searchTerm?.substring(0, 20) + '...',
      options: {
        limit: options.limit,
        orderBy: options.orderBy,
        order: options.order
      }
    });

    try {
      // Validar y optimizar opciones de búsqueda
      const optimizedOptions = {
        limit: Math.min(Math.max(options.limit || 20, 1), 50), // Límite más conservador para búsquedas
        orderBy: options.orderBy || 'timestamp',
        order: ['asc', 'desc'].includes(options.order) ? options.order : 'desc',
        type: options.type,
        direction: options.direction,
        startDate: options.startDate,
        endDate: options.endDate
      };

      // Sanitizar término de búsqueda
      const sanitizedSearchTerm = searchTerm?.trim().toLowerCase();
      if (!sanitizedSearchTerm || sanitizedSearchTerm.length < 2) {
        logger.warn('MessageRepository.search término de búsqueda muy corto', {
          category: 'REPOSITORY_SEARCH_WARNING',
          conversationId,
          searchTerm: sanitizedSearchTerm
        });
        return {
          messages: [],
          pagination: {
            hasMore: false,
            totalResults: 0,
            limit: optimizedOptions.limit
          },
          metadata: {
            conversationId,
            searchTerm: sanitizedSearchTerm,
            queryTime: '0ms'
          }
        };
      }

      // Ejecutar búsqueda optimizada
      const result = await Message.search(conversationId, sanitizedSearchTerm, optimizedOptions);
      
      const queryTime = Date.now() - startTime;
      
      logger.info('MessageRepository.search completado', {
        category: 'REPOSITORY_SEARCH_PERFORMANCE',
        conversationId,
        searchTerm: sanitizedSearchTerm,
        totalResults: result.messages?.length || 0,
        hasMore: result.pagination?.hasMore || false,
        queryTime: `${queryTime}ms`,
        limit: optimizedOptions.limit
      });

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      
      logger.error('MessageRepository.search error', {
        category: 'REPOSITORY_SEARCH_ERROR',
        conversationId,
        searchTerm: searchTerm?.substring(0, 20) + '...',
        error: error.message,
        queryTime: `${queryTime}ms`
      });
      
      throw error;
    }
  }

  /**
   * Obtener conteo de mensajes no leídos
   */
  static async getUnreadCount(conversationId, userEmail) {
    logger.debug('MessageRepository.getUnreadCount delegando a Message.getUnreadCount', {
      category: 'REPOSITORY_DELEGATION',
      conversationId,
      userEmail
    });
    return Message.getUnreadCount(conversationId, userEmail);
  }
}

module.exports = MessageRepository; 