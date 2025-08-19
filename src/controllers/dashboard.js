const logger = require('../utils/logger');
/**
 * 🚀 UTalk Backend - Log Dashboard JavaScript
 * Funcionalidad completa del dashboard de logs
 */

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
            logger.error('Error cargando stats:', { category: 'ERROR_CARGANDO_STATS_', data: error });
            showToast('Error de red al cargar estadísticas', 'error');
        });
}

function displayStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = 
        '<div class="stat-card">' +
            '<h3>📊 Total Logs</h3>' +
            '<p>' + stats.total + '</p>' +
        '</div>' +
        '<div class="stat-card">' +
            '<h3>⏰ Última Hora</h3>' +
            '<p>' + stats.lastHour + '</p>' +
        '</div>' +
        '<div class="stat-card">' +
            '<h3>📅 Últimas 24h</h3>' +
            '<p>' + stats.last24Hours + '</p>' +
        '</div>' +
        '<div class="stat-card">' +
            '<h3>🚨 Errores</h3>' +
            '<p>' + stats.byLevel.error + '</p>' +
        '</div>' +
        '<div class="stat-card">' +
            '<h3>⚠️ Warnings</h3>' +
            '<p>' + stats.byLevel.warn + '</p>' +
        '</div>' +
        '<div class="stat-card">' +
            '<h3>ℹ️ Info</h3>' +
            '<p>' + stats.byLevel.info + '</p>' +
        '</div>';
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
            logger.error('❌ Error cargando logs:', { category: '_ERROR_CARGANDO_LOGS_', data: error });
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
        logger.info('🚀 Iniciando exportación de Railway:', { category: '_INICIANDO_EXPORTACI_N_DE_RAIL', data: format });
        
        const level = document.getElementById('levelFilter').value;
        const category = document.getElementById('categoryFilter').value;
        const timeRange = document.getElementById('timeRangeFilter').value;

        // Usar el endpoint específico de Railway
        const params = new URLSearchParams({ format, level, category, timeRange });
        const url = '/api/logs/export-railway?' + params;
        
        logger.info('🚀 URL de exportación Railway:', { category: '_URL_DE_EXPORTACI_N_RAILWAY_', data: url });
        showToast('Iniciando exportación de Railway...', 'info', 1000);

        const res = await fetch(url);
        logger.info('🚀 Respuesta del servidor Railway', {
          category: 'RAILWAY_RESPONSE',
          status: res.status,
          statusText: res.statusText
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            logger.error('🚀 Error en respuesta Railway:', { category: '_ERROR_EN_RESPUESTA_RAILWAY_', data: errorText });
            showToast('Error del servidor Railway: ' + res.status + ' - ' + res.statusText, 'error');
            return;
        }

        const contentDisposition = res.headers.get('content-disposition') || '';
        const match = contentDisposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : ('railway-logs-' + new Date().toISOString().slice(0,10) + '.' + format);

        logger.info('🚀 Descargando archivo Railway:', { category: '_DESCARGANDO_ARCHIVO_RAILWAY_', data: filename });
        const blob = await res.blob();
        logger.info('🚀 Blob Railway creado', {
          category: 'RAILWAY_BLOB_CREATED',
          size: blob.size
        });
        
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url2);
        
        logger.info('🚀 Exportación Railway completada:', { category: '_EXPORTACI_N_RAILWAY_COMPLETAD', data: filename });
        showToast('Exportación Railway completada: ' + filename, 'success', 3000);
    } catch (err) {
        logger.error('🚀 Error exportando Railway:', { category: '_ERROR_EXPORTANDO_RAILWAY_', data: err });
        showToast('Error de red al exportar Railway: ' + err.message, 'error');
    }
}

async function exportLogs(format) {
    try {
        logger.info('📤 Iniciando exportación local:', { category: '_INICIANDO_EXPORTACI_N_LOCAL_', data: format });
        
        const level = document.getElementById('levelFilter').value;
        const category = document.getElementById('categoryFilter').value;
        const timeRange = document.getElementById('timeRangeFilter').value;

        // Usar el endpoint local para exportar logs locales
        const params = new URLSearchParams({ format, level, category, timeRange });
        const url = '/api/logs/export?' + params;
        
        logger.info('📤 URL de exportación:', { category: '_URL_DE_EXPORTACI_N_', data: url });
        showToast('Iniciando exportación...', 'info', 1000);

        const res = await fetch(url);
        logger.info('📤 Respuesta del servidor', {
          category: 'SERVER_RESPONSE',
          status: res.status,
          statusText: res.statusText
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            logger.error('📤 Error en respuesta:', { category: '_ERROR_EN_RESPUESTA_', data: errorText });
            showToast('Error del servidor: ' + res.status + ' - ' + res.statusText, 'error');
            return;
        }

        const contentDisposition = res.headers.get('content-disposition') || '';
        const match = contentDisposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : ('logs-' + new Date().toISOString().slice(0,10) + '.' + format);

        logger.info('📤 Descargando archivo:', { category: '_DESCARGANDO_ARCHIVO_', data: filename });
        const blob = await res.blob();
        logger.info('📤 Blob creado', {
          category: 'BLOB_CREATED',
          size: blob.size
        });
        
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url2);
        
        logger.info('📤 Exportación completada:', { category: '_EXPORTACI_N_COMPLETADA_', data: filename });
        showToast('Exportación completada: ' + filename, 'success', 3000);
    } catch (err) {
        logger.error('📤 Error exportando:', { category: '_ERROR_EXPORTANDO_', data: err });
        showToast('Error de red al exportar: ' + err.message, 'error');
    }
}

function testExport() {
    try {
        logger.info('🧪 Iniciando test export...', { category: '_INICIANDO_TEST_EXPORT_' });
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
                
                logger.info('🧪 Test export completado', { category: '_TEST_EXPORT_COMPLETADO' });
                showToast('Test export completado', 'success', 3000);
            })
            .catch(error => {
                logger.error('🧪 Error en test export:', { category: '_ERROR_EN_TEST_EXPORT_', data: error });
                showToast('Error en test export: ' + error.message, 'error');
            });
    } catch (err) {
        logger.error('🧪 Error en test export:', { category: '_ERROR_EN_TEST_EXPORT_', data: err });
        showToast('Error en test export: ' + err.message, 'error');
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
                logger.error('Error limpiando logs:', { category: 'ERROR_LIMPIANDO_LOGS_', data: error });
                showToast('Error de red al limpiar logs', 'error');
            });
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
            logger.error('❌ Error en la petición:', { category: '_ERROR_EN_LA_PETICI_N_', data: error });
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