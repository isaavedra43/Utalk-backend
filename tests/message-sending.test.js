const request = require('supertest');
const app = require('../src/index');
const { v4: uuidv4 } = require('uuid');

describe('🧪 Pruebas de Aceptación - Envío de Mensajes', () => {
  let authToken;
  const baseUrl = '/api/conversations';
  const testConversationId = 'conv_+5214775211021_+5214793176502';
  const testConversationIdEncoded = 'conv_%2B5214775211021_%2B5214793176502';

  beforeAll(async () => {
    // Obtener token de autenticación (simulado)
    authToken = 'test-auth-token';
  });

  describe('✅ cURL OK (con %2B) → 200/201', () => {
    it('debe aceptar conversationId con URL encoding %2B', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationIdEncoded}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: 'Hola desde prueba con %2B',
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021',
          metadata: {
            source: 'test',
            testCase: 'url_encoding'
          }
        });

      expect(response.status).toBeOneOf([200, 201]);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBeDefined();
      expect(response.body.data.message.conversationId).toBe(testConversationId);
    });
  });

  describe('✅ cURL OK (con +) → 200/201', () => {
    it('debe aceptar conversationId con + directo', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: 'Hola desde prueba con +',
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021',
          metadata: {
            source: 'test',
            testCase: 'direct_plus'
          }
        });

      expect(response.status).toBeOneOf([200, 201]);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBeDefined();
      expect(response.body.data.message.conversationId).toBe(testConversationId);
    });
  });

  describe('❌ Falta senderIdentifier → 400 con field: "senderIdentifier"', () => {
    it('debe retornar 400 cuando falta senderIdentifier', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: 'Hola sin senderIdentifier',
          recipientIdentifier: 'whatsapp:+5214775211021'
          // senderIdentifier faltante
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'senderIdentifier',
          code: 'required'
        })
      );
    });
  });

  describe('❌ content vacío → 400 con detalle', () => {
    it('debe retornar 400 cuando content está vacío', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: '', // content vacío
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'content',
          code: 'string.empty'
        })
      );
    });
  });

  describe('❌ messageId inválido → 400', () => {
    it('debe retornar 400 cuando messageId no es UUID válido', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: 'invalid-uuid', // UUID inválido
          type: 'text',
          content: 'Hola con UUID inválido',
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'messageId',
          code: 'string.guid'
        })
      );
    });
  });

  describe('❌ senderIdentifier formato inválido → 400', () => {
    it('debe retornar 400 cuando senderIdentifier tiene formato inválido', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: 'Hola con senderIdentifier inválido',
          senderIdentifier: 'invalid-format', // Formato inválido
          recipientIdentifier: 'whatsapp:+5214775211021'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'senderIdentifier',
          code: 'any.invalid'
        })
      );
    });
  });

  describe('❌ conversationId formato inválido → 400', () => {
    it('debe retornar 400 cuando conversationId tiene formato inválido', async () => {
      const response = await request(app)
        .post(`${baseUrl}/invalid-conversation-id/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: uuidv4(),
          type: 'text',
          content: 'Hola con conversationId inválido',
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'conversationId',
          code: 'invalid_format'
        })
      );
    });
  });

  describe('✅ Extensiones opcionales', () => {
    it('debe autogenerar messageId si está vacío', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          messageId: '', // messageId vacío para autogeneración
          type: 'text',
          content: 'Hola con messageId autogenerado',
          senderIdentifier: 'whatsapp:+1234567890',
          recipientIdentifier: 'whatsapp:+5214775211021'
        });

      expect(response.status).toBeOneOf([200, 201]);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message.id).toBeDefined();
      expect(response.body.data.message.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('❌ Endpoint legacy deprecado', () => {
    it('debe retornar 410 para endpoint deprecado', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          content: 'Hola desde endpoint deprecado',
          type: 'text'
        });

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('deprecated_endpoint');
      expect(response.body.message).toContain('deprecado');
      expect(response.body.details.newEndpoint).toBe('/api/conversations/:conversationId/messages');
    });
  });
}); 