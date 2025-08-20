// Script para debuggear exactamente qué datos llegan en el webhook
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/debug-webhook', (req, res) => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 WEBHOOK RECIBIDO:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Headers:', JSON.stringify(req.headers, null, 2));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📦 Body:', JSON.stringify(req.body, null, 2));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔗 Query params:', JSON.stringify(req.query, null, 2));
  
  // Verificar específicamente los campos de media
  const mediaFields = {};
  for (const [key, value] of Object.entries(req.body)) {
    if (key.startsWith('Media') || key === 'NumMedia') {
      mediaFields[key] = value;
    }
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📎 Campos de media encontrados:', mediaFields });
  
  // Verificar si hay datos de media
  const numMedia = parseInt(req.body.NumMedia || '0');
  logger.info('NumMedia: ${numMedia}', { category: 'AUTO_MIGRATED' });
  
  if (numMedia > 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Hay datos de media en el webhook' });
    for (let i = 0; i < numMedia; i++) {
      logger.info('Media ${i}:', { category: 'AUTO_MIGRATED' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `    URL: ${req.body[`MediaUrl${i}`]}` });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `    Content-Type: ${req.body[`MediaContentType${i}`]}` });
    }
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ No hay datos de media en el webhook' });
  }
  
  res.status(200).send('OK');
});

const PORT = 3002;
app.listen(PORT, () => {
  logger.info('Servidor de debug iniciado en puerto ${PORT}', { category: 'AUTO_MIGRATED' });
  logger.info('� Endpoint: http://localhost:${PORT}/debug-webhook', { category: 'AUTO_MIGRATED' });
  logger.info('\n🧪 Para probar:', { category: 'AUTO_MIGRATED' });
  logger.info('1. Cambia temporalmente la URL del webhook en Twilio a:', { category: 'AUTO_MIGRATED' });
  logger.info('http://localhost:${PORT}/debug-webhook', { category: 'AUTO_MIGRATED' });
  logger.info('2. Envía un mensaje con imagen', { category: 'AUTO_MIGRATED' });
  logger.info('3. Revisa los logs aquí', { category: 'AUTO_MIGRATED' });
  logger.info('4. Cambia la URL de vuelta a tu backend', { category: 'AUTO_MIGRATED' });
}); 