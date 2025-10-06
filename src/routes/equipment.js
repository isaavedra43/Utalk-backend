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
