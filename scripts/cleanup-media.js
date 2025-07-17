#!/usr/bin/env node

/**
 * Script de limpieza automática de archivos multimedia
 * Ejecutar con: node scripts/cleanup-media.js [opciones]
 */

require('dotenv').config();
const MediaService = require('../src/services/MediaService');
const logger = require('../src/utils/logger');

// Configuración por argumentos de línea de comandos
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  orphansOnly: args.includes('--orphans-only'),
  tempOnly: args.includes('--temp-only'),
  validateIntegrity: args.includes('--validate'),
  compressImages: args.includes('--compress'),
  verbose: args.includes('--verbose'),
};

async function main () {
  try {
    console.log('🧹 INICIANDO LIMPIEZA DE ARCHIVOS MULTIMEDIA');
    console.log('==========================================');

    if (options.dryRun) {
      console.log('🔍 MODO DRY RUN - No se eliminarán archivos realmente');
    }

    const results = {
      orphans: null,
      temp: null,
      validation: null,
      compression: null,
      totalSpaceSaved: 0,
    };

    // 1. Limpiar archivos huérfanos
    if (!options.tempOnly) {
      console.log('\n📂 Limpiando archivos huérfanos...');
      try {
        results.orphans = await MediaService.cleanOrphanedFiles({
          dryRun: options.dryRun,
          batchSize: 50,
        });

        console.log(`✅ Huérfanos: ${results.orphans.orphansFound} encontrados, ${results.orphans.orphansDeleted} eliminados`);
        console.log(`💾 Espacio liberado: ${results.orphans.spaceSavedFormatted}`);
        results.totalSpaceSaved += results.orphans.spaceSaved;

        if (options.verbose && results.orphans.orphanedFiles.length > 0) {
          console.log('📋 Archivos huérfanos encontrados:');
          results.orphans.orphanedFiles.forEach(file => {
            console.log(`   - ${file.fileName} (${file.category}, ${MediaService.formatFileSize(file.size)})`);
          });
        }
      } catch (error) {
        console.error('❌ Error limpiando huérfanos:', error.message);
      }
    }

    // 2. Limpiar archivos temporales
    if (!options.orphansOnly) {
      console.log('\n🗂️ Limpiando archivos temporales...');
      try {
        results.temp = await MediaService.cleanTemporaryFiles({
          olderThanHours: 24,
          dryRun: options.dryRun,
        });

        console.log(`✅ Temporales: ${results.temp.deleted} archivos eliminados`);
        console.log(`💾 Espacio liberado: ${results.temp.spaceSavedFormatted}`);
        results.totalSpaceSaved += results.temp.spaceSaved;
      } catch (error) {
        console.error('❌ Error limpiando temporales:', error.message);
      }
    }

    // 3. Validar integridad de archivos
    if (options.validateIntegrity) {
      console.log('\n🔍 Validando integridad de archivos...');
      try {
        results.validation = await MediaService.validateFileIntegrity({
          checkSignatures: true,
          checkSizes: true,
        });

        console.log(`✅ Validación: ${results.validation.validFiles}/${results.validation.totalFiles} archivos válidos`);

        if (results.validation.corruptedFiles.length > 0) {
          console.log(`⚠️ Archivos corruptos: ${results.validation.corruptedFiles.length}`);
          if (options.verbose) {
            results.validation.corruptedFiles.forEach(file => {
              console.log(`   - ${file.fileName}: ${file.error}`);
            });
          }
        }

        if (results.validation.invalidSignatures.length > 0) {
          console.log(`⚠️ Firmas inválidas: ${results.validation.invalidSignatures.length}`);
          if (options.verbose) {
            results.validation.invalidSignatures.forEach(file => {
              console.log(`   - ${file.fileName} (esperado: ${file.category})`);
            });
          }
        }
      } catch (error) {
        console.error('❌ Error validando integridad:', error.message);
      }
    }

    // 4. Comprimir imágenes
    if (options.compressImages) {
      console.log('\n🖼️ Comprimiendo imágenes...');
      try {
        results.compression = await MediaService.compressImages({
          quality: 85,
          maxWidth: 1920,
          maxHeight: 1080,
          dryRun: options.dryRun,
        });

        console.log(`✅ Compresión: ${results.compression.processed}/${results.compression.totalImages} imágenes procesadas`);
        console.log(`💾 Espacio ahorrado: ${MediaService.formatFileSize(results.compression.spaceSaved)}`);
        results.totalSpaceSaved += results.compression.spaceSaved;
      } catch (error) {
        console.error('❌ Error comprimiendo imágenes:', error.message);
      }
    }

    // 5. Mostrar estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES');
    console.log('======================');

    try {
      const stats = await MediaService.getAdvancedStorageStats();

      console.log(`📁 Total archivos: ${stats.totalFiles}`);
      console.log(`💾 Espacio total: ${stats.totalSizeFormatted}`);
      console.log(`🔗 Archivos referenciados: ${stats.efficiency.referencedFiles}`);
      console.log(`📈 Tasa de utilización: ${stats.efficiency.utilizationRate}%`);

      if (stats.orphaned.files > 0) {
        console.log(`🗑️ Archivos huérfanos: ${stats.orphaned.files} (${stats.orphaned.sizeFormatted}, ${stats.orphaned.percentage}%)`);
      }

      console.log(`\n💾 ESPACIO TOTAL LIBERADO: ${MediaService.formatFileSize(results.totalSpaceSaved)}`);

      if (options.verbose) {
        console.log('\n📋 Distribución por categoría:');
        Object.entries(stats.byCategory).forEach(([category, data]) => {
          console.log(`   ${category}: ${data.files} archivos, ${data.sizeFormatted}`);
        });

        console.log('\n📅 Distribución por edad:');
        Object.entries(stats.byAge).forEach(([age, data]) => {
          console.log(`   ${age}: ${data.files} archivos, ${data.sizeFormatted}`);
        });
      }
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
    }

    console.log('\n✅ LIMPIEZA COMPLETADA');

    if (options.dryRun) {
      console.log('\n🔍 Ejecutar sin --dry-run para aplicar cambios reales');
    }
  } catch (error) {
    console.error('❌ Error fatal en script de limpieza:', error);
    process.exit(1);
  }
}

// Mostrar ayuda si se solicita
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Script de Limpieza de Archivos Multimedia
==========================================

Uso: node scripts/cleanup-media.js [opciones]

Opciones:
  --dry-run           Simular limpieza sin eliminar archivos
  --orphans-only      Solo limpiar archivos huérfanos
  --temp-only         Solo limpiar archivos temporales
  --validate          Validar integridad de archivos
  --compress          Comprimir imágenes automáticamente
  --verbose           Mostrar información detallada
  --help, -h          Mostrar esta ayuda

Ejemplos:
  node scripts/cleanup-media.js --dry-run --verbose
  node scripts/cleanup-media.js --orphans-only
  node scripts/cleanup-media.js --validate --compress
  node scripts/cleanup-media.js --temp-only --dry-run
`);
  process.exit(0);
}

// Ejecutar script principal
main().catch(error => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});
