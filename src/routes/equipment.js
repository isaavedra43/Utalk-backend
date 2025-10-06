const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const EquipmentAttachmentController = require('../controllers/EquipmentAttachmentController');

// Alias de subida de archivos para compatibilidad:
// Frontend llama: POST /api/equipment/upload
// Reutiliza exactamente la misma lógica que /api/equipment/attachments/upload

router.use(authMiddleware);

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }
});

router.post('/upload', upload.array('files'), EquipmentAttachmentController.uploadAttachments);

module.exports = router;

const express = require('express');
const router = express.Router();
const EquipmentController = require('../controllers/EquipmentController');
const EquipmentReviewController = require('../controllers/EquipmentReviewController');
const { authMiddleware } = require('../middleware/auth');
const { validateRequiredFields } = require('../middleware/validation');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * 🔧 RUTAS DE EQUIPOS Y HERRAMIENTAS
 * 
 * Endpoints para gestión de equipos asignados a empleados
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */

// ========================================
// RUTAS PRINCIPALES DE EQUIPOS
// ========================================

// 1. Obtener todos los equipos de un empleado
router.get('/:employeeId/equipment', EquipmentController.getByEmployee);

// 2. Obtener equipo específico
router.get('/:employeeId/equipment/:equipmentId', EquipmentController.getById);

// 3. Crear nuevo equipo
router.post('/:employeeId/equipment', 
  validateRequiredFields(['name', 'description', 'category', 'purchaseDate', 'purchasePrice', 'assignedDate', 'invoice']),
  EquipmentController.create
);

// 4. Actualizar equipo
router.put('/:employeeId/equipment/:equipmentId', EquipmentController.update);

// 5. Eliminar equipo
router.delete('/:employeeId/equipment/:equipmentId', EquipmentController.delete);

// ========================================
// RUTAS DE ACCIONES DE ESTADO
// ========================================

// 6. Devolver equipo
router.put('/:employeeId/equipment/:equipmentId/return', 
  validateRequiredFields(['condition']),
  EquipmentController.return
);

// 7. Reportar equipo perdido
router.put('/:employeeId/equipment/:equipmentId/report-lost', 
  validateRequiredFields(['lostDate', 'description']),
  EquipmentController.reportLost
);

// 8. Reportar daño en equipo
router.put('/:employeeId/equipment/:equipmentId/report-damage', 
  validateRequiredFields(['description', 'severity']),
  EquipmentController.reportDamage
);

// ========================================
// RUTAS DE REVISIONES
// ========================================

// 9. Crear nueva revisión
router.post('/:employeeId/equipment/:equipmentId/reviews', 
  validateRequiredFields(['reviewType', 'condition', 'cleanliness', 'functionality']),
  EquipmentReviewController.create
);

// 10. Obtener revisiones de un equipo
router.get('/:employeeId/equipment/:equipmentId/reviews', EquipmentReviewController.getByEquipment);

// 11. Obtener revisión específica
router.get('/:employeeId/equipment/:equipmentId/reviews/:reviewId', EquipmentReviewController.getById);

// 12. Obtener estadísticas de revisiones
router.get('/:employeeId/equipment/:equipmentId/reviews/stats', EquipmentReviewController.getStats);

// 13. Obtener última revisión
router.get('/:employeeId/equipment/:equipmentId/reviews/last', EquipmentReviewController.getLastReview);

// 14. Programar próxima revisión
router.post('/:employeeId/equipment/:equipmentId/schedule-review', 
  EquipmentReviewController.scheduleReview
);

// 15. Eliminar revisión
router.delete('/:employeeId/equipment/:equipmentId/reviews/:reviewId', EquipmentReviewController.delete);

// ========================================
// RUTAS DE DATOS Y REPORTES
// ========================================

// 16. Obtener resumen estadístico
router.get('/:employeeId/equipment/summary', EquipmentController.getSummary);

// 17. Exportar equipos
router.get('/:employeeId/equipment/export', EquipmentController.export);

// 18. Generar reporte específico
router.get('/:employeeId/equipment/report/:reportType', EquipmentController.generateReport);

module.exports = router;
