# 🚀 Exportar Logs de Railway - Guía Completa

## 📋 Resumen

Esta guía te muestra **4 formas gratuitas** de exportar logs de Railway **sin usar la terminal de Railway** y **sin costos adicionales**.

## 🎯 Opciones Disponibles

### 1. 📊 **Script Node.js (Recomendado)**
- **Archivo**: `scripts/export-railway-logs.js`
- **Ventajas**: Más rápido, más opciones, programable
- **Uso**: Comando directo desde tu terminal local

### 2. 🌐 **Endpoint de API**
- **URL**: `GET /api/logs/export-railway`
- **Ventajas**: Integrado en tu aplicación, accesible desde cualquier lugar
- **Uso**: Navegador web o herramientas como Postman

### 3. 🔧 **Script de Configuración**
- **Archivo**: `scripts/setup-railway-export.sh`
- **Ventajas**: Te guía paso a paso en la configuración
- **Uso**: Ejecutar una vez para configurar todo

### 4. 📱 **Dashboard Web**
- **URL**: `/logs` (dashboard visual)
- **Ventajas**: Interfaz gráfica, filtros visuales
- **Uso**: Navegador web

## 🚀 Configuración Inicial

### Paso 1: Obtener Credenciales de Railway

#### 🔑 RAILWAY_TOKEN
1. Ve a: https://railway.app/account/tokens
2. Haz clic en "New Token"
3. Dale un nombre descriptivo (ej: "Log Exporter")
4. Copia el token generado

#### 🆔 RAILWAY_PROJECT_ID
1. Ve a tu proyecto en Railway
2. En la URL verás: `https://railway.app/project/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. El ID es: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

#### 🔧 RAILWAY_SERVICE_ID
1. En tu proyecto, ve a la pestaña "Settings"
2. Busca "Service ID" o usa el nombre del servicio
3. También puedes encontrarlo en la URL del servicio

### Paso 2: Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# Railway API Configuration
RAILWAY_TOKEN=tu_token_aqui
RAILWAY_PROJECT_ID=tu_project_id_aqui
RAILWAY_SERVICE_ID=tu_service_id_aqui
```

### Paso 3: Ejecutar Script de Configuración

```bash
chmod +x scripts/setup-railway-export.sh
./scripts/setup-railway-export.sh
```

## 📊 Métodos de Exportación

### 1. 🖥️ **Script Node.js**

#### Exportación Básica
```bash
# Exportar logs de las últimas 24 horas (JSON)
node scripts/export-railway-logs.js

# Exportar solo errores
node scripts/export-railway-logs.js --errors-only

# Exportar en formato CSV
node scripts/export-railway-logs.js --csv

# Exportar logs recientes
node scripts/export-railway-logs.js --recent
```

#### Opciones Avanzadas
```javascript
const RailwayLogExporter = require('./scripts/export-railway-logs');

const exporter = new RailwayLogExporter();

// Exportar logs específicos
await exporter.exportToJSON('./my-logs.json', {
  level: 'error',
  maxLogs: 5000,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

// Exportar solo errores críticos
await exporter.exportErrors('./critical-errors.json');

// Exportar logs de las últimas 48 horas
await exporter.exportRecentLogs(48, './recent-logs.json');
```

### 2. 🌐 **Endpoint de API**

#### URLs de Ejemplo
```bash
# Exportar logs básicos (JSON)
GET /api/logs/export-railway

# Exportar solo errores
GET /api/logs/export-railway?level=error

# Exportar en CSV
GET /api/logs/export-railway?format=csv

# Exportar logs de las últimas 48 horas
GET /api/logs/export-railway?hours=48

# Exportar con límite personalizado
GET /api/logs/export-railway?maxLogs=1000&level=warn

# Exportar por rango de fechas
GET /api/logs/export-railway?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

#### Parámetros Disponibles
- `format`: `json` o `csv` (por defecto: `json`)
- `level`: `error`, `warn`, `info`, `debug`
- `hours`: número de horas hacia atrás (por defecto: 24)
- `maxLogs`: máximo número de logs (por defecto: 1000)
- `startDate`: fecha de inicio (ISO string)
- `endDate`: fecha de fin (ISO string)

### 3. 📱 **Dashboard Web**

1. Ve a tu aplicación: `https://tu-app.railway.app/logs`
2. Usa los filtros visuales
3. Haz clic en "Export" para descargar

## 📋 Ejemplos Prácticos

### 🔍 **Debugging de Errores**
```bash
# Exportar solo errores de las últimas 24 horas
node scripts/export-railway-logs.js --errors-only

# O usar la API
curl "https://tu-app.railway.app/api/logs/export-railway?level=error&format=csv"
```

### 📈 **Análisis de Rendimiento**
```bash
# Exportar logs de las últimas 7 días
node scripts/export-railway-logs.js --hours=168

# O usar la API con rango específico
curl "https://tu-app.railway.app/api/logs/export-railway?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z"
```

### 🚨 **Monitoreo en Tiempo Real**
```javascript
// Script para monitoreo automático
const cron = require('node-cron');
const RailwayLogExporter = require('./scripts/export-railway-logs');

// Exportar errores cada hora
cron.schedule('0 * * * *', async () => {
  const exporter = new RailwayLogExporter();
  await exporter.exportErrors(`./logs/errors-${new Date().toISOString().split('T')[0]}.json`);
});
```

## 🔧 Solución de Problemas

### ❌ **Error: RAILWAY_TOKEN no configurado**
```bash
# Verificar que la variable esté en .env
cat .env | grep RAILWAY_TOKEN

# O configurar manualmente
export RAILWAY_TOKEN=tu_token_aqui
```

### ❌ **Error: Project ID no encontrado**
1. Verifica que el ID del proyecto sea correcto
2. Asegúrate de que el token tenga permisos para ese proyecto
3. Prueba con el nombre del proyecto en lugar del ID

### ❌ **Error: Rate limit excedido**
```javascript
// El script incluye pausas automáticas, pero puedes ajustarlas
const options = {
  maxLogs: 500, // Reducir el número de logs
  delay: 200    // Aumentar la pausa entre requests
};
```

### ❌ **Error: Archivo muy grande**
```bash
# Usar filtros para reducir el tamaño
node scripts/export-railway-logs.js --errors-only --hours=6

# O dividir por fechas
node scripts/export-railway-logs.js --startDate=2024-01-01T00:00:00Z --endDate=2024-01-01T23:59:59Z
```

## 📊 Formatos de Salida

### JSON
```json
{
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "totalLogs": 1250,
  "filters": {
    "level": "error",
    "hours": 24
  },
  "logs": [
    {
      "id": "log_123",
      "message": "Error en endpoint de autenticación",
      "level": "error",
      "timestamp": "2024-01-15T10:25:00.000Z",
      "metadata": {
        "userId": "user_456",
        "endpoint": "/api/auth/login"
      }
    }
  ]
}
```

### CSV
```csv
Timestamp,Level,Message,ID,Metadata
2024-01-15T10:25:00.000Z,error,Error en endpoint de autenticación,log_123,"{""userId"":""user_456"",""endpoint"":""/api/auth/login""}"
```

## 🎯 Casos de Uso Comunes

### 1. **Debugging Diario**
```bash
# Exportar errores del día
node scripts/export-railway-logs.js --errors-only --hours=24 --format=csv
```

### 2. **Reportes Semanales**
```bash
# Exportar logs de la semana
node scripts/export-railway-logs.js --hours=168 --format=json
```

### 3. **Análisis de Rendimiento**
```bash
# Exportar logs de rendimiento
node scripts/export-railway-logs.js --level=warn --hours=48
```

### 4. **Auditoría de Seguridad**
```bash
# Exportar logs de autenticación
node scripts/export-railway-logs.js --startDate=2024-01-01T00:00:00Z --endDate=2024-01-31T23:59:59Z
```

## 🔒 Seguridad

### ✅ **Buenas Prácticas**
- Usa tokens con permisos mínimos necesarios
- No compartas tokens en código público
- Rota tokens regularmente
- Usa variables de entorno para credenciales

### ❌ **Evitar**
- Hardcodear tokens en el código
- Usar tokens de producción en desarrollo
- Compartir tokens en repositorios públicos
- Usar tokens con permisos excesivos

## 📞 Soporte

Si tienes problemas:

1. **Verifica la configuración**: Ejecuta `./scripts/setup-railway-export.sh`
2. **Revisa los logs**: Los errores se muestran en la consola
3. **Verifica permisos**: Asegúrate de que el token tenga acceso al proyecto
4. **Contacta soporte**: Si el problema persiste, revisa la documentación de Railway

## 🎉 ¡Listo!

Ahora puedes exportar logs de Railway de forma gratuita y sin usar la terminal de Railway. ¡Elige el método que mejor se adapte a tus necesidades! 