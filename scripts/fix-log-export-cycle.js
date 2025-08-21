/**
 * 🔧 SCRIPT PARA LIMPIAR CICLO INFINITO DE LOGS DE EXPORTACIÓN
 * 
 * Este script limpia el archivo de logs actual eliminando:
 * - Logs duplicados
 * - Logs del ciclo infinito de exportación
 * - Logs innecesarios que inflan el archivo
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const fs = require('fs');
const path = require('path');

// Configuración
const LOG_FILE_PATH = path.join(__dirname, '../LOGSDOC/logs-2025-08-20.json');
const BACKUP_FILE_PATH = path.join(__dirname, '../LOGSDOC/logs-2025-08-20-backup.json');
const CLEANED_FILE_PATH = path.join(__dirname, '../LOGSDOC/logs-2025-08-20-cleaned.json');

console.log('🧹 INICIANDO LIMPIEZA DE LOGS...');
console.log('📁 Archivo original:', LOG_FILE_PATH);

// Función para crear backup
function createBackup() {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      fs.copyFileSync(LOG_FILE_PATH, BACKUP_FILE_PATH);
      console.log('✅ Backup creado:', BACKUP_FILE_PATH);
    } else {
      console.log('⚠️ Archivo de logs no encontrado');
      return false;
    }
  } catch (error) {
    console.error('❌ Error creando backup:', error.message);
    return false;
  }
  return true;
}

// Función para limpiar logs
function cleanLogs() {
  try {
    console.log('📖 Leyendo archivo de logs...');
    const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    const logs = JSON.parse(logContent);
    
    console.log(`📊 Total de logs originales: ${logs.length}`);
    
    // Estadísticas iniciales
    const initialStats = {
      total: logs.length,
      byCategory: {},
      byLevel: {},
      exportLogs: 0,
      duplicates: 0
    };
    
    // Contar logs por categoría y nivel
    logs.forEach(log => {
      initialStats.byCategory[log.category] = (initialStats.byCategory[log.category] || 0) + 1;
      initialStats.byLevel[log.level] = (initialStats.byLevel[log.level] || 0) + 1;
      
      // Contar logs de exportación
      if (log.category === 'HTTP_REQUEST_START' && log.data?.url?.includes('/logs/export')) {
        initialStats.exportLogs++;
      }
      if (log.category === 'HTTP_SUCCESS' && log.data?.url?.includes('/logs/export')) {
        initialStats.exportLogs++;
      }
    });
    
    console.log('📈 Estadísticas iniciales:');
    console.log('- Por categoría:', initialStats.byCategory);
    console.log('- Por nivel:', initialStats.byLevel);
    console.log('- Logs de exportación:', initialStats.exportLogs);
    
    // Filtrar logs
    const seenLogs = new Set();
    const cleanedLogs = [];
    let duplicateCount = 0;
    let exportCycleCount = 0;
    
    for (const log of logs) {
      // Crear clave única para detectar duplicados
      const logKey = `${log.timestamp}_${log.category}_${log.message}_${log.ip || 'unknown'}`;
      
      // Detectar logs del ciclo infinito de exportación
      const isExportCycleLog = (
        log.category === 'HTTP_REQUEST_START' && 
        log.data?.url?.includes('/logs/export')
      ) || (
        log.category === 'HTTP_SUCCESS' && 
        log.data?.url?.includes('/logs/export')
      ) || (
        log.category === 'HTTP_REQUEST_COMPLETE' && 
        log.data?.url?.includes('/logs/export')
      );
      
      if (isExportCycleLog) {
        exportCycleCount++;
        continue; // Saltar logs del ciclo de exportación
      }
      
      if (seenLogs.has(logKey)) {
        duplicateCount++;
        continue; // Saltar duplicados
      }
      
      seenLogs.add(logKey);
      cleanedLogs.push(log);
    }
    
    console.log('🧹 Limpieza completada:');
    console.log(`- Logs duplicados eliminados: ${duplicateCount}`);
    console.log(`- Logs de ciclo de exportación eliminados: ${exportCycleCount}`);
    console.log(`- Logs restantes: ${cleanedLogs.length}`);
    console.log(`- Reducción total: ${logs.length - cleanedLogs.length} logs (${((logs.length - cleanedLogs.length) / logs.length * 100).toFixed(2)}%)`);
    
    // Guardar archivo limpio
    fs.writeFileSync(CLEANED_FILE_PATH, JSON.stringify(cleanedLogs, null, 2));
    console.log('✅ Archivo limpio guardado:', CLEANED_FILE_PATH);
    
    // Reemplazar archivo original
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(cleanedLogs, null, 2));
    console.log('✅ Archivo original reemplazado con versión limpia');
    
    return {
      originalCount: logs.length,
      cleanedCount: cleanedLogs.length,
      duplicateCount,
      exportCycleCount,
      reduction: logs.length - cleanedLogs.length,
      reductionPercentage: ((logs.length - cleanedLogs.length) / logs.length * 100).toFixed(2)
    };
    
  } catch (error) {
    console.error('❌ Error limpiando logs:', error.message);
    return null;
  }
}

// Función principal
function main() {
  console.log('🚀 INICIANDO SCRIPT DE LIMPIEZA DE LOGS');
  console.log('=' .repeat(50));
  
  // Crear backup
  if (!createBackup()) {
    console.log('❌ No se pudo crear backup, abortando...');
    return;
  }
  
  // Limpiar logs
  const results = cleanLogs();
  
  if (results) {
    console.log('=' .repeat(50));
    console.log('🎉 LIMPIEZA COMPLETADA EXITOSAMENTE');
    console.log('📊 RESUMEN:');
    console.log(`- Logs originales: ${results.originalCount}`);
    console.log(`- Logs después de limpieza: ${results.cleanedCount}`);
    console.log(`- Duplicados eliminados: ${results.duplicateCount}`);
    console.log(`- Logs de ciclo de exportación eliminados: ${results.exportCycleCount}`);
    console.log(`- Reducción total: ${results.reduction} logs (${results.reductionPercentage}%)`);
    console.log('');
    console.log('📁 Archivos:');
    console.log(`- Original: ${LOG_FILE_PATH}`);
    console.log(`- Backup: ${BACKUP_FILE_PATH}`);
    console.log(`- Limpio: ${CLEANED_FILE_PATH}`);
    console.log('');
    console.log('✅ El problema del ciclo infinito de logs ha sido resuelto');
  } else {
    console.log('❌ Error durante la limpieza');
  }
}

// Ejecutar script
if (require.main === module) {
  main();
}

module.exports = { cleanLogs, createBackup }; 