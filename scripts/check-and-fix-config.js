/**
 * 🔧 SCRIPT PARA VERIFICAR Y CONFIGURAR VARIABLES DE ENTORNO CRÍTICAS
 * 
 * Este script verifica que todas las variables de entorno necesarias estén configuradas
 * y proporciona instrucciones para configurarlas correctamente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 VERIFICANDO CONFIGURACIÓN DE VARIABLES DE ENTORNO...');
console.log('=' .repeat(60));

// Variables críticas requeridas
const CRITICAL_VARS = {
  // Firebase (CRÍTICO para subida de archivos)
  FIREBASE_PROJECT_ID: {
    description: 'ID del proyecto de Firebase',
    example: 'tu-proyecto-firebase',
    critical: true
  },
  FIREBASE_STORAGE_BUCKET: {
    description: 'Bucket de Firebase Storage',
    example: 'tu-proyecto-firebase.appspot.com',
    critical: true
  },
  FIREBASE_SERVICE_ACCOUNT_KEY: {
    description: 'Clave de cuenta de servicio de Firebase (JSON)',
    example: '{"type":"service_account",...}',
    critical: true
  },
  
  // Twilio (CRÍTICO para mensajería)
  TWILIO_ACCOUNT_SID: {
    description: 'Account SID de Twilio',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    critical: true
  },
  TWILIO_AUTH_TOKEN: {
    description: 'Auth Token de Twilio',
    example: 'tu-auth-token-aqui',
    critical: true
  },
  TWILIO_WHATSAPP_NUMBER: {
    description: 'Número de WhatsApp de Twilio',
    example: 'whatsapp:+1234567890',
    critical: true
  },
  
  // JWT (CRÍTICO para autenticación)
  JWT_SECRET: {
    description: 'Secreto para firmar JWT',
    example: 'tu-super-secret-jwt-key-aqui',
    critical: true
  },
  
  // Redis (IMPORTANTE para funcionalidad completa)
  REDIS_URL: {
    description: 'URL de conexión a Redis',
    example: 'redis://localhost:6379',
    critical: false
  },
  REDISCLOUD_URL: {
    description: 'URL de Redis Cloud (alternativa)',
    example: 'redis://tu-rediscloud-url',
    critical: false
  }
};

// Verificar variables de entorno
function checkEnvironmentVariables() {
  const missing = [];
  const present = [];
  const criticalMissing = [];
  
  console.log('📋 VERIFICANDO VARIABLES DE ENTORNO...\n');
  
  for (const [varName, config] of Object.entries(CRITICAL_VARS)) {
    const value = process.env[varName];
    
    if (value) {
      present.push({ name: varName, config });
      console.log(`✅ ${varName}: ${config.description}`);
    } else {
      missing.push({ name: varName, config });
      if (config.critical) {
        criticalMissing.push({ name: varName, config });
      }
      console.log(`❌ ${varName}: ${config.description} - FALTANTE`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN DE VERIFICACIÓN:');
  console.log(`✅ Variables configuradas: ${present.length}`);
  console.log(`❌ Variables faltantes: ${missing.length}`);
  console.log(`🚨 Variables críticas faltantes: ${criticalMissing.length}`);
  
  return { missing, present, criticalMissing };
}

// Generar archivo .env de ejemplo
function generateEnvExample() {
  const envExamplePath = path.join(__dirname, '../.env.example');
  const envPath = path.join(__dirname, '../.env');
  
  console.log('\n📝 GENERANDO ARCHIVO .env DE EJEMPLO...');
  
  let envContent = `# =============================================================================
# UTalk Backend Environment Variables - CONFIGURACIÓN CRÍTICA
# =============================================================================
# 
# 🔴 IMPORTANTE: Configura estas variables para que funcione la subida de archivos
# =============================================================================

# 🔴 VARIABLES CRÍTICAS (REQUERIDAS PARA FUNCIONAR)
# =============================================================================

# Puerto del servidor (Railway lo inyecta automáticamente)
PORT=3001

# Entorno de ejecución
NODE_ENV=production

# Secreto para JWT (REQUERIDO)
JWT_SECRET=tu-super-secret-jwt-key-aqui

# =============================================================================
# 🔥 FIREBASE CONFIGURACIÓN (CRÍTICO PARA SUBIDA DE ARCHIVOS)
# =============================================================================

# ID del proyecto de Firebase
FIREBASE_PROJECT_ID=tu-proyecto-firebase

# Bucket de Firebase Storage (CRÍTICO - debe existir)
FIREBASE_STORAGE_BUCKET=tu-proyecto-firebase.appspot.com

# Clave de cuenta de servicio de Firebase (JSON completo)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"tu-proyecto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-xxx@tu-proyecto.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40tu-proyecto.iam.gserviceaccount.com"}

# =============================================================================
# 📱 TWILIO CONFIGURACIÓN (CRÍTICO PARA MENSAJERÍA)
# =============================================================================

# Account SID de Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Auth Token de Twilio
TWILIO_AUTH_TOKEN=tu-twilio-auth-token-aqui

# Número de WhatsApp de Twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# =============================================================================
# 🗄️ REDIS Y CACHÉ (IMPORTANTE PARA FUNCIONALIDAD COMPLETA)
# =============================================================================

# URL de conexión a Redis
REDIS_URL=redis://localhost:6379

# URL de Redis Cloud (alternativa)
REDISCLOUD_URL=redis://tu-rediscloud-url

# =============================================================================
# 🔗 FRONTEND Y CORS
# =============================================================================

# URLs del frontend permitidas
FRONTEND_URL=https://tu-frontend.com,https://www.tu-frontend.com

# Orígenes CORS permitidos
CORS_ORIGINS=https://tu-frontend.com,https://www.tu-frontend.com

# =============================================================================
# 🟢 VARIABLES OPCIONALES (CARACTERÍSTICAS AVANZADAS)
# =============================================================================

# Habilitar IA globalmente
AI_ENABLED=false

# Modelo de IA por defecto
AI_MODEL=gpt-4o-mini

# Temperatura del modelo (0-1)
AI_TEMPERATURE=0.3

# Máximo de tokens de respuesta
AI_MAX_TOKENS=150

# Habilitar RAG (Retrieval-Augmented Generation)
AI_RAG_ENABLED=false

# OpenAI API Key (opcional)
OPENAI_API_KEY=tu_openai_api_key_aqui

# =============================================================================
# 📝 LOGGING Y MONITOREO
# =============================================================================

# Nivel de logging
LOG_LEVEL=info

# Habilitar logging a archivo
ENABLE_FILE_LOGGING=true

# Directorio de logs
LOG_DIR=./logs

# =============================================================================
# 🚫 SEGURIDAD AVANZADA
# =============================================================================

# Máximo de intentos fallidos
MAX_FAILED_ATTEMPTS=5

# Duración de bloqueo en minutos
BLOCK_DURATION_MINUTES=30

# Umbral de actividad sospechosa
SUSPICIOUS_THRESHOLD=10

# Intervalo de limpieza en minutos
CLEANUP_INTERVAL_MINUTES=60

# =============================================================================
# 🔧 CONFIGURACIÓN DEL SERVIDOR
# =============================================================================

# Opciones de Node.js
NODE_OPTIONS=--max-old-space-size=2048

# =============================================================================
# 📡 WEBSOCKET Y SOCKETS
# =============================================================================

# Máximo de salas por socket
SOCKET_MAX_ROOMS_PER_SOCKET=50

# Log verbose de sockets
SOCKET_LOG_VERBOSE=false

# =============================================================================
# 📋 INSTRUCCIONES DE CONFIGURACIÓN
# =============================================================================
#
# 1. 🔥 FIREBASE: Ve a https://console.firebase.google.com
#    - Crea un proyecto o usa uno existente
#    - Ve a Storage y crea un bucket
#    - Ve a Project Settings > Service Accounts
#    - Genera una nueva clave privada (JSON)
#    - Copia el contenido JSON a FIREBASE_SERVICE_ACCOUNT_KEY
#
# 2. 📱 TWILIO: Ve a https://console.twilio.com
#    - Obtén tu Account SID y Auth Token
#    - Configura un número de WhatsApp
#
# 3. 🗄️ REDIS: Usa Redis Cloud o instala Redis localmente
#    - Para desarrollo: redis://localhost:6379
#    - Para producción: Usa Redis Cloud
#
# 4. 🔐 JWT_SECRET: Genera una clave secreta fuerte
#    - Usa: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
#
# =============================================================================
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Archivo .env generado: ${envPath}`);
    console.log('📝 Edita el archivo .env con tus valores reales');
  } catch (error) {
    console.error(`❌ Error generando archivo .env: ${error.message}`);
  }
}

// Mostrar instrucciones específicas
function showInstructions(criticalMissing) {
  if (criticalMissing.length === 0) {
    console.log('\n🎉 ¡TODAS LAS VARIABLES CRÍTICAS ESTÁN CONFIGURADAS!');
    console.log('✅ El sistema debería funcionar correctamente');
    return;
  }
  
  console.log('\n🚨 VARIABLES CRÍTICAS FALTANTES:');
  console.log('=' .repeat(60));
  
  criticalMissing.forEach(({ name, config }) => {
    console.log(`\n❌ ${name}: ${config.description}`);
    console.log(`   Ejemplo: ${config.example}`);
  });
  
  console.log('\n🔧 INSTRUCCIONES PARA CONFIGURAR:');
  console.log('=' .repeat(60));
  
  console.log('\n1. 🔥 FIREBASE (CRÍTICO PARA SUBIDA DE ARCHIVOS):');
  console.log('   - Ve a https://console.firebase.google.com');
  console.log('   - Crea un proyecto o usa uno existente');
  console.log('   - Ve a Storage y crea un bucket');
  console.log('   - Ve a Project Settings > Service Accounts');
  console.log('   - Genera una nueva clave privada (JSON)');
  console.log('   - Copia el contenido JSON a FIREBASE_SERVICE_ACCOUNT_KEY');
  
  console.log('\n2. 📱 TWILIO (CRÍTICO PARA MENSAJERÍA):');
  console.log('   - Ve a https://console.twilio.com');
  console.log('   - Obtén tu Account SID y Auth Token');
  console.log('   - Configura un número de WhatsApp');
  
  console.log('\n3. 🔐 JWT_SECRET (CRÍTICO PARA AUTENTICACIÓN):');
  console.log('   - Genera una clave secreta fuerte:');
  console.log('   - node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  
  console.log('\n4. 🗄️ REDIS (IMPORTANTE PARA FUNCIONALIDAD COMPLETA):');
  console.log('   - Para desarrollo: redis://localhost:6379');
  console.log('   - Para producción: Usa Redis Cloud');
  
  console.log('\n📝 DESPUÉS DE CONFIGURAR:');
  console.log('   - Reinicia el servidor');
  console.log('   - Ejecuta este script nuevamente para verificar');
}

// Función principal
function main() {
  console.log('🔧 VERIFICACIÓN DE CONFIGURACIÓN DE VARIABLES DE ENTORNO');
  console.log('=' .repeat(60));
  
  const { missing, present, criticalMissing } = checkEnvironmentVariables();
  
  if (criticalMissing.length > 0) {
    console.log('\n🚨 PROBLEMAS CRÍTICOS DETECTADOS:');
    console.log('=' .repeat(60));
    console.log('❌ Las siguientes variables críticas están faltantes:');
    
    criticalMissing.forEach(({ name }) => {
      console.log(`   - ${name}`);
    });
    
    console.log('\n⚠️ SIN ESTAS VARIABLES, EL SISTEMA NO FUNCIONARÁ CORRECTAMENTE');
    console.log('   - La subida de archivos fallará');
    console.log('   - La mensajería no funcionará');
    console.log('   - La autenticación puede fallar');
    
    showInstructions(criticalMissing);
    generateEnvExample();
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Configura las variables críticas faltantes');
    console.log('2. Reinicia el servidor');
    console.log('3. Ejecuta este script nuevamente para verificar');
    
    process.exit(1);
  } else {
    console.log('\n🎉 ¡CONFIGURACIÓN COMPLETA!');
    console.log('✅ Todas las variables críticas están configuradas');
    console.log('✅ El sistema debería funcionar correctamente');
    
    if (missing.length > 0) {
      console.log('\n📝 Variables opcionales faltantes:');
      missing.forEach(({ name, config }) => {
        console.log(`   - ${name}: ${config.description}`);
      });
      console.log('\n💡 Estas variables son opcionales pero mejoran la funcionalidad');
    }
  }
}

// Ejecutar script
if (require.main === module) {
  main();
}

module.exports = { checkEnvironmentVariables, generateEnvExample, showInstructions }; 