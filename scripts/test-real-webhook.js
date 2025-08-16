// Script para probar webhook real de Twilio
const express = require('express');
const app = express();

// Middleware para parsear JSON y form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simular el endpoint de webhook
app.post('/webhook/test', async (req, res) => {
  console.log('📨 Webhook de prueba recibido:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  try {
    // Simular el procesamiento del webhook
    const webhookData = req.body;
    
    // Verificar datos de media
    const numMedia = parseInt(webhookData.NumMedia || '0');
    console.log('🔍 Análisis del webhook:');
    console.log('- NumMedia:', numMedia);
    console.log('- MediaUrl0:', webhookData.MediaUrl0);
    console.log('- MediaContentType0:', webhookData.MediaContentType0);
    console.log('- MessageSid:', webhookData.MessageSid);
    console.log('- From:', webhookData.From);
    console.log('- To:', webhookData.To);
    
    if (numMedia > 0) {
      console.log('✅ Es un mensaje de media');
      
      // Simular processWebhookMedia
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
      
      // Simular creación de mensaje
      const messageData = {
        id: webhookData.MessageSid,
        conversationId: `conv_${webhookData.From}_${webhookData.To}`,
        content: webhookData.Body || '',
        type: primaryType,
        direction: 'inbound',
        status: 'received',
        senderIdentifier: webhookData.From,
        recipientIdentifier: webhookData.To,
        mediaUrl: mediaUrls[0] || null,
        timestamp: new Date(),
        metadata: {
          twilio: {
            sid: webhookData.MessageSid
          },
          media: {
            urls: mediaUrls,
            count: mediaUrls.length,
            primaryType: primaryType
          }
        }
      };
      
      console.log('📝 Mensaje creado:');
      console.log('- mediaUrl:', messageData.mediaUrl);
      console.log('- type:', messageData.type);
      console.log('- hasMedia:', !!messageData.mediaUrl);
      
      // Simular toJSON
      const baseUrl = process.env.BASE_URL || 'https://utalk-backend-production.up.railway.app';
      let processedMediaUrl = messageData.mediaUrl;
      
      if (messageData.mediaUrl && messageData.mediaUrl.includes('api.twilio.com')) {
        const urlParts = messageData.mediaUrl.split('/');
        const messageSid = urlParts[urlParts.length - 3];
        const mediaSid = urlParts[urlParts.length - 1];
        
        processedMediaUrl = `${baseUrl}/media/proxy-public?messageSid=${messageSid}&mediaSid=${mediaSid}`;
        
        console.log('🔄 URL convertida a pública:');
        console.log('- Original:', messageData.mediaUrl);
        console.log('- Pública:', processedMediaUrl);
      }
      
      const finalMessage = {
        ...messageData,
        mediaUrl: processedMediaUrl
      };
      
      console.log('🎯 Mensaje final:');
      console.log('- mediaUrl:', finalMessage.mediaUrl);
      console.log('- hasMedia:', !!finalMessage.mediaUrl);
      
      res.status(200).json({
        success: true,
        message: 'Webhook procesado correctamente',
        data: {
          message: finalMessage,
          media: {
            urls: mediaUrls,
            primaryType: primaryType,
            count: mediaUrls.length
          }
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

// Iniciar servidor
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de prueba iniciado en puerto ${PORT}`);
  console.log(`📝 Endpoint: POST http://localhost:${PORT}/webhook/test`);
  console.log('');
  console.log('🧪 Para probar, envía un POST con:');
  console.log(JSON.stringify({
    MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
    From: '+5214773790184',
    To: '+5214793176502',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123',
    MediaContentType0: 'image/jpeg',
    ProfileName: 'Isra'
  }, null, 2));
}); 