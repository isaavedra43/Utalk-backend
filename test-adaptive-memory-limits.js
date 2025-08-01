/**
 * 🧪 PRUEBA DE LÍMITES ADAPTATIVOS DEL MEMORY MANAGER
 * 
 * Este script valida que los límites adaptativos se calculen correctamente
 * según el hardware donde corre el proceso.
 */

const { memoryManager } = require('./src/utils/memoryManager');
const os = require('os');

console.log('🧠 PRUEBA DE LÍMITES ADAPTATIVOS DEL MEMORY MANAGER');
console.log('=' .repeat(60));

// Obtener información detallada de límites adaptativos
const adaptiveInfo = memoryManager.getAdaptiveLimitsInfo();

console.log('\n📊 INFORMACIÓN DEL HARDWARE:');
console.log(`- RAM Total: ${adaptiveInfo.hardware.totalMemoryGB} GB`);
console.log(`- RAM Disponible: ${adaptiveInfo.hardware.availableMemoryGB} GB`);
console.log(`- CPUs: ${adaptiveInfo.hardware.cpuCount}`);
console.log(`- Plataforma: ${adaptiveInfo.hardware.platform} (${adaptiveInfo.hardware.arch})`);

console.log('\n🔧 LÍMITES ADAPTATIVOS CALCULADOS:');
console.log(`- maxMapsPerInstance: ${adaptiveInfo.adaptiveLimits.maxMapsPerInstance}`);
console.log(`- maxEntriesPerMap: ${adaptiveInfo.adaptiveLimits.maxEntriesPerMap}`);
console.log(`- memoryWarningThreshold: ${adaptiveInfo.adaptiveLimits.memoryWarningThresholdGB} GB`);
console.log(`- memoryCriticalThreshold: ${adaptiveInfo.adaptiveLimits.memoryCriticalThresholdGB} GB`);

console.log('\n📝 EXPLICACIÓN DE CÁLCULOS:');
console.log(`- ${adaptiveInfo.explanation.maxMapsPerInstance}`);
console.log(`- ${adaptiveInfo.explanation.maxEntriesPerMap}`);
console.log(`- ${adaptiveInfo.explanation.memoryWarningThreshold}`);
console.log(`- ${adaptiveInfo.explanation.memoryCriticalThreshold}`);

console.log('\n✅ VALIDACIONES:');

// Validar que los límites sean razonables
const validations = [
  {
    name: 'maxMapsPerInstance >= 10',
    condition: adaptiveInfo.adaptiveLimits.maxMapsPerInstance >= 10,
    value: adaptiveInfo.adaptiveLimits.maxMapsPerInstance
  },
  {
    name: 'maxEntriesPerMap >= 1000',
    condition: adaptiveInfo.adaptiveLimits.maxEntriesPerMap >= 1000,
    value: adaptiveInfo.adaptiveLimits.maxEntriesPerMap
  },
  {
    name: 'memoryWarningThreshold < memoryCriticalThreshold',
    condition: adaptiveInfo.adaptiveLimits.memoryWarningThreshold < adaptiveInfo.adaptiveLimits.memoryCriticalThreshold,
    value: `${adaptiveInfo.adaptiveLimits.memoryWarningThresholdGB} GB < ${adaptiveInfo.adaptiveLimits.memoryCriticalThresholdGB} GB`
  },
  {
    name: 'memoryWarningThreshold <= 70% RAM total',
    condition: adaptiveInfo.adaptiveLimits.memoryWarningThreshold <= (os.totalmem() * 0.7),
    value: `${adaptiveInfo.adaptiveLimits.memoryWarningThresholdGB} GB <= ${(os.totalmem() * 0.7 / (1024 * 1024 * 1024)).toFixed(2)} GB`
  },
  {
    name: 'memoryCriticalThreshold <= 90% RAM total',
    condition: adaptiveInfo.adaptiveLimits.memoryCriticalThreshold <= (os.totalmem() * 0.9),
    value: `${adaptiveInfo.adaptiveLimits.memoryCriticalThresholdGB} GB <= ${(os.totalmem() * 0.9 / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
];

let allValid = true;
validations.forEach(validation => {
  const status = validation.condition ? '✅' : '❌';
  console.log(`${status} ${validation.name}: ${validation.value}`);
  if (!validation.condition) allValid = false;
});

console.log('\n📈 ESTADÍSTICAS COMPLETAS:');
const stats = memoryManager.getStats();
console.log(JSON.stringify(stats, null, 2));

console.log('\n' + '=' .repeat(60));
if (allValid) {
  console.log('🎉 TODAS LAS VALIDACIONES PASARON - LÍMITES ADAPTATIVOS FUNCIONANDO CORRECTAMENTE');
} else {
  console.log('⚠️  ALGUNAS VALIDACIONES FALLARON - REVISAR CÁLCULOS');
}

console.log('\n💡 RECOMENDACIONES:');
console.log('- Monitorear el uso real de memoria en producción');
console.log('- Ajustar límites manualmente si es necesario para casos específicos');
console.log('- Revisar logs de memoria para detectar patrones de uso');
console.log('- Considerar escalar horizontalmente si se alcanzan límites frecuentemente'); 