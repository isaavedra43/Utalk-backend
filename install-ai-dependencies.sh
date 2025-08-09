#!/bin/bash

# Script para instalar dependencias de IA
echo "🔧 Instalando dependencias de IA..."

# Instalar dependencias principales
npm install openai@^4.28.0 @anthropic-ai/sdk@^0.18.0 @google/generative-ai@^0.21.0

# Verificar instalación
echo "✅ Verificando instalación..."
node -e "
try {
  require('openai');
  console.log('✅ OpenAI instalado correctamente');
} catch (e) {
  console.log('❌ Error con OpenAI:', e.message);
}

try {
  require('@anthropic-ai/sdk');
  console.log('✅ Anthropic SDK instalado correctamente');
} catch (e) {
  console.log('❌ Error con Anthropic:', e.message);
}

try {
  require('@google/generative-ai');
  console.log('✅ Google Generative AI instalado correctamente');
} catch (e) {
  console.log('❌ Error con Google AI:', e.message);
}
"

echo "🎉 Instalación completada!" 