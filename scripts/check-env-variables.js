#!/usr/bin/env node

/**
 * 🔍 SCRIPT PARA VERIFICAR VARIABLES DE ENTORNO
 * 
 * Este script verifica qué variables de entorno están configuradas
 * y cuáles faltan para el funcionamiento completo del proyecto.
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env
require('dotenv').config();

// Variables críticas (la aplicación NO funciona sin estas)
const CRITICAL_VARS = [
  'PORT',
  'NODE_ENV',
  'JWT_SECRET'
];

// Variables importantes (funcionalidad limitada sin estas)
const IMPORTANT_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'REDIS_URL',
  'REDISCLOUD_URL',
  'FRONTEND_URL',
  'CORS_ORIGINS'
];

// Variables opcionales (características avanzadas)
const OPTIONAL_VARS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'AI_ENABLED',
  'AI_MODEL',
  'AI_TEMPERATURE',
  'AI_MAX_TOKENS',
  'AI_RAG_ENABLED',
  'BATCH_SIZE',
  'MAX_CONCURRENT_BATCHES',
  'BATCH_RETRY_ATTEMPTS',
  'BATCH_RETRY_DELAY',
  'REDIS_SENTINELS',
  'REDIS_MASTER_NAME',
  'REDIS_CLUSTER',
  'CACHE_COMPRESSION',
  'LOG_LEVEL',
  'ENABLE_FILE_LOGGING',
  'LOG_DIR',
  'ENABLE_ALERT_FILE',
  'MAX_FAILED_ATTEMPTS',
  'BLOCK_DURATION_MINUTES',
  'SUSPICIOUS_THRESHOLD',
  'CLEANUP_INTERVAL_MINUTES',
  'WEBHOOK_SECRET',
  'API_DOCS_URL',
  'WORKSPACE_ID',
  'TENANT_ID',
  'DEFAULT_WORKSPACE_ID',
  'DEFAULT_TENANT_ID',
  'DEFAULT_AGENT_ID',
  'DEFAULT_AGENT_EMAIL',
  'DEFAULT_VIEWER_EMAILS',
  'NODE_OPTIONS',
  'SOCKET_MAX_ROOMS_PER_SOCKET',
  'SOCKET_LOG_VERBOSE',
  'TWILIO_SID',
  'TWILIO_TOKEN',
  'TWILIO_FROM',
  'WHATSAPP_FROM',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'ADMIN_OVERRIDE_KEY'
];

function checkVariables() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 VERIFICANDO VARIABLES DE ENTORNO\n' });
  
  // Verificar variables críticas
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔴 VARIABLES CRÍTICAS:' });
  const missingCritical = [];
  CRITICAL_VARS.forEach(varName => {
    if (process.env[varName]) {
      logger.info('${varName} = ${varName.includes('SECRET') ? '***SET***' : process.env[varName]}', { category: 'AUTO_MIGRATED' });
    } else {
      logger.info('❌ ${varName} = NO CONFIGURADA', { category: 'AUTO_MIGRATED' });
      missingCritical.push(varName);
    }
  });
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🟡 VARIABLES IMPORTANTES:' });
  const missingImportant = [];
  IMPORTANT_VARS.forEach(varName => {
    if (process.env[varName]) {
      logger.info('${varName} = ${varName.includes('KEY') || varName.includes('TOKEN') || varName.includes('SECRET') ? '***SET***' : process.env[varName]}', { category: 'AUTO_MIGRATED' });
    } else {
      logger.info('${varName} = NO CONFIGURADA', { category: 'AUTO_MIGRATED' });
      missingImportant.push(varName);
    }
  });
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🟢 VARIABLES OPCIONALES:' });
  const missingOptional = [];
  OPTIONAL_VARS.forEach(varName => {
    if (process.env[varName]) {
      logger.info('${varName} = ${varName.includes('KEY') || varName.includes('TOKEN') || varName.includes('SECRET') ? '***SET***' : process.env[varName]}', { category: 'AUTO_MIGRATED' });
    } else {
      logger.info('� ${varName} = NO CONFIGURADA (opcional)', { category: 'AUTO_MIGRATED' });
      missingOptional.push(varName);
    }
  });
  
  // Resumen
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 RESUMEN:' });
  logger.info('� Críticas faltantes: ${missingCritical.length}', { category: 'AUTO_MIGRATED' });
  logger.info('� Importantes faltantes: ${missingImportant.length}', { category: 'AUTO_MIGRATED' });
  logger.info('� Opcionales faltantes: ${missingOptional.length}', { category: 'AUTO_MIGRATED' });
  
  // Recomendaciones
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 RECOMENDACIONES:' });
  
  if (missingCritical.length > 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ❌ PROBLEMA CRÍTICO: La aplicación NO puede funcionar sin las variables críticas.' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Variables faltantes:', missingCritical.join(', '));
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Solución: Configura estas variables en tu archivo .env' });
  }
  
  if (missingImportant.length > 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ⚠️  FUNCIONALIDAD LIMITADA: Sin las variables importantes, algunas características no funcionarán.' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Variables faltantes:', missingImportant.join(', '));
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Recomendación: Configura estas variables para funcionalidad completa' });
  }
  
  if (missingOptional.length > 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  🔵 CARACTERÍSTICAS AVANZADAS: Las variables opcionales habilitan características adicionales.' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Variables faltantes:', missingOptional.join(', '));
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '     Nota: Estas son opcionales y no afectan el funcionamiento básico' });
  }
  
  // Verificar si existe archivo .env
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Archivo .env encontrado' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ Archivo .env NO encontrado' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Solución: Copia env.example como .env y configura las variables' });
  }
  
  // Estado general
  if (missingCritical.length === 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ESTADO: La aplicación puede iniciar correctamente' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🚨 ESTADO: La aplicación NO puede iniciar - faltan variables críticas' });
  }
}

// Ejecutar verificación
checkVariables(); 