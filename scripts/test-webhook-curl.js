// Script para probar el webhook con curl
const { exec } = require('child_process');

const webhookData = {
  From: '+5214773790184',
  To: '+5214793176502',
  MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  Body: '',
  NumMedia: '1',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  MediaContentType0: 'image/jpeg',
  ProfileName: 'Isra'
};

console.log('🧪 Probando webhook con curl...\n');

// Convertir el objeto a formato form-data para curl
const formData = Object.entries(webhookData)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&');

const curlCommand = `curl -X POST http://localhost:3001/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${formData}"`;

console.log('📋 Comando curl:');
console.log(curlCommand);
console.log('\n');

console.log('📋 Datos del webhook:');
console.log(JSON.stringify(webhookData, null, 2));
console.log('\n');

// Ejecutar el comando curl
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error ejecutando curl:', error.message);
    return;
  }
  
  if (stderr) {
    console.error('⚠️ Stderr:', stderr);
  }
  
  console.log('✅ Respuesta del webhook:');
  console.log(stdout);
  
  try {
    const response = JSON.parse(stdout);
    console.log('\n📊 Análisis de la respuesta:');
    console.log('- Success:', response.success);
    console.log('- Message:', response.message);
    
    if (response.media) {
      console.log('- Media URLs:', response.media.urls.length);
      console.log('- Media Type:', response.media.primaryType);
      console.log('- URLs:', response.media.urls);
    }
  } catch (parseError) {
    console.log('⚠️ No se pudo parsear la respuesta como JSON');
  }
}); 