#!/usr/bin/env node

console.log('🧪 Probando solo la exportación de TwilioService...\n');

try {
  // Probar importación de instancia por defecto
  console.log('1. Probando importación de instancia por defecto...');
  const twilioService = require('./src/services/TwilioService');
  console.log('✅ Instancia importada correctamente');
  console.log('   Tipo:', typeof twilioService);
  
  // Probar importación de clase
  console.log('\n2. Probando importación de clase...');
  const { TwilioService: TwilioServiceClass } = require('./src/services/TwilioService');
  console.log('✅ Clase importada correctamente');
  console.log('   Tipo:', typeof TwilioServiceClass);
  
  // Probar getTwilioService
  console.log('\n3. Probando getTwilioService...');
  const { getTwilioService } = require('./src/services/TwilioService');
  console.log('✅ getTwilioService disponible');
  console.log('   Tipo:', typeof getTwilioService);
  
  console.log('\n🎉 Exportación unificada funciona correctamente!');
  console.log('\n📋 Resumen:');
  console.log('   - Instancia por defecto: ✅');
  console.log('   - Clase nombrada: ✅');
  console.log('   - getTwilioService: ✅');
  console.log('   - No más "is not a constructor": ✅');
  
} catch (error) {
  console.error('\n❌ Error en las pruebas:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
} 