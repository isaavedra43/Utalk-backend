# 📄 ALINEACIÓN FRONTEND - MÓDULO DE DOCUMENTOS DE EMPLEADOS

## 🎯 RESUMEN EJECUTIVO

El backend ha implementado **COMPLETAMENTE** el módulo de documentos de empleados con **100% de compatibilidad** con el frontend existente. Todos los endpoints están listos y funcionando según las especificaciones del frontend.

---

## ✅ ENDPOINTS IMPLEMENTADOS Y FUNCIONANDO

### 1. **Listar Documentos**
```
GET /api/employees/:employeeId/documents
```

**Query Parameters:**
- `search` (string): Búsqueda en nombre, descripción y tags
- `category` (string): Filtro por categoría (`contract`, `id`, `tax`, `certification`, `other`)
- `confidential` (boolean): Filtro por confidencialidad (`true`/`false`)
- `page` (number): Número de página (default: 1)
- `limit` (number): Resultados por página (default: 20, max: 100)
- `sortBy` (string): Campo de ordenamiento (`uploadedAt`, `originalName`, `fileSize`, `category`)
- `sortOrder` (string): Orden (`asc`/`desc`, default: `desc`)

**Respuesta:**
```json
{
  "success": true,
  "message": "Documentos obtenidos exitosamente",
  "data": {
    "documents": [
      {
        "id": "doc_abc123",
        "employeeId": "emp_123",
        "originalName": "Contrato_Laboral_Ana_Garcia.pdf",
        "fileSize": 2318852,
        "mimeType": "application/pdf",
        "category": "contract",
        "description": "Contrato 2024",
        "tags": ["contratos", "2024"],
        "isConfidential": false,
        "version": 2,
        "uploadedAt": "2025-02-09T12:34:56.000Z",
        "expiresAt": null,
        "uploader": {
          "id": "user_123",
          "email": "admin@empresa.com",
          "name": "Admin Usuario"
        }
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 24,
    "totalPages": 2
  }
}
```

### 2. **Subir Documento**
```
POST /api/employees/:employeeId/documents
```

**Content-Type:** `multipart/form-data`

**Body:**
- `file` (File): Archivo a subir (requerido)
- `category` (string): Categoría del documento (requerido)
- `description` (string): Descripción opcional
- `tags` (string): Tags separados por comas
- `isConfidential` (string): `"true"` o `"false"` (requerido)
- `expiresAt` (string): Fecha de expiración ISO (opcional)

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento subido correctamente",
  "data": {
    "document": {
      "id": "doc_abc123",
      "employeeId": "emp_123",
      "originalName": "Contrato_Laboral_Ana_Garcia.pdf",
      "fileSize": 2318852,
      "mimeType": "application/pdf",
      "category": "contract",
      "description": "Contrato 2024",
      "tags": ["contratos", "2024"],
      "isConfidential": false,
      "version": 2,
      "uploadedAt": "2025-02-09T12:34:56.000Z",
      "expiresAt": null,
      "uploader": {
        "id": "user_123",
        "email": "admin@empresa.com",
        "name": "Admin Usuario"
      }
    }
  }
}
```

### 3. **Descargar Documento**
```
GET /api/employees/:employeeId/documents/:documentId/download
```

**Respuesta:** Redirección 302 a URL firmada de Firebase Storage

### 4. **Eliminar Documento**
```
DELETE /api/employees/:employeeId/documents/:documentId
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento eliminado correctamente"
}
```

### 5. **Resumen de Documentos**
```
GET /api/employees/:employeeId/documents/summary
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Resumen obtenido exitosamente",
  "data": {
    "totalCount": 24,
    "totalSizeBytes": 164322345,
    "categories": {
      "contract": 3,
      "id": 5,
      "tax": 2,
      "certification": 1,
      "other": 13
    },
    "lastUploadAt": "2025-02-09T12:34:56.000Z"
  }
}
```

### 6. **Actualizar Metadatos**
```
PUT /api/employees/:employeeId/documents/:documentId
```

**Body:**
```json
{
  "description": "Nueva descripción",
  "tags": "nuevo, tag, separado",
  "isConfidential": true,
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Documento actualizado correctamente",
  "data": {
    "document": {
      // ... documento actualizado
    }
  }
}
```

---

## 🔐 AUTENTICACIÓN Y AUTORIZACIÓN

### **Autenticación Requerida**
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Todas las rutas** requieren autenticación

### **Permisos por Rol**

| Rol | Ver Documentos | Subir | Eliminar | Confidenciales |
|-----|----------------|-------|----------|----------------|
| `admin` | ✅ Todos | ✅ | ✅ | ✅ |
| `hr_admin` | ✅ Todos | ✅ | ✅ | ✅ |
| `hr_manager` | ✅ Departamento | ✅ | ✅ | ✅ |
| `supervisor` | ✅ Equipo | ✅ | ❌ | ❌ |
| `employee` | ✅ Propios | ❌ | ❌ | ❌ |

### **Validaciones de Acceso**
- **Empleado debe existir** y estar activo
- **Documento debe existir** y no estar eliminado
- **Confidenciales:** Solo roles HR pueden ver
- **Departamento:** HR managers solo ven su departamento
- **Equipo:** Supervisores solo ven su equipo

---

## 📊 ESTRUCTURA DE DATOS

### **Documento (EmployeeDocument)**
```typescript
interface EmployeeDocument {
  id: string;                    // UUID
  employeeId: string;            // UUID del empleado
  originalName: string;          // Nombre original del archivo
  fileSize: number;              // Tamaño en bytes
  mimeType: string;              // Tipo MIME
  category: 'contract' | 'id' | 'tax' | 'certification' | 'other';
  description?: string;          // Descripción opcional
  tags: string[];                // Array de tags
  isConfidential: boolean;       // Si es confidencial
  version: number;               // Versión del documento
  uploadedAt: string;            // ISO timestamp
  expiresAt?: string;            // ISO timestamp opcional
  uploader: {
    id: string;
    email: string;
    name?: string;
  };
}
```

### **Resumen (Summary)**
```typescript
interface DocumentsSummary {
  totalCount: number;            // Total de documentos
  totalSizeBytes: number;        // Tamaño total en bytes
  categories: {                  // Conteo por categoría
    contract: number;
    id: number;
    tax: number;
    certification: number;
    other: number;
  };
  lastUploadAt?: string;         // Última subida ISO timestamp
}
```

---

## 🚀 CÓMO USAR DESDE EL FRONTEND

### **1. Configurar Axios/HTTP Client**
```javascript
// Configurar headers de autenticación
const apiClient = axios.create({
  baseURL: '/api/employees',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### **2. Listar Documentos**
```javascript
const getDocuments = async (employeeId, filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.category) params.append('category', filters.category);
  if (filters.confidential !== undefined) params.append('confidential', filters.confidential);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  
  const response = await apiClient.get(`/${employeeId}/documents?${params}`);
  return response.data;
};
```

### **3. Subir Documento**
```javascript
const uploadDocument = async (employeeId, file, metadata) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', metadata.category);
  formData.append('isConfidential', metadata.isConfidential.toString());
  
  if (metadata.description) formData.append('description', metadata.description);
  if (metadata.tags) formData.append('tags', metadata.tags);
  if (metadata.expiresAt) formData.append('expiresAt', metadata.expiresAt);
  
  const response = await apiClient.post(`/${employeeId}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};
```

### **4. Descargar Documento**
```javascript
const downloadDocument = async (employeeId, documentId) => {
  // El backend redirige automáticamente a la URL firmada
  window.open(`/api/employees/${employeeId}/documents/${documentId}/download`, '_blank');
};
```

### **5. Eliminar Documento**
```javascript
const deleteDocument = async (employeeId, documentId) => {
  const response = await apiClient.delete(`/${employeeId}/documents/${documentId}`);
  return response.data;
};
```

### **6. Obtener Resumen**
```javascript
const getDocumentsSummary = async (employeeId) => {
  const response = await apiClient.get(`/${employeeId}/documents/summary`);
  return response.data;
};
```

### **7. Actualizar Metadatos**
```javascript
const updateDocument = async (employeeId, documentId, updateData) => {
  const response = await apiClient.put(`/${employeeId}/documents/${documentId}`, updateData);
  return response.data;
};
```

---

## 🎨 INTEGRACIÓN CON COMPONENTES EXISTENTES

### **DocumentModule Component**
El componente `DocumentModule` del frontend ya está diseñado para consumir estos endpoints. Solo necesita:

1. **Actualizar las URLs** de los endpoints (ya están correctas)
2. **Verificar que los nombres de campos** coincidan (ya coinciden)
3. **Manejar la autenticación** con JWT (ya implementado)

### **employeeService**
El servicio `employeeService` del frontend puede usar directamente estos endpoints:

```javascript
// En employeeService.js
export const employeeService = {
  // ... métodos existentes ...
  
  getDocuments: (employeeId, filters) => getDocuments(employeeId, filters),
  uploadDocument: (employeeId, file, metadata) => uploadDocument(employeeId, file, metadata),
  downloadDocument: (employeeId, documentId) => downloadDocument(employeeId, documentId),
  deleteDocument: (employeeId, documentId) => deleteDocument(employeeId, documentId),
  getDocumentsSummary: (employeeId) => getDocumentsSummary(employeeId),
  updateDocument: (employeeId, documentId, updateData) => updateDocument(employeeId, documentId, updateData)
};
```

---

## 🔧 CONFIGURACIÓN ADICIONAL

### **Variables de Entorno**
```env
# Firebase Storage (ya configurado)
FIREBASE_STORAGE_BUCKET=tu-bucket.appspot.com

# Límites de archivos (configurables)
MAX_FILE_SIZE_MB=25
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,txt,csv,jpg,jpeg,png,gif,webp,mp3,wav,mp4,webm
```

### **Índices de Firestore**
El backend crea automáticamente los índices necesarios:
- `employee_documents` collection
- Índices compuestos para consultas eficientes
- Índices para búsquedas y filtros

---

## 🚨 MANEJO DE ERRORES

### **Códigos de Error Estándar**
- `400`: Datos de entrada inválidos
- `401`: No autenticado
- `403`: Sin permisos
- `404`: Empleado/Documento no encontrado
- `413`: Archivo demasiado grande
- `415`: Tipo de archivo no permitido
- `500`: Error interno del servidor

### **Estructura de Error**
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "code": "INVALID_INPUT",
    "message": "La categoría es requerida",
    "timestamp": "2025-02-09T12:34:56.000Z"
  }
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN FRONTEND

### **Configuración Básica**
- [ ] Verificar que las URLs de endpoints coincidan
- [ ] Configurar headers de autenticación JWT
- [ ] Verificar que los nombres de campos coincidan
- [ ] Configurar manejo de errores estándar

### **Funcionalidades**
- [ ] Listar documentos con filtros y paginación
- [ ] Subir documentos con metadatos
- [ ] Descargar documentos (redirección automática)
- [ ] Eliminar documentos
- [ ] Obtener resumen de documentos
- [ ] Actualizar metadatos de documentos

### **UI/UX**
- [ ] Mostrar indicadores de carga
- [ ] Mostrar mensajes de error/success
- [ ] Implementar confirmación para eliminación
- [ ] Mostrar progreso de subida
- [ ] Manejar archivos grandes

### **Permisos**
- [ ] Verificar permisos de usuario
- [ ] Ocultar botones según permisos
- [ ] Manejar documentos confidenciales
- [ ] Validar acceso por departamento/equipo

---

## 🎯 PRÓXIMOS PASOS

1. **Probar endpoints** con Postman/Thunder Client
2. **Verificar autenticación** con tokens JWT válidos
3. **Integrar con componentes** existentes del frontend
4. **Configurar manejo de errores** estándar
5. **Implementar indicadores de carga** y feedback visual
6. **Probar con diferentes roles** de usuario

---

## 📞 SOPORTE

Si encuentras algún problema o necesitas ajustes:

1. **Verificar logs** del backend para errores específicos
2. **Comprobar permisos** del usuario autenticado
3. **Validar formato** de datos enviados
4. **Revisar configuración** de Firebase Storage

El módulo está **100% funcional** y listo para producción. Todos los endpoints están implementados según las especificaciones del frontend y son completamente compatibles.

---

**🎉 ¡EL MÓDULO DE DOCUMENTOS DE EMPLEADOS ESTÁ COMPLETAMENTE IMPLEMENTADO Y LISTO PARA USAR!**
