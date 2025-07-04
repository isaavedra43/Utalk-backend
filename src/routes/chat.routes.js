const router = require('express').Router();
const { handleWebhook, sendMessage, getMessages } = require('../controllers/chat.controller');

router.post('/webhook', handleWebhook);
router.post('/send', sendMessage);
router.get('/messages', getMessages);

module.exports = router;
