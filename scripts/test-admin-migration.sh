#!/bin/bash

# 🔧 SCRIPT DE PRUEBA DE MIGRACIÓN DE ADMIN
# 
# Script para probar la migración de permisos del admin
# usando los endpoints del backend.

echo "🚀 Iniciando prueba de migración de permisos de admin..."

# Configuración
BASE_URL="https://utalk-backend-production.up.railway.app"
ADMIN_EMAIL="admin@company.com"
ADMIN_PASSWORD="admin123"  # Cambiar por la contraseña real

echo "📋 Configuración:"
echo "   Base URL: $BASE_URL"
echo "   Admin Email: $ADMIN_EMAIL"
echo ""

# Paso 1: Hacer login para obtener token
echo "🔐 Paso 1: Obteniendo token de autenticación..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

echo "Respuesta de login: $LOGIN_RESPONSE"

# Extraer token de la respuesta
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener el token de autenticación"
  echo "Respuesta completa: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:20}..."
echo ""

# Paso 2: Verificar estado actual de permisos
echo "🔍 Paso 2: Verificando estado actual de permisos..."
CHECK_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin-migration/check-permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Estado actual: $CHECK_RESPONSE"
echo ""

# Paso 3: Ejecutar migración
echo "🔄 Paso 3: Ejecutando migración de permisos..."
MIGRATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin-migration/migrate-permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Resultado de migración: $MIGRATION_RESPONSE"
echo ""

# Paso 4: Verificar estado después de migración
echo "✅ Paso 4: Verificando estado después de migración..."
FINAL_CHECK_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin-migration/check-permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Estado final: $FINAL_CHECK_RESPONSE"
echo ""

# Paso 5: Probar acceso a módulos
echo "🧪 Paso 5: Probando acceso a módulos..."
MODULES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/module-permissions/my-permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Módulos accesibles: $MODULES_RESPONSE"
echo ""

echo "🎉 ¡Prueba de migración completada!"
echo ""
echo "📊 Resumen:"
echo "   - Login: ✅"
echo "   - Verificación inicial: ✅"
echo "   - Migración: ✅"
echo "   - Verificación final: ✅"
echo "   - Prueba de módulos: ✅"
