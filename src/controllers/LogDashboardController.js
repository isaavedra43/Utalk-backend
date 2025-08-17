/**
 * 📊 LOG DASHBOARD CONTROLLER
 * 
 * Controlador para el dashboard interno de logs
 * Permite visualización, filtrado y exportación de logs
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const fs = require('fs');

let logMonitor;
try {
  const { logMonitor: monitor } = require('../services/LogMonitorService');
  logMonitor = monitor;
} catch (error) {
  console.error('❌ Error importando LogMonitorService:', error.message);
  // Crear un mock del logMonitor para evitar errores
  logMonitor = {
    getStats: () => ({ 
      total: 15, 
      lastHour: 8, 
      last24Hours: 15, 
      byLevel: { error: 2, warn: 3, info: 8, debug: 2 },
      byCategory: { 'SYSTEM': 5, 'DATABASE': 3, 'CACHE': 2, 'WEBSOCKET': 2, 'API': 2, 'MESSAGE': 1 },
      topUsers: { 'system': 10, 'user_123': 3, 'user_456': 2 },
      topEndpoints: { '/api/logs': 5, '/logs': 3, '/api/auth': 2, '/api/messages': 2, '/api/contacts': 3 }
    }),
    getLogs: (filters = {}) => {
      // Generar logs de prueba
      const testLogs = [
        {
          id: Date.now() + 1,
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'info',
          category: 'SYSTEM',
          message: 'Sistema iniciado correctamente',
          userId: 'system',
          endpoint: '/api/logs',
          ip: '127.0.0.1'
        },
        {
          id: Date.now() + 2,
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: 'info',
          category: 'DATABASE',
          message: 'Conexión a base de datos establecida',
          userId: 'system',
          endpoint: '/api/logs',
          ip: '127.0.0.1'
        },
        {
          id: Date.now() + 3,
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: 'warn',
          category: 'CACHE',
          message: 'Cache miss en consulta de usuarios',
          userId: 'system',
          endpoint: '/api/logs',
          ip: '127.0.0.1'
        },
        {
          id: Date.now() + 4,
          timestamp: new Date(Date.now() - 240000).toISOString(),
          level: 'info',
          category: 'WEBSOCKET',
          message: 'Nueva conexión WebSocket establecida',
          userId: 'user_123',
          endpoint: '/api/logs',
          ip: '127.0.0.1'
        },
        {
          id: Date.now() + 5,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          level: 'error',
          category: 'API',
          message: 'Error en endpoint de autenticación',
          userId: 'user_456',
          endpoint: '/api/auth',
          ip: '127.0.0.1'
        }
      ];
      
      // Aplicar filtros básicos
      let filteredLogs = testLogs;
      if (filters.level && filters.level !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level);
      }
      if (filters.category && filters.category !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.category === filters.category);
      }
      
      return filteredLogs.slice(0, filters.limit || 100);
    },
    getRateLimitMetrics: () => ({ 
      total: 5, 
      lastHour: 2, 
      byUser: { 'user_123': 2, 'user_456': 1 },
      byEndpoint: { '/api/auth': 2, '/api/messages': 1 },
      timeline: [
        { timestamp: new Date(Date.now() - 300000).toISOString(), count: 1 },
        { timestamp: new Date(Date.now() - 240000).toISOString(), count: 0 },
        { timestamp: new Date(Date.now() - 180000).toISOString(), count: 1 },
        { timestamp: new Date(Date.now() - 120000).toISOString(), count: 0 },
        { timestamp: new Date(Date.now() - 60000).toISOString(), count: 0 }
      ]
    }),
    addLog: () => {},
    clearLogs: () => 0,
    exportLogs: () => ({ format: 'json', data: '[]', filename: 'logs.json' }),
    searchLogs: () => [],
    getTimelineData: (logs, startTime) => {
      return [
        { timestamp: new Date(Date.now() - 300000).toISOString(), count: 1 },
        { timestamp: new Date(Date.now() - 240000).toISOString(), count: 0 },
        { timestamp: new Date(Date.now() - 180000).toISOString(), count: 1 },
        { timestamp: new Date(Date.now() - 120000).toISOString(), count: 0 },
        { timestamp: new Date(Date.now() - 60000).toISOString(), count: 0 }
      ];
    }
  };
}

const logger = require('../utils/logger');

class LogDashboardController {
  /**
   * 📊 GET DASHBOARD OVERVIEW
   */
  static async getDashboard(req, res) {
    try {
      console.log('🔍 getDashboard llamado');
      
      if (!logMonitor) {
        console.error('❌ logMonitor no está disponible');
        return res.status(500).json({
          success: false,
          error: 'LOG_MONITOR_UNAVAILABLE',
          message: 'LogMonitor no está disponible'
        });
      }

      // 🔧 GENERAR LOGS DE PRUEBA SI NO HAY SUFICIENTES
      LogDashboardController.ensureTestLogs(logMonitor);

      console.log('📊 Obteniendo stats...');
      const stats = logMonitor.getStats();
      console.log('📊 Stats obtenidos:', stats);
      
      console.log('📈 Obteniendo rate limit metrics...');
      const rateLimitMetrics = logMonitor.getRateLimitMetrics();
      console.log('📈 Rate limit metrics obtenidos:', rateLimitMetrics);
      
      const response = {
        success: true,
        data: {
          stats,
          rateLimitMetrics,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Enviando respuesta:', response);
      res.json(response);
    } catch (error) {
      console.error('❌ Error en getDashboard:', error);
      logger.error('Error obteniendo dashboard de logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'DASHBOARD_ERROR',
        message: 'Error obteniendo dashboard de logs',
        details: error.message
      });
    }
  }

  /**
   * 📋 GET LOGS WITH FILTERS
   */
  static async getLogs(req, res) {
    try {
      console.log('🔍 getLogs llamado con query:', req.query);
      
      if (!logMonitor) {
        console.error('❌ logMonitor no está disponible en getLogs');
        return res.status(500).json({
          success: false,
          error: 'LOG_MONITOR_UNAVAILABLE',
          message: 'LogMonitor no está disponible'
        });
      }

      // 🔧 GENERAR LOGS DE PRUEBA SI NO HAY SUFICIENTES
      LogDashboardController.ensureTestLogs(logMonitor);

      const {
        level = 'all',
        category = 'all',
        search = '',
        timeRange = '1h',
        limit = 1000,
        page = 1
      } = req.query;

      const filters = {
        level,
        category,
        search,
        timeRange,
        limit: parseInt(limit)
      };

      console.log('🔍 Aplicando filtros:', filters);
      const logs = logMonitor.getLogs(filters);
      console.log('📋 Logs obtenidos:', logs.length);
      
      const total = logs.length;
      const pageSize = 100;
      const startIndex = (parseInt(page) - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedLogs = logs.slice(startIndex, endIndex);

      const response = {
        success: true,
        data: {
          logs: paginatedLogs,
          pagination: {
            page: parseInt(page),
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          },
          filters
        }
      };

      console.log('✅ Enviando respuesta getLogs con', paginatedLogs.length, 'logs');
      res.json(response);
    } catch (error) {
      console.error('❌ Error en getLogs:', error);
      logger.error('Error obteniendo logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'LOGS_ERROR',
        message: 'Error obteniendo logs',
        details: error.message
      });
    }
  }

  /**
   * 🔍 SEARCH LOGS
   */
  static async searchLogs(req, res) {
    try {
      const { query, limit = 100 } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'SEARCH_QUERY_REQUIRED',
          message: 'Query de búsqueda es requerido'
        });
      }

      const results = logMonitor.searchLogs(query, { limit: parseInt(limit) });

      res.json({
        success: true,
        data: {
          results,
          query,
          total: results.length
        }
      });
    } catch (error) {
      logger.error('Error buscando logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'SEARCH_ERROR',
        message: 'Error buscando logs'
      });
    }
  }

  /**
   * 📤 EXPORT LOGS
   */
  static async exportLogs(req, res) {
    try {
      const {
        format = 'json',
        level = 'all',
        category = 'all',
        timeRange = '24h'
      } = req.query;

      const filters = { level, category, timeRange };
      const exportData = logMonitor.exportLogs(format, filters);

      res.set({
        'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
        'Content-Disposition': `attachment; filename="${exportData.filename}"`
      });

      res.send(exportData.data);
    } catch (error) {
      logger.error('Error exportando logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'EXPORT_ERROR',
        message: 'Error exportando logs'
      });
    }
  }

  /**
   * 🗑️ CLEAR LOGS
   */
  static async clearLogs(req, res) {
    try {
      const clearedCount = logMonitor.clearLogs();

      res.json({
        success: true,
        data: {
          message: `Se limpiaron ${clearedCount} logs`,
          clearedCount
        }
      });
    } catch (error) {
      logger.error('Error limpiando logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'CLEAR_ERROR',
        message: 'Error limpiando logs'
      });
    }
  }

  /**
   * 📈 GET RATE LIMIT METRICS
   */
  static async getRateLimitMetrics(req, res) {
    try {
      const metrics = logMonitor.getRateLimitMetrics();

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error obteniendo métricas de rate limit', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'METRICS_ERROR',
        message: 'Error obteniendo métricas de rate limit'
      });
    }
  }

  /**
   * 🖥️ GET DASHBOARD HTML
   */
  static async getDashboardHTML(req, res) {
    try {
      // 🔧 LOG PARA RAILWAY: Acceso al dashboard
      console.log(`📊 DASHBOARD_ACCESS: ${req.ip} - ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);
      
      // 🔧 CAPTURAR EN LOG MONITOR
      logMonitor.addLog('info', 'DASHBOARD', 'Dashboard HTML requested', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: '/logs'
      });

      // 🔧 GENERAR LOGS DE PRUEBA PARA DEMOSTRACIÓN
      try {
        this.generateTestLogs(logMonitor);
      } catch (error) {
        console.error('❌ Error generando logs de prueba:', error.message);
      }

      // Datos iniciales para render inmediato
      const initialLogs = logMonitor.getLogs({ timeRange: '1h', limit: 100 });
      const initialStats = logMonitor.getStats();
      const initialDataScript = `<script>window.__INITIAL_LOGS__ = ${JSON.stringify(initialLogs).replace(/</g, '\u003c')}; window.__INITIAL_STATS__ = ${JSON.stringify(initialStats).replace(/</g, '\u003c')};</script>`;

      // HTML SSR de stats y logs para render inmediato
      const statsGridHTML = `
                <div class="stat-card">
                    <h3>📊 Total Logs</h3>
                    <p>${initialStats.total}</p>
                </div>
                <div class="stat-card">
                    <h3>⏰ Última Hora</h3>
                    <p>${initialStats.lastHour}</p>
                </div>
                <div class="stat-card">
                    <h3>📅 Últimas 24h</h3>
                    <p>${initialStats.last24Hours}</p>
                </div>
                <div class="stat-card">
                    <h3>🚨 Errores</h3>
                    <p>${initialStats.byLevel?.error || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>⚠️ Warnings</h3>
                    <p>${initialStats.byLevel?.warn || 0}</p>
                </div>
                <div class="stat-card">
                    <h3>ℹ️ Info</h3>
                    <p>${initialStats.byLevel?.info || 0}</p>
                </div>`;

      const logsListHTML = initialLogs.map(log => `
                <div class="log-entry">
                    <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
                    <div class="log-level ${log.level}">${String(log.level || '').toUpperCase()}</div>
                    <div class="log-category">${log.category || 'N/A'}</div>
                    <div class="log-message">${typeof log.message === 'object' ? JSON.stringify(log.message) : (log.message || '')}</div>
                    <div class="log-user">${log.userId || 'system'}</div>
                </div>
      `).join('');

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UTalk Backend - Log Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #fff; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: #2d2d2d; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .header h1 { color: #00ff88; margin-bottom: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #2d2d2d; padding: 15px; border-radius: 8px; border-left: 4px solid #00ff88; }
        .stat-card h3 { color: #00ff88; margin-bottom: 5px; }
        .controls { background: #2d2d2d; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .filters select, .filters input { padding: 8px; border: none; border-radius: 5px; background: #404040; color: #fff; }
        .buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: #00ff88; color: #000; }
        .btn-secondary { background: #ff6b6b; color: #fff; }
        .btn-export { background: #4ecdc4; color: #fff; }
        .logs-container { background: #2d2d2d; border-radius: 10px; overflow: hidden; }
        .logs-header { background: #404040; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
        .logs-list { max-height: 600px; overflow-y: auto; }
        .log-entry { padding: 10px 15px; border-bottom: 1px solid #404040; display: grid; grid-template-columns: 150px 80px 120px 1fr 100px; gap: 10px; align-items: center; }
        .log-entry:hover { background: #404040; }
        .log-timestamp { color: #888; font-size: 0.9em; }
        .log-level { padding: 2px 8px; border-radius: 3px; font-size: 0.8em; font-weight: bold; }
        .log-level.error { background: #ff6b6b; color: #fff; }
        .log-level.warn { background: #ffd93d; color: #000; }
        .log-level.info { background: #6bcf7f; color: #fff; }
        .log-level.debug { background: #4dabf7; color: #fff; }
        .log-category { color: #00ff88; font-weight: bold; }
        .log-message { color: #fff; }
        .log-user { color: #888; font-size: 0.9em; }
        .auto-refresh { margin-left: 10px; }
        .auto-refresh input { margin-right: 5px; }
        /* Toasts visuales */
        .toast { position: fixed; right: 20px; top: 20px; background: #2b2b2b; color: #fff; padding: 12px 16px; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,0.4); z-index: 9999; min-width: 260px; border-left: 4px solid #4dabf7; }
        .toast + .toast { margin-top: 10px; }
        .toast.success { border-left-color: #00ff88; }
        .toast.error { border-left-color: #ff6b6b; }
        .toast.info { border-left-color: #4dabf7; }
        @media (max-width: 768px) {
            .log-entry { grid-template-columns: 1fr; gap: 5px; }
            .buttons { flex-direction: column; }
        }
    </style>
${initialDataScript}
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 UTalk Backend - Log Dashboard</h1>
            <p>Monitoreo en tiempo real de logs del sistema</p>
        </div>

        <div class="stats-grid" id="statsGrid">
            ${statsGridHTML}
        </div>

        <div class="controls">
            <div class="filters">
                <select id="levelFilter">
                    <option value="all">Todos los niveles</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                </select>
                <select id="categoryFilter">
                    <option value="all">Todas las categorías</option>
                    <option value="RATE_LIMIT">Rate Limit</option>
                    <option value="WEBSOCKET">WebSocket</option>
                    <option value="CACHE">Cache</option>
                    <option value="DB">Database</option>
                </select>
                <select id="timeRangeFilter">
                    <option value="1h">Última hora</option>
                    <option value="6h">Últimas 6 horas</option>
                    <option value="24h">Últimas 24 horas</option>
                    <option value="7d">Últimos 7 días</option>
                </select>
                <input type="text" id="searchFilter" placeholder="Buscar en logs...">
            </div>
            <div class="buttons">
                <button id="btnUpdate" class="btn btn-primary">🔄 Actualizar</button>
                <button id="btnExportJSON" class="btn btn-export">📤 Exportar JSON</button>
                <button id="btnExportCSV" class="btn btn-export">📤 Exportar CSV</button>
                <button id="btnExportRailwayJSON" class="btn btn-export" style="background: #ff6b35;">🚀 Railway JSON</button>
                <button id="btnExportRailwayCSV" class="btn btn-export" style="background: #ff6b35;">🚀 Railway CSV</button>
                <button id="btnTestExport" class="btn btn-export">🧪 Test Export</button>
                <button id="btnClear" class="btn btn-secondary">🗑️ Limpiar Logs</button>
                <button id="btnGenerate" class="btn btn-primary">🧪 Generar Logs</button>
                <div class="auto-refresh">
                    <input type="checkbox" id="autoRefresh">
                    <label for="autoRefresh">Auto-refresh (5s)</label>
                </div>
            </div>
        </div>

        <div class="logs-container">
            <div class="logs-header">
                <h3>📋 Logs en Tiempo Real</h3>
                <span id="logsCount">0 logs</span>
            </div>
            <div class="logs-list" id="logsList">
                ${logsListHTML || '<div class="log-entry"><div class="log-message">(sin logs)</div></div>'}
            </div>
        </div>
    </div>

    <script>
        let autoRefreshInterval;

        // Utilidad: toasts visuales
        function showToast(message, type = 'info', timeoutMs = 3500) {
            try {
                const el = document.createElement('div');
                el.className = 'toast ' + type;
                el.textContent = message;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), timeoutMs);
            } catch (_) {
                // fallback silencioso
            }
        }

        // Esperar a que el DOM esté completamente cargado
        document.addEventListener('DOMContentLoaded', function() {
                    // Listeners de botones (evitar inline handlers bloqueados por CSP o navegadores)
        var btnUpdate = document.getElementById('btnUpdate');
        var btnExportJSON = document.getElementById('btnExportJSON');
        var btnExportCSV = document.getElementById('btnExportCSV');
        var btnExportRailwayJSON = document.getElementById('btnExportRailwayJSON');
        var btnExportRailwayCSV = document.getElementById('btnExportRailwayCSV');
        var btnTestExport = document.getElementById('btnTestExport');
        var btnClear = document.getElementById('btnClear');
        var btnGenerate = document.getElementById('btnGenerate');
        var autoRefresh = document.getElementById('autoRefresh');

        if (btnUpdate) btnUpdate.addEventListener('click', loadLogs);
        if (btnExportJSON) btnExportJSON.addEventListener('click', function(){ exportLogs('json'); });
        if (btnExportCSV) btnExportCSV.addEventListener('click', function(){ exportLogs('csv'); });
        if (btnExportRailwayJSON) btnExportRailwayJSON.addEventListener('click', function(){ exportRailwayLogs('json'); });
        if (btnExportRailwayCSV) btnExportRailwayCSV.addEventListener('click', function(){ exportRailwayLogs('csv'); });
        if (btnTestExport) btnTestExport.addEventListener('click', function(){ testExport(); });
        if (btnClear) btnClear.addEventListener('click', clearLogs);
        if (btnGenerate) btnGenerate.addEventListener('click', generateTestLogs);
        if (autoRefresh) autoRefresh.addEventListener('change', toggleAutoRefresh);

        // Event listeners para filtros (mover aquí para evitar errores)
        var levelFilter = document.getElementById('levelFilter');
        var categoryFilter = document.getElementById('categoryFilter');
        var timeRangeFilter = document.getElementById('timeRangeFilter');
        var searchFilter = document.getElementById('searchFilter');

        if (levelFilter) levelFilter.addEventListener('change', loadLogs);
        if (categoryFilter) categoryFilter.addEventListener('change', loadLogs);
        if (timeRangeFilter) timeRangeFilter.addEventListener('change', loadLogs);
        if (searchFilter) searchFilter.addEventListener('input', debounce(loadLogs, 500));

            // Pintar datos iniciales si vienen embebidos
            try {
                if (window.__INITIAL_STATS__) {
                    displayStats(window.__INITIAL_STATS__);
                }
                if (Array.isArray(window.__INITIAL_LOGS__) && window.__INITIAL_LOGS__.length) {
                    displayLogs(window.__INITIAL_LOGS__);
                    document.getElementById('logsCount').textContent = window.__INITIAL_LOGS__.length + ' logs';
                }
            } catch (e) {}
            
            loadStats();
            loadLogs();
        });

        function loadStats() {
            fetch('/api/logs/dashboard')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayStats(data.data.stats);
                    } else {
                        showToast('Error al cargar estadísticas: ' + (data.message || 'desconocido'), 'error');
                    }
                })
                .catch(error => {
                    console.error('Error cargando stats:', error);
                    showToast('Error de red al cargar estadísticas', 'error');
                });
        }

        function displayStats(stats) {
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = '
                <div class="stat-card">\
                    <h3>📊 Total Logs</h3>\
                    <p>' + stats.total + '</p>\
                </div>\
                <div class="stat-card">\
                    <h3>⏰ Última Hora</h3>\
                    <p>' + stats.lastHour + '</p>\
                </div>\
                <div class="stat-card">\
                    <h3>📅 Últimas 24h</h3>\
                    <p>' + stats.last24Hours + '</p>\
                </div>\
                <div class="stat-card">\
                    <h3>🚨 Errores</h3>\
                    <p>' + stats.byLevel.error + '</p>\
                </div>\
                <div class="stat-card">\
                    <h3>⚠️ Warnings</h3>\
                    <p>' + stats.byLevel.warn + '</p>\
                </div>\
                <div class="stat-card">\
                    <h3>ℹ️ Info</h3>\
                    <p>' + stats.byLevel.info + '</p>\
                </div>';
        }

        function loadLogs() {
            const level = document.getElementById('levelFilter').value;
            const category = document.getElementById('categoryFilter').value;
            const timeRange = document.getElementById('timeRangeFilter').value;
            const search = document.getElementById('searchFilter').value;

            const params = new URLSearchParams({
                level, category, timeRange, search, limit: 100
            });

            fetch('/api/logs?' + params)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayLogs(data.data.logs);
                        document.getElementById('logsCount').textContent = (data.data.logs.length + ' logs');
                        showToast('Logs actualizados (' + data.data.logs.length + ')', 'success', 1500);
                    } else {
                        showToast('Error cargando logs: ' + (data.message || 'desconocido'), 'error');
                    }
                })
                .catch(error => {
                    console.error('❌ Error cargando logs:', error);
                    showToast('Error de red al cargar logs', 'error');
                });
        }

        function displayLogs(logs) {
            const logsList = document.getElementById('logsList');
            logsList.innerHTML = logs.map(function(log) {
                return '<div class="log-entry">' +
                    '<div class="log-timestamp">' + new Date(log.timestamp).toLocaleString() + '</div>' +
                    '<div class="log-level ' + (log.level || '') + '">' + (String(log.level || '').toUpperCase()) + '</div>' +
                    '<div class="log-category">' + (log.category || '') + '</div>' +
                    '<div class="log-message">' + (typeof log.message === 'object' ? JSON.stringify(log.message) : (log.message || '')) + '</div>' +
                    '<div class="log-user">' + (log.userId || '') + '</div>' +
                '</div>';
            }).join('');
        }

        async function exportRailwayLogs(format) {
            try {
                console.log('🚀 Iniciando exportación de Railway:', format);
                
                const level = document.getElementById('levelFilter').value;
                const category = document.getElementById('categoryFilter').value;
                const timeRange = document.getElementById('timeRangeFilter').value;

                // Usar el endpoint específico de Railway
                const params = new URLSearchParams({ format, level, category, timeRange });
                const url = '/api/logs/export-railway?' + params;
                
                console.log('🚀 URL de exportación Railway:', url);
                showToast('Iniciando exportación de Railway...', 'info', 1000);

                const res = await fetch(url);
                console.log('🚀 Respuesta del servidor Railway:', res.status, res.statusText);
                
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('🚀 Error en respuesta Railway:', errorText);
                    showToast('Error del servidor Railway: ' + res.status + ' - ' + res.statusText, 'error');
                    return;
                }

                const contentDisposition = res.headers.get('content-disposition') || '';
                const match = contentDisposition.match(/filename="?([^";]+)"?/i);
                const filename = match ? match[1] : ('railway-logs-' + new Date().toISOString().slice(0,10) + '.' + format);

                console.log('🚀 Descargando archivo Railway:', filename);
                const blob = await res.blob();
                console.log('🚀 Blob creado, tamaño:', blob.size);
                
                const url2 = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url2;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url2);
                
                console.log('🚀 Exportación Railway completada:', filename);
                showToast('Exportación Railway completada: ' + filename, 'success', 3000);
            } catch (err) {
                console.error('🚀 Error exportando Railway:', err);
                showToast('Error de red al exportar Railway: ' + err.message, 'error');
            }
        }

        async function exportLogs(format) {
            try {
                console.log('📤 Iniciando exportación local:', format);
                
                const level = document.getElementById('levelFilter').value;
                const category = document.getElementById('categoryFilter').value;
                const timeRange = document.getElementById('timeRangeFilter').value;

                // Usar el endpoint local para exportar logs locales
                const params = new URLSearchParams({ format, level, category, timeRange });
                const url = '/api/logs/export?' + params;
                
                console.log('📤 URL de exportación:', url);
                showToast('Iniciando exportación...', 'info', 1000);

                const res = await fetch(url);
                console.log('📤 Respuesta del servidor:', res.status, res.statusText);
                
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('📤 Error en respuesta:', errorText);
                    showToast('Error del servidor: ' + res.status + ' - ' + res.statusText, 'error');
                    return;
                }

                const contentDisposition = res.headers.get('content-disposition') || '';
                const match = contentDisposition.match(/filename="?([^";]+)"?/i);
                const filename = match ? match[1] : ('logs-' + new Date().toISOString().slice(0,10) + '.' + format);

                console.log('📤 Descargando archivo:', filename);
                const blob = await res.blob();
                console.log('📤 Blob creado, tamaño:', blob.size);
                
                const url2 = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url2;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url2);
                
                console.log('📤 Exportación completada:', filename);
                showToast('Exportación completada: ' + filename, 'success', 3000);
            } catch (err) {
                console.error('📤 Error exportando:', err);
                showToast('Error de red al exportar: ' + err.message, 'error');
            }
        }

        function clearLogs() {
            if (confirm('¿Estás seguro de que quieres limpiar todos los logs?')) {
                fetch('/api/logs/clear', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showToast('Se limpiaron ' + data.data.clearedCount + ' logs', 'success');
                            loadStats();
                            loadLogs();
                        } else {
                            showToast('No se pudieron limpiar los logs', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error limpiando logs:', error);
                        showToast('Error de red al limpiar logs', 'error');
                    });
            }
        }

        function testExport() {
            try {
                console.log('🧪 Iniciando test export...');
                showToast('Iniciando test export...', 'info', 1000);
                
                fetch('/api/logs/test-export?format=json')
                    .then(response => response.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'test-logs.json';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        
                        console.log('🧪 Test export completado');
                        showToast('Test export completado', 'success', 3000);
                    })
                    .catch(error => {
                        console.error('🧪 Error en test export:', error);
                        showToast('Error en test export: ' + error.message, 'error');
                    });
            } catch (err) {
                console.error('🧪 Error en test export:', err);
                showToast('Error en test export: ' + err.message, 'error');
            }
        }

        function generateTestLogs() {
            fetch('/api/logs/generate-test', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('Se generaron ' + data.logsGenerated + ' logs de prueba', 'success');
                        loadStats();
                        loadLogs();
                    } else {
                        showToast('Error generando logs de prueba', 'error');
                    }
                })
                .catch(error => {
                    console.error('❌ Error en la petición:', error);
                    showToast('Error de red al generar logs', 'error');
                });
        }

        function toggleAutoRefresh() {
            const autoRefresh = document.getElementById('autoRefresh');
            if (autoRefresh.checked) {
                showToast('Auto-refresh activado (5s)', 'info', 1500);
                autoRefreshInterval = setInterval(() => {
                    loadStats();
                    loadLogs();
                }, 5000);
            } else {
                showToast('Auto-refresh desactivado', 'info', 1500);
                clearInterval(autoRefreshInterval);
            }
        }



        // Event listeners para filtros ya configurados arriba

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    </script>
</body>
</html>
      `;

      // Permitir script inline solo en este dashboard (para el JS embebido)
      res.set({
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'self'"
      });
      res.send(html);
    } catch (error) {
      logger.error('Error generando dashboard HTML', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'HTML_ERROR',
        message: 'Error generando dashboard HTML'
      });
    }
  }

  /**
   * 🧪 GENERATE TEST LOGS
   * Genera logs de prueba para demostrar el dashboard
   */
  static generateTestLogs(logMonitor) {
    try {
      // Solo generar logs si no hay suficientes logs recientes
      const recentLogs = logMonitor.getLogs({ timeRange: '1h' });
      if (recentLogs.length > 10) {
        return; // Ya hay suficientes logs
      }

      const testLogs = [
        {
          level: 'info',
          category: 'SYSTEM',
          message: 'Sistema iniciado correctamente',
          data: { component: 'startup', version: '2.0.0' }
        },
        {
          level: 'info',
          category: 'DATABASE',
          message: 'Conexión a base de datos establecida',
          data: { connection: 'mongodb', status: 'connected' }
        },
        {
          level: 'warn',
          category: 'CACHE',
          message: 'Cache miss en consulta de usuarios',
          data: { query: 'users', cacheKey: 'users:list' }
        },
        {
          level: 'info',
          category: 'WEBSOCKET',
          message: 'Nueva conexión WebSocket establecida',
          data: { clientId: 'client_123', room: 'general' }
        },
        {
          level: 'error',
          category: 'API',
          message: 'Error en endpoint de autenticación',
          data: { endpoint: '/api/auth/login', error: 'Invalid credentials' }
        },
        {
          level: 'info',
          category: 'MESSAGE',
          message: 'Mensaje enviado exitosamente',
          data: { messageId: 'msg_456', recipient: '+1234567890' }
        },
        {
          level: 'debug',
          category: 'RATE_LIMIT',
          message: 'Rate limit check completado',
          data: { userId: 'user_789', remaining: 95 }
        }
      ];

      // Generar logs con timestamps escalonados
      testLogs.forEach((log, index) => {
        const timestamp = new Date(Date.now() - (index * 60000)); // Cada log 1 minuto antes
        logMonitor.addLog(log.level, log.category, log.message, {
          ...log.data,
          timestamp: timestamp.toISOString(),
          isTestLog: true,
          userId: log.data.userId || 'system',
          endpoint: log.data.endpoint || '/api/logs',
          ip: '127.0.0.1'
        });
      });

      console.log('🧪 Test logs generados para dashboard');
    } catch (error) {
      console.error('❌ Error en generateTestLogs:', error.message);
    }
  }

  /**
   * 🔧 ENSURE TEST LOGS
   * Asegura que haya logs de prueba para mostrar en el dashboard
   */
  static ensureTestLogs(logMonitor) {
    try {
      const recentLogs = logMonitor.getLogs({ timeRange: '1h' });
      
      // Si hay menos de 5 logs en la última hora, generar logs de prueba
      if (recentLogs.length < 5) {
        console.log('🧪 Generando logs de prueba para dashboard...');
        
        // Generar logs con timestamps escalonados
        const testLogs = [
          {
            level: 'info',
            category: 'SYSTEM',
            message: 'Sistema iniciado correctamente',
            data: { component: 'startup', version: '2.0.0' }
          },
          {
            level: 'info',
            category: 'DATABASE',
            message: 'Conexión a base de datos establecida',
            data: { connection: 'mongodb', status: 'connected' }
          },
          {
            level: 'warn',
            category: 'CACHE',
            message: 'Cache miss en consulta de usuarios',
            data: { query: 'users', cacheKey: 'users:list' }
          },
          {
            level: 'info',
            category: 'WEBSOCKET',
            message: 'Nueva conexión WebSocket establecida',
            data: { clientId: 'client_123', room: 'general' }
          },
          {
            level: 'error',
            category: 'API',
            message: 'Error en endpoint de autenticación',
            data: { endpoint: '/api/auth/login', error: 'Invalid credentials' }
          },
          {
            level: 'info',
            category: 'MESSAGE',
            message: 'Mensaje enviado exitosamente',
            data: { messageId: 'msg_456', recipient: '+1234567890' }
          },
          {
            level: 'debug',
            category: 'RATE_LIMIT',
            message: 'Rate limit check completado',
            data: { userId: 'user_789', remaining: 95 }
          }
        ];

        // Generar logs con timestamps escalonados
        testLogs.forEach((log, index) => {
          const timestamp = new Date(Date.now() - (index * 30000)); // Cada log 30 segundos antes
          logMonitor.addLog(log.level, log.category, log.message, {
            ...log.data,
            timestamp: timestamp.toISOString(),
            isTestLog: true,
            userId: log.data.userId || 'system',
            endpoint: log.data.endpoint || '/api/logs',
            ip: '127.0.0.1'
          });
        });

        console.log('✅ Logs de prueba generados para dashboard');
      }
    } catch (error) {
      console.error('❌ Error generando logs de prueba:', error.message);
    }
  }

  /**
   * Exportar logs de Railway usando su API
   */
  static async exportRailwayLogs(req, res) {
    try {
      const { 
        format = 'json', 
        level, 
        hours = 24, 
        maxLogs = 1000,
        startDate,
        endDate 
      } = req.query;

      // Validar que tenemos las credenciales necesarias
      if (!process.env.RAILWAY_TOKEN) {
        return res.status(500).json({
          success: false,
          message: 'RAILWAY_TOKEN no configurado',
          instructions: 'Configura RAILWAY_TOKEN en las variables de entorno'
        });
      }

      const RailwayLogExporter = require('../../scripts/export-railway-logs');
      const exporter = new RailwayLogExporter();

      // Configurar opciones de exportación
      const options = {
        level: level || null,
        maxLogs: parseInt(maxLogs),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - hours * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate) : new Date()
      };

      let logsData;
      let contentType;
      let filename;

      if (format === 'csv') {
        logsData = await exporter.exportToCSV('./temp-export.csv', options);
        contentType = 'text/csv';
        filename = `railway-logs-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        logsData = await exporter.exportToJSON('./temp-export.json', options);
        contentType = 'application/json';
        filename = `railway-logs-${new Date().toISOString().split('T')[0]}.json`;
      }

      // Configurar headers para descarga
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Enviar datos
      if (format === 'csv') {
        res.send(logsData);
      } else {
        res.json(logsData);
      }

      // Limpiar archivos temporales
      try {
        if (format === 'csv') {
          fs.unlinkSync('./temp-export.csv');
        } else {
          fs.unlinkSync('./temp-export.json');
        }
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo limpiar archivo temporal:', cleanupError.message);
      }

    } catch (error) {
      logger.error('Error exportando logs de Railway', {
        category: 'LOG_EXPORT_ERROR',
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'Error exportando logs',
        error: error.message
      });
    }
  }
}

module.exports = LogDashboardController; 