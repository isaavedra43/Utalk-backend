// Simular un webhook real de Twilio con media
const express = require('express');
const app = express();

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simular el webhook endpoint
app.post('/webhook/twilio', async (req, res) => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📨 Webhook recibido:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Headers:', req.headers });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Body:', req.body });
  
  try {
    // Simular el procesamiento del webhook
    const webhookData = req.body;
    
    // Verificar si es un mensaje de media
    const numMedia = parseInt(webhookData.NumMedia || '0');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Análisis del webhook:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- NumMedia:', numMedia });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- MediaUrl0:', webhookData.MediaUrl0 });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- MediaContentType0:', webhookData.MediaContentType0 });
    
    if (numMedia > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Es un mensaje de media' });
      
      // Simular el procesamiento de media
      const mediaUrls = [];
      const types = new Set();
      
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = webhookData[`MediaUrl${i}`];
        const mediaContentType = webhookData[`MediaContentType${i}`];
        
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
          
          // Determinar tipo
          let category = 'document';
          if (mediaContentType && mediaContentType.startsWith('image/')) category = 'image';
          else if (mediaContentType && mediaContentType.startsWith('video/')) category = 'video';
          else if (mediaContentType && mediaContentType.startsWith('audio/')) category = 'audio';
          
          types.add(category);
          logger.info('Media ${i}: ${category} - ${mediaUrl}', { category: 'AUTO_MIGRATED' });
        }
      }
      
      // Determinar tipo principal
      const primaryType = types.has('image') ? 'image' : 
                         types.has('video') ? 'video' : 
                         types.has('audio') ? 'audio' : 
                         types.has('document') ? 'document' : 'media';
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Resultado del procesamiento:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- URLs encontradas:', mediaUrls.length });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- URLs:', mediaUrls });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Tipo principal:', primaryType });
      
      // Simular respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Webhook procesado correctamente',
        media: {
          urls: mediaUrls,
          primaryType: primaryType,
          count: mediaUrls.length
        }
      });
      
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'ℹ️ No es un mensaje de media' });
      res.status(200).json({
        success: true,
        message: 'Webhook procesado (no es media)'
      });
    }
    
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint de prueba
app.get('/test', (req, res) => {
  res.json({
    message: 'Servidor de prueba funcionando',
    endpoints: {
      webhook: 'POST /webhook/twilio',
      test: 'GET /test'
    }
  });
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
  logger.info('� Servidor de prueba iniciado en puerto ${PORT}', { category: 'AUTO_MIGRATED' });
  logger.info('� Endpoints:', { category: 'AUTO_MIGRATED' });
  logger.info('- GET  http://localhost:${PORT}/test', { category: 'AUTO_MIGRATED' });
  logger.info('- POST http://localhost:${PORT}/webhook/twilio', { category: 'AUTO_MIGRATED' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Para probar, envía un POST a /webhook/twilio con:' });
  console.log(JSON.stringify({
    From: '+5214773790184',
    To: '+5214793176502',
    MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123',
    MediaContentType0: 'image/jpeg',
    ProfileName: 'Isra'
  }, null, 2));
}); 