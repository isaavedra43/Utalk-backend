/**
 * 📦 RUTAS DE INVENTARIO
 * 
 * Configura todas las rutas para el módulo de inventario de materiales.
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// Middleware de autenticación
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

// Configuración de Multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20
  }
});

// Controladores
const InventoryProviderController = require('../controllers/InventoryProviderController');
const InventoryPlatformController = require('../controllers/InventoryPlatformController');
const InventoryMaterialController = require('../controllers/InventoryMaterialController');
const InventoryConfigurationController = require('../controllers/InventoryConfigurationController');
const InventoryEvidenceController = require('../controllers/InventoryEvidenceController');
const InventoryDriverController = require('../controllers/InventoryDriverController');

/**
 * 🔐 MIDDLEWARE DE AUTENTICACIÓN
 * Todas las rutas requieren autenticación
 */
router.use(authMiddleware);

/**
 * ⚙️ CONFIGURACIÓN
 */

// GET /api/inventory/configuration
router.get('/configuration',
  InventoryConfigurationController.get
);

// PUT /api/inventory/configuration
router.put('/configuration',
  InventoryConfigurationController.update
);

// POST /api/inventory/configuration/sync
router.post('/configuration/sync',
  InventoryConfigurationController.sync
);

/**
 * 📦 PROVEEDORES
 */

// GET /api/inventory/providers/:providerId/stats (PRIMERO - ruta específica)
router.get('/providers/:providerId/stats',
  InventoryProviderController.getStats
);

// GET /api/inventory/providers/:providerId/platforms (PRIMERO - ruta específica)
router.get('/providers/:providerId/platforms',
  InventoryProviderController.getPlatforms
);

// ============================================
// MATERIALES DEL PROVEEDOR (Primero - rutas específicas)
// ============================================

// GET /api/inventory/providers/:providerId/materials/:materialId
router.get('/providers/:providerId/materials/:materialId',
  InventoryProviderController.getMaterial
);

// GET /api/inventory/providers/:providerId/materials
router.get('/providers/:providerId/materials',
  InventoryProviderController.listMaterials
);

// POST /api/inventory/providers/:providerId/materials
router.post('/providers/:providerId/materials',
  InventoryProviderController.createMaterial
);

// PUT /api/inventory/providers/:providerId/materials/:materialId
router.put('/providers/:providerId/materials/:materialId',
  InventoryProviderController.updateMaterial
);

// DELETE /api/inventory/providers/:providerId/materials/:materialId
router.delete('/providers/:providerId/materials/:materialId',
  InventoryProviderController.deleteMaterial
);

// ============================================
// ÓRDENES DE COMPRA
// ============================================

// GET /api/inventory/providers/:providerId/purchase-orders/:orderId
router.get('/providers/:providerId/purchase-orders/:orderId',
  InventoryProviderController.getPurchaseOrder
);

// GET /api/inventory/providers/:providerId/purchase-orders
router.get('/providers/:providerId/purchase-orders',
  InventoryProviderController.listPurchaseOrders
);

// POST /api/inventory/providers/:providerId/purchase-orders
router.post('/providers/:providerId/purchase-orders',
  InventoryProviderController.createPurchaseOrder
);

// PUT /api/inventory/providers/:providerId/purchase-orders/:orderId
router.put('/providers/:providerId/purchase-orders/:orderId',
  InventoryProviderController.updatePurchaseOrder
);

// DELETE /api/inventory/providers/:providerId/purchase-orders/:orderId
router.delete('/providers/:providerId/purchase-orders/:orderId',
  InventoryProviderController.deletePurchaseOrder
);

// ============================================
// PAGOS
// ============================================

// GET /api/inventory/providers/:providerId/payments/:paymentId
router.get('/providers/:providerId/payments/:paymentId',
  InventoryProviderController.getPayment
);

// GET /api/inventory/providers/:providerId/payments
router.get('/providers/:providerId/payments',
  InventoryProviderController.listPayments
);

// POST /api/inventory/providers/:providerId/payments
router.post('/providers/:providerId/payments',
  InventoryProviderController.createPayment
);

// PUT /api/inventory/providers/:providerId/payments/:paymentId
router.put('/providers/:providerId/payments/:paymentId',
  InventoryProviderController.updatePayment
);

// DELETE /api/inventory/providers/:providerId/payments/:paymentId
router.delete('/providers/:providerId/payments/:paymentId',
  InventoryProviderController.deletePayment
);

// ============================================
// DOCUMENTOS
// ============================================

// GET /api/inventory/providers/:providerId/documents
router.get('/providers/:providerId/documents',
  InventoryProviderController.listDocuments
);

// POST /api/inventory/providers/:providerId/documents
router.post('/providers/:providerId/documents',
  InventoryProviderController.createDocument
);

// DELETE /api/inventory/providers/:providerId/documents/:documentId
router.delete('/providers/:providerId/documents/:documentId',
  InventoryProviderController.deleteDocument
);

// ============================================
// ACTIVIDADES
// ============================================

// GET /api/inventory/providers/:providerId/activities
router.get('/providers/:providerId/activities',
  InventoryProviderController.listActivities
);

// POST /api/inventory/providers/:providerId/activities
router.post('/providers/:providerId/activities',
  InventoryProviderController.createActivity
);

// ============================================
// CALIFICACIONES
// ============================================

// GET /api/inventory/providers/:providerId/rating
router.get('/providers/:providerId/rating',
  InventoryProviderController.getRating
);

// POST /api/inventory/providers/:providerId/rating
router.post('/providers/:providerId/rating',
  InventoryProviderController.updateRating
);

// ============================================
// ESTADO DE CUENTA
// ============================================

// GET /api/inventory/providers/:providerId/account-statement
router.get('/providers/:providerId/account-statement',
  InventoryProviderController.getAccountStatement
);

// ============================================
// PROVEEDORES (rutas generales al final)
// ============================================

// GET /api/inventory/providers/:providerId/stats (PRIMERO - ruta específica)
router.get('/providers/:providerId/stats',
  InventoryProviderController.getStats
);

// GET /api/inventory/providers/:providerId/platforms (PRIMERO - ruta específica)
router.get('/providers/:providerId/platforms',
  InventoryProviderController.getPlatforms
);

// GET /api/inventory/providers
router.get('/providers',
  InventoryProviderController.list
);

// GET /api/inventory/providers/:providerId
router.get('/providers/:providerId',
  InventoryProviderController.getById
);

// POST /api/inventory/providers
router.post('/providers',
  InventoryProviderController.create
);

// PUT /api/inventory/providers/:providerId
router.put('/providers/:providerId',
  InventoryProviderController.update
);

// DELETE /api/inventory/providers/:providerId
router.delete('/providers/:providerId',
  InventoryProviderController.delete
);

/**
 * 🚛 PLATAFORMAS
 */

// GET /api/inventory/platforms/stats (PRIMERO - ruta específica)
router.get('/platforms/stats',
  InventoryPlatformController.getStats
);

// GET /api/inventory/platforms
router.get('/platforms',
  InventoryPlatformController.list
);

// GET /api/inventory/platforms/:platformId
router.get('/platforms/:platformId',
  InventoryPlatformController.getById
);

// POST /api/inventory/platforms
router.post('/platforms',
  InventoryPlatformController.create
);

// PUT /api/inventory/platforms/:platformId
router.put('/platforms/:platformId',
  InventoryPlatformController.update
);

// DELETE /api/inventory/platforms/:platformId
router.delete('/platforms/:platformId',
  InventoryPlatformController.delete
);

/**
 * 🎨 MATERIALES
 */

// GET /api/inventory/materials/active (PRIMERO - ruta específica)
router.get('/materials/active',
  InventoryMaterialController.getActive
);

// GET /api/inventory/materials/category/:category (PRIMERO - ruta específica)
router.get('/materials/category/:category',
  InventoryMaterialController.getByCategory
);

// GET /api/inventory/materials
router.get('/materials',
  InventoryMaterialController.list
);

// POST /api/inventory/materials
router.post('/materials',
  InventoryMaterialController.create
);

// PUT /api/inventory/materials/:materialId
router.put('/materials/:materialId',
  InventoryMaterialController.update
);

// DELETE /api/inventory/materials/:materialId
router.delete('/materials/:materialId',
  InventoryMaterialController.delete
);

/**
 * 📸 EVIDENCIAS
 */

// GET /api/inventory/evidence/stats/:platformId (PRIMERO - ruta específica)
router.get('/evidence/stats/:platformId',
  InventoryEvidenceController.getStats
);

// POST /api/inventory/evidence/upload
router.post('/evidence/upload',
  upload.array('files', 20),
  InventoryEvidenceController.upload
);

// GET /api/inventory/evidence/:platformId
router.get('/evidence/:platformId',
  InventoryEvidenceController.getByPlatform
);

// DELETE /api/inventory/evidence/:evidenceId
router.delete('/evidence/:evidenceId',
  InventoryEvidenceController.delete
);

/**
 * 🚛 CHOFERES
 */

// GET /api/inventory/drivers/active (PRIMERO - ruta específica)
router.get('/drivers/active',
  InventoryDriverController.listActive
);

// GET /api/inventory/drivers/stats (PRIMERO - ruta específica)
router.get('/drivers/stats',
  InventoryDriverController.getStats
);

// GET /api/inventory/drivers/vehicle-type/:type (PRIMERO - ruta específica)
router.get('/drivers/vehicle-type/:type',
  InventoryDriverController.listByVehicleType
);

// GET /api/inventory/drivers
router.get('/drivers',
  InventoryDriverController.list
);

// GET /api/inventory/drivers/:id
router.get('/drivers/:id',
  InventoryDriverController.getById
);

// POST /api/inventory/drivers
router.post('/drivers',
  InventoryDriverController.create
);

// PUT /api/inventory/drivers/:id
router.put('/drivers/:id',
  InventoryDriverController.update
);

// DELETE /api/inventory/drivers/:id
router.delete('/drivers/:id',
  InventoryDriverController.delete
);

module.exports = router;

