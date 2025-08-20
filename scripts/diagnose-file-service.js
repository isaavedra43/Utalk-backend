#!/usr/bin/env node

/**
 * 🔧 DIAGNÓSTICO Y CORRECCIÓN DEL FILESERVICE
 * 
 * Script para identificar y corregir problemas en el FileService
 * basado en los errores observados en los logs.
 */

const path = require('path');
const fs = require('fs');

console.log('🔧 Iniciando diagnóstico del FileService...\n');

// 1. Verificar configuración de Firebase
console.log('1️⃣ Verificando configuración de Firebase...');
try {
  const admin = require('firebase-admin');
  
  if (!admin) {
    console.log('❌ Firebase Admin SDK no disponible');
  } else if (!admin.apps || admin.apps.length === 0) {
    console.log('⚠️ Firebase Admin SDK no inicializado');
  } else {
    console.log('✅ Firebase Admin SDK disponible');
    
    try {
      const firestore = admin.firestore();
      console.log('✅ Firestore disponible');
    } catch (error) {
      console.log('❌ Error con Firestore:', error.message);
    }
    
    try {
      const storage = admin.storage();
      const bucket = storage.bucket();
      console.log('✅ Firebase Storage disponible');
    } catch (error) {
      console.log('❌ Error con Firebase Storage:', error.message);
    }
  }
} catch (error) {
  console.log('❌ Error cargando Firebase Admin SDK:', error.message);
}

// 2. Verificar dependencias críticas
console.log('\n2️⃣ Verificando dependencias críticas...');
const dependencies = [
  { name: 'sharp', required: true },
  { name: 'uuid', required: true },
  { name: 'firebase-admin', required: true }
];

dependencies.forEach(dep => {
  try {
    require(dep.name);
    console.log(`✅ ${dep.name} disponible`);
  } catch (error) {
    if (dep.required) {
      console.log(`❌ ${dep.name} NO disponible:`, error.message);
    } else {
      console.log(`⚠️ ${dep.name} no disponible:`, error.message);
    }
  }
});

// 3. Verificar configuración de CORS
console.log('\n3️⃣ Verificando configuración de CORS...');
try {
  const corsConfig = require('../src/config/cors.js');
  const { STATIC_WHITELIST } = corsConfig;
  
  const backendDomain = 'https://utalk-backend-production.up.railway.app';
  const isBackendAllowed = STATIC_WHITELIST.includes(backendDomain);
  
  console.log(`Dominio del backend: ${backendDomain}`);
  console.log(`¿Está en la lista blanca? ${isBackendAllowed ? '✅ Sí' : '❌ No'}`);
  
  if (!isBackendAllowed) {
    console.log('🔧 Agregando dominio del backend a la lista blanca...');
    
    // Leer el archivo de configuración CORS
    const corsFilePath = path.join(__dirname, '../src/config/cors.js');
    let corsContent = fs.readFileSync(corsFilePath, 'utf8');
    
    // Agregar el dominio si no está presente
    if (!corsContent.includes(backendDomain)) {
      const newWhitelist = `const STATIC_WHITELIST = [
  ...FRONTEND_ENV,                 // e.g. https://utalk-frontend-glt2-git-main-...vercel.app, https://utalk-frontend-glt2.vercel.app
  process.env.FRONTEND_URL_2,
  process.env.FRONTEND_URL_3,
  'http://localhost:5173',
  // 🔧 CORRECCIÓN: Agregar dominio del backend para peticiones internas
  'https://utalk-backend-production.up.railway.app',
  'http://utalk-backend-production.up.railway.app'
].filter(Boolean);`;
      
      corsContent = corsContent.replace(
        /const STATIC_WHITELIST = \[[\s\S]*?\].filter\(Boolean\);/,
        newWhitelist
      );
      
      fs.writeFileSync(corsFilePath, corsContent);
      console.log('✅ Dominio del backend agregado a la configuración CORS');
    }
  }
} catch (error) {
  console.log('❌ Error verificando configuración CORS:', error.message);
}

// 4. Verificar FileService
console.log('\n4️⃣ Verificando FileService...');
try {
  const FileService = require('../src/services/FileService.js');
  const fileService = new FileService();
  
  console.log('✅ FileService inicializado correctamente');
  console.log('Estado de inicialización:', fileService.initializationStatus);
  
  // Verificar métodos críticos
  const criticalMethods = ['uploadFile', 'getFileById', 'getBucket'];
  criticalMethods.forEach(method => {
    if (typeof fileService[method] === 'function') {
      console.log(`✅ Método ${method} disponible`);
    } else {
      console.log(`❌ Método ${method} NO disponible`);
    }
  });
  
} catch (error) {
  console.log('❌ Error inicializando FileService:', error.message);
  console.log('Stack trace:', error.stack);
}

// 5. Verificar MediaUploadController
console.log('\n5️⃣ Verificando MediaUploadController...');
try {
  const MediaUploadController = require('../src/controllers/MediaUploadController.js');
  const mediaController = new MediaUploadController();
  
  console.log('✅ MediaUploadController inicializado correctamente');
  
  // Verificar que tiene acceso al FileService
  if (mediaController.fileService) {
    console.log('✅ FileService disponible en MediaUploadController');
  } else {
    console.log('❌ FileService NO disponible en MediaUploadController');
  }
  
} catch (error) {
  console.log('❌ Error inicializando MediaUploadController:', error.message);
  console.log('Stack trace:', error.stack);
}

// 6. Verificar variables de entorno
console.log('\n6️⃣ Verificando variables de entorno críticas...');
const criticalEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FRONTEND_URL'
];

criticalEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar} configurada`);
  } else {
    console.log(`❌ ${envVar} NO configurada`);
  }
});

console.log('\n🔧 Diagnóstico completado.');
console.log('\n📋 Resumen de acciones recomendadas:');
console.log('1. Verificar que todas las dependencias estén instaladas');
console.log('2. Asegurar que Firebase esté configurado correctamente');
console.log('3. Verificar que las variables de entorno estén configuradas');
console.log('4. Reiniciar el servidor después de las correcciones'); 