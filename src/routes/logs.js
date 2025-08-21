/**
 * 📊 LOG DASHBOARD ROUTES
 * 
 * Rutas para el dashboard interno de logs
 * Permite visualización, filtrado y exportación de logs
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const LogDashboardController = require('../controllers/LogDashboardController');
const { authMiddleware } = require('../middleware/auth');

/**
 * 🧪 TEST ENDPOINT
 * @route GET /api/logs/test
 * @desc Endpoint de prueba para verificar que funciona
 * @access Public
 */
router.get('/test', (req, res) => {
  logger.info('🧪 LOGS_TEST: Endpoint de prueba accedido', { category: '_LOGS_TEST_ENDPOINT_DE_PRUEBA_' });
  res.json({
    success: true,
    message: 'Dashboard de logs funcionando correctamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: '/logs',
      api: '/api/logs',
      stats: '/api/logs/dashboard',
      export: '/api/logs/export'
    }
  });
});

/**
 * 🧪 GENERATE TEST LOGS
 * @route POST /api/logs/generate-test
 * @desc Generar logs de prueba para el dashboard
 * @access Public
 */
router.post('/generate-test', async (req, res) => {
  try {
    const { logMonitor } = require('../services/LogMonitorService');
    LogDashboardController.generateTestLogs(logMonitor);
    
    res.json({
      success: true,
      message: 'Logs de prueba generados exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'GENERATE_ERROR',
      message: 'Error generando logs de prueba'
    });
  }
});

/**
 * 📊 GET DASHBOARD DATA
 * @route GET /api/logs/dashboard
 * @desc Datos del dashboard (estadísticas)
 * @access Public (sin autenticación para debugging)
 */
router.get('/dashboard',
  LogDashboardController.getDashboard
);

/**
 * 📋 GET LOGS WITH FILTERS
 * @route GET /api/logs
 * @desc Obtener logs con filtros
 * @access Public (sin autenticación para debugging)
 */
router.get('/',
  LogDashboardController.getLogs
);

/**
 * 🔍 SEARCH LOGS
 * @route GET /api/logs/search
 * @desc Buscar logs
 * @access Public
 */
router.get('/search',
  LogDashboardController.searchLogs
);

/**
 * 📤 EXPORT LOGS
 * @route GET /api/logs/export
 * @desc Exportar logs en JSON o CSV
 * @access Public
 */
router.get('/export',
  LogDashboardController.exportLogs
);

/**
 * 🗑️ CLEAR LOGS
 * @route POST /api/logs/clear
 * @desc Limpiar todos los logs
 * @access Public
 */
router.post('/clear',
  LogDashboardController.clearLogs
);

/**
 * 🧹 CLEAN DUPLICATE LOGS
 * @route POST /api/logs/clean-duplicates
 * @desc Limpiar logs duplicados y ciclo infinito de exportación
 * @access Public
 */
router.post('/clean-duplicates',
  LogDashboardController.cleanDuplicateLogs
);

/**
 * 📈 GET RATE LIMIT METRICS
 * @route GET /api/logs/rate-limit-metrics
 * @desc Métricas de rate limiting
 * @access Public
 */
router.get('/rate-limit-metrics',
  LogDashboardController.getRateLimitMetrics
);

/**
 * 🖥️ GET DASHBOARD HTML
 * @route GET /logs
 * @desc Dashboard HTML completo
 * @access Public
 */
router.get('/html',
  LogDashboardController.getDashboardHTML
);

/**
 * 🚀 EXPORT RAILWAY LOGS
 * @route GET /api/logs/export-railway
 * @desc Exportar logs de Railway
 * @access Public
 */
router.get('/export-railway',
  LogDashboardController.exportRailwayLogs
);

/**
 * 🧪 TEST EXPORT
 * @route GET /api/logs/test-export
 * @desc Test de exportación
 * @access Public
 */
router.get('/test-export', (req, res) => {
  const testData = [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Test log 1' },
    { timestamp: new Date().toISOString(), level: 'warn', message: 'Test log 2' },
    { timestamp: new Date().toISOString(), level: 'error', message: 'Test log 3' }
  ];
  
  const format = req.query.format || 'json';
  let data, contentType, filename;
  
  if (format === 'json') {
    data = JSON.stringify(testData, null, 2);
    contentType = 'application/json';
    filename = 'test-logs.json';
  } else {
    data = 'timestamp,level,message\n' +
           testData.map(log => `${log.timestamp},${log.level},${log.message}`).join('\n');
    contentType = 'text/csv';
    filename = 'test-logs.csv';
  }
  
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`
  });
  
  res.send(data);
});

/**
 * 📜 DASHBOARD JAVASCRIPT
 * @route GET /api/logs/dashboard.js
 * @desc JavaScript para el dashboard
 * @access Public
 */
router.get('/dashboard.js', (req, res) => {
  const js = `
// 📊 LOG DASHBOARD JAVASCRIPT
// Maneja todas las funcionalidades del dashboard

class LogDashboard {
  constructor() {
    this.autoRefreshInterval = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadInitialData();
    this.setupAutoRefresh();
  }

  bindEvents() {
    // Botones de acción
    document.getElementById('btnUpdate')?.addEventListener('click', () => this.updateDashboard());
    document.getElementById('btnExportJSON')?.addEventListener('click', () => this.exportLogs('json'));
    document.getElementById('btnExportCSV')?.addEventListener('click', () => this.exportLogs('csv'));
    document.getElementById('btnExportRailwayJSON')?.addEventListener('click', () => this.exportRailwayLogs('json'));
    document.getElementById('btnExportRailwayCSV')?.addEventListener('click', () => this.exportRailwayLogs('csv'));
    document.getElementById('btnTestExport')?.addEventListener('click', () => this.testExport());
    document.getElementById('btnClear')?.addEventListener('click', () => this.clearLogs());
    document.getElementById('btnGenerate')?.addEventListener('click', () => this.generateTestLogs());

    // Filtros
    document.getElementById('levelFilter')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('categoryFilter')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('timeRangeFilter')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('searchFilter')?.addEventListener('input', () => this.applyFilters());

    // Auto-refresh
    document.getElementById('autoRefresh')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });
  }

  async loadInitialData() {
    try {
      await this.updateDashboard();
      await this.updateLogs();
    } catch (error) {
      this.showToast('Error cargando datos iniciales', 'error');
    }
  }

  async updateDashboard() {
    try {
      const response = await fetch('/api/logs/dashboard');
      const data = await response.json();
      
      if (data.success) {
        this.updateStats(data.data.stats);
        this.showToast('Dashboard actualizado', 'success');
      } else {
        throw new Error(data.message || 'Error actualizando dashboard');
      }
    } catch (error) {
      this.showToast('Error actualizando dashboard: ' + error.message, 'error');
    }
  }

  async updateLogs() {
    try {
      const filters = this.getFilters();
      const queryString = new URLSearchParams(filters).toString();
      const response = await fetch('/api/logs?' + queryString);
      const data = await response.json();
      
      if (data.success) {
        this.updateLogsList(data.data.logs);
        this.updateLogsCount(data.data.logs.length);
      } else {
        throw new Error(data.message || 'Error obteniendo logs');
      }
    } catch (error) {
      this.showToast('Error obteniendo logs: ' + error.message, 'error');
    }
  }

  async exportLogs(format) {
    try {
      const filters = this.getFilters();
      filters.format = format;
      const queryString = new URLSearchParams(filters).toString();
      
      const response = await fetch('/api/logs/export?' + queryString);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'logs.' + format;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Logs exportados exitosamente', 'success');
      } else {
        throw new Error('Error en la exportación');
      }
    } catch (error) {
      this.showToast('Error exportando logs: ' + error.message, 'error');
    }
  }

  async exportRailwayLogs(format) {
    try {
      const filters = this.getFilters();
      filters.format = format;
      const queryString = new URLSearchParams(filters).toString();
      
      const response = await fetch('/api/logs/export-railway?' + queryString);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'railway-logs.' + format;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Logs de Railway exportados exitosamente', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error exportando logs de Railway');
      }
    } catch (error) {
      this.showToast('Error exportando logs de Railway: ' + error.message, 'error');
    }
  }

  async testExport() {
    try {
      const format = document.getElementById('levelFilter')?.value === 'error' ? 'csv' : 'json';
      const response = await fetch('/api/logs/test-export?format=' + format);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'test-logs.' + format;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Test de exportación exitoso', 'success');
      } else {
        throw new Error('Error en test de exportación');
      }
    } catch (error) {
      this.showToast('Error en test de exportación: ' + error.message, 'error');
    }
  }

  async clearLogs() {
    if (!confirm('¿Estás seguro de que quieres limpiar todos los logs?')) {
      return;
    }

    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        this.showToast(data.data.message, 'success');
        await this.updateDashboard();
        await this.updateLogs();
      } else {
        throw new Error(data.message || 'Error limpiando logs');
      }
    } catch (error) {
      this.showToast('Error limpiando logs: ' + error.message, 'error');
    }
  }

  async generateTestLogs() {
    try {
      const response = await fetch('/api/logs/generate-test', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        this.showToast('Logs de prueba generados exitosamente', 'success');
        await this.updateDashboard();
        await this.updateLogs();
      } else {
        throw new Error(data.message || 'Error generando logs de prueba');
      }
    } catch (error) {
      this.showToast('Error generando logs de prueba: ' + error.message, 'error');
    }
  }

  getFilters() {
    return {
      level: document.getElementById('levelFilter')?.value || 'all',
      category: document.getElementById('categoryFilter')?.value || 'all',
      timeRange: document.getElementById('timeRangeFilter')?.value || '1h',
      search: document.getElementById('searchFilter')?.value || ''
    };
  }

  applyFilters() {
    this.updateLogs();
  }

  updateStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;

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
        <p>\${stats.byLevel?.error || 0}</p>
      </div>
      <div class="stat-card">
        <h3>⚠️ Warnings</h3>
        <p>\${stats.byLevel?.warn || 0}</p>
      </div>
      <div class="stat-card">
        <h3>ℹ️ Info</h3>
        <p>\${stats.byLevel?.info || 0}</p>
      </div>
    \`;
  }

  updateLogsList(logs) {
    const logsList = document.getElementById('logsList');
    if (!logsList) return;

    if (logs.length === 0) {
      logsList.innerHTML = '<div class="log-entry"><div class="log-message">(sin logs)</div></div>';
      return;
    }

    logsList.innerHTML = logs.map(log => \`
      <div class="log-entry">
        <div class="log-timestamp">\${new Date(log.timestamp).toLocaleString()}</div>
        <div class="log-level \${log.level}">\${String(log.level || '').toUpperCase()}</div>
        <div class="log-category">\${log.category || 'N/A'}</div>
        <div class="log-message">\${typeof log.message === 'object' ? JSON.stringify(log.message) : (log.message || '')}</div>
        <div class="log-user">\${log.userId || 'system'}</div>
      </div>
    \`).join('');
  }

  updateLogsCount(count) {
    const logsCount = document.getElementById('logsCount');
    if (logsCount) {
      logsCount.textContent = count + ' logs';
    }
  }

  setupAutoRefresh() {
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
      this.startAutoRefresh();
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      this.updateDashboard();
      this.updateLogs();
    }, 5000);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.logDashboard = new LogDashboard();
});

// También inicializar si ya está cargado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.logDashboard = new LogDashboard();
  });
} else {
  window.logDashboard = new LogDashboard();
}
  `;

  res.set({
    'Content-Type': 'application/javascript',
    'Cache-Control': 'no-store'
  });
  res.send(js);
});

module.exports = router; 