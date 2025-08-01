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
  console.log('🔄 INICIANDO MIGRACIÓN DE ARCHIVOS AL SISTEMA INDEXADO');
  console.log('=' .repeat(60));

  try {
    // Verificar conexión a Firebase
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK no inicializado');
    }

    const bucket = admin.storage().bucket();
    const firestore = admin.firestore();

    console.log('📋 Paso 1: Escaneando archivos existentes en Firebase Storage...');

    // Obtener todos los archivos del bucket
    const [files] = await bucket.getFiles();
    
    console.log(`📊 Encontrados ${files.length} archivos en Storage`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Procesar archivos en lotes para evitar sobrecarga
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      console.log(`\n🔄 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);
      
      await Promise.all(batch.map(async (file) => {
        try {
          await processFile(file, firestore);
          migratedCount++;
          process.stdout.write('.');
        } catch (error) {
          errorCount++;
          console.log(`\n❌ Error procesando archivo ${file.name}: ${error.message}`);
        }
      }));

      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Archivos migrados: ${migratedCount}`);
    console.log(`⏭️ Archivos omitidos: ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📁 Total procesados: ${migratedCount + skippedCount + errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️ Algunos archivos no pudieron ser migrados. Revisa los errores arriba.');
    } else {
      console.log('\n🎉 ¡Migración completada exitosamente!');
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
      console.log(`⏭️ Omitiendo archivo no válido: ${storageFile.name}`);
      return;
    }

    // Verificar si ya existe en la base de datos
    const existingFile = await File.getByStoragePath(storageFile.name);
    if (existingFile) {
      console.log(`⏭️ Archivo ya indexado: ${storageFile.name}`);
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

    console.log(`✅ Migrado: ${storageFile.name}`);

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
  console.log('\n🧹 LIMPIANDO ARCHIVOS HUÉRFANOS...');

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

    console.log(`📊 Archivos indexados: ${indexedFiles.size}`);

    // Obtener todos los archivos en Storage
    const [storageFiles] = await bucket.getFiles();
    const storagePaths = new Set(storageFiles.map(file => file.name));

    console.log(`📊 Archivos en Storage: ${storagePaths.size}`);

    // Encontrar archivos huérfanos (en Storage pero no indexados)
    const orphanedFiles = [];
    for (const storagePath of storagePaths) {
      if (!indexedFiles.has(storagePath)) {
        orphanedFiles.push(storagePath);
      }
    }

    console.log(`📊 Archivos huérfanos encontrados: ${orphanedFiles.length}`);

    if (orphanedFiles.length > 0) {
      console.log('\n🗑️ Eliminando archivos huérfanos...');
      
      for (const orphanedPath of orphanedFiles) {
        try {
          const file = bucket.file(orphanedPath);
          await file.delete();
          console.log(`✅ Eliminado archivo huérfano: ${orphanedPath}`);
        } catch (error) {
          console.log(`❌ Error eliminando ${orphanedPath}: ${error.message}`);
        }
      }
    }

    console.log('✅ Limpieza de archivos huérfanos completada');

  } catch (error) {
    console.error('❌ Error en limpieza de archivos huérfanos:', error.message);
  }
}

/**
 * Verificar integridad del sistema
 */
async function verifySystemIntegrity() {
  console.log('\n🔍 VERIFICANDO INTEGRIDAD DEL SISTEMA...');

  try {
    const firestore = admin.firestore();
    const bucket = admin.storage().bucket();

    // Verificar archivos indexados vs Storage
    const filesSnapshot = await firestore.collection('files').get();
    const indexedFiles = filesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Archivos indexados: ${indexedFiles.length}`);

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
          console.log(`⚠️ Archivo indexado pero no en Storage: ${file.storagePath}`);
        }
      } catch (error) {
        invalidFiles++;
        console.log(`❌ Error verificando archivo: ${file.storagePath}`);
      }
    }

    console.log(`\n📊 RESULTADOS DE INTEGRIDAD:`);
    console.log(`✅ Archivos válidos: ${validFiles}`);
    console.log(`❌ Archivos inválidos: ${invalidFiles}`);
    console.log(`📈 Tasa de integridad: ${((validFiles / indexedFiles.length) * 100).toFixed(1)}%`);

    if (invalidFiles > 0) {
      console.log('\n⚠️ Se encontraron archivos con problemas de integridad.');
    } else {
      console.log('\n🎉 ¡Sistema completamente integro!');
    }

  } catch (error) {
    console.error('❌ Error verificando integridad:', error.message);
  }
}

/**
 * Generar reporte de migración
 */
async function generateMigrationReport() {
  console.log('\n📊 GENERANDO REPORTE DE MIGRACIÓN...');

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

    console.log('\n📊 REPORTE DE MIGRACIÓN:');
    console.log(`📁 Total de archivos: ${stats.total}`);
    console.log(`💾 Tamaño total: ${formatFileSize(stats.totalSize)}`);
    console.log(`📏 Tamaño promedio: ${formatFileSize(stats.averageSize)}`);
    
    console.log('\n📂 Por categoría:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      console.log(`  ${category}: ${count} archivos`);
    }

    console.log('\n👤 Por usuario:');
    for (const [user, count] of Object.entries(stats.byUser)) {
      console.log(`  ${user}: ${count} archivos`);
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
      console.log('\n🏁 Limpieza completada.');
      process.exit(0);
    });
  } else if (args.includes('--verify')) {
    verifySystemIntegrity().then(() => {
      console.log('\n🏁 Verificación completada.');
      process.exit(0);
    });
  } else if (args.includes('--report')) {
    generateMigrationReport().then(() => {
      console.log('\n🏁 Reporte generado.');
      process.exit(0);
    });
  } else {
    migrateFilesToIndexedSystem().then(() => {
      console.log('\n🏁 Migración completada.');
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