const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route   GET /api/conversations/:conversationId/messages
 * @desc    Obtener todos los mensajes de una conversación específica (EMAIL-FIRST)
 * @access  Private (Admin, Agent, Viewer)
 * @params  conversationId (UUID)
 * @query   limit, cursor
 */
// NOTA: Esta ruta debería estar lógicamente en `conversations.js`,
// pero por ahora la mantenemos aquí para arreglar el bug de arranque.
// router.get('/:conversationId/messages', ...); <-- Se moverá a conversations.js

/**
 * @route   POST /api/messages/send
 * @desc    Enviar un mensaje de WhatsApp saliente (EMAIL-FIRST)
 * @access  Private (Admin, Agent only)
 * @body    { conversationId: (UUID), content: "..." }
 */
router.post('/send',
  requireWriteAccess,
  validate(schemas.message.send), // Asegurarse que este schema esté actualizado
  MessageController.sendMessage,
);


// --- RUTAS OBSOLETAS ELIMINADAS ---
// Las siguientes rutas fueron eliminadas porque sus controladores
// no existen después de la refactorización EMAIL-FIRST o su lógica ha cambiado.

// router.get('/', MessageController.getMessages); // <- Ambiguo sin conversationId
// router.get('/conversation/:phone', MessageController.getConversationByPhone); // <- Obsoleto
// router.get('/stats', MessageController.getStats); // <- Lógica movida
// router.put('/:id/status', MessageController.updateStatus); // <- Lógica movida
// router.put('/:id/read', MessageController.markAsRead); // <- Lógica movida
// router.put('/read-multiple', MessageController.markMultipleAsRead); // <- Lógica movida
// router.get('/search', MessageController.search); // <- Obsoleto


// EXPORT PATTERN: Single router export
module.exports = router;
