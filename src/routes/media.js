const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authMiddleware } = require('../middleware/auth');
const MediaService = require('../services/MediaService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route GET /media/:category/:filename
 * @desc Servir archivo multimedia con autenticación
 * @access Private
 */
router.get('/:category/:filename', authMiddleware, async (req, res) => {
  try {
    const { category, filename } = req.params;

    // Validar categoría
    const allowedCategories = ['images', 'videos', 'audio', 'documents'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: 'Categoría inválida',
        message: 'Categoría de archivo no permitida',
      });
    }

    // Validar nombre de archivo
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        error: 'Nombre de archivo inválido',
        message: 'El nombre de archivo contiene caracteres no permitidos',
      });
    }

    const relativePath = `${category}/${filename}`;
    const mediaInfo = await MediaService.getMediaInfo(relativePath);

    if (!mediaInfo.exists) {
      return res.status(404).json({
        error: 'Archivo no encontrado',
        message: 'El archivo solicitado no existe',
      });
    }

    // Determinar tipo de contenido
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.weba': 'audio/webm',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    };

    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }

    // Configurar headers de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', mediaInfo.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 año

    // Leer y enviar archivo
    const fileBuffer = await fs.readFile(mediaInfo.fullPath);
    res.send(fileBuffer);

    logger.info('Archivo multimedia servido', {
      userId: req.user.id,
      file: relativePath,
      size: mediaInfo.size,
      contentType,
    });
  } catch (error) {
    logger.error('Error sirviendo archivo multimedia:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

module.exports = router;
