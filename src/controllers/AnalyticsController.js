/**
 * 📊 CONTROLADOR DE ANALYTICS Y MÉTRICAS
 * 
 * Proporciona endpoints para obtener métricas y analytics
 * de uso de archivos y comportamiento de usuarios.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const FileService = require('../services/FileService');
const { logger } = require('../utils/logger');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const Joi = require('joi');

class AnalyticsController {
  constructor() {
    this.fileService = new FileService();
  }

  /**
   * 📊 GET /api/analytics/file/:fileId/usage
   * Obtener estadísticas de uso de un archivo específico
   */
  async getFileUsageStats(req, res) {
    try {
      const { fileId } = req.params;
      const { timeRange = '30d' } = req.query;

      // Validar parámetros
      if (!fileId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE_ID',
          'ID de archivo requerido',
          'Especifica el ID del archivo en la URL',
          400
        ));
      }

      // Validar rango de tiempo
      const allowedTimeRanges = ['1d', '7d', '30d', '90d', '1y'];
      if (!allowedTimeRanges.includes(timeRange)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TIME_RANGE',
          'Rango de tiempo inválido',
          'Usa uno de: 1d, 7d, 30d, 90d, 1y',
          400
        ));
      }

      logger.info('📊 Obteniendo estadísticas de uso de archivo', {
        fileId,
        timeRange,
        userEmail: req.user?.email
      });

      const stats = await this.fileService.getFileUsageStats(fileId, timeRange);

      logger.info('✅ Estadísticas de uso obtenidas exitosamente', {
        fileId,
        timeRange,
        totalUsage: stats.totalUsage,
        uniqueUsers: stats.uniqueUsers
      });

      return ResponseHandler.success(res, stats, 'Estadísticas de uso obtenidas');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de uso', {
        fileId: req.params.fileId,
        timeRange: req.query.timeRange,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'ANALYTICS_ERROR',
        'Error obteniendo estadísticas',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/analytics/global/usage
   * Obtener métricas globales de uso de archivos
   */
  async getGlobalUsageMetrics(req, res) {
    try {
      const { timeRange = '30d' } = req.query;

      // Validar rango de tiempo
      const allowedTimeRanges = ['1d', '7d', '30d', '90d', '1y'];
      if (!allowedTimeRanges.includes(timeRange)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TIME_RANGE',
          'Rango de tiempo inválido',
          'Usa uno de: 1d, 7d, 30d, 90d, 1y',
          400
        ));
      }

      logger.info('📊 Obteniendo métricas globales de uso', {
        timeRange,
        userEmail: req.user?.email
      });

      const metrics = await this.fileService.getGlobalUsageMetrics(timeRange);

      logger.info('✅ Métricas globales obtenidas exitosamente', {
        timeRange,
        totalUsage: metrics.totalUsage,
        uniqueFiles: metrics.uniqueFiles,
        uniqueUsers: metrics.uniqueUsers
      });

      return ResponseHandler.success(res, metrics, 'Métricas globales obtenidas');

    } catch (error) {
      logger.error('❌ Error obteniendo métricas globales', {
        timeRange: req.query.timeRange,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'ANALYTICS_ERROR',
        'Error obteniendo métricas globales',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/analytics/conversation/:conversationId/usage
   * Obtener métricas de uso de archivos por conversación
   */
  async getConversationUsageMetrics(req, res) {
    try {
      const { conversationId } = req.params;
      const { timeRange = '30d' } = req.query;

      // Validar parámetros
      if (!conversationId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_CONVERSATION_ID',
          'ID de conversación requerido',
          'Especifica el ID de la conversación en la URL',
          400
        ));
      }

      // Validar rango de tiempo
      const allowedTimeRanges = ['1d', '7d', '30d', '90d', '1y'];
      if (!allowedTimeRanges.includes(timeRange)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TIME_RANGE',
          'Rango de tiempo inválido',
          'Usa uno de: 1d, 7d, 30d, 90d, 1y',
          400
        ));
      }

      logger.info('📊 Obteniendo métricas de uso por conversación', {
        conversationId,
        timeRange,
        userEmail: req.user?.email
      });

      // Obtener archivos de la conversación
      const files = await this.fileService.getFilesByConversation(conversationId, { limit: 1000 });
      
      // Obtener estadísticas de uso para cada archivo
      const fileStats = [];
      let totalUsage = 0;
      let uniqueUsers = new Set();
      const actionBreakdown = {};

      for (const file of files) {
        try {
          const stats = await this.fileService.getFileUsageStats(file.id, timeRange);
          fileStats.push({
            fileId: file.id,
            fileName: file.originalName,
            fileType: file.mimetype,
            ...stats
          });

          totalUsage += stats.totalUsage;
          stats.topUsers.forEach(user => uniqueUsers.add(user.userId));
          
          // Agregar al desglose de acciones
          Object.entries(stats.actionBreakdown).forEach(([action, count]) => {
            actionBreakdown[action] = (actionBreakdown[action] || 0) + count;
          });
        } catch (error) {
          logger.warn('⚠️ Error obteniendo estadísticas para archivo', {
            fileId: file.id,
            error: error.message
          });
        }
      }

      const metrics = {
        conversationId,
        timeRange,
        totalFiles: files.length,
        totalUsage,
        uniqueUsers: uniqueUsers.size,
        actionBreakdown,
        fileStats: fileStats.sort((a, b) => b.totalUsage - a.totalUsage),
        averageUsagePerFile: files.length > 0 ? totalUsage / files.length : 0
      };

      logger.info('✅ Métricas de conversación obtenidas exitosamente', {
        conversationId,
        timeRange,
        totalFiles: metrics.totalFiles,
        totalUsage: metrics.totalUsage,
        uniqueUsers: metrics.uniqueUsers
      });

      return ResponseHandler.success(res, metrics, 'Métricas de conversación obtenidas');

    } catch (error) {
      logger.error('❌ Error obteniendo métricas de conversación', {
        conversationId: req.params.conversationId,
        timeRange: req.query.timeRange,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'ANALYTICS_ERROR',
        'Error obteniendo métricas de conversación',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/analytics/user/:userId/usage
   * Obtener métricas de uso de archivos por usuario
   */
  async getUserUsageMetrics(req, res) {
    try {
      const { userId } = req.params;
      const { timeRange = '30d' } = req.query;

      // Validar parámetros
      if (!userId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_USER_ID',
          'ID de usuario requerido',
          'Especifica el ID del usuario en la URL',
          400
        ));
      }

      // Validar rango de tiempo
      const allowedTimeRanges = ['1d', '7d', '30d', '90d', '1y'];
      if (!allowedTimeRanges.includes(timeRange)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TIME_RANGE',
          'Rango de tiempo inválido',
          'Usa uno de: 1d, 7d, 30d, 90d, 1y',
          400
        ));
      }

      logger.info('📊 Obteniendo métricas de uso por usuario', {
        userId,
        timeRange,
        userEmail: req.user?.email
      });

      const startDate = this.fileService.getStartDate(timeRange);
      
      // Obtener registros de uso del usuario
      const firestore = require('firebase-admin').firestore();
      const snapshot = await firestore
        .collection('file_usage')
        .where('userId', '==', userId)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'desc')
        .get();

      const usageRecords = [];
      const fileCounts = {};
      const actionCounts = {};
      const conversationCounts = {};
      const dailyCounts = {};

      snapshot.forEach(doc => {
        const record = doc.data();
        usageRecords.push(record);

        // Contar archivos únicos
        fileCounts[record.fileId] = (fileCounts[record.fileId] || 0) + 1;

        // Contar acciones
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;

        // Contar conversaciones únicas
        if (record.metadata?.conversationId) {
          conversationCounts[record.metadata.conversationId] = (conversationCounts[record.metadata.conversationId] || 0) + 1;
        }

        // Contar por día
        const day = record.timestamp.toDate().toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      const metrics = {
        userId,
        timeRange,
        totalUsage: usageRecords.length,
        uniqueFiles: Object.keys(fileCounts).length,
        uniqueConversations: Object.keys(conversationCounts).length,
        actionBreakdown: actionCounts,
        topFiles: Object.entries(fileCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([fileId, count]) => ({ fileId, count })),
        topConversations: Object.entries(conversationCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([conversationId, count]) => ({ conversationId, count })),
        dailyUsage: Object.entries(dailyCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
        recentActivity: usageRecords.slice(0, 50),
        averageUsagePerDay: usageRecords.length / Math.max(1, Object.keys(dailyCounts).length)
      };

      logger.info('✅ Métricas de usuario obtenidas exitosamente', {
        userId,
        timeRange,
        totalUsage: metrics.totalUsage,
        uniqueFiles: metrics.uniqueFiles,
        uniqueConversations: metrics.uniqueConversations
      });

      return ResponseHandler.success(res, metrics, 'Métricas de usuario obtenidas');

    } catch (error) {
      logger.error('❌ Error obteniendo métricas de usuario', {
        userId: req.params.userId,
        timeRange: req.query.timeRange,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'ANALYTICS_ERROR',
        'Error obteniendo métricas de usuario',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 POST /api/analytics/tracking/configure
   * Configurar el tracking de uso de archivos
   */
  async configureTracking(req, res) {
    try {
      const { enabled, trackViews, trackDownloads, trackShares, trackUploads, trackDeletes } = req.body;

      logger.info('📊 Configurando tracking de uso', {
        enabled,
        trackViews,
        trackDownloads,
        trackShares,
        trackUploads,
        trackDeletes,
        userEmail: req.user?.email
      });

      const config = await this.fileService.configureUsageTracking({
        enabled,
        trackViews,
        trackDownloads,
        trackShares,
        trackUploads,
        trackDeletes
      });

      logger.info('✅ Configuración de tracking actualizada exitosamente', {
        enabled: config.enabled,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, config, 'Configuración de tracking actualizada');

    } catch (error) {
      logger.error('❌ Error configurando tracking', {
        error: error.message,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, new ApiError(
        'TRACKING_CONFIG_ERROR',
        'Error configurando tracking',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📊 GET /api/analytics/tracking/status
   * Obtener el estado actual del tracking
   */
  async getTrackingStatus(req, res) {
    try {
      logger.info('📊 Obteniendo estado de tracking', {
        userEmail: req.user?.email
      });

      const status = this.fileService.usageTracking;

      logger.info('✅ Estado de tracking obtenido exitosamente', {
        enabled: status.enabled,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, status, 'Estado de tracking obtenido');

    } catch (error) {
      logger.error('❌ Error obteniendo estado de tracking', {
        error: error.message,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, new ApiError(
        'TRACKING_STATUS_ERROR',
        'Error obteniendo estado de tracking',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }
}

module.exports = AnalyticsController; 