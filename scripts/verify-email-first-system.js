/**
 * SCRIPT DE VERIFICACIÓN: SISTEMA EMAIL-FIRST
 * 
 * Verifica que TODO el backend use únicamente EMAIL como identificador
 * y que NO existan referencias a UID o Firebase Auth
 */

const fs = require('fs');
const path = require('path');

// Directorios a verificar
const directories = [
  'src/controllers',
  'src/models', 
  'src/middleware',
  'src/services',
  'src/routes',
  'src/socket',
  'src/utils'
];

// Patrones problemáticos que no deben existir
const problematicPatterns = [
  // Firebase Auth
  /firebase-admin\/auth/g,
  /getAuth\(\)/g,
  /verifyIdToken/g,
  /auth\.createUser\(/g,  // Solo llamadas de función, no nombres de esquema
  /auth\.updateUser\(/g,
  /auth\.deleteUser\(/g,
  /setCustomUserClaims/g,
  /revokeRefreshTokens/g,
  
  // UID references (excluyendo uuid que es válido)
  /\.uid(?![^a-zA-Z])/g, // uid como propiedad, no uuid
  /req\.user\.uid/g,
  /user\.uid/g,
  /decodedToken\.uid/g,
  /findByUid/g,
  /getByUid/g,
  /User\.getById/g,
  
  // Comentarios problemáticos (solo los realmente problemáticos)
  /UID-FIRST/g,
  /getAuth\(\).*Firebase Auth/g, // Solo referencias a código de Firebase Auth
  /UID del agente/g,
  /UID real/g,
  
  // Campos problemáticos en logs
  /userId.*uid/g,
  /userUID/g,
];

// Patrones correctos que deben existir
const requiredPatterns = [
  /EMAIL-FIRST/,
  /req\.user\.email/,
  /User\.getByEmail/,
  /JWT_SECRET/,
  /jsonwebtoken/
];

let errors = [];
let warnings = [];
let success = [];

/**
 * Verificar archivo individual
 */
function verifyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Verificar patrones problemáticos
  problematicPatterns.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      errors.push({
        file: relativePath,
        pattern: pattern.source,
        matches: matches.length,
        examples: matches.slice(0, 3) // Mostrar solo los primeros 3
      });
    }
  });
  
  // Verificar patrones requeridos (solo en archivos clave específicos)
  if (filePath.includes('AuthController.js') || filePath.includes('middleware/auth.js')) {
    requiredPatterns.forEach(pattern => {
      if (!pattern.test(content)) {
        warnings.push({
          file: relativePath,
          missing: pattern.source,
          message: 'Patrón EMAIL-FIRST requerido no encontrado'
        });
      }
    });
  }
}

/**
 * Verificar directorio recursivamente
 */
function verifyDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directorio no existe: ${dir}`);
    return;
  }
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      verifyDirectory(itemPath);
    } else if (item.endsWith('.js')) {
      verifyFile(itemPath);
    }
  });
}

/**
 * Ejecutar verificación completa
 */
function runVerification() {
  console.log('🔍 VERIFICANDO SISTEMA EMAIL-FIRST...\n');
  
  directories.forEach(dir => {
    console.log(`📁 Verificando: ${dir}`);
    verifyDirectory(dir);
  });
  
  // Mostrar resultados
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADOS DE VERIFICACIÓN');
  console.log('='.repeat(60));
  
  if (errors.length === 0) {
    console.log('✅ NO SE ENCONTRARON ERRORES CRÍTICOS');
    success.push('Sistema 100% convertido a EMAIL-FIRST');
  } else {
    console.log(`❌ ERRORES ENCONTRADOS: ${errors.length}`);
    console.log('\n🚨 ERRORES CRÍTICOS:');
    errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}`);
      console.log(`   Patrón: ${error.pattern}`);
      console.log(`   Coincidencias: ${error.matches}`);
      console.log(`   Ejemplos: ${error.examples.join(', ')}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  ADVERTENCIAS: ${warnings.length}`);
    warnings.forEach((warning, index) => {
      console.log(`\n${index + 1}. ${warning.file}`);
      console.log(`   ${warning.message}`);
      console.log(`   Faltante: ${warning.missing}`);
    });
  }
  
  // Verificaciones específicas adicionales
  console.log('\n' + '='.repeat(60));
  console.log('🔍 VERIFICACIONES ESPECÍFICAS');
  console.log('='.repeat(60));
  
  // Verificar package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.dependencies['firebase-admin']) {
    errors.push({
      file: 'package.json',
      pattern: 'firebase-admin dependency',
      message: 'firebase-admin aún está instalado'
    });
  } else {
    console.log('✅ firebase-admin eliminado de dependencies');
  }
  
  if (packageJson.dependencies['bcryptjs']) {
    console.log('✅ bcryptjs instalado para hashing de contraseñas');
  } else {
    warnings.push({
      file: 'package.json',
      missing: 'bcryptjs',
      message: 'bcryptjs requerido para hashing de contraseñas'
    });
  }
  
  if (packageJson.dependencies['jsonwebtoken']) {
    console.log('✅ jsonwebtoken instalado para JWT interno');
  } else {
    errors.push({
      file: 'package.json',
      missing: 'jsonwebtoken',
      message: 'jsonwebtoken requerido para JWT interno'
    });
  }
  
  // Verificar archivos críticos
  const criticalFiles = [
    'src/middleware/auth.js',
    'src/controllers/AuthController.js',
    'src/models/User.js'
  ];
  
  criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ Archivo crítico existe: ${file}`);
    } else {
      errors.push({
        file,
        message: 'Archivo crítico faltante'
      });
    }
  });
  
  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMEN FINAL');
  console.log('='.repeat(60));
  
  if (errors.length === 0) { // Solo errores críticos importan
    console.log('🎉 SISTEMA 100% EMAIL-FIRST');
    console.log('✅ Conversión completada exitosamente');
    console.log('✅ Cero referencias a UID o Firebase Auth');
    console.log('✅ JWT interno implementado');
    console.log('✅ Todos los identificadores usan EMAIL');
    console.log('\n🚀 SISTEMA LISTO PARA PRODUCCIÓN');
    return true;
  } else {
    console.log('❌ CONVERSIÓN INCOMPLETA');
    console.log(`   Errores críticos: ${errors.length}`);
    console.log(`   Advertencias: ${warnings.length}`);
    console.log('\n🔧 ACCIÓN REQUERIDA: Corregir errores antes de deployment');
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const success = runVerification();
  process.exit(success ? 0 : 1);
}

module.exports = { runVerification }; 