// Debug Railway Port Assignment
console.log('🔍 RAILWAY PORT DEBUG:');
console.log('process.env.PORT:', process.env.PORT);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars containing PORT:');

Object.keys(process.env)
  .filter(key => key.includes('PORT') || key.includes('port'))
  .forEach(key => {
    console.log(`${key}: ${process.env[key]}`);
  });

console.log('\nRailway specific vars:');
Object.keys(process.env)
  .filter(key => key.includes('RAILWAY'))
  .forEach(key => {
    console.log(`${key}: ${process.env[key]}`);
  });

// Test server
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({
    message: 'Railway Port Debug',
    port: process.env.PORT,
    actualPort: req.socket.localPort,
    environment: process.env.NODE_ENV
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Debug server running on 0.0.0.0:${PORT}`);
  console.log(`Railway PORT: ${process.env.PORT}`);
}); 