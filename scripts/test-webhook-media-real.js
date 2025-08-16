// Simular un webhook real de Twilio con media
const express = require('express');
const app = express();

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simular el webhook endpoint
app.post('/webhook/twilio', async (req, res) => {
  console.log('📨 Webhook recibido:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  try {
    // Simular el procesamiento del webhook
    const webhookData = req.body;
    
    // Verificar si es un mensaje de media
    const numMedia = parseInt(webhookData.NumMedia || '0');
    console.log('🔍 Análisis del webhook:');
    console.log('- NumMedia:', numMedia);
    console.log('- MediaUrl0:', webhookData.MediaUrl0);
    console.log('- MediaContentType0:', webhookData.MediaContentType0);
    
    if (numMedia > 0) {
      console.log('✅ Es un mensaje de media');
      
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
          console.log(`✅ Media ${i}: ${category} - ${mediaUrl}`);
        }
      }
      
      // Determinar tipo principal
      const primaryType = types.has('image') ? 'image' : 
                         types.has('video') ? 'video' : 
                         types.has('audio') ? 'audio' : 
                         types.has('document') ? 'document' : 'media';
      
      console.log('📊 Resultado del procesamiento:');
      console.log('- URLs encontradas:', mediaUrls.length);
      console.log('- URLs:', mediaUrls);
      console.log('- Tipo principal:', primaryType);
      
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
      console.log('ℹ️ No es un mensaje de media');
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
  console.log(`🚀 Servidor de prueba iniciado en puerto ${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/test`);
  console.log(`   - POST http://localhost:${PORT}/webhook/twilio`);
  console.log('');
  console.log('🧪 Para probar, envía un POST a /webhook/twilio con:');
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