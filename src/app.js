const express = require('express');
const { applyBasicMiddlewares } = require('./config/middleware');

function createApp() {
  const app = express();
  applyBasicMiddlewares(app);
  return app;
}

module.exports = { createApp }; 