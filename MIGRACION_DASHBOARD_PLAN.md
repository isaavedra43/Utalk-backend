# 📊 PLAN DE MIGRACIÓN DEL DASHBOARD - UTalk Frontend

## 📋 Resumen Ejecutivo

El proyecto UTalk requiere migrar el dashboard actual (básico con cards de bienvenida y acciones rápidas) hacia un diseño empresarial avanzado con KPIs, gráficos de actividad, ranking de agentes, análisis de sentimiento, temas IA, calendario de actividad e insights de IA. El análisis revela que el backend ya cuenta con endpoints robustos para métricas y reportes, pero el frontend necesita una reestructuración completa para implementar los widgets objetivo.

La migración se realizará mediante feature flags y rutas paralelas (`/dashboard-v2`) para mantener la funcionalidad existente mientras se desarrolla la nueva versión. El backend ya dispone de infraestructura de caching, rate limiting y batch processing que facilitará la implementación de los nuevos widgets.

## 🏗️ Arquitectura Actual

### Frontend (SvelteKit + TypeScript)

```
src/
├── routes/
│   ├── dashboard/+page.svelte          # Dashboard actual (básico)
│   ├── analytics/+page.svelte          # Placeholder analytics
│   └── +layout.svelte                  # Layout principal
├── lib/
│   ├── stores/
│   │   ├── auth.store.ts               # ✅ Autenticación
│   │   ├── conversations.store.ts      # ✅ Conversaciones
│   │   ├── messages.store.ts           # ✅ Mensajes
│   │   └── notifications.store.ts      # ✅ Notificaciones
│   ├── components/
│   │   ├── ui/                         # ✅ Componentes base (shadcn)
│   │   │   ├── card/                   # ✅ Cards reutilizables
│   │   │   ├── button/                 # ✅ Botones
│   │   │   └── dialog/                 # ✅ Modales
│   │   └── Sidebar.svelte              # ✅ Navegación
│   ├── api/
│   │   ├── http.ts                     # ✅ Cliente HTTP
│   │   └── conversations.ts            # ✅ API conversaciones
│   └── config/
│       └── api.ts                      # ✅ Configuración API
└── static/                             # ✅ Assets estáticos
```

### Backend (Node.js + Express + Firestore)

```
src/
├── routes/
│   ├── dashboard.js                    # ✅ Endpoints dashboard
│   ├── reports.js                      # ✅ Reportes
│   ├── ai.js                          # ✅ Servicios IA
│   └── conversations.js               # ✅ Conversaciones
├── controllers/
│   ├── DashboardController.js         # ✅ Métricas y KPIs
│   ├── ReportController.js            # ✅ Reportes
│   └── AIController.js                # ✅ Análisis IA
├── models/
│   ├── Report.js                      # ✅ Modelo reportes
│   ├── Message.js                     # ✅ Mensajes
│   └── Conversation.js                # ✅ Conversaciones
├── services/
│   ├── CacheService.js                # ✅ Caching
│   ├── BatchService.js                # ✅ Batch processing
│   └── ShardingService.js             # ✅ Sharding
└── ai/
    ├── vendors/openai.js              # ✅ Integración OpenAI
    └── rag/                           # ✅ RAG system
```

### Flujo de Datos Actual

```
Frontend (SvelteKit)
    ↓
Cliente HTTP (apiUrl)
    ↓
Backend (Railway)
    ↓
Firestore + Cache
    ↓
Métricas + Reportes
```

## 📦 Inventario de Componentes

### ✅ Componentes Reutilizables (Existentes)

| Componente | Path | Estado | Reutilización |
|------------|------|--------|---------------|
| Card System | `src/lib/components/ui/card/` | ✅ Completo | Alta - Base para todos los widgets |
| Button System | `src/lib/components/ui/button/` | ✅ Completo | Alta - Acciones y CTAs |
| Dialog System | `src/lib/components/ui/dialog/` | ✅ Completo | Media - Modales de configuración |
| Input System | `src/lib/components/ui/input/` | ✅ Completo | Media - Filtros y búsquedas |
| Avatar System | `src/lib/components/ui/avatar/` | ✅ Completo | Alta - Ranking de agentes |
| Badge System | `src/lib/components/ui/badge/` | ✅ Completo | Alta - Estados y tags |
| Sidebar | `src/lib/components/Sidebar.svelte` | ✅ Completo | Alta - Navegación |
| Auth Store | `src/lib/stores/auth.store.ts` | ✅ Completo | Alta - Autenticación |

### ❌ Componentes Faltantes (Nuevos)

| Componente | Propósito | Complejidad | Dependencias |
|------------|-----------|-------------|--------------|
| KPI Card | Widget de métricas con comparación | Media | Chart library |
| Activity Chart | Gráfico de barras por hora | Media | Chart library |
| Agent Ranking | Lista de agentes con métricas | Baja | Avatar, Badge |
| Sentiment Donut | Gráfico circular de sentimiento | Media | Chart library |
| Topics List | Lista de temas IA con tendencias | Baja | Badge, Card |
| Calendar Heatmap | Calendario de actividad | Alta | Date library |
| Insights List | Lista de insights IA | Baja | Card, Badge |
| Dashboard Grid | Layout responsive para widgets | Media | CSS Grid |

## 🗺️ Mapa de Datos

### ✅ Endpoints Existentes (Backend)

| Widget Objetivo | Endpoint Actual | Estado | Datos Disponibles |
|-----------------|-----------------|--------|-------------------|
| KPIs Generales | `GET /api/dashboard/metrics` | ✅ Completo | Total mensajes, contactos, campañas |
| Actividad Reciente | `GET /api/dashboard/recent-activity` | ✅ Completo | Actividad por usuario |
| Estadísticas Mensajes | `GET /api/dashboard/messages/stats` | ✅ Completo | Métricas de mensajes |
| Estadísticas Contactos | `GET /api/dashboard/contacts/stats` | ✅ Completo | Métricas de contactos |
| Estadísticas Campañas | `GET /api/dashboard/campaigns/stats` | ✅ Completo | Métricas de campañas |
| Performance | `GET /api/dashboard/performance` | ✅ Completo | Métricas de rendimiento |
| Reportes | `GET /api/reports` | ✅ Completo | Reportes con sentimiento |

### ❌ Endpoints Faltantes (Nuevos)

| Widget Objetivo | Endpoint Propuesto | Datos Requeridos | Complejidad |
|-----------------|-------------------|------------------|-------------|
| KPI Sentimiento | `GET /api/analytics/sentiment` | `sentiment_positive_pct`, comparación | Media |
| KPI Tiempo Respuesta | `GET /api/analytics/response-time` | `first_response_avg_sec`, comparación | Media |
| KPI Conversaciones | `GET /api/analytics/conversations` | `resolved_count`, comparación | Baja |
| KPI Ventas | `GET /api/analytics/revenue` | `revenue_total`, moneda, comparación | Alta |
| Actividad Horaria | `GET /api/analytics/activity-hourly` | `[{hour, normal, peak}]` | Media |
| Ranking Agentes | `GET /api/analytics/agents/ranking` | `[{agentId, name, kpis}]` | Media |
| Sentimiento por Canal | `GET /api/analytics/sentiment/by-channel` | `positive/neutral/negative` | Media |
| Temas IA | `GET /api/ai/topics` | `[{topic, trendDelta, severity}]` | Media |
| Calendario Actividad | `GET /api/analytics/calendar` | `[{date, messages}]` | Alta |
| Insights IA | `GET /api/ai/insights` | `[{type, confidence, text}]` | Media |

### 🔍 Brechas Detectadas

1. **Métricas de Sentimiento**: Existe en Report.js pero no como endpoint dedicado
2. **Tiempo de Primera Respuesta**: No implementado en el backend
3. **Métricas de Ventas**: No implementado en el backend
4. **Actividad por Hora**: No implementado en el backend
5. **Ranking de Agentes**: No implementado en el backend
6. **Temas IA**: No implementado en el backend
7. **Calendario de Actividad**: No implementado en el backend
8. **Insights IA**: No implementado en el backend

## 🔧 Compatibilidad

### ✅ Aspectos Compatibles

| Aspecto | Estado | Implementación |
|---------|--------|----------------|
| Autenticación | ✅ Completo | JWT + Refresh tokens |
| Roles y Permisos | ✅ Completo | admin, agent, viewer |
| i18n | ✅ Base | Estructura preparada |
| Responsive | ✅ Completo | Tailwind CSS |
| Dark Mode | ❌ Faltante | No implementado |
| Moneda | ❌ Faltante | No configurado |
| Timezone | ❌ Faltante | No configurado |
| Accesibilidad | ✅ Base | shadcn/ui components |

### ❌ Aspectos a Implementar

| Aspecto | Prioridad | Esfuerzo | Dependencias |
|---------|-----------|----------|--------------|
| Dark Mode | Media | M | Theme system |
| Moneda | Alta | S | Configuración |
| Timezone | Alta | S | Configuración |
| Accesibilidad Avanzada | Media | M | ARIA labels |
| i18n Completo | Baja | L | Traducciones |

## ⚠️ Riesgos y Mitigaciones

### Riesgos Identificados

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Cargas pesadas en KPIs | Alto | Media | Caching + Progressive loading |
| Inconsistencia de períodos | Medio | Alta | Validación de fechas |
| Queries N+1 | Alto | Media | Batch processing |
| Rate limiting | Medio | Baja | Implementado en backend |
| Coherencia de datos | Alto | Media | Transacciones |
| Performance en móvil | Medio | Alta | Lazy loading + Virtualization |

### Estrategias de Mitigación

1. **Caching Inteligente**: Aprovechar CacheService existente
2. **Batch Processing**: Usar BatchService para consultas masivas
3. **Progressive Loading**: Implementar loading states
4. **Error Boundaries**: Manejo robusto de errores
5. **Feature Flags**: Despliegue gradual
6. **Monitoring**: Logging y métricas de performance

## 📅 Plan por Fases

### Fase 0: Preparación y Feature Flags (1 semana)

**Objetivo**: Configurar infraestructura para desarrollo paralelo

#### Tareas Frontend
- [ ] Crear ruta `/dashboard-v2` con feature flag
- [ ] Configurar layout base para nuevos widgets
- [ ] Implementar sistema de feature flags
- [ ] Crear componentes base para KPIs

#### Tareas Backend
- [ ] Validar endpoints existentes
- [ ] Documentar contratos de API
- [ ] Configurar rate limiting para nuevos endpoints

**Esfuerzo**: S | **Dependencias**: Ninguna

### Fase 1: KPIs + Activity Chart (2 semanas)

**Objetivo**: Implementar tarjetas KPI principales y gráfico de actividad

#### Tareas Frontend
- [ ] Crear componente KPI Card
- [ ] Implementar Activity Chart (barras por hora)
- [ ] Integrar con endpoints existentes
- [ ] Implementar comparación de períodos

#### Tareas Backend
- [ ] Crear endpoint `/api/analytics/activity-hourly`
- [ ] Optimizar queries de métricas
- [ ] Implementar caching para KPIs

**Esfuerzo**: M | **Dependencias**: Fase 0

### Fase 2: Ranking de Agentes (1 semana)

**Objetivo**: Implementar lista de ranking de agentes

#### Tareas Frontend
- [ ] Crear componente Agent Ranking
- [ ] Implementar lista con avatares
- [ ] Mostrar métricas por agente
- [ ] Implementar filtros y ordenamiento

#### Tareas Backend
- [ ] Crear endpoint `/api/analytics/agents/ranking`
- [ ] Implementar agregaciones por agente
- [ ] Optimizar queries de usuarios

**Esfuerzo**: S | **Dependencias**: Fase 1

### Fase 3: Sentiment + Temas IA (2 semanas)

**Objetivo**: Implementar análisis de sentimiento y temas IA

#### Tareas Frontend
- [ ] Crear componente Sentiment Donut
- [ ] Implementar Topics List
- [ ] Integrar con servicios IA
- [ ] Mostrar tendencias y alertas

#### Tareas Backend
- [ ] Crear endpoint `/api/analytics/sentiment`
- [ ] Crear endpoint `/api/ai/topics`
- [ ] Integrar con servicios IA existentes
- [ ] Implementar análisis de sentimiento

**Esfuerzo**: M | **Dependencias**: Fase 2

### Fase 4: Calendario de Actividad (2 semanas)

**Objetivo**: Implementar calendario heatmap de actividad

#### Tareas Frontend
- [ ] Crear componente Calendar Heatmap
- [ ] Implementar visualización por día
- [ ] Integrar con datos de actividad
- [ ] Implementar navegación por meses

#### Tareas Backend
- [ ] Crear endpoint `/api/analytics/calendar`
- [ ] Implementar agregaciones por fecha
- [ ] Optimizar queries de fechas
- [ ] Implementar caching por mes

**Esfuerzo**: L | **Dependencias**: Fase 3

### Fase 5: Insights IA (1 semana)

**Objetivo**: Implementar lista de insights de IA

#### Tareas Frontend
- [ ] Crear componente Insights List
- [ ] Implementar cards de insights
- [ ] Mostrar confianza y tags
- [ ] Implementar acciones (CTAs)

#### Tareas Backend
- [ ] Crear endpoint `/api/ai/insights`
- [ ] Integrar con servicios IA
- [ ] Implementar generación de insights
- [ ] Configurar tipos de insights

**Esfuerzo**: S | **Dependencias**: Fase 4

### Fase 6: Pulido y QA (1 semana)

**Objetivo**: Optimización, testing y despliegue

#### Tareas Frontend
- [ ] Optimizar performance
- [ ] Implementar error boundaries
- [ ] Testing de componentes
- [ ] Testing de integración

#### Tareas Backend
- [ ] Optimizar queries
- [ ] Testing de endpoints
- [ ] Monitoreo y alertas
- [ ] Documentación final

**Esfuerzo**: M | **Dependencias**: Fase 5

## 📋 Contratos de API Propuestos

### 1. KPI Sentimiento Global

```typescript
// GET /api/analytics/sentiment?from=2024-01-01&to=2024-01-31
{
  "success": true,
  "data": {
    "sentiment_positive_pct": 78.5,
    "sentiment_neutral_pct": 15.2,
    "sentiment_negative_pct": 6.3,
    "comparison": {
      "previous_period": 75.2,
      "change": 3.3,
      "trend": "up"
    },
    "meta": {
      "range": "2024-01-01 to 2024-01-31",
      "tz": "America/Mexico_City",
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 2. Actividad del Día (Barras por Hora)

```typescript
// GET /api/analytics/activity-hourly?date=2024-01-31
{
  "success": true,
  "data": {
    "hourly_data": [
      {"hour": "09:00", "normal": 45, "peak": 67},
      {"hour": "10:00", "normal": 78, "peak": 89},
      // ... más horas
    ],
    "peak_hour": "14:00",
    "total_messages": 1247,
    "meta": {
      "date": "2024-01-31",
      "tz": "America/Mexico_City",
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 3. Ranking de Agentes

```typescript
// GET /api/analytics/agents/ranking?from=2024-01-01&to=2024-01-31&limit=10
{
  "success": true,
  "data": {
    "agents": [
      {
        "agentId": "agent_001",
        "name": "María García",
        "avatar": "https://...",
        "status": "online",
        "kpis": {
          "responses": 156,
          "avgHandleTime": 180,
          "score": 4.8,
          "lastActivity": "2024-01-31T15:30:00Z"
        }
      }
      // ... más agentes
    ],
    "meta": {
      "range": "2024-01-01 to 2024-01-31",
      "total_agents": 15,
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 4. Temas y Alertas IA

```typescript
// GET /api/ai/topics?from=2024-01-01&to=2024-01-31
{
  "success": true,
  "data": {
    "topics": [
      {
        "topic": "Problemas de facturación",
        "trendDelta": 15.3,
        "severity": "high",
        "tags": ["billing", "urgent"],
        "count": 89
      }
      // ... más temas
    ],
    "meta": {
      "range": "2024-01-01 to 2024-01-31",
      "total_topics": 12,
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 5. Calendario de Actividad

```typescript
// GET /api/analytics/calendar?month=2024-01&teamId=team_001
{
  "success": true,
  "data": {
    "calendar_data": [
      {"date": "2024-01-01", "messages": 45},
      {"date": "2024-01-02", "messages": 67},
      // ... más días
    ],
    "total_month": 1247,
    "meta": {
      "month": "2024-01",
      "teamId": "team_001",
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 6. Insights IA

```typescript
// GET /api/ai/insights?from=2024-01-01&to=2024-01-31&limit=5
{
  "success": true,
  "data": {
    "insights": [
      {
        "type": "alert",
        "confidencePct": 92.5,
        "text": "El tiempo de respuesta promedio aumentó 15% esta semana",
        "tags": ["performance", "response_time"],
        "cta": {
          "text": "Ver detalles",
          "action": "view_performance"
        }
      }
      // ... más insights
    ],
    "meta": {
      "range": "2024-01-01 to 2024-01-31",
      "total_insights": 8,
      "generatedAt": "2024-01-31T23:59:59Z"
    }
  }
}
```

## ✅ Criterios de Aceptación por Widget

### KPI Cards
- [ ] Muestra valor actual y comparación con período anterior
- [ ] Indicador visual de tendencia (flecha arriba/abajo)
- [ ] Formato correcto de números (moneda, porcentajes)
- [ ] Loading state durante carga
- [ ] Error state si falla la API
- [ ] Responsive en móvil y desktop

### Activity Chart
- [ ] Gráfico de barras por hora del día
- [ ] Distinción entre actividad normal y picos
- [ ] Tooltip con detalles al hacer hover
- [ ] Zoom y navegación por fechas
- [ ] Export de datos
- [ ] Responsive y accesible

### Agent Ranking
- [ ] Lista ordenada por métricas de rendimiento
- [ ] Avatares y estados de agentes
- [ ] Filtros por período y métricas
- [ ] Paginación para listas largas
- [ ] Export de ranking
- [ ] Responsive en móvil

### Sentiment Donut
- [ ] Gráfico circular con distribución de sentimiento
- [ ] Leyenda interactiva
- [ ] Breakdown por canal
- [ ] Comparación temporal
- [ ] Export de datos
- [ ] Accesible con ARIA labels

### Topics List
- [ ] Lista de temas con tendencias
- [ ] Indicadores de severidad
- [ ] Tags y categorías
- [ ] Filtros por severidad y período
- [ ] Acciones rápidas
- [ ] Responsive design

### Calendar Heatmap
- [ ] Calendario con intensidad de actividad
- [ ] Navegación por meses
- [ ] Tooltip con detalles por día
- [ ] Export de datos
- [ ] Responsive en móvil
- [ ] Accesible con teclado

### Insights List
- [ ] Lista de insights con confianza
- [ ] Tipos diferenciados (alert/recommendation)
- [ ] CTAs para acciones
- [ ] Filtros por tipo y confianza
- [ ] Mark as read/unread
- [ ] Responsive design

## 🔒 Checklist "No Romper Nada"

### Rutas Existentes
- [ ] `/dashboard` sigue funcionando
- [ ] `/analytics` sigue funcionando
- [ ] Navegación en sidebar intacta
- [ ] Redirecciones de autenticación funcionan

### Stores y Estado
- [ ] Auth store no modificado
- [ ] Conversations store intacto
- [ ] Messages store intacto
- [ ] Notifications store intacto

### Cachés y Performance
- [ ] Cachés existentes no afectados
- [ ] Rate limiting funcionando
- [ ] Performance no degradada
- [ ] Memory leaks no introducidos

### Telemetry y Logging
- [ ] Logging existente intacto
- [ ] Métricas de performance
- [ ] Error tracking funcionando
- [ ] Analytics de usuario

### Tests
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Tests E2E funcionando
- [ ] Coverage no degradado

## 📊 Timeline Sugerido

| Fase | Duración | Responsable | Entregables |
|------|----------|-------------|-------------|
| Fase 0 | 1 semana | Frontend | Feature flags + layout base |
| Fase 1 | 2 semanas | Frontend + Backend | KPIs + Activity chart |
| Fase 2 | 1 semana | Frontend + Backend | Agent ranking |
| Fase 3 | 2 semanas | Frontend + Backend | Sentiment + Topics |
| Fase 4 | 2 semanas | Frontend + Backend | Calendar heatmap |
| Fase 5 | 1 semana | Frontend + Backend | Insights IA |
| Fase 6 | 1 semana | Frontend + Backend | QA + Optimización |

**Total**: 10 semanas (2.5 meses)

### Responsabilidades

**Frontend Team**:
- Componentes Svelte
- Integración con APIs
- UI/UX y responsive
- Testing de componentes

**Backend Team**:
- Nuevos endpoints
- Optimización de queries
- Integración con IA
- Testing de APIs

## ❓ Preguntas Abiertas

### Configuración
- **Timezone por defecto**: ¿América/Mexico_City o detectar automáticamente?
- **Idioma por defecto**: ¿Español o detectar del navegador?
- **Moneda**: ¿MXN, USD o configurable por workspace?
- **Límites de datos**: ¿Cuántos meses de histórico mostrar?

### Performance
- **Tamaños de muestra**: ¿Límites para queries de analytics?
- **Caching**: ¿TTL específico por tipo de widget?
- **Rate limiting**: ¿Límites específicos para nuevos endpoints?

### UX/UI
- **Dark mode**: ¿Implementar en esta migración o posterior?
- **Accesibilidad**: ¿Nivel de compliance requerido?
- **Export**: ¿Formatos soportados (CSV, PDF, Excel)?

### Integración
- **IA Services**: ¿OpenAI, Azure, o múltiples proveedores?
- **Real-time**: ¿WebSocket para updates en tiempo real?
- **Notifications**: ¿Alertas push para insights críticos?

---

**Documento generado**: 2024-01-31  
**Versión**: 1.0.0  
**Estado**: Análisis completo - Listo para implementación 