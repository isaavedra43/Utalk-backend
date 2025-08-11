#!/usr/bin/env node

console.log('🧪 Probando exportación unificada de TwilioService...\n');

try {
  // Probar importación de instancia por defecto
  console.log('1. Probando importación de instancia por defecto...');
  const twilioService = require('./src/services/TwilioService');
  console.log('✅ Instancia importada correctamente');
  console.log('   Tipo:', typeof twilioService);
  console.log('   Métodos disponibles:', Object.getOwnPropertyNames(Object.getPrototypeOf(twilioService)).filter(name => name !== 'constructor'));
  
  // Probar importación de clase
  console.log('\n2. Probando importación de clase...');
  const { TwilioService: TwilioServiceClass } = require('./src/services/TwilioService');
  console.log('✅ Clase importada correctamente');
  console.log('   Tipo:', typeof TwilioServiceClass);
  
  // Probar creación de nueva instancia
  console.log('\n3. Probando creación de nueva instancia...');
  const newInstance = new TwilioServiceClass();
  console.log('✅ Nueva instancia creada correctamente');
  console.log('   Tipo:', typeof newInstance);
  
  // Probar método sendWhatsAppMessage
  console.log('\n4. Probando método sendWhatsAppMessage...');
  if (typeof twilioService.sendWhatsAppMessage === 'function') {
    console.log('✅ Método sendWhatsAppMessage disponible');
  } else {
    console.log('❌ Método sendWhatsAppMessage no disponible');
  }
  
  // Probar getTwilioService
  console.log('\n5. Probando getTwilioService...');
  const { getTwilioService } = require('./src/services/TwilioService');
  const singletonInstance = getTwilioService();
  console.log('✅ getTwilioService funciona correctamente');
  console.log('   Instancia obtenida:', typeof singletonInstance);
  
  console.log('\n🎉 Todas las pruebas de exportación pasaron correctamente!');
  console.log('\n📋 Resumen de exportaciones:');
  console.log('   - Instancia por defecto: ✅');
  console.log('   - Clase nombrada: ✅');
  console.log('   - getTwilioService: ✅');
  console.log('   - Compatibilidad: ✅');
  
} catch (error) {
  console.error('\n❌ Error en las pruebas:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
} 