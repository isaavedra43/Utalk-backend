const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('../utils/logger');
const { correlationMiddleware } = require('../middleware/correlation');
const { corsOptions } = require('../config/cors');

function applyBasicMiddlewares(app) {
  logger.info('🛡️ Configurando middlewares básicos...', {
    category: 'MIDDLEWARE_SETUP'
  });

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  }));

  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    type: ['application/json', 'text/plain']
  }));

  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 20
  }));

  app.use(correlationMiddleware);

  app.use((req, res, next) => {
    res.set({
      'X-Powered-By': 'UTalk-Backend-v4.1-Enterprise',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-DNS-Prefetch-Control': 'off'
    });
    next();
  });

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  logger.info('✅ Middlewares básicos configurados', {
    category: 'MIDDLEWARE_SUCCESS',
    trustProxy: process.env.NODE_ENV === 'production'
  });
}

module.exports = { applyBasicMiddlewares }; 