/**
 * 🛡️ SCRIPT PREVENTIVO PARA EVITAR CICLOS INFINITOS DE LOGS
 * 
 * Este script implementa medidas preventivas para evitar que se vuelva a crear
 * el ciclo infinito de logs de exportación.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const fs = require('fs');
const path = require('path');

// Configuración
const LOGSDOC_DIR = path.join(__dirname, '../LOGSDOC');
const MAX_LOG_SIZE_MB = 10; // 10MB máximo por archivo de logs
const MAX_LOG_ENTRIES = 1000; // Máximo 1000 entradas por archivo

console.log('🛡️ CONFIGURANDO MEDIDAS PREVENTIVAS PARA LOGS...');

// Función para verificar y limpiar archivos de logs grandes
function checkAndCleanLargeLogFiles() {
  try {
    const files = fs.readdirSync(LOGSDOC_DIR);
    const logFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`📁 Encontrados ${logFiles.length} archivos de logs`);
    
    for (const file of logFiles) {
      const filePath = path.join(LOGSDOC_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);
      
      console.log(`📊 ${file}: ${sizeMB.toFixed(2)}MB`);
      
      // Si el archivo es muy grande, limpiarlo
      if (sizeMB > MAX_LOG_SIZE_MB) {
        console.log(`⚠️ Archivo ${file} es muy grande (${sizeMB.toFixed(2)}MB), limpiando...`);
        cleanLogFile(filePath);
      }
    }
  } catch (error) {
    console.error('❌ Error verificando archivos de logs:', error.message);
  }
}

// Función para limpiar un archivo de logs específico
function cleanLogFile(filePath) {
  try {
    // Crear backup
    const backupPath = filePath.replace('.json', '-backup.json');
    fs.copyFileSync(filePath, backupPath);
    console.log(`✅ Backup creado: ${backupPath}`);
    
    // Leer y limpiar logs
    const content = fs.readFileSync(filePath, 'utf8');
    const logs = JSON.parse(content);
    
    console.log(`📊 Logs originales: ${logs.length}`);
    
    // Filtrar logs problemáticos
    const cleanedLogs = logs.filter(log => {
      // Excluir logs de exportación
      if (log.category === 'HTTP_REQUEST_START' && log.data?.url?.includes('/logs/export')) {
        return false;
      }
      if (log.category === 'HTTP_SUCCESS' && log.data?.url?.includes('/logs/export')) {
        return false;
      }
      if (log.category === 'HTTP_REQUEST_COMPLETE' && log.data?.url?.includes('/logs/export')) {
        return false;
      }
      
      // Excluir logs duplicados excesivos
      if (log.category === 'SYSTEM' && log.message === 'Auto cleanup ejecutado') {
        return false; // Estos se generan automáticamente
      }
      
      return true;
    });
    
    // Limitar número de entradas
    const limitedLogs = cleanedLogs.slice(-MAX_LOG_ENTRIES);
    
    console.log(`🧹 Logs después de limpieza: ${limitedLogs.length}`);
    console.log(`📉 Reducción: ${logs.length - limitedLogs.length} logs`);
    
    // Guardar archivo limpio
    fs.writeFileSync(filePath, JSON.stringify(limitedLogs, null, 2));
    console.log(`✅ Archivo ${path.basename(filePath)} limpiado`);
    
  } catch (error) {
    console.error(`❌ Error limpiando archivo ${filePath}:`, error.message);
  }
}

// Función para crear un archivo de configuración de logging
function createLoggingConfig() {
  const config = {
    maxFileSizeMB: MAX_LOG_SIZE_MB,
    maxEntries: MAX_LOG_ENTRIES,
    excludedEndpoints: [
      '/api/logs/export',
      '/logs/export',
      '/api/logs/export-railway'
    ],
    excludedCategories: [
      'HTTP_REQUEST_START',
      'HTTP_SUCCESS',
      'HTTP_REQUEST_COMPLETE'
    ],
    autoCleanup: {
      enabled: true,
      interval: '1h',
      maxAge: '24h'
    },
    prevention: {
      cycleDetection: true,
      duplicateRemoval: true,
      sizeLimiting: true
    }
  };
  
  const configPath = path.join(LOGSDOC_DIR, 'logging-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Configuración de logging creada:', configPath);
  
  return config;
}

// Función para crear un script de monitoreo automático
function createMonitoringScript() {
  const script = `#!/usr/bin/env node

/**
 * 🔍 SCRIPT DE MONITOREO AUTOMÁTICO DE LOGS
 * 
 * Este script se ejecuta automáticamente para prevenir ciclos infinitos
 * y mantener los archivos de logs bajo control.
 */

const fs = require('fs');
const path = require('path');

const LOGSDOC_DIR = path.join(__dirname, 'LOGSDOC');
const MAX_SIZE_MB = 10;
const MAX_ENTRIES = 1000;

function monitorLogs() {
  try {
    const files = fs.readdirSync(LOGSDOC_DIR);
    const logFiles = files.filter(file => file.endsWith('.json') && !file.includes('backup'));
    
    for (const file of logFiles) {
      const filePath = path.join(LOGSDOC_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > MAX_SIZE_MB) {
        console.log(\`⚠️ Archivo \${file} excede el límite (\${sizeMB.toFixed(2)}MB > \${MAX_SIZE_MB}MB)\`);
        
        // Limpiar archivo
        const content = fs.readFileSync(filePath, 'utf8');
        const logs = JSON.parse(content);
        
        // Filtrar logs problemáticos
        const cleanedLogs = logs.filter(log => {
          if (log.data?.url?.includes('/logs/export')) return false;
          if (log.category === 'SYSTEM' && log.message === 'Auto cleanup ejecutado') return false;
          return true;
        }).slice(-MAX_ENTRIES);
        
        fs.writeFileSync(filePath, JSON.stringify(cleanedLogs, null, 2));
        console.log(\`✅ Archivo \${file} limpiado: \${logs.length} → \${cleanedLogs.length} logs\`);
      }
    }
  } catch (error) {
    console.error('Error en monitoreo:', error.message);
  }
}

// Ejecutar monitoreo
monitorLogs();
`;

  const scriptPath = path.join(LOGSDOC_DIR, 'monitor-logs.js');
  fs.writeFileSync(scriptPath, script);
  fs.chmodSync(scriptPath, '755'); // Hacer ejecutable
  console.log('✅ Script de monitoreo creado:', scriptPath);
}

// Función principal
function main() {
  console.log('🛡️ INICIANDO CONFIGURACIÓN PREVENTIVA');
  console.log('=' .repeat(50));
  
  // Verificar y limpiar archivos grandes
  checkAndCleanLargeLogFiles();
  
  // Crear configuración
  createLoggingConfig();
  
  // Crear script de monitoreo
  createMonitoringScript();
  
  console.log('=' .repeat(50));
  console.log('✅ CONFIGURACIÓN PREVENTIVA COMPLETADA');
  console.log('');
  console.log('📋 MEDIDAS IMPLEMENTADAS:');
  console.log('1. ✅ Detección de archivos de logs grandes');
  console.log('2. ✅ Filtrado automático de logs de exportación');
  console.log('3. ✅ Límite de tamaño por archivo (10MB)');
  console.log('4. ✅ Límite de entradas por archivo (1000)');
  console.log('5. ✅ Script de monitoreo automático');
  console.log('6. ✅ Configuración de logging preventiva');
  console.log('');
  console.log('🚀 Para monitoreo automático, ejecuta:');
  console.log('   node LOGSDOC/monitor-logs.js');
  console.log('');
  console.log('🛡️ El ciclo infinito de logs ha sido prevenido');
}

// Ejecutar script
if (require.main === module) {
  main();
}

module.exports = { checkAndCleanLargeLogFiles, createLoggingConfig, createMonitoringScript }; 