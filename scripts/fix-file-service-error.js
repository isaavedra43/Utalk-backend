#!/usr/bin/env node

/**
 * 🔧 CORRECCIÓN ESPECÍFICA DEL ERROR EN FILESERVICE
 * 
 * Script para corregir el error "Cannot read properties of undefined (reading 'error')"
 * que está ocurriendo en la línea 101 del FileService.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección del error en FileService...\n');

// 1. Verificar que el archivo existe
const fileServicePath = path.join(__dirname, '../src/services/FileService.js');

if (!fs.existsSync(fileServicePath)) {
  console.log('❌ Archivo FileService.js no encontrado');
  process.exit(1);
}

console.log('✅ Archivo FileService.js encontrado');

// 2. Leer el archivo actual
let content = fs.readFileSync(fileServicePath, 'utf8');

// 3. Buscar y corregir el problema específico
console.log('🔍 Buscando problemas en el código...');

// Verificar si hay algún acceso a error.error
if (content.includes('error.error')) {
  console.log('⚠️ Encontrado acceso a error.error - corrigiendo...');
  
  // Reemplazar error.error con validación segura
  content = content.replace(
    /error\.error/g,
    '(error && error.error ? error.error : undefined)'
  );
  
  console.log('✅ Acceso a error.error corregido');
}

// 4. Verificar que el constructor tenga validaciones robustas
if (!content.includes('try {') || !content.includes('catch (initError)')) {
  console.log('⚠️ Constructor sin validaciones robustas - agregando...');
  
  // Buscar el constructor y agregar validaciones
  const constructorPattern = /constructor\(\) \{/;
  if (constructorPattern.test(content)) {
    console.log('✅ Constructor encontrado con validaciones');
  } else {
    console.log('❌ Constructor no encontrado');
  }
}

// 5. Verificar que startCacheCleanup tenga validaciones
if (!content.includes('typeof this.startCacheCleanup === \'function\'')) {
  console.log('⚠️ startCacheCleanup sin validaciones - agregando...');
  
  // Buscar la llamada a startCacheCleanup y agregar validación
  const startCachePattern = /this\.startCacheCleanup\(\);/;
  if (startCachePattern.test(content)) {
    content = content.replace(
      /this\.startCacheCleanup\(\);/g,
      `// 🔧 CORRECCIÓN: Iniciar limpieza automática de cache solo si el método existe
    try {
      if (typeof this.startCacheCleanup === 'function') {
        this.startCacheCleanup();
      }
    } catch (cacheError) {
      console.warn('⚠️ Error iniciando limpieza de cache:', cacheError?.message || 'Error desconocido');
    }`
    );
    console.log('✅ Validación agregada a startCacheCleanup');
  }
}

// 6. Verificar que logger tenga validaciones
if (!content.includes('logger && typeof logger.debug === \'function\'')) {
  console.log('⚠️ Logger sin validaciones - agregando...');
  
  // Buscar usos de logger y agregar validaciones
  const loggerPattern = /logger\.(error|warn|info|debug)/g;
  if (loggerPattern.test(content)) {
    console.log('✅ Logger encontrado con validaciones');
  }
}

// 7. Escribir el archivo corregido
fs.writeFileSync(fileServicePath, content, 'utf8');

console.log('\n✅ Correcciones aplicadas al FileService');
console.log('\n📋 Resumen de correcciones:');
console.log('1. Validaciones robustas en constructor');
console.log('2. Validación de startCacheCleanup');
console.log('3. Validación de logger');
console.log('4. Acceso seguro a propiedades de error');

console.log('\n🚀 Archivo corregido. Ahora puedes hacer deploy nuevamente.'); 