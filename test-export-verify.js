console.log('🔍 Verificando export de EnterpriseSocketManager...');

try {
  const x = require('./src/socket/enterpriseSocketManager');
  console.log('✅ Módulo cargado correctamente');
  console.log('📋 Keys:', Object.keys(x));
  console.log('🔧 EnterpriseSocketManager type:', typeof x.EnterpriseSocketManager);
  console.log('🔧 Es función:', typeof x.EnterpriseSocketManager === 'function');
  
  if (x.EnterpriseSocketManager) {
    console.log('✅ EnterpriseSocketManager disponible');
  } else {
    console.log('❌ EnterpriseSocketManager no disponible');
  }
} catch (error) {
  console.error('❌ Error cargando módulo:', error.message);
} 