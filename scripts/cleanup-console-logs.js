/**
 * 🧹 SCRIPT DE LIMPIEZA DE CONSOLE.LOG
 * 
 * Elimina automáticamente todos los console.log del proyecto
 * y los reemplaza con logging estructurado apropiado.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// Directorios a procesar
const DIRECTORIES = [
  'src',
  'scripts'
];

// Archivos a excluir
const EXCLUDE_FILES = [
  'node_modules',
  '.git',
  'package-lock.json',
  'yarn.lock'
];

// Patrones de console.log a reemplazar
const CONSOLE_PATTERNS = [
  {
    pattern: /console\.log\(`([^`]+)`\);/g,
    replacement: (match, message) => {
      // Extraer información del mensaje
      const cleanMessage = message.replace(/[🔍🏥✅📋📊⚠️🔧🚨🔄]/g, '').trim();
      return `logger.info('${cleanMessage}', { category: 'AUTO_MIGRATED' });`;
    }
  },
  {
    pattern: /console\.log\(`([^`]+)`, ([^)]+)\);/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.replace(/[🔍🏥✅📋📊⚠️🔧🚨🔄]/g, '').trim();
      return `logger.info('${cleanMessage}', { category: 'AUTO_MIGRATED', data: ${data} });`;
    }
  },
  {
    pattern: /console\.log\(([^)]+)\);/g,
    replacement: (match, content) => {
      return `logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: ${content} });`;
    }
  }
];

/**
 * Procesar un archivo JavaScript
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let changes = 0;

    // Aplicar patrones de reemplazo
    CONSOLE_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        modifiedContent = modifiedContent.replace(pattern.pattern, pattern.replacement);
        changes += matches.length;
      }
    });

    // Si hubo cambios, escribir el archivo
    if (changes > 0) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      logger.info(`Archivo procesado: ${filePath}`, {
        category: 'CONSOLE_CLEANUP',
        changes,
        filePath
      });
      return changes;
    }

    return 0;
  } catch (error) {
    logger.error(`Error procesando archivo: ${filePath}`, {
      category: 'CONSOLE_CLEANUP_ERROR',
      error: error.message,
      filePath
    });
    return 0;
  }
}

/**
 * Recorrer directorio recursivamente
 */
function processDirectory(dirPath) {
  let totalChanges = 0;
  let processedFiles = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!EXCLUDE_FILES.includes(item)) {
          const subChanges = processDirectory(fullPath);
          totalChanges += subChanges;
        }
      } else if (item.endsWith('.js')) {
        const changes = processFile(fullPath);
        totalChanges += changes;
        if (changes > 0) {
          processedFiles++;
        }
      }
    }
  } catch (error) {
    logger.error(`Error procesando directorio: ${dirPath}`, {
      category: 'CONSOLE_CLEANUP_ERROR',
      error: error.message,
      dirPath
    });
  }

  return totalChanges;
}

/**
 * Función principal
 */
function cleanupConsoleLogs() {
  logger.info('🧹 Iniciando limpieza de console.log', {
    category: 'CONSOLE_CLEANUP_START'
  });

  let totalChanges = 0;
  let totalFiles = 0;

  // Procesar cada directorio
  DIRECTORIES.forEach(dir => {
    if (fs.existsSync(dir)) {
      logger.info(`Procesando directorio: ${dir}`, {
        category: 'CONSOLE_CLEANUP',
        directory: dir
      });
      
      const changes = processDirectory(dir);
      totalChanges += changes;
      
      logger.info(`Directorio completado: ${dir}`, {
        category: 'CONSOLE_CLEANUP',
        directory: dir,
        changes
      });
    } else {
      logger.warn(`Directorio no encontrado: ${dir}`, {
        category: 'CONSOLE_CLEANUP',
        directory: dir
      });
    }
  });

  // Reporte final
  logger.info('✅ Limpieza de console.log completada', {
    category: 'CONSOLE_CLEANUP_COMPLETE',
    totalChanges,
    totalFiles,
    directories: DIRECTORIES
  });

  return {
    totalChanges,
    totalFiles,
    success: true
  };
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanupConsoleLogs();
}

module.exports = {
  cleanupConsoleLogs,
  processFile,
  processDirectory
}; 