/**
 * 🔄 SCRIPT DE MIGRACIÓN: SISTEMA DE ARCHIVOS INDEXADO
 * 
 * Migra archivos existentes del sistema anterior al nuevo sistema
 * con indexación completa para consultas eficientes.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const admin = require('firebase-admin');
const File = require('../src/models/File');
const { logger } = require('../src/utils/logger');

/**
 * Migrar archivos existentes al sistema indexado
 */
async function migrateFilesToIndexedSystem() {
  // Usar logger simple para scripts
  const log = (message, data = {}) => {
    const timestamp = new Date().toISOString();
    if (Object.keys(data).length > 0) {
      console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      logger.info('[${timestamp}] ${message}', { category: 'AUTO_MIGRATED' });
    }
  };

  log('🔄 INICIANDO MIGRACIÓN DE ARCHIVOS AL SISTEMA INDEXADO');
  log('=' .repeat(60));

  try {
    // Verificar conexión a Firebase
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK no inicializado');
    }

    const bucket = admin.storage().bucket();
    const firestore = admin.firestore();

    log('📋 Paso 1: Escaneando archivos existentes en Firebase Storage...');

    // Obtener todos los archivos del bucket
    const [files] = await bucket.getFiles();
    
    log(`📊 Encontrados ${files.length} archivos en Storage`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Procesar archivos en lotes para evitar sobrecarga
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      logger.info('\n Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}', { category: 'AUTO_MIGRATED' });
      
      await Promise.all(batch.map(async (file) => {
        try {
          await processFile(file, firestore);
          migratedCount++;
          process.stdout.write('.');
        } catch (error) {
          errorCount++;
          logger.info('\n❌ Error procesando archivo ${file.name}: ${error.message}', { category: 'AUTO_MIGRATED' });
        }
      }));

      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n\n📊 RESUMEN DE MIGRACIÓN:' });
    logger.info('Archivos migrados: ${migratedCount}', { category: 'AUTO_MIGRATED' });
    logger.info('⏭ Archivos omitidos: ${skippedCount}', { category: 'AUTO_MIGRATED' });
    logger.info('❌ Errores: ${errorCount}', { category: 'AUTO_MIGRATED' });
    logger.info('� Total procesados: ${migratedCount + skippedCount + errorCount}', { category: 'AUTO_MIGRATED' });

    if (errorCount > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunos archivos no pudieron ser migrados. Revisa los errores arriba.' });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡Migración completada exitosamente!' });
    }

  } catch (error) {
    console.error('💥 Error durante la migración:', error.message);
    process.exit(1);
  }
}

/**
 * Procesar un archivo individual
 */
async function processFile(storageFile, firestore) {
  try {
    // Extraer información del path del archivo
    const pathInfo = extractPathInfo(storageFile.name);
    
    if (!pathInfo.isValid) {
      logger.info('⏭ Omitiendo archivo no válido: ${storageFile.name}', { category: 'AUTO_MIGRATED' });
      return;
    }

    // Verificar si ya existe en la base de datos
    const existingFile = await File.getByStoragePath(storageFile.name);
    if (existingFile) {
      logger.info('⏭ Archivo ya indexado: ${storageFile.name}', { category: 'AUTO_MIGRATED' });
      return;
    }

    // Obtener metadata del archivo
    const [metadata] = await storageFile.getMetadata();

    // Crear registro en la base de datos
    const fileData = {
      originalName: pathInfo.originalName || storageFile.name.split('/').pop(),
      storagePath: storageFile.name,
      storageUrl: `gs://${storageFile.bucket.name}/${storageFile.name}`,
      category: pathInfo.category,
      mimeType: metadata.contentType || 'application/octet-stream',
      size: formatFileSize(metadata.size),
      sizeBytes: parseInt(metadata.size),
      conversationId: pathInfo.conversationId,
      uploadedBy: pathInfo.uploadedBy || 'system',
      uploadedAt: new Date(metadata.timeCreated),
      metadata: metadata.metadata || {},
      tags: pathInfo.tags || []
    };

    // Crear archivo con indexación automática
    await File.create(fileData);

    logger.info('Migrado: ${storageFile.name}', { category: 'AUTO_MIGRATED' });

  } catch (error) {
    throw new Error(`Error procesando ${storageFile.name}: ${error.message}`);
  }
}

/**
 * Extraer información del path del archivo
 */
function extractPathInfo(storagePath) {
  const pathParts = storagePath.split('/');
  
  // Patrones de path esperados:
  // - images/conversationId/filename.jpg
  // - audio/conversationId/filename.mp3
  // - video/conversationId/filename.mp4
  // - documents/conversationId/filename.pdf
  
  if (pathParts.length < 3) {
    return { isValid: false };
  }

  const category = pathParts[0];
  const conversationId = pathParts[1];
  const filename = pathParts[2];

  // Validar categoría
  const validCategories = ['images', 'audio', 'video', 'documents'];
  if (!validCategories.includes(category)) {
    return { isValid: false };
  }

  // Extraer información adicional del filename
  const filenameParts = filename.split('_');
  let uploadedBy = 'system';
  let tags = [];

  // Buscar información de usuario en el filename
  if (filenameParts.length > 2) {
    // Formato esperado: timestamp_uuid_userId_resto
    if (filenameParts[2] && filenameParts[2].includes('@')) {
      uploadedBy = filenameParts[2];
    }
  }

  return {
    isValid: true,
    category: category.slice(0, -1), // Remover 's' final
    conversationId,
    originalName: filename,
    uploadedBy,
    tags
  };
}

/**
 * Formatear tamaño de archivo
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Limpiar archivos huérfanos
 */
async function cleanupOrphanedFiles() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧹 LIMPIANDO ARCHIVOS HUÉRFANOS...' });

  try {
    const firestore = admin.firestore();
    const bucket = admin.storage().bucket();

    // Obtener todos los archivos indexados
    const filesSnapshot = await firestore.collection('files').get();
    const indexedFiles = new Set();
    
    filesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.storagePath) {
        indexedFiles.add(data.storagePath);
      }
    });

    logger.info('Archivos indexados: ${indexedFiles.size}', { category: 'AUTO_MIGRATED' });

    // Obtener todos los archivos en Storage
    const [storageFiles] = await bucket.getFiles();
    const storagePaths = new Set(storageFiles.map(file => file.name));

    logger.info('Archivos en Storage: ${storagePaths.size}', { category: 'AUTO_MIGRATED' });

    // Encontrar archivos huérfanos (en Storage pero no indexados)
    const orphanedFiles = [];
    for (const storagePath of storagePaths) {
      if (!indexedFiles.has(storagePath)) {
        orphanedFiles.push(storagePath);
      }
    }

    logger.info('Archivos huérfanos encontrados: ${orphanedFiles.length}', { category: 'AUTO_MIGRATED' });

    if (orphanedFiles.length > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🗑️ Eliminando archivos huérfanos...' });
      
      for (const orphanedPath of orphanedFiles) {
        try {
          const file = bucket.file(orphanedPath);
          await file.delete();
          logger.info('Eliminado archivo huérfano: ${orphanedPath}', { category: 'AUTO_MIGRATED' });
        } catch (error) {
          logger.info('❌ Error eliminando ${orphanedPath}: ${error.message}', { category: 'AUTO_MIGRATED' });
        }
      }
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Limpieza de archivos huérfanos completada' });

  } catch (error) {
    console.error('❌ Error en limpieza de archivos huérfanos:', error.message);
  }
}

/**
 * Verificar integridad del sistema
 */
async function verifySystemIntegrity() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 VERIFICANDO INTEGRIDAD DEL SISTEMA...' });

  try {
    const firestore = admin.firestore();
    const bucket = admin.storage().bucket();

    // Verificar archivos indexados vs Storage
    const filesSnapshot = await firestore.collection('files').get();
    const indexedFiles = filesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info('Archivos indexados: ${indexedFiles.length}', { category: 'AUTO_MIGRATED' });

    let validFiles = 0;
    let invalidFiles = 0;

    for (const file of indexedFiles) {
      try {
        const storageFile = bucket.file(file.storagePath);
        const [exists] = await storageFile.exists();
        
        if (exists) {
          validFiles++;
        } else {
          invalidFiles++;
          logger.info('Archivo indexado pero no en Storage: ${file.storagePath}', { category: 'AUTO_MIGRATED' });
        }
      } catch (error) {
        invalidFiles++;
        logger.info('❌ Error verificando archivo: ${file.storagePath}', { category: 'AUTO_MIGRATED' });
      }
    }

    logger.info('\n RESULTADOS DE INTEGRIDAD:', { category: 'AUTO_MIGRATED' });
    logger.info('Archivos válidos: ${validFiles}', { category: 'AUTO_MIGRATED' });
    logger.info('❌ Archivos inválidos: ${invalidFiles}', { category: 'AUTO_MIGRATED' });
    logger.info('� Tasa de integridad: ${((validFiles / indexedFiles.length) * 100).toFixed(1)}%', { category: 'AUTO_MIGRATED' });

    if (invalidFiles > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Se encontraron archivos con problemas de integridad.' });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡Sistema completamente integro!' });
    }

  } catch (error) {
    console.error('❌ Error verificando integridad:', error.message);
  }
}

/**
 * Generar reporte de migración
 */
async function generateMigrationReport() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 GENERANDO REPORTE DE MIGRACIÓN...' });

  try {
    const firestore = admin.firestore();

    // Estadísticas generales
    const filesSnapshot = await firestore.collection('files').get();
    const files = filesSnapshot.docs.map(doc => doc.data());

    const stats = {
      total: files.length,
      byCategory: {},
      byUser: {},
      totalSize: 0,
      averageSize: 0
    };

    for (const file of files) {
      // Contar por categoría
      stats.byCategory[file.category] = (stats.byCategory[file.category] || 0) + 1;
      
      // Contar por usuario
      stats.byUser[file.uploadedBy] = (stats.byUser[file.uploadedBy] || 0) + 1;
      
      // Sumar tamaños
      stats.totalSize += file.sizeBytes || 0;
    }

    if (files.length > 0) {
      stats.averageSize = stats.totalSize / files.length;
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 REPORTE DE MIGRACIÓN:' });
    logger.info('� Total de archivos: ${stats.total}', { category: 'AUTO_MIGRATED' });
    logger.info('� Tamaño total: ${formatFileSize(stats.totalSize)}', { category: 'AUTO_MIGRATED' });
    logger.info('� Tamaño promedio: ${formatFileSize(stats.averageSize)}', { category: 'AUTO_MIGRATED' });
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📂 Por categoría:' });
    for (const [category, count] of Object.entries(stats.byCategory)) {
      logger.info('${category}: ${count} archivos', { category: 'AUTO_MIGRATED' });
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n👤 Por usuario:' });
    for (const [user, count] of Object.entries(stats.byUser)) {
      logger.info('${user}: ${count} archivos', { category: 'AUTO_MIGRATED' });
    }

  } catch (error) {
    console.error('❌ Error generando reporte:', error.message);
  }
}

// Ejecutar migración si el script se ejecuta directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    cleanupOrphanedFiles().then(() => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Limpieza completada.' });
      process.exit(0);
    });
  } else if (args.includes('--verify')) {
    verifySystemIntegrity().then(() => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Verificación completada.' });
      process.exit(0);
    });
  } else if (args.includes('--report')) {
    generateMigrationReport().then(() => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Reporte generado.' });
      process.exit(0);
    });
  } else {
    migrateFilesToIndexedSystem().then(() => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Migración completada.' });
      process.exit(0);
    });
  }
}

module.exports = {
  migrateFilesToIndexedSystem,
  cleanupOrphanedFiles,
  verifySystemIntegrity,
  generateMigrationReport
}; 