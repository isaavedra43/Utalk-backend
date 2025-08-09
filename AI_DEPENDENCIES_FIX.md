# 🔧 SOLUCIÓN PARA ERROR DE DEPENDENCIAS DE IA

## Problema Identificado

El error `Cannot find module 'openai'` se debe a que las dependencias de IA no están instaladas en el entorno de producción.

## Solución Implementada

### 1. **Dependencias Agregadas al package.json**

Se han agregado las siguientes dependencias:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.18.0",
    "@google/generative-ai": "^0.21.0",
    "openai": "^4.28.0"
  }
}
```

### 2. **Manejo de Errores Implementado**

Se ha modificado `src/ai/vendors/openai.js` para manejar el caso cuando el módulo no está disponible:

```javascript
let OpenAI;
try {
  OpenAI = require('openai');
} catch (error) {
  console.warn('⚠️ Módulo OpenAI no disponible. Usando stub temporal.');
  OpenAI = null;
}
```

### 3. **Modo Stub Temporal**

Cuando OpenAI no está disponible, el sistema:
- No falla completamente
- Devuelve respuestas stub
- Registra warnings en logs
- Permite que el resto del sistema funcione

## Instrucciones para Resolver

### Opción 1: Instalación Automática (Recomendada)

```bash
# Ejecutar el script de instalación
./install-ai-dependencies.sh
```

### Opción 2: Instalación Manual

```bash
# Instalar dependencias de IA
npm install openai@^4.28.0 @anthropic-ai/sdk@^0.18.0 @google/generative-ai@^0.21.0

# Verificar instalación
npm list openai @anthropic-ai/sdk @google/generative-ai
```

### Opción 3: Para Railway (Producción)

1. **Agregar al package.json** (ya hecho):
```json
{
  "dependencies": {
    "openai": "^4.28.0",
    "@anthropic-ai/sdk": "^0.18.0",
    "@google/generative-ai": "^0.21.0"
  }
}
```

2. **Redeploy en Railway**:
   - Railway detectará automáticamente las nuevas dependencias
   - Las instalará durante el build
   - El error se resolverá automáticamente

## Verificación

### 1. **Verificar Instalación Local**
```bash
node -e "console.log('OpenAI:', require('openai') ? '✅ OK' : '❌ Error')"
```

### 2. **Verificar en Railway**
- Revisar logs de build
- Verificar que no aparezca `Cannot find module 'openai'`
- Confirmar que el health check pase

### 3. **Test de Funcionalidad**
```bash
# Test del endpoint de salud de IA
curl -X GET "https://utalk-backend-production.up.railway.app/api/ai/health"
```

## Estado Actual

### ✅ **Implementado**
- Manejo de errores para módulos faltantes
- Modo stub temporal
- Dependencias agregadas al package.json
- Script de instalación automática

### ⏳ **Pendiente**
- Instalación en Railway (redeploy)
- Verificación de funcionalidad completa

## Logs Esperados

### Antes de la Solución
```
Error: Cannot find module 'openai'
```

### Después de la Solución
```
⚠️ Módulo OpenAI no disponible. Usando stub temporal.
✅ Cliente OpenAI inicializado (cuando esté disponible)
```

## Próximos Pasos

1. **Redeploy en Railway** para instalar dependencias
2. **Verificar logs** para confirmar instalación exitosa
3. **Test de endpoints** de IA
4. **Configurar variables de entorno** (OPENAI_API_KEY, etc.)

## Notas Importantes

- El sistema **NO fallará** si OpenAI no está disponible
- Se usará **modo stub** temporalmente
- Los **logs indicarán** el estado de disponibilidad
- El **resto del sistema** funcionará normalmente 