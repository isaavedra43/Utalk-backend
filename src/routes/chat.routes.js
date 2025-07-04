const router = require('express').Router();
const chatController = require('../controllers/chat.controller');

router.post('/webhook', chatController.receiveIncoming);
router.post('/send', chatController.sendOutgoing);
router.get('/messages', chatController.listLast);

module.exports = router;
