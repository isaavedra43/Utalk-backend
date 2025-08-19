# 🚀 SISTEMA DE COLAS PARA CAMPAÑAS MASIVAS

## 📋 RESUMEN

El sistema de colas para campañas masivas permite el envío escalable y confiable de campañas de WhatsApp a miles de contactos simultáneamente, con control total sobre el proceso y monitoreo en tiempo real.

---

## 🎯 CARACTERÍSTICAS PRINCIPALES

### ✅ **Procesamiento Asíncrono**
- Envío de campañas en segundo plano
- No bloquea la aplicación principal
- Manejo de errores robusto

### ✅ **Rate Limiting Inteligente**
- Respeta límites de Twilio (10 msg/seg)
- Procesamiento en lotes optimizados
- Delays automáticos entre lotes

### ✅ **Control Total de Campañas**
- Pausar/Reanudar campañas en tiempo real
- Detener campañas inmediatamente
- Monitoreo de progreso en vivo

### ✅ **Circuit Breaker**
- Protección automática contra fallos de Twilio
- Recuperación automática
- Prevención de cascadas de errores

### ✅ **Métricas en Tiempo Real**
- Progreso de envío
- Tasa de éxito/fallo
- Tiempo de procesamiento
- Estado de colas

---

## 🛠️ ARQUITECTURA

### **Componentes Principales**

1. **CampaignQueueService** - Servicio principal de colas
2. **Bull Queue** - Sistema de colas con Redis
3. **Workers** - Procesadores de mensajes
4. **Circuit Breaker** - Protección contra fallos
5. **Métricas** - Monitoreo en tiempo real

### **Flujo de Procesamiento**

```
1. Crear Campaña → 2. Encolar → 3. Procesar Lotes → 4. Enviar Mensajes → 5. Registrar Resultados
```

---

## 📡 ENDPOINTS DISPONIBLES

### **Envío de Campañas**

#### `POST /api/campaigns/:campaignId/start`
Encola una campaña para envío asíncrono.

**Respuesta:**
```json
{
  "message": "Campaña encolada exitosamente para envío",
  "jobId": "campaign_123_1703123456789",
  "estimatedContacts": 1000,
  "estimatedTime": 100000,
  "campaign": { ... }
}
```

### **Control de Campañas**

#### `GET /api/campaigns/:campaignId/queue-status`
Obtiene el estado actual de una campaña en cola.

**Respuesta:**
```json
{
  "success": true,
  "status": {
    "campaignId": "campaign_123",
    "status": "sending",
    "totalJobs": 5,
    "activeJobs": 2,
    "waitingJobs": 1,
    "completedJobs": 1,
    "failedJobs": 1,
    "progress": {
      "processed": 500,
      "total": 1000,
      "success": 480,
      "failed": 20,
      "percentage": 50
    },
    "metrics": { ... }
  }
}
```

#### `POST /api/campaigns/:campaignId/queue-pause`
Pausa una campaña en proceso.

#### `POST /api/campaigns/:campaignId/queue-resume`
Reanuda una campaña pausada.

#### `POST /api/campaigns/:campaignId/queue-stop`
Detiene una campaña inmediatamente.

### **Métricas del Sistema**

#### `GET /api/dashboard/campaign-queue-metrics`
Obtiene métricas generales del sistema de colas.

**Respuesta:**
```json
{
  "success": true,
  "metrics": {
    "campaignQueue": {
      "waiting": 2,
      "active": 1,
      "completed": 10,
      "failed": 0,
      "delayed": 0
    },
    "processingQueue": {
      "waiting": 50,
      "active": 10,
      "completed": 1000,
      "failed": 5,
      "delayed": 0
    },
    "system": {
      "campaignsProcessed": 12,
      "messagesSent": 5000,
      "messagesFailed": 25,
      "averageProcessingTime": 1500,
      "activeWorkers": 10,
      "circuitBreakerStatus": "closed"
    }
  }
}
```

---

## ⚙️ CONFIGURACIÓN

### **Variables de Entorno**

```bash
# Redis (requerido)
REDIS_URL=redis://localhost:6379
REDISCLOUD_URL=redis://your-rediscloud-url

# Twilio (requerido)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Configuración de colas (opcional)
BATCH_SIZE=500
MAX_CONCURRENT_BATCHES=10
BATCH_RETRY_ATTEMPTS=3
BATCH_RETRY_DELAY=1000
```

### **Límites de Twilio**

```javascript
const twilioLimits = {
  messagesPerSecond: 10,    // Máximo 10 mensajes por segundo
  messagesPerMinute: 600,   // Máximo 600 mensajes por minuto
  messagesPerHour: 36000,   // Máximo 36,000 mensajes por hora
  maxConcurrent: 50         // Máximo 50 workers concurrentes
};
```

---

## 🔄 FLUJO DE TRABAJO

### **1. Crear Campaña**
```javascript
const campaign = await Campaign.create({
  name: "Promoción Black Friday",
  message: "¡Oferta especial! 50% de descuento",
  contacts: ["contact1", "contact2", "contact3"],
  scheduledAt: "2024-11-29T10:00:00Z"
});
```

### **2. Encolar Campaña**
```javascript
const result = await campaignQueueService.queueCampaign(campaign.id, {
  userId: req.user.id,
  priority: 'normal'
});
```

### **3. Monitorear Progreso**
```javascript
const status = await campaignQueueService.getCampaignStatus(campaign.id);
console.log(`Progreso: ${status.progress.percentage}%`);
```

### **4. Controlar Campaña**
```javascript
// Pausar
await campaignQueueService.pauseCampaign(campaign.id);

// Reanudar
await campaignQueueService.resumeCampaign(campaign.id);

// Detener
await campaignQueueService.stopCampaign(campaign.id);
```

---

## 📊 MÉTRICAS Y MONITOREO

### **Métricas por Campaña**
- Total de contactos objetivo
- Mensajes procesados
- Mensajes enviados exitosamente
- Mensajes fallidos
- Tiempo de procesamiento
- Tasa de éxito

### **Métricas del Sistema**
- Campañas procesadas
- Mensajes totales enviados
- Tasa de fallos
- Tiempo promedio de procesamiento
- Workers activos
- Estado del circuit breaker

### **Alertas Automáticas**
- Circuit breaker abierto
- Tasa de fallos alta
- Tiempo de procesamiento excesivo
- Colas saturadas

---

## 🚨 MANEJO DE ERRORES

### **Circuit Breaker**
- Se abre automáticamente después de 10 fallos consecutivos
- Se cierra automáticamente después de 1 minuto
- Previene cascadas de errores

### **Retry Logic**
- Reintentos automáticos con backoff exponencial
- Máximo 3 reintentos por campaña
- Máximo 5 reintentos por mensaje

### **Fallback Strategies**
- Almacenamiento en Redis para persistencia
- Métricas en memoria si Redis falla
- Logging detallado para debugging

---

## 🔧 MANTENIMIENTO

### **Limpieza Automática**
- Jobs completados: eliminados después de 100
- Jobs fallidos: eliminados después de 50
- Progreso de campañas: expira después de 24 horas
- Resultados de mensajes: expiran después de 7 días

### **Monitoreo de Recursos**
- Uso de memoria Redis
- Tiempo de respuesta de workers
- Latencia de Twilio API
- Estado de conexiones

---

## 🚀 ESCALABILIDAD

### **Capacidades Actuales**
- ✅ Hasta 10,000 contactos por campaña
- ✅ Múltiples campañas simultáneas
- ✅ Rate limiting automático
- ✅ Circuit breaker protection
- ✅ Monitoreo en tiempo real

### **Optimizaciones Futuras**
- Sharding de colas por región
- Workers distribuidos
- Cache inteligente
- Compresión de datos
- Load balancing automático

---

## 📝 EJEMPLOS DE USO

### **Campaña Simple**
```javascript
// 1. Crear campaña
const campaign = await Campaign.create({
  name: "Test Campaign",
  message: "Hola, esto es una prueba",
  contacts: contactIds
});

// 2. Enviar
const result = await fetch(`/api/campaigns/${campaign.id}/start`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Monitorear
setInterval(async () => {
  const status = await fetch(`/api/campaigns/${campaign.id}/queue-status`);
  console.log(await status.json());
}, 5000);
```

### **Campaña Programada**
```javascript
const campaign = await Campaign.create({
  name: "Campaña Programada",
  message: "Mensaje programado",
  contacts: contactIds,
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Mañana
});

// Se enviará automáticamente a la hora programada
```

### **Control en Tiempo Real**
```javascript
// Pausar campaña
await fetch(`/api/campaigns/${campaignId}/queue-pause`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Reanudar después de 1 hora
setTimeout(async () => {
  await fetch(`/api/campaigns/${campaignId}/queue-resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}, 60 * 60 * 1000);
```

---

## 🔍 TROUBLESHOOTING

### **Problemas Comunes**

#### **Campaña no se envía**
1. Verificar que Redis esté funcionando
2. Revisar logs de inicialización
3. Verificar permisos de usuario
4. Comprobar estado de Twilio

#### **Mensajes fallan**
1. Verificar circuit breaker
2. Revisar rate limits de Twilio
3. Comprobar formato de números
4. Verificar créditos de Twilio

#### **Progreso lento**
1. Verificar workers activos
2. Revisar rate limiting
3. Comprobar carga del sistema
4. Verificar conexión Redis

### **Logs Importantes**
```bash
# Inicialización
✅ Servicios de colas inicializados

# Procesamiento
🔄 Procesando campaña campaign_123
📦 Procesando lote 1/10

# Completado
✅ Campaña procesada exitosamente

# Errores
❌ Error procesando campaña
⚠️ Circuit breaker abierto para Twilio
```

---

## 📞 SOPORTE

Para problemas o preguntas sobre el sistema de colas:

1. Revisar logs del servidor
2. Verificar métricas del dashboard
3. Comprobar estado de Redis
4. Validar configuración de Twilio
5. Contactar al equipo de desarrollo

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2025  
**Autor:** Campaign Team 