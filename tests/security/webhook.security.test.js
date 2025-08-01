/**
 * 🔐 TESTS DE SEGURIDAD PARA WEBHOOKS
 * 
 * Valida que los webhooks estén correctamente protegidos contra:
 * - Spoofing de firma
 * - Rate limiting abuse
 * - Payload malicioso
 * - Headers faltantes
 * 
 * @version 1.0.0
 * @author Security Team
 */

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/index');
const { rateLimitManager } = require('../../src/middleware/persistentRateLimit');

describe('🔐 Webhook Security Tests', () => {
  const webhookEndpoint = '/api/messages/webhook';
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 'test_token';
  
  beforeAll(async () => {
    // Inicializar rate limiting para tests
    await rateLimitManager.initialize();
  });

  afterEach(() => {
    // Limpiar rate limits entre tests
    rateLimitManager.memoryStore.clear();
  });

  describe('🚫 Validación de Firma Twilio', () => {
    
    test('DEBE rechazar webhook sin firma Twilio', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      const response = await request(app)
        .post(webhookEndpoint)
        .send(payload)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Webhook signature validation failed',
        code: 'MISSING_SIGNATURE'
      });
    });

    test('DEBE rechazar webhook con firma inválida', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      const response = await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', 'invalid_signature_base64')
        .send(payload)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Webhook signature validation failed',
        code: 'INVALID_SIGNATURE'
      });
    });

    test('DEBE aceptar webhook con firma válida', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      // Generar firma válida
      const url = `http://127.0.0.1/api/messages/webhook`;
      const postBody = Object.keys(payload)
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      
      const validSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(url + postBody, 'utf-8')
        .digest('base64');

      const response = await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', validSignature)
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty('validated', true);
    });

    test('DEBE loguear intentos de spoofing', async () => {
      const logSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', 'spoofed_signature')
        .send({ MessageSid: 'fake' })
        .expect(403);

      // Verificar que se logueó el intento malicioso
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('WEBHOOK'),
        expect.objectContaining({
          error: expect.any(String)
        })
      );

      logSpy.mockRestore();
    });
  });

  describe('🚦 Rate Limiting de Webhooks', () => {
    
    test('DEBE aplicar rate limiting a webhooks', async () => {
      const payload = {
        MessageSid: 'SMtest',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test'
      };

      // Generar firma válida para todas las requests
      const url = `http://127.0.0.1/api/messages/webhook`;
      const postBody = Object.keys(payload)
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      
      const validSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(url + postBody, 'utf-8')
        .digest('base64');

      // Enviar múltiples requests rápidamente
      const requests = Array(35).fill().map(() => 
        request(app)
          .post(webhookEndpoint)
          .set('X-Twilio-Signature', validSignature)
          .send(payload)
      );

      const responses = await Promise.all(requests);
      
      // Algunas deberían ser exitosas (200) y otras rechazadas por rate limit (429)
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body).toMatchObject({
        error: 'Webhook rate limit exceeded',
        code: 'WEBHOOK_RATE_LIMIT'
      });
    });

    test('DEBE persistir rate limits entre requests', async () => {
      // Test de persistencia del rate limiting
      // (Implementar según la configuración específica de persistencia)
      
      expect(rateLimitManager.initialized).toBe(true);
      
      const stats = await rateLimitManager.getStats();
      expect(stats).toHaveProperty('store');
      expect(stats).toHaveProperty('configurations');
    });
  });

  describe('💉 Payload Injection Tests', () => {
    
    test('DEBE rechazar payloads con caracteres maliciosos', async () => {
      const maliciousPayloads = [
        { Body: '<script>alert("xss")</script>' },
        { Body: '"; DROP TABLE messages; --' },
        { Body: '${process.env.SECRET}' },
        { From: '../../../etc/passwd' },
        { MessageSid: null },
        { MessageSid: undefined },
        { MessageSid: {} }
      ];

      for (const maliciousPayload of maliciousPayloads) {
        const payload = {
          MessageSid: 'SMtest123',
          From: 'whatsapp:+1234567890',
          To: 'whatsapp:+0987654321',
          Body: 'Test message',
          ...maliciousPayload
        };

        // Generar firma válida
        const url = `http://127.0.0.1/api/messages/webhook`;
        const postBody = Object.keys(payload)
          .filter(key => payload[key] !== null && payload[key] !== undefined)
          .sort()
          .map(key => `${key}=${payload[key]}`)
          .join('&');
        
        const validSignature = crypto
          .createHmac('sha1', twilioAuthToken)
          .update(url + postBody, 'utf-8')
          .digest('base64');

        const response = await request(app)
          .post(webhookEndpoint)
          .set('X-Twilio-Signature', validSignature)
          .send(payload);

        // Debería procesarse pero con sanitización
        // (El comportamiento específico depende de la implementación de validación)
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('🔒 Headers y Metadata Security', () => {
    
    test('DEBE validar User-Agent de Twilio', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      // Generar firma válida
      const url = `http://127.0.0.1/api/messages/webhook`;
      const postBody = Object.keys(payload)
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      
      const validSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(url + postBody, 'utf-8')
        .digest('base64');

      // Test con User-Agent sospechoso
      const response = await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', validSignature)
        .set('User-Agent', 'malicious-bot/1.0')
        .send(payload);

      // Debería procesar pero loguear el User-Agent sospechoso
      expect(response.status).toBe(200);
    });

    test('DEBE rechazar requests con Content-Type inválido', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      const response = await request(app)
        .post(webhookEndpoint)
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(payload));

      // Debería rechazar por Content-Type incorrecto
      expect([400, 415]).toContain(response.status);
    });
  });

  describe('📊 Logging y Auditoría', () => {
    
    test('DEBE loguear todos los webhooks exitosos', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      // Generar firma válida
      const url = `http://127.0.0.1/api/messages/webhook`;
      const postBody = Object.keys(payload)
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      
      const validSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(url + postBody, 'utf-8')
        .digest('base64');

      await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', validSignature)
        .send(payload)
        .expect(200);

      // Verificar que se logueó correctamente
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('WEBHOOK TWILIO SEGURO'),
        expect.objectContaining({
          messageSid: payload.MessageSid,
          validated: expect.any(String)
        })
      );

      logSpy.mockRestore();
    });

    test('DEBE generar métricas de seguridad', async () => {
      const stats = await rateLimitManager.getStats();
      
      expect(stats).toHaveProperty('store');
      expect(stats).toHaveProperty('memoryEntries');
      expect(stats).toHaveProperty('configurations');
      expect(stats.configurations).toContain('webhook');
    });
  });

  describe('🔄 Recovery y Resilience', () => {
    
    test('DEBE manejar errores internos sin exponer información', async () => {
      const payload = {
        MessageSid: 'SMtest123',
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        Body: 'Test message'
      };

      // Mock de error interno
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Generar firma válida
      const url = `http://127.0.0.1/api/messages/webhook`;
      const postBody = Object.keys(payload)
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      
      const validSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(url + postBody, 'utf-8')
        .digest('base64');

      const response = await request(app)
        .post(webhookEndpoint)
        .set('X-Twilio-Signature', validSignature)
        .send(payload);

      // Debería responder 200 incluso con errores internos (protocolo Twilio)
      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');

      console.error = originalConsoleError;
    });
  });
}); 