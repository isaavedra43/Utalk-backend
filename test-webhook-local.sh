#!/bin/bash

# Script de testing para webhook de Twilio
# Simula un mensaje entrante de WhatsApp para debugging

echo "🔍 TESTING WEBHOOK LOCAL - UTalk Backend"
echo "========================================"

# URL del webhook (ajustar según entorno)
WEBHOOK_URL="https://utalk-backend-production.up.railway.app/api/messages/webhook"
# Para testing local usar: http://localhost:3000/api/messages/webhook

# Datos de prueba que simula Twilio
curl -X POST $WEBHOOK_URL \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "MessageSid=SM1234567890abcdef1234567890abcdef" \
  -d "AccountSid=AC1234567890abcdef1234567890abcdef" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Hola, este es un mensaje de prueba" \
  -d "NumMedia=0" \
  -d "MessageStatus=received" \
  -d "ApiVersion=2010-04-01" \
  -v

echo ""
echo "✅ Test completado. Revisar logs del servidor para ver el resultado."
echo "🔍 Si funciona local pero no en producción, problema está en Twilio Console URL." 