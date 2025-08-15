/**
 * 📊 LOG DASHBOARD CONTROLLER
 * 
 * Controlador para el dashboard interno de logs
 * Permite visualización, filtrado y exportación de logs
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { logMonitor } = require('../services/LogMonitorService');
const logger = require('../utils/logger');

class LogDashboardController {
  /**
   * 📊 GET DASHBOARD OVERVIEW
   */
  static async getDashboard(req, res) {
    try {
      const stats = logMonitor.getStats();
      const rateLimitMetrics = logMonitor.getRateLimitMetrics();
      
      res.json({
        success: true,
        data: {
          stats,
          rateLimitMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error obteniendo dashboard de logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'DASHBOARD_ERROR',
        message: 'Error obteniendo dashboard de logs'
      });
    }
  }

  /**
   * 📋 GET LOGS WITH FILTERS
   */
  static async getLogs(req, res) {
    try {
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

      const logs = logMonitor.getLogs(filters);
      const total = logs.length;
      const pageSize = 100;
      const startIndex = (parseInt(page) - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedLogs = logs.slice(startIndex, endIndex);

      res.json({
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
      });
    } catch (error) {
      logger.error('Error obteniendo logs', {
        category: 'LOG_DASHBOARD_ERROR',
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'LOGS_ERROR',
        message: 'Error obteniendo logs'
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
      const { logMonitor } = require('../services/LogMonitorService');
      logMonitor.addLog('info', 'DASHBOARD', 'Dashboard HTML requested', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: '/logs'
      });

      // 🔧 GENERAR LOGS DE PRUEBA PARA DEMOSTRACIÓN
      this.generateTestLogs(logMonitor);

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
        @media (max-width: 768px) {
            .log-entry { grid-template-columns: 1fr; gap: 5px; }
            .buttons { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 UTalk Backend - Log Dashboard</h1>
            <p>Monitoreo en tiempo real de logs del sistema</p>
        </div>

        <div class="stats-grid" id="statsGrid">
            <!-- Stats se cargarán dinámicamente -->
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
                <button class="btn btn-primary" onclick="loadLogs()">🔄 Actualizar</button>
                <button class="btn btn-export" onclick="exportLogs('json')">📤 Exportar JSON</button>
                <button class="btn btn-export" onclick="exportLogs('csv')">📤 Exportar CSV</button>
                <button class="btn btn-secondary" onclick="clearLogs()">🗑️ Limpiar Logs</button>
                <div class="auto-refresh">
                    <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()">
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
                <!-- Logs se cargarán dinámicamente -->
            </div>
        </div>
    </div>

    <script>
        let autoRefreshInterval;

        // Cargar datos iniciales
        loadStats();
        loadLogs();

        function loadStats() {
            fetch('/api/logs/dashboard')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayStats(data.data.stats);
                    }
                })
                .catch(error => console.error('Error cargando stats:', error));
        }

        function displayStats(stats) {
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = \`
                <div class="stat-card">
                    <h3>📊 Total Logs</h3>
                    <p>\${stats.total}</p>
                </div>
                <div class="stat-card">
                    <h3>⏰ Última Hora</h3>
                    <p>\${stats.lastHour}</p>
                </div>
                <div class="stat-card">
                    <h3>📅 Últimas 24h</h3>
                    <p>\${stats.last24Hours}</p>
                </div>
                <div class="stat-card">
                    <h3>🚨 Errores</h3>
                    <p>\${stats.byLevel.error}</p>
                </div>
                <div class="stat-card">
                    <h3>⚠️ Warnings</h3>
                    <p>\${stats.byLevel.warn}</p>
                </div>
                <div class="stat-card">
                    <h3>ℹ️ Info</h3>
                    <p>\${stats.byLevel.info}</p>
                </div>
            \`;
        }

        function loadLogs() {
            const level = document.getElementById('levelFilter').value;
            const category = document.getElementById('categoryFilter').value;
            const timeRange = document.getElementById('timeRangeFilter').value;
            const search = document.getElementById('searchFilter').value;

            const params = new URLSearchParams({
                level, category, timeRange, search, limit: 100
            });

            fetch(\`/api/logs?\${params}\`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayLogs(data.data.logs);
                        document.getElementById('logsCount').textContent = \`\${data.data.logs.length} logs\`;
                    }
                })
                .catch(error => console.error('Error cargando logs:', error));
        }

        function displayLogs(logs) {
            const logsList = document.getElementById('logsList');
            logsList.innerHTML = logs.map(log => \`
                <div class="log-entry">
                    <div class="log-timestamp">\${new Date(log.timestamp).toLocaleString()}</div>
                    <div class="log-level \${log.level}">\${log.level.toUpperCase()}</div>
                    <div class="log-category">\${log.category}</div>
                    <div class="log-message">\${log.message}</div>
                    <div class="log-user">\${log.userId}</div>
                </div>
            \`).join('');
        }

        function exportLogs(format) {
            const level = document.getElementById('levelFilter').value;
            const category = document.getElementById('categoryFilter').value;
            const timeRange = document.getElementById('timeRangeFilter').value;

            const params = new URLSearchParams({
                format, level, category, timeRange
            });

            window.open(\`/api/logs/export?\${params}\`, '_blank');
        }

        function clearLogs() {
            if (confirm('¿Estás seguro de que quieres limpiar todos los logs?')) {
                fetch('/api/logs/clear', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert(\`Se limpiaron \${data.data.clearedCount} logs\`);
                            loadStats();
                            loadLogs();
                        }
                    })
                    .catch(error => console.error('Error limpiando logs:', error));
            }
        }

        function toggleAutoRefresh() {
            const autoRefresh = document.getElementById('autoRefresh');
            if (autoRefresh.checked) {
                autoRefreshInterval = setInterval(() => {
                    loadStats();
                    loadLogs();
                }, 5000);
            } else {
                clearInterval(autoRefreshInterval);
            }
        }

        // Event listeners para filtros
        document.getElementById('levelFilter').addEventListener('change', loadLogs);
        document.getElementById('categoryFilter').addEventListener('change', loadLogs);
        document.getElementById('timeRangeFilter').addEventListener('change', loadLogs);
        document.getElementById('searchFilter').addEventListener('input', debounce(loadLogs, 500));

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

      res.set('Content-Type', 'text/html');
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
        isTestLog: true
      });
    });

    console.log('🧪 Test logs generados para dashboard');
  }
}

module.exports = LogDashboardController; 