// Script para probar webhook real de Twilio
const express = require('express');
const app = express();

// Middleware para parsear JSON y form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simular el endpoint de webhook
app.post('/webhook/test', async (req, res) => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📨 Webhook de prueba recibido:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Headers:', req.headers });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Body:', req.body });
  
  try {
    // Simular el procesamiento del webhook
    const webhookData = req.body;
    
    // Verificar datos de media
    const numMedia = parseInt(webhookData.NumMedia || '0');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Análisis del webhook:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- NumMedia:', numMedia });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- MediaUrl0:', webhookData.MediaUrl0 });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- MediaContentType0:', webhookData.MediaContentType0 });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- MessageSid:', webhookData.MessageSid });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- From:', webhookData.From });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- To:', webhookData.To });
    
    if (numMedia > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Es un mensaje de media' });
      
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
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📝 Mensaje creado:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaUrl:', messageData.mediaUrl });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- type:', messageData.type });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- hasMedia:', !!messageData.mediaUrl });
      
      // Simular toJSON
      const baseUrl = process.env.BASE_URL || 'https://utalk-backend-production.up.railway.app';
      let processedMediaUrl = messageData.mediaUrl;
      
      if (messageData.mediaUrl && messageData.mediaUrl.includes('api.twilio.com')) {
        const urlParts = messageData.mediaUrl.split('/');
        const messageSid = urlParts[urlParts.length - 3];
        const mediaSid = urlParts[urlParts.length - 1];
        
        processedMediaUrl = `${baseUrl}/media/proxy-public?messageSid=${messageSid}&mediaSid=${mediaSid}`;
        
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔄 URL convertida a pública:' });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Original:', messageData.mediaUrl });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Pública:', processedMediaUrl });
      }
      
      const finalMessage = {
        ...messageData,
        mediaUrl: processedMediaUrl
      };
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎯 Mensaje final:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaUrl:', finalMessage.mediaUrl });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- hasMedia:', !!finalMessage.mediaUrl });
      
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
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'ℹ️ No es un mensaje de media' });
      res.status(200).json({
        success: true,
        message: 'Webhook procesado (no es media)'
      });
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error procesando webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Iniciar servidor
const PORT = 3002;
app.listen(PORT, () => {
  logger.info('� Servidor de prueba iniciado en puerto ${PORT}', { category: 'AUTO_MIGRATED' });
  logger.info('� Endpoint: POST http://localhost:${PORT}/webhook/test', { category: 'AUTO_MIGRATED' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Para probar, envía un POST con:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: JSON.stringify({
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