#!/bin/bash

# 🚀 SCRIPT DE CONFIGURACIÓN PARA EXPORTAR LOGS DE RAILWAY
# 
# Este script te ayuda a configurar las variables de entorno necesarias
# para exportar logs de Railway sin usar la terminal de Railway

echo "🚀 Configurando exportación de logs de Railway..."
echo "=================================================="

# Verificar si ya existe .env
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp env.example .env
fi

echo ""
echo "📋 PASOS PARA CONFIGURAR LA EXPORTACIÓN:"
echo "========================================"
echo ""
echo "1️⃣ Obtén tu RAILWAY_TOKEN:"
echo "   - Ve a: https://railway.app/account/tokens"
echo "   - Crea un nuevo token"
echo "   - Copia el token generado"
echo ""
echo "2️⃣ Obtén tu RAILWAY_PROJECT_ID:"
echo "   - Ve a tu proyecto en Railway"
echo "   - En la URL verás algo como: https://railway.app/project/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
echo "   - El ID es: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
echo ""
echo "3️⃣ Obtén tu RAILWAY_SERVICE_ID:"
echo "   - En tu proyecto de Railway, ve a la pestaña 'Settings'"
echo "   - Busca 'Service ID' o revisa la URL del servicio"
echo "   - También puedes usar el nombre del servicio"
echo ""
echo "4️⃣ Configura las variables en tu archivo .env:"
echo ""
echo "   RAILWAY_TOKEN=tu_token_aqui"
echo "   RAILWAY_PROJECT_ID=tu_project_id_aqui"
echo "   RAILWAY_SERVICE_ID=tu_service_id_aqui"
echo ""

# Verificar si las variables ya están configuradas
if grep -q "RAILWAY_TOKEN" .env; then
    echo "✅ RAILWAY_TOKEN ya está configurado en .env"
else
    echo "❌ RAILWAY_TOKEN no está configurado en .env"
fi

if grep -q "RAILWAY_PROJECT_ID" .env; then
    echo "✅ RAILWAY_PROJECT_ID ya está configurado en .env"
else
    echo "❌ RAILWAY_PROJECT_ID no está configurado en .env"
fi

if grep -q "RAILWAY_SERVICE_ID" .env; then
    echo "✅ RAILWAY_SERVICE_ID ya está configurado en .env"
else
    echo "❌ RAILWAY_SERVICE_ID no está configurado en .env"
fi

echo ""
echo "🔧 COMANDOS PARA USAR UNA VEZ CONFIGURADO:"
echo "=========================================="
echo ""
echo "📊 Exportar logs en JSON (últimas 24 horas):"
echo "   node scripts/export-railway-logs.js"
echo ""
echo "📊 Exportar solo errores:"
echo "   node scripts/export-railway-logs.js --errors-only"
echo ""
echo "📊 Exportar en formato CSV:"
echo "   node scripts/export-railway-logs.js --csv"
echo ""
echo "📊 Exportar logs recientes:"
echo "   node scripts/export-railway-logs.js --recent"
echo ""
echo "🌐 Usar el endpoint de la API:"
echo "   GET /api/logs/export-railway?format=json&level=error&hours=24"
echo ""
echo "📋 Parámetros disponibles:"
echo "   - format: json o csv"
echo "   - level: error, warn, info, debug"
echo "   - hours: número de horas hacia atrás"
echo "   - maxLogs: máximo número de logs a exportar"
echo "   - startDate: fecha de inicio (ISO string)"
echo "   - endDate: fecha de fin (ISO string)"
echo ""

echo "🎉 ¡Configuración completada!"
echo "   Una vez que configures las variables, podrás exportar logs sin usar la terminal de Railway" 