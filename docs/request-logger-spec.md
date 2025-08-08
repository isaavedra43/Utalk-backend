# Request Logger Spec (Unificado)

## Contrato de `req.logger`
- Métodos Winston estándar:
  - `.info(message, meta)`, `.warn(message, meta)`, `.error(message, meta)`, `.debug(message, meta)`, `.child(ctx)`
- Métodos de dominio (wrappers que delegan a Winston child):
  - `.database(op, payload)`
  - `.auth(op, payload)`
  - `.message(op, payload)`
  - `.media(op, payload)`
  - `.twilio(op, payload)`
  - `.socket(op, payload)`
  - `.security(op, payload)`
  - `.success(op, payload)`
  - `.debug(op, payload)`

## Formato de eventos
- Claves mínimas: `event`, `op`, `requestId`, `traceId`, `user.emailMasked`, `workspaceIdMasked`, `tenantIdMasked`, `durationMs?`
- Convenciones de fase: `*_start`, `*_done`, `*_error`

## PII / Redacción
- Emails: `adm***@dominio`
- Teléfono: `+52***len:13` (o máscara equivalente)
- Nunca loguear cuerpos completos de mensaje; preferir `contentLength`/`hasContent`

## Orden de middlewares (logger)
- `correlation` → (otros) → `logging` (dominio adjunta) → rutas `/api/*`
- Prohibido volver a asignar `req.logger`; solo extender.

## Ejemplos
- Controlador:
```js
req.logger.info('conversations_list_start', { filters });
req.logger.database('query_started', { collection: 'conversations' });
```
- Servicio:
```js
req.logger.error('operation_failed', { reason: 'firestore_unavailable' });
```
- Child:
```js
const child = req.logger.child({ module: 'importer' });
child.debug('batch_started', { batchId });
```

## Guía de diagnóstico
- Shape: `event=req_logger_shape hasInfo=function hasAuth=function hasDatabase=function requestId=<id> traceId=<id>`
- Query: log único por request con `collectionPath`, `wheres`, `orderBy`, `limit`, `snapshot.size` 