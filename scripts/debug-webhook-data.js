// Script para debuggear exactamente qué datos llegan en el webhook
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/debug-webhook', (req, res) => {
  console.log('🔍 WEBHOOK RECIBIDO:');
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  console.log('🔗 Query params:', JSON.stringify(req.query, null, 2));
  
  // Verificar específicamente los campos de media
  const mediaFields = {};
  for (const [key, value] of Object.entries(req.body)) {
    if (key.startsWith('Media') || key === 'NumMedia') {
      mediaFields[key] = value;
    }
  }
  
  console.log('📎 Campos de media encontrados:', mediaFields);
  
  // Verificar si hay datos de media
  const numMedia = parseInt(req.body.NumMedia || '0');
  console.log(`📊 NumMedia: ${numMedia}`);
  
  if (numMedia > 0) {
    console.log('✅ Hay datos de media en el webhook');
    for (let i = 0; i < numMedia; i++) {
      console.log(`  Media ${i}:`);
      console.log(`    URL: ${req.body[`MediaUrl${i}`]}`);
      console.log(`    Content-Type: ${req.body[`MediaContentType${i}`]}`);
    }
  } else {
    console.log('❌ No hay datos de media en el webhook');
  }
  
  res.status(200).send('OK');
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🔍 Servidor de debug iniciado en puerto ${PORT}`);
  console.log(`📝 Endpoint: http://localhost:${PORT}/debug-webhook`);
  console.log(`\n🧪 Para probar:`);
  console.log(`1. Cambia temporalmente la URL del webhook en Twilio a:`);
  console.log(`   http://localhost:${PORT}/debug-webhook`);
  console.log(`2. Envía un mensaje con imagen`);
  console.log(`3. Revisa los logs aquí`);
  console.log(`4. Cambia la URL de vuelta a tu backend`);
}); 