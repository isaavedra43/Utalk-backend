# Especificación del Request Logger Unificado

## Propósito
Unificar la interfaz de logging por request garantizando:
- Métodos estándar tipo Winston siempre disponibles: `.info`, `.warn`, `.error`, `.debug`, `.child`.
- Conservación de los métodos de dominio existentes: `.database`, `.auth`, `.message`, `.media`, `.twilio`, `.socket`, `.security`, `.success`, `.debug`.
- Propagación de contexto (`requestId`, `traceId`, `userCtx`) en todos los logs estándar.
- Compatibilidad con el logger de dominio existente, sin romper contratos ni semánticas.

## Problema que resuelve
- Evita errores como `req.logger?.info is not a function` al normalizar `req.logger` a una interfaz estable.
- Proporciona un único punto de acceso para logging en controladores y servicios.
- Mantiene la compatibilidad con los métodos de dominio ya utilizados.

## Interfaz estándar (Winston-like)
- **.info(message, meta)**: Log informativo. Incluye por defecto `requestId` y `traceId` del contexto del request.
- **.warn(message, meta)**: Log de advertencia. Incluye contexto.
- **.error(message, meta)**: Log de error. Incluye contexto.
- **.debug(message, meta)**: Log de depuración. Incluye contexto.
- **.child(context)**: Crea un logger hijo con contexto adicional; hereda `requestId` y `traceId`.

Campos mínimos en `meta`:
- `requestId`, `traceId` (provenientes del middleware de correlación)
- `service: 'utalk-backend'`, `environment` (desde el logger base)

## Interfaz de dominio (existente)
- Métodos disponibles: `.database`, `.auth`, `.message`, `.media`, `.twilio`, `.socket`, `.security`, `.success`, `.debug`.
- Semántica:
  - **.database(op, data)**: Eventos de operaciones a la base de datos.
  - **.auth(op, data)**: Eventos de autenticación/autorización.
  - **.message(op, data)**: Eventos del flujo de mensajes.
  - **.media(op, data)**: Eventos de manejo de media.
  - **.twilio(op, data)**: Eventos asociados a Twilio.
  - **.socket(op, data)**: Eventos de Socket.IO.
  - **.security(op, data)**: Eventos de seguridad.
  - **.success(op, data)**: Eventos de éxito por dominio.
  - **.debug(op, data)**: Eventos de depuración por dominio.

Nota: La semántica de estos métodos no cambia. Se preservan tal como existen.

## Reglas de redacción de PII
- No incluir PII directa en `message` o `meta`.
- En caso de necesidad, usar utilidades de redacción existentes (e.g., enmascarar email/teléfono).

## Reglas de contexto
- El wrapper asegura que los logs estándar propaguen `requestId` y `traceId` desde `req.logContext`.
- `userCtx` se enmascara y puede incluir: `userId`, `emailMasked`, `workspaceIdMasked`, `tenantIdMasked`, `role`.
- `.child(context)` agrega contexto adicional sin perder `requestId`/`traceId`.

## Ejemplos de uso
1. Controlador (estándar + dominio):
```js
const reqLogger = req.logger; // ya unificado
reqLogger.info('conversations_list_start', { filters });
reqLogger.database('query_started', { collection: 'conversations' });
```

2. Servicio/Repositorio (estándar):
```js
req.logger.error('operation_failed', { reason: 'firestore_unavailable' });
```

3. Child para subtarea:
```js
const child = req.logger.child({ module: 'importer' });
child.debug('batch_started', { batchId });
```

## Buenas prácticas
- No loguear PII; usar enmascarado.
- Elegir niveles adecuados (info/warn/error/debug) para evitar ruido.
- Adjuntar siempre metadatos de operación (método, URL, colección, ids no sensibles).

## Matriz de compatibilidad
- Si `req.logger` ya era Winston: el wrapper aplica `.child(context)` y conserva cualquier método de dominio presente.
- Si `req.logger` era un objeto de dominio: el wrapper agrega `.info/.warn/.error/.debug/.child` delegando al Winston base, preservando los métodos de dominio.

## Limitaciones conocidas
- Si un método de dominio redefine `.error` o `.debug` con semántica distinta, se preserva el estándar Winston para esos nombres en el objeto unificado.
- El wrapper no modifica formatos de salida existentes; solo asegura presencia de métodos estándar y contexto. 