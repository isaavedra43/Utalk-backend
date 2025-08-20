/**
 * 🔍 SCRIPT DE VERIFICACIÓN DE LA CORRECCIÓN DE SUBIDA DE MEDIA
 * 
 * Este script verifica que la corrección del middleware de multer
 * esté correctamente implementada en el código fuente.
 * 
 * @version 1.0.0
 * @date 2025-08-19
 */

const fs = require('fs');
const path = require('path');

// Archivos a verificar
const FILES_TO_CHECK = [
  {
    path: 'src/routes/media.js',
    description: 'Ruta de subida de media',
    checks: [
      {
        name: 'Middleware de multer configurado',
        pattern: /MediaUploadController\.getMulterConfig\(\)\.single\('file'\)/,
        expected: true
      },
      {
        name: 'Ruta POST /upload existe',
        pattern: /router\.post\('\/upload'/,
        expected: true
      },
      {
        name: 'Orden correcto de middlewares',
        pattern: /authMiddleware.*requireWriteAccess.*validateUpload.*getUploadRateLimit.*getMulterConfig.*uploadMedia/s,
        expected: true
      }
    ]
  },
  {
    path: 'src/controllers/MediaUploadController.js',
    description: 'Controlador de media upload',
    checks: [
      {
        name: 'Método getMulterConfig existe',
        pattern: /getMulterConfig\(\)/,
        expected: true
      },
      {
        name: 'Configuración de multer con límites',
        pattern: /fileSize.*100.*1024.*1024/,
        expected: true
      },
      {
        name: 'Validación de archivo en uploadMedia',
        pattern: /if \(!req\.file\)/,
        expected: true
      }
    ]
  }
];

// Función para verificar un archivo
function checkFile(filePath, description, checks) {
  logger.info('\n� Verificando: ${description}', { category: 'AUTO_MIGRATED' });
  logger.info('� Archivo: ${filePath}', { category: 'AUTO_MIGRATED' });
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let allChecksPassed = true;

  checks.forEach((check, index) => {
    const hasPattern = check.pattern.test(content);
    const status = hasPattern === check.expected ? '✅' : '❌';
    
    logger.info('${index + 1}. ${status} ${check.name}', { category: 'AUTO_MIGRATED' });
    
    if (hasPattern !== check.expected) {
      logger.info('� Esperado: ${check.expected ? 'ENCONTRADO' : 'NO ENCONTRADO'}', { category: 'AUTO_MIGRATED' });
      logger.info('� Actual: ${hasPattern ? 'ENCONTRADO' : 'NO ENCONTRADO'}', { category: 'AUTO_MIGRATED' });
      allChecksPassed = false;
    }
  });

  return allChecksPassed;
}

// Función para mostrar el código relevante
function showRelevantCode() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 CÓDIGO RELEVANTE:' });
  
  const mediaRoutesPath = 'src/routes/media.js';
  if (fs.existsSync(mediaRoutesPath)) {
    const content = fs.readFileSync(mediaRoutesPath, 'utf8');
    
    // Buscar la línea específica de la ruta de upload
    const lines = content.split('\n');
    let inUploadRoute = false;
    let routeLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('router.post(\'/upload\'')) {
        inUploadRoute = true;
        routeLines.push(`Línea ${i + 1}: ${line.trim()}`);
      } else if (inUploadRoute && line.includes('MediaUploadController.uploadMedia')) {
        routeLines.push(`Línea ${i + 1}: ${line.trim()}`);
        inUploadRoute = false;
      } else if (inUploadRoute) {
        routeLines.push(`Línea ${i + 1}: ${line.trim()}`);
      }
    }
    
    if (routeLines.length > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 Configuración de la ruta /upload:' });
      routeLines.forEach(line => console.log(`  ${line}`));
    }
  }
}

// Función principal
function runVerification() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 VERIFICANDO CORRECCIÓN DE SUBIDA DE MEDIA' });
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📍 Directorio:', process.cwd());
  
  let totalChecks = 0;
  let passedChecks = 0;
  let failedFiles = [];

  FILES_TO_CHECK.forEach(fileCheck => {
    const filePassed = checkFile(fileCheck.path, fileCheck.description, fileCheck.checks);
    
    fileCheck.checks.forEach(check => {
      totalChecks++;
      if (check.pattern.test(fs.readFileSync(fileCheck.path, 'utf8')) === check.expected) {
        passedChecks++;
      }
    });
    
    if (!filePassed) {
      failedFiles.push(fileCheck.path);
    }
  });

  // Mostrar resumen
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 RESUMEN DE VERIFICACIÓN:' });
  logger.info('Checks pasados: ${passedChecks}/${totalChecks}', { category: 'AUTO_MIGRATED' });
  logger.info('❌ Checks fallidos: ${totalChecks - passedChecks}/${totalChecks}', { category: 'AUTO_MIGRATED' });
  
  if (failedFiles.length > 0) {
    logger.info('\n Archivos con problemas:', { category: 'AUTO_MIGRATED' });
    failedFiles.forEach(file => console.log(`  - ${file}`));
  }

  // Mostrar código relevante
  showRelevantCode();

  // Conclusión
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎯 CONCLUSIÓN:' });
  if (passedChecks === totalChecks) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ ¡CORRECCIÓN IMPLEMENTADA CORRECTAMENTE!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El middleware de multer está configurado en la ruta' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ La subida de archivos debería funcionar ahora' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 Para probar completamente:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   1. Iniciar el servidor: npm start' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   2. Ejecutar: node scripts/test-media-upload-fix.js' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ CORRECCIÓN INCOMPLETA' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Hay problemas en la configuración' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '💡 Revisar los archivos marcados con ❌' });
  }

  return passedChecks === totalChecks;
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
  const success = runVerification();
  process.exit(success ? 0 : 1);
}

module.exports = { runVerification, checkFile }; 