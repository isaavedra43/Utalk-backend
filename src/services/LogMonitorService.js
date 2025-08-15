/**
 * 📊 LOG MONITOR SERVICE - DASHBOARD INTERNO
 * 
 * Servicio para capturar y monitorear logs en tiempo real
 * Permite visualización y exportación de logs para debugging
 * 
 * @version 1.0.0
 * @author Backend Team
 */

class LogMonitorService {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000; // Máximo 10,000 logs en memoria
    this.filters = {
      level: 'all',
      category: 'all',
      search: '',
      timeRange: '1h' // 1h, 6h, 24h, 7d
    };
    
    // Limpiar logs antiguos cada 5 minutos
    setInterval(() => {
      this.cleanupOldLogs();
    }, 5 * 60 * 1000);
    
    console.log('✅ LogMonitorService inicializado');
  }

  /**
   * 📝 ADD LOG
   */
  addLog(level, category, message, data = {}) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level: level, // 'info', 'warn', 'error', 'debug'
      category: category, // 'RATE_LIMIT', 'WEBSOCKET', 'CACHE', 'DB', etc.
      message: message,
      data: data,
      userAgent: data.userAgent || 'unknown',
      ip: data.ip || 'unknown',
      userId: data.userId || 'anonymous',
      endpoint: data.endpoint || 'unknown'
    };

    this.logs.unshift(logEntry); // Agregar al inicio

    // Mantener límite de logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return logEntry;
  }

  /**
   * 🔍 GET LOGS WITH FILTERS
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    // Filtrar por nivel
    if (filters.level && filters.level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    // Filtrar por categoría
    if (filters.category && filters.category !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }

    // Filtrar por búsqueda
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        log.category.toLowerCase().includes(searchTerm) ||
        log.userId.toLowerCase().includes(searchTerm)
      );
    }

    // Filtrar por rango de tiempo
    if (filters.timeRange) {
      const now = new Date();
      let cutoffTime;

      switch (filters.timeRange) {
        case '1h':
          cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = new Date(now.getTime() - 60 * 60 * 1000); // 1h por defecto
      }

      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) > cutoffTime);
    }

    // Limitar resultados
    const limit = filters.limit || 1000;
    return filteredLogs.slice(0, limit);
  }

  /**
   * 📊 GET STATISTICS
   */
  getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentLogs = this.logs.filter(log => new Date(log.timestamp) > oneHourAgo);
    const dailyLogs = this.logs.filter(log => new Date(log.timestamp) > oneDayAgo);

    const stats = {
      total: this.logs.length,
      lastHour: recentLogs.length,
      last24Hours: dailyLogs.length,
      byLevel: {
        info: this.logs.filter(log => log.level === 'info').length,
        warn: this.logs.filter(log => log.level === 'warn').length,
        error: this.logs.filter(log => log.level === 'error').length,
        debug: this.logs.filter(log => log.level === 'debug').length
      },
      byCategory: {},
      topUsers: {},
      topEndpoints: {}
    };

    // Estadísticas por categoría
    this.logs.forEach(log => {
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      stats.topUsers[log.userId] = (stats.topUsers[log.userId] || 0) + 1;
      stats.topEndpoints[log.endpoint] = (stats.topEndpoints[log.endpoint] || 0) + 1;
    });

    // Ordenar top users y endpoints
    stats.topUsers = Object.entries(stats.topUsers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    stats.topEndpoints = Object.entries(stats.topEndpoints)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    return stats;
  }

  /**
   * 🗑️ CLEAR LOGS
   */
  clearLogs() {
    const count = this.logs.length;
    this.logs = [];
    return count;
  }

  /**
   * 📤 EXPORT LOGS
   */
  exportLogs(format = 'json', filters = {}) {
    const logs = this.getLogs(filters);

    switch (format.toLowerCase()) {
      case 'json':
        return {
          format: 'json',
          data: JSON.stringify(logs, null, 2),
          filename: `logs-${new Date().toISOString().split('T')[0]}.json`
        };

      case 'csv':
        const csvHeaders = ['timestamp', 'level', 'category', 'message', 'userId', 'endpoint', 'ip'];
        const csvData = logs.map(log => [
          log.timestamp,
          log.level,
          log.category,
          log.message.replace(/"/g, '""'), // Escapar comillas
          log.userId,
          log.endpoint,
          log.ip
        ]);

        const csv = [
          csvHeaders.join(','),
          ...csvData.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        return {
          format: 'csv',
          data: csv,
          filename: `logs-${new Date().toISOString().split('T')[0]}.csv`
        };

      default:
        throw new Error('Formato no soportado. Use "json" o "csv"');
    }
  }

  /**
   * 🧹 CLEANUP OLD LOGS
   */
  cleanupOldLogs() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => new Date(log.timestamp) > oneWeekAgo);
    
    const cleanedCount = initialCount - this.logs.length;
    if (cleanedCount > 0) {
      console.log(`🧹 LogMonitorService: Limpiados ${cleanedCount} logs antiguos`);
    }
  }

  /**
   * 🔍 SEARCH LOGS
   */
  searchLogs(query, options = {}) {
    const searchTerm = query.toLowerCase();
    const results = this.logs.filter(log => {
      const searchableText = [
        log.message,
        log.category,
        log.userId,
        log.endpoint,
        JSON.stringify(log.data)
      ].join(' ').toLowerCase();

      return searchableText.includes(searchTerm);
    });

    return results.slice(0, options.limit || 100);
  }

  /**
   * 📈 GET RATE LIMIT METRICS
   */
  getRateLimitMetrics() {
    const rateLimitLogs = this.logs.filter(log => 
      log.category === 'RATE_LIMIT' || 
      log.message.includes('RATE_LIMIT')
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentRateLimits = rateLimitLogs.filter(log => 
      new Date(log.timestamp) > oneHourAgo
    );

    return {
      total: rateLimitLogs.length,
      lastHour: recentRateLimits.length,
      byUser: {},
      byEndpoint: {},
      timeline: this.getTimelineData(rateLimitLogs, oneHourAgo)
    };
  }

  /**
   * 📊 GET TIMELINE DATA
   * Genera datos de timeline para métricas
   */
  getTimelineData(logs, startTime) {
    const timeline = [];
    const now = new Date();
    const interval = 5 * 60 * 1000; // 5 minutos

    for (let time = startTime.getTime(); time <= now.getTime(); time += interval) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + interval);
      
      const logsInInterval = logs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= intervalStart && logTime < intervalEnd;
      });

      timeline.push({
        timestamp: intervalStart.toISOString(),
        count: logsInInterval.length
      });
    }

    return timeline;
  }
}

// Singleton instance
const logMonitor = new LogMonitorService();

module.exports = {
  LogMonitorService,
  logMonitor
}; 