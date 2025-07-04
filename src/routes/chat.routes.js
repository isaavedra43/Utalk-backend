// src/routes/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');

// Twilio envía aquí los webhooks de mensajes entrantes
router.post('/webhook', chatController.receiveWebhook);

// API para enviar un mensaje saliente
router.post('/send', chatController.sendMessage);

// API para listar últimos 50 mensajes
router.get('/', chatController.listMessages);

module.exports = router;
