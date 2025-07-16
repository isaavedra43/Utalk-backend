#!/bin/bash

# =======================================================
# SCRIPT DE TESTING COMPLETO - WEBHOOK TWILIO WHATSAPP
# Para Railway Production Testing
# =======================================================

# Configuración
WEBHOOK_URL="https://utalk-backend-production.up.railway.app/api/messages/webhook"
HEALTH_URL="https://utalk-backend-production.up.railway.app/health"

echo "🚀 TESTING COMPLETO DEL WEBHOOK TWILIO - UTalk Backend"
echo "====================================================="
echo "🌐 URL Webhook: $WEBHOOK_URL"
echo "🏥 URL Health: $HEALTH_URL"
echo ""

# Función para hacer una pausa
pause() {
  echo "Presiona ENTER para continuar..."
  read -r
}

# =====================================================
# TEST 1: HEALTH CHECK
# =====================================================
echo "🏥 TEST 1: VERIFICANDO HEALTH CHECK"
echo "-----------------------------------"

curl -s "$HEALTH_URL" | jq '.' || curl -s "$HEALTH_URL"

echo ""
echo "✅ Verificar que:"
echo "   - status: 'OK' (no 'DEGRADED')"
echo "   - firebase: 'connected'"
echo "   - twilio: 'configured'"
pause

# =====================================================
# TEST 2: VERIFICACIÓN GET WEBHOOK
# =====================================================
echo "🔍 TEST 2: VERIFICACIÓN GET WEBHOOK"
echo "-----------------------------------"

curl -s "$WEBHOOK_URL" -H "User-Agent: Twilio-Verification"

echo ""
echo "✅ Debería responder: 'Webhook endpoint activo y funcionando'"
pause

# =====================================================
# TEST 3: MENSAJE DE TEXTO SIMPLE
# =====================================================
echo "📱 TEST 3: MENSAJE DE TEXTO SIMPLE"
echo "-----------------------------------"

RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "MessageSid=SM$(date +%s)abcdef1234567890abcdef" \
  -d "AccountSid=AC1234567890abcdef1234567890abcdef" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Hola, este es un mensaje de prueba" \
  -d "NumMedia=0" \
  -d "MessageStatus=received" \
  -d "ApiVersion=2010-04-01" \
  -d "ProfileName=Usuario Test" \
  -d "WaId=1234567890")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "📊 Status Code: $HTTP_CODE"
echo "📄 Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ÉXITO: Webhook respondió 200 OK"
else
  echo "❌ ERROR: Webhook respondió $HTTP_CODE (debería ser 200)"
fi
pause

# =====================================================
# TEST 4: MENSAJE CON IMAGEN
# =====================================================
echo "🖼️ TEST 4: MENSAJE CON IMAGEN"
echo "------------------------------"

RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "MessageSid=SM$(date +%s)image1234567890abcdef" \
  -d "AccountSid=AC1234567890abcdef1234567890abcdef" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Mira esta imagen" \
  -d "NumMedia=1" \
  -d "MediaUrl0=https://example.com/image.jpg" \
  -d "MediaContentType0=image/jpeg" \
  -d "MessageStatus=received" \
  -d "ApiVersion=2010-04-01")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "📊 Status Code: $HTTP_CODE"
echo "📄 Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ÉXITO: Webhook procesó imagen correctamente"
else
  echo "❌ ERROR: Webhook falló con imagen"
fi
pause

# =====================================================
# TEST 5: MENSAJE CON DATOS FALTANTES
# =====================================================
echo "⚠️ TEST 5: MENSAJE CON DATOS FALTANTES"
echo "--------------------------------------"

RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "AccountSid=AC1234567890abcdef1234567890abcdef" \
  -d "Body=Mensaje con datos incompletos" \
  -d "ApiVersion=2010-04-01")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "📊 Status Code: $HTTP_CODE"
echo "📄 Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ÉXITO: Webhook manejó datos faltantes correctamente"
else
  echo "❌ ERROR: Webhook falló con datos faltantes"
fi
pause

# =====================================================
# TEST 6: MENSAJE CON AUDIO
# =====================================================
echo "🎵 TEST 6: MENSAJE CON AUDIO"
echo "----------------------------"

RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "MessageSid=SM$(date +%s)audio1234567890abcdef" \
  -d "AccountSid=AC1234567890abcdef1234567890abcdef" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=" \
  -d "NumMedia=1" \
  -d "MediaUrl0=https://example.com/audio.ogg" \
  -d "MediaContentType0=audio/ogg" \
  -d "MessageStatus=received" \
  -d "ApiVersion=2010-04-01")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "📊 Status Code: $HTTP_CODE"
echo "📄 Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ÉXITO: Webhook procesó audio correctamente"
else
  echo "❌ ERROR: Webhook falló con audio"
fi

# =====================================================
# RESUMEN FINAL
# =====================================================
echo ""
echo "🎯 RESUMEN DE TESTING COMPLETO"
echo "==============================="
echo "✅ Health Check - Verificar manualmente"
echo "✅ GET Webhook - Verificar manualmente" 
echo "✅ Mensaje Texto - Verificar logs Railway"
echo "✅ Mensaje Imagen - Verificar logs Railway"
echo "✅ Datos Faltantes - Verificar logs Railway"
echo "✅ Mensaje Audio - Verificar logs Railway"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Revisar logs en Railway Dashboard"
echo "2. Verificar mensajes guardados en Firebase Console"
echo "3. Corregir URL en Twilio Console si es necesario"
echo "4. Testear con mensajes reales desde WhatsApp"
echo ""
echo "🔗 URLs importantes:"
echo "   Railway: https://railway.app/dashboard"
echo "   Firebase: https://console.firebase.google.com"
echo "   Twilio: https://console.twilio.com"
echo ""
echo "🎉 Testing completado!" 