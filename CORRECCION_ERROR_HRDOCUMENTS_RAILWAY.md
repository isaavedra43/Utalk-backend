# ✅ Corrección Error Módulo HR Documents - Railway

**Fecha**: 7 de Octubre, 2025  
**Error**: `SyntaxError: Identifier 'express' has already been declared`  
**Ubicación**: `/app/src/routes/hrDocuments.js:15`

---

## 🔍 Análisis del Problema

### Error Identificado
El archivo `src/routes/hrDocuments.js` contenía **código duplicado** en las primeras líneas:

```javascript
// LÍNEAS 1-14 (DUPLICADO - ELIMINADAS)
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const HRDocumentsController = require('../controllers/HRDocumentsController');

router.use(authMiddleware);

// Rutas básicas...
module.exports = router;

// LÍNEA 15 - AQUÍ OCURRÍA EL ERROR
const express = require('express'); // ❌ ERROR: Ya declarado arriba
```

Node.js intentaba declarar la constante `express` dos veces, lo cual causaba el error de sintaxis.

---

## 🔧 Correcciones Realizadas

### 1. ✅ Eliminación de Código Duplicado
**Archivo**: `src/routes/hrDocuments.js`  
**Acción**: Eliminadas líneas 1-14 (bloque duplicado)

**Antes**:
```javascript
const express = require('express');
const router = express.Router();
// ... código duplicado ...
module.exports = router;

const express = require('express'); // ❌ ERROR
const router = express.Router();
// ... código real ...
```

**Después**:
```javascript
const express = require('express'); // ✅ Una sola declaración
const router = express.Router();
const multer = require('multer');
const path = require('path');
// ... resto del código correcto ...
```

### 2. ✅ Eliminación de Importación Duplicada en routes.js
**Archivo**: `src/config/routes.js`  
**Acción**: Eliminada línea 123 (importación duplicada)

**Antes**:
```javascript
app.use('/api/hr', hrDocumentRoutes);         // Línea 121 ✅
// Alias directo para documentos RH si el módulo no estaba montado
app.use('/api/hr', require('../routes/hrDocuments')); // Línea 123 ❌ DUPLICADO
```

**Después**:
```javascript
app.use('/api/hr', hrDocumentRoutes); // ✅ Una sola importación
// Rutas directas para adjuntos de vacaciones, incidentes y equipos
```

---

## 📊 Análisis de Arquitectura de Archivos

### Patrón de Manejo de Archivos en Módulos Existentes

#### Módulo de Extras/Empleados (Referencia):
```javascript
// AttachmentsController.js
static getMulterConfig() {
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads/attachments');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  return multer({ storage, fileFilter, limits });
}
```

**Características**:
- Usa `diskStorage` para guardar archivos en el sistema de archivos local
- Guarda metadatos en Firestore en subcolección `attachments`
- Permite hasta 5 archivos (10MB cada uno)

#### Módulo de HR Documents (Corregido):
```javascript
// hrDocuments.js
const upload = multer({
  storage: multer.memoryStorage(), // Archivos en memoria
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
    files: 1 // Un archivo por vez
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      // ... más tipos permitidos
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});
```

**Características**:
- Usa `memoryStorage` para mantener archivos en buffer
- Los archivos se suben directamente a Firebase Storage
- Soporta archivos más grandes (50MB)
- Más tipos de archivo permitidos (PDFs, Office, imágenes, videos, audio, archivos comprimidos)

---

## 🗂️ Estructura del Módulo HR Documents

### Controladores
1. **HRDocumentController.js** (Principal - 20 métodos)
   - `getDocuments` - Listar documentos con filtros
   - `getDocumentById` - Obtener documento específico
   - `uploadDocument` - Subir nuevo documento
   - `updateDocument` - Actualizar metadatos
   - `deleteDocument` - Eliminar documento
   - `downloadDocument` - Descargar documento
   - `getPreview` - Obtener vista previa
   - `toggleFavorite` - Marcar como favorito
   - `togglePin` - Fijar documento
   - `shareDocument` - Compartir documento
   - `duplicateDocument` - Duplicar documento
   - `moveDocument` - Mover a carpeta
   - `getSummary` - Resumen estadístico
   - `searchDocuments` - Búsqueda avanzada
   - `getFolders` - Obtener carpetas
   - `createFolder` - Crear carpeta
   - `deleteFolder` - Eliminar carpeta
   - `getActivity` - Historial de actividad
   - `exportDocuments` - Exportar a Excel/PDF
   - `initializeModule` - Inicializar módulo

2. **HRDocumentsController.js** (Legacy - 3 métodos)
   - `list` - Listar documentos (versión simple)
   - `summary` - Resumen (versión simple)
   - `folders` - Obtener carpetas (versión simple)

### Modelos
- **HRDocument.js** - Modelo principal de documento
- **HRDocumentSummary.js** - Resumen estadístico
- **HRDocumentFolder.js** - Carpetas de documentos
- **HRDocumentActivity.js** - Registro de actividad

### Servicios
- **HRDocumentInitializationService.js** - Inicialización del sistema
  - Crea resumen inicial
  - Crea carpetas por defecto
  - Verifica estructura de base de datos

### Configuración
- **hrDocumentConfig.js** - Configuración centralizada
  - Categorías de documentos
  - Tipos de archivo permitidos
  - Límites y validaciones
  - Permisos por rol
  - Mensajes de error y éxito

---

## 🛣️ Rutas Configuradas

### Endpoints Principales (`/api/hr`)

#### Documentos
```
GET    /api/hr/                          - Listar documentos
GET    /api/hr/summary                   - Resumen estadístico
GET    /api/hr/search                    - Búsqueda avanzada
GET    /api/hr/activity                  - Historial de actividad
GET    /api/hr/export                    - Exportar documentos
POST   /api/hr/initialize                - Inicializar módulo
GET    /api/hr/:documentId               - Obtener documento específico
POST   /api/hr/                          - Subir nuevo documento
PUT    /api/hr/:documentId               - Actualizar documento
DELETE /api/hr/:documentId               - Eliminar documento
GET    /api/hr/:documentId/download      - Descargar documento
GET    /api/hr/:documentId/preview       - Vista previa
PUT    /api/hr/:documentId/favorite      - Toggle favorito
PUT    /api/hr/:documentId/pin           - Toggle fijado
POST   /api/hr/:documentId/share         - Compartir documento
POST   /api/hr/:documentId/duplicate     - Duplicar documento
PUT    /api/hr/:documentId/move          - Mover documento
```

#### Carpetas
```
GET    /api/hr/folders                   - Listar carpetas
POST   /api/hr/folders                   - Crear carpeta
DELETE /api/hr/folders/:folderName       - Eliminar carpeta
```

---

## ✅ Verificación de Funcionamiento

### Checklist de Validación

- [x] **Sintaxis corregida**: Eliminada duplicación de `const express`
- [x] **Importaciones únicas**: Eliminada importación duplicada en `routes.js`
- [x] **Sin errores de linter**: Verificado con `read_lints`
- [x] **Controlador completo**: 20 métodos implementados
- [x] **Rutas alineadas**: Todas las rutas apuntan al controlador correcto
- [x] **Configuración de multer**: `memoryStorage` + Firebase Storage
- [x] **Modelos implementados**: HRDocument, HRDocumentSummary, HRDocumentFolder, HRDocumentActivity
- [x] **Servicio de inicialización**: HRDocumentInitializationService funcional
- [x] **Configuración centralizada**: hrDocumentConfig.js completo

---

## 🚀 Próximos Pasos

### Para Desplegar en Railway:

1. **Commit y Push**:
   ```bash
   git add .
   git commit -m "fix: corregir error de duplicación en hrDocuments.js"
   git push origin main
   ```

2. **Railway se desplegará automáticamente** con los cambios

3. **Verificar en Railway**:
   - Revisar logs de despliegue
   - Verificar que no haya errores de sintaxis
   - Confirmar que el servidor inicie correctamente

### Para Inicializar el Módulo (Primera vez):

```bash
POST /api/hr/initialize
Headers: {
  Authorization: Bearer <admin_token>
}
```

Este endpoint creará:
- Resumen inicial de documentos
- 8 carpetas por defecto:
  - Plantillas
  - Políticas
  - Procedimientos
  - Manuales
  - Formatos
  - Capacitación
  - Legal
  - Multimedia

---

## 📝 Lecciones Aprendidas

1. **Evitar código duplicado**: Siempre revisar archivos antes de agregar código
2. **Validar imports**: Verificar que no haya importaciones duplicadas en `routes.js`
3. **Usar linter**: Ejecutar `read_lints` para detectar errores antes del despliegue
4. **Documentar patrones**: Mantener consistencia en el manejo de archivos entre módulos

---

## 🔗 Referencias

- **Módulo de referencia**: `src/routes/employees.js` (manejo de archivos con extras)
- **Controlador de archivos**: `src/controllers/AttachmentsController.js`
- **Configuración de storage**: `src/config/storage.js`
- **Documentación de multer**: https://github.com/expressjs/multer

---

**Status**: ✅ COMPLETADO  
**Impacto**: 🟢 BAJO - Solo corrección de sintaxis  
**Testing**: 🟢 Linter OK - Sin errores  
**Deploy**: 🟡 Pendiente - Listo para Railway

