# 📄 NUEVA RUTA DE DOCUMENTOS DE EMPLEADOS

## ✅ CAMBIO CRÍTICO APLICADO

Se ha cambiado el prefijo de las rutas de documentos de empleados para evitar conflictos con las rutas de empleados.

---

## 🔄 CAMBIOS EN LAS RUTAS

### ❌ RUTAS ANTERIORES (YA NO FUNCIONAN):
```
GET    /api/employees/:employeeId/documents
POST   /api/employees/:employeeId/documents
GET    /api/employees/:employeeId/documents/summary
GET    /api/employees/:employeeId/documents/:documentId/download
PUT    /api/employees/:employeeId/documents/:documentId
DELETE /api/employees/:employeeId/documents/:documentId
```

### ✅ RUTAS NUEVAS (USAR ESTAS):
```
GET    /api/employee-documents/:employeeId
POST   /api/employee-documents/:employeeId
GET    /api/employee-documents/:employeeId/summary
GET    /api/employee-documents/:employeeId/:documentId/download
PUT    /api/employee-documents/:employeeId/:documentId
DELETE /api/employee-documents/:employeeId/:documentId
```

---

## 📋 DETALLES DE LOS ENDPOINTS

### 1. **Listar Documentos**
```
GET /api/employee-documents/:employeeId
```
**Query Params:**
- `search` (opcional): Búsqueda en nombre, descripción y tags
- `category` (opcional): contract|identification|payroll|medical|training|performance|other
- `confidential` (opcional): true|false
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Resultados por página (default: 20, max: 100)
- `sortBy` (opcional): uploadedAt|originalName|fileSize|category (default: uploadedAt)
- `sortOrder` (opcional): asc|desc (default: desc)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "documents": [...],
    "totalCount": 2,
    "categories": ["contract", "identification", ...],
    "confidentialCount": 0,
    "publicCount": 2
  }
}
```

---

### 2. **Subir Documento**
```
POST /api/employee-documents/:employeeId
```
**Content-Type:** `multipart/form-data`

**Body:**
- `file` (required): El archivo a subir
- `category` (optional): contract|identification|payroll|medical|training|performance|other
- `isConfidential` (optional): true|false
- `description` (optional): Descripción del documento
- `tags` (optional): Etiquetas separadas por coma

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento subido exitosamente",
  "data": {
    "document": {...}
  }
}
```

---

### 3. **Obtener Resumen**
```
GET /api/employee-documents/:employeeId/summary
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "totalCount": 5,
    "totalSizeBytes": 1048576,
    "totalSizeFormatted": "1.00 MB",
    "byCategory": {...},
    "confidentialCount": 2,
    "publicCount": 3
  }
}
```

---

### 4. **Descargar/Vista Previa Documento**
```
GET /api/employee-documents/:employeeId/:documentId/download
```

**Respuesta:**
Redirección (302) a URL firmada de Firebase Storage con el archivo

---

### 5. **Actualizar Metadatos**
```
PUT /api/employee-documents/:employeeId/:documentId
```

**Body:**
```json
{
  "category": "payroll",
  "isConfidential": true,
  "description": "Nueva descripción",
  "tags": ["tag1", "tag2"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento actualizado exitosamente",
  "data": {
    "document": {...}
  }
}
```

---

### 6. **Eliminar Documento**
```
DELETE /api/employee-documents/:employeeId/:documentId
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento eliminado exitosamente"
}
```

---

## 🔒 AUTENTICACIÓN

Todas las rutas requieren:
- Header: `Authorization: Bearer <token>`
- Permisos de HR según la operación (read/create/update/delete)

---

## ⚠️ ACCIÓN REQUERIDA EN EL FRONTEND

**El frontend DEBE actualizar sus llamadas API de:**
```javascript
// ❌ Anterior
const url = `/api/employees/${employeeId}/documents`;

// ✅ Nueva
const url = `/api/employee-documents/${employeeId}`;
```

**Para descargas:**
```javascript
// ❌ Anterior
const url = `/api/employees/${employeeId}/documents/${documentId}/download`;

// ✅ Nueva
const url = `/api/employee-documents/${employeeId}/${documentId}/download`;
```

---

## 🎯 RAZÓN DEL CAMBIO

El prefijo anterior `/api/employees/:employeeId/documents` estaba en conflicto con otras rutas de empleados como `/api/employees/:id`, causando que Express capturara las peticiones incorrectamente.

El nuevo prefijo `/api/employee-documents/:employeeId` elimina completamente este conflicto y garantiza que las rutas funcionen correctamente.

---

## ✅ ESTADO

- ✅ Backend actualizado y desplegado
- ⏳ Frontend necesita actualizar las rutas
- ✅ Todas las funcionalidades probadas y funcionando

---

**Fecha de cambio:** 2025-10-01
**Versión:** 2.0.0

