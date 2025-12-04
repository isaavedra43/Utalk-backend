# 📸 SISTEMA DE EVIDENCIAS - MÓDULO DE INVENTARIO

## ✅ IMPLEMENTACIÓN COMPLETADA

Fecha: Octubre 1, 2025
Estado: **100% FUNCIONAL**

---

## 🗄️ ESTRUCTURA DE FIRESTORE

```
providers/ (colección raíz)
  └── {providerId}/
       ├── userId: "admin@company.com"
       ├── name: "Mármoles del Norte"
       ├── contact: "Juan Pérez"
       ├── phone: "+52 123 456 7890"
       ├── isActive: true
       └── platforms/ (subcolección)
            └── {platformId}/
                 ├── userId: "admin@company.com"
                 ├── providerId: "prov-001"
                 ├── platformNumber: "SYNC-1759308494813"
                 ├── evidenceCount: 3
                 ├── status: "in_progress"
                 └── evidence/ (subcolección)
                      ├── {evidenceId}/
                      │    ├── userId: "admin@company.com"
                      │    ├── platformId: "platform_123"
                      │    ├── providerId: "prov-001"
                      │    ├── fileName: "foto_material.jpg"
                      │    ├── fileType: "image/jpeg"
                      │    ├── fileSize: 2048576
                      │    ├── storagePath: "inventory/evidence/2025/10/evi_xxx_foto_material.jpg"
                      │    ├── downloadUrl: "https://storage.googleapis.com/..."
                      │    ├── description: "Foto del material recibido"
                      │    ├── uploadedBy: "admin@company.com"
                      │    ├── createdAt: timestamp
                      │    └── updatedAt: timestamp
                      └── ...
```

---

## 🔗 ENDPOINTS IMPLEMENTADOS

### **1. Subir Evidencias**
```http
POST /api/inventory/evidence/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body (FormData):
- files: File[] (hasta 20 archivos)
- descriptions: string[] (opcional, JSON array)
- platformId: string
- providerId: string
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Evidencias subidas exitosamente",
  "data": [
    {
      "id": "evi_123...",
      "fileName": "foto_material.jpg",
      "fileType": "image/jpeg",
      "fileSize": 2048576,
      "downloadUrl": "https://storage.googleapis.com/...",
      "description": "Foto del material",
      "uploadedBy": "admin@company.com",
      "createdAt": "2025-10-01T10:30:00Z"
    }
  ]
}
```

---

### **2. Obtener Evidencias de una Plataforma**
```http
GET /api/inventory/evidence/{platformId}?providerId={providerId}
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Evidencias obtenidas exitosamente",
  "data": [
    {
      "id": "evi_123...",
      "fileName": "foto_material.jpg",
      "fileType": "image/jpeg",
      "fileSize": 2048576,
      "downloadUrl": "https://storage.googleapis.com/...",
      "description": "Foto del material recibido",
      "uploadedBy": "admin@company.com",
      "createdAt": "2025-10-01T10:30:00Z"
    }
  ]
}
```

---

### **3. Eliminar Evidencia**
```http
DELETE /api/inventory/evidence/{evidenceId}
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "platformId": "platform_123",
  "providerId": "prov-001"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Evidencia eliminada exitosamente",
  "data": null
}
```

---

### **4. Estadísticas de Evidencias**
```http
GET /api/inventory/evidence/stats/{platformId}?providerId={providerId}
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Estadísticas de evidencias obtenidas exitosamente",
  "data": {
    "totalFiles": 5,
    "totalSize": 15728640,
    "fileTypes": {
      "image/jpeg": 3,
      "application/pdf": 2
    },
    "lastUpload": "2025-10-01T10:30:00Z"
  }
}
```

---

## 📋 VALIDACIONES IMPLEMENTADAS

### **Archivos:**
- ✅ Tamaño máximo: **10MB por archivo**
- ✅ Máximo **20 archivos** por subida
- ✅ Máximo **50 evidencias** por plataforma
- ✅ Tipos permitidos:
  - Imágenes: `jpeg`, `jpg`, `png`, `gif`
  - Documentos: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `txt`

### **Seguridad:**
- ✅ Autenticación JWT requerida
- ✅ Verificación de pertenencia de plataforma al usuario
- ✅ Sanitización de nombres de archivo
- ✅ Eliminación de archivos físicos al borrar registro

---

## 🗂️ ALMACENAMIENTO EN FIREBASE STORAGE

### **Ruta de Archivos:**
```
inventory/
  └── evidence/
       └── {year}/
            └── {month}/
                 └── evi_{uuid}_{sanitizedFilename}
```

**Ejemplo:**
```
inventory/evidence/2025/10/evi_abc123_foto_material.jpg
inventory/evidence/2025/10/evi_def456_factura_proveedor.pdf
```

### **Configuración de Storage:**
- Archivos públicos con URL directa
- Metadata incluye: `uploadedBy`, `platformId`, `providerId`, `uploadDate`
- Eliminación automática al borrar evidencia

---

## 🔧 ARCHIVOS CREADOS/MODIFICADOS

### **Nuevos Archivos:**
1. ✅ `src/models/InventoryEvidence.js` - Modelo de evidencias
2. ✅ `src/services/InventoryEvidenceService.js` - Lógica de negocio
3. ✅ `src/controllers/InventoryEvidenceController.js` - Controlador de endpoints

### **Archivos Modificados:**
1. ✅ `src/routes/inventory.js` - Agregadas rutas de evidencias
2. ✅ `src/models/Platform.js` - Agregado campo `evidenceCount`
3. ✅ `src/models/Provider.js` - Corregida estructura de colecciones
4. ✅ `src/models/Material.js` - Corregida estructura de colecciones
5. ✅ `src/services/PlatformService.js` - Auto-creación de proveedores

---

## 🎯 FLUJO COMPLETO DE FUNCIONAMIENTO

### **1. Usuario crea una plataforma:**
```
Frontend → POST /api/inventory/platforms
Backend → Crea proveedor (si no existe) → Guarda plataforma
Firestore → providers/{providerId}/platforms/{platformId}
```

### **2. Usuario sube evidencias:**
```
Frontend → POST /api/inventory/evidence/upload (con FormData)
Backend → Valida archivos → Sube a Firebase Storage
Backend → Guarda metadata en Firestore
Backend → Actualiza evidenceCount en plataforma
Firestore → providers/{providerId}/platforms/{platformId}/evidence/{evidenceId}
```

### **3. Usuario ve evidencias:**
```
Frontend → GET /api/inventory/evidence/{platformId}
Backend → Consulta Firestore → Retorna lista con URLs
Frontend → Muestra galería de evidencias
```

### **4. Usuario elimina evidencia:**
```
Frontend → DELETE /api/inventory/evidence/{evidenceId}
Backend → Elimina de Firebase Storage
Backend → Elimina de Firestore
Backend → Actualiza evidenceCount
```

---

## 🔒 SEGURIDAD Y LÍMITES

### **Rate Limiting:**
El sistema usa el middleware `intelligentRateLimit` existente que ya limita:
- Máximo 100 requests por minuto por usuario
- Protección contra DDoS

### **Validación de Permisos:**
Todas las rutas usan `authMiddleware` que verifica:
- Token JWT válido
- Usuario autenticado
- Permisos de módulo `inventory`

### **Validación de Propiedad:**
- Todas las operaciones verifican que `userId` coincida
- Previene acceso a evidencias de otros usuarios

---

## 📊 CONTADOR AUTOMÁTICO

El campo `evidenceCount` en la plataforma se actualiza automáticamente:

```javascript
// Al subir evidencia
await evidence.save(); // evidenceCount++

// Al eliminar evidencia  
await evidence.delete(); // evidenceCount--
```

Este contador permite al frontend mostrar el número de evidencias sin hacer queries adicionales.

---

## 🚀 INTEGRACIÓN CON FRONTEND

### **Ejemplo de Subida desde Frontend:**
```javascript
const formData = new FormData();
files.forEach(file => formData.append('files', file));
formData.append('descriptions', JSON.stringify(descriptions));
formData.append('platformId', platformId);
formData.append('providerId', providerId);

const response = await api.post('/inventory/evidence/upload', formData);
```

### **Ejemplo de Eliminación:**
```javascript
const response = await api.delete(`/inventory/evidence/${evidenceId}`, {
  data: { platformId, providerId }
});
```

---

## ✅ CHECKLIST DE FUNCIONALIDAD

- ✅ Modelo de evidencias creado
- ✅ Servicio de evidencias implementado
- ✅ Controlador de evidencias implementado
- ✅ Rutas configuradas con Multer
- ✅ Validaciones de archivos completas
- ✅ Integración con Firebase Storage
- ✅ Contador automático de evidencias
- ✅ Eliminación segura de archivos
- ✅ Estadísticas de evidencias
- ✅ Autenticación y autorización
- ✅ Manejo de errores robusto
- ✅ Logging completo

---

## 🎓 NOTAS PARA EL FRONTEND

### **Tipos de Archivo Permitidos:**
```javascript
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];
```

### **Límites:**
- Tamaño máximo por archivo: **10MB**
- Archivos por subida: **20 archivos**
- Total de evidencias por plataforma: **50 archivos**

### **URLs de Descarga:**
Las evidencias retornan `downloadUrl` que es una URL pública de Firebase Storage que puede ser usada directamente en `<img>` tags o `<a>` tags.

---

## 🔄 SINCRONIZACIÓN CON FRONTEND

El frontend ya está preparado para:
1. ✅ Subir archivos con drag & drop
2. ✅ Mostrar galería de evidencias
3. ✅ Eliminar evidencias
4. ✅ Gestionar descripciones

**El backend ahora soporta todas estas operaciones al 100%.**

---

**🎯 Estado Final: LISTO PARA PRODUCCIÓN**

