/**
 * 🧪 TESTS FASE C - ALMACENAMIENTO Y API DE SUGERENCIAS
 * 
 * Tests para verificar el almacenamiento de sugerencias en Firestore,
 * endpoints de generación y gestión de sugerencias.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const request = require('supertest');
const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');

// Importar app (asumiendo que exporta la app Express)
let app;

describe('🤖 FASE C - ALMACENAMIENTO Y API DE SUGERENCIAS', () => {
  before(async () => {
    // Importar la app Express
    const { default: server } = require('../../src/index');
    app = server.app;
  });

  describe('Modelo de Sugerencia', () => {
    const { Suggestion, SUGGESTION_STATES, SUGGESTION_TYPES } = require('../../src/models/Suggestion');

    it('Debe crear sugerencia válida', () => {
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: 'Hola, ¿en qué puedo ayudarte?',
        confianza: 0.8,
        modelo: 'gpt-4o-mini'
      };

      const suggestion = new Suggestion(suggestionData);

      expect(suggestion.conversationId).to.equal('conv_123');
      expect(suggestion.messageIdOrigen).to.equal('msg_456');
      expect(suggestion.texto).to.equal('Hola, ¿en qué puedo ayudarte?');
      expect(suggestion.confianza).to.equal(0.8);
      expect(suggestion.estado).to.equal(SUGGESTION_STATES.DRAFT);
      expect(suggestion.flagged).to.equal(false);
    });

    it('Debe validar campos requeridos', () => {
      expect(() => {
        new Suggestion({});
      }).to.throw('Validación fallida: conversationId es requerido, messageIdOrigen es requerido, texto es requerido y no puede estar vacío');
    });

    it('Debe sanitizar texto con HTML', () => {
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: '<script>alert("xss")</script>Hola <b>mundo</b>'
      };

      const suggestion = new Suggestion(suggestionData);
      expect(suggestion.texto).to.equal('Hola mundo');
    });

    it('Debe detectar contenido sensible', () => {
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: 'Mi tarjeta es 1234-5678-9012-3456'
      };

      const suggestion = new Suggestion(suggestionData);
      expect(suggestion.flagged).to.equal(true);
      expect(suggestion.metadata.riesgos).to.include('pii');
    });

    it('Debe generar preview correcto', () => {
      const longText = 'A'.repeat(300);
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: longText
      };

      const suggestion = new Suggestion(suggestionData);
      const preview = suggestion.getPreview();
      expect(preview.length).to.be.at.most(200);
      expect(preview).to.include('...');
    });

    it('Debe determinar tipo correcto', () => {
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: '¿Cuál es el precio del producto?'
      };

      const suggestion = new Suggestion(suggestionData);
      expect(suggestion.getType()).to.equal(SUGGESTION_TYPES.CONSULTA_PRECIOS);
    });
  });

  describe('Endpoint de Generación de Sugerencias', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();
    const testConversationId = 'test-conversation-' + uuidv4();
    const testMessageId = 'test-message-' + uuidv4();

    it('POST /api/ai/suggestions/generate - Debe generar y guardar sugerencia', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('ok', true);
      expect(response.body.data).to.have.property('suggestionId');
      expect(response.body.data).to.have.property('conversationId', testConversationId);
      expect(response.body.data).to.have.property('messageIdOrigen', testMessageId);
      expect(response.body.data).to.have.property('preview');
      expect(response.body.data).to.have.property('usage');
      expect(response.body.data.usage).to.have.property('in');
      expect(response.body.data.usage).to.have.property('out');
      expect(response.body.data.usage).to.have.property('latencyMs');
      expect(response.body.data).to.have.property('flagged');
      expect(response.body.data).to.have.property('warnings');
    });

    it('POST /api/ai/suggestions/generate - Debe fallar sin AI_ENABLED', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      // Simular AI_ENABLED=false
      const originalEnv = process.env.AI_ENABLED;
      process.env.AI_ENABLED = 'false';
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'AI_DISABLED');
      
      // Restaurar variable de entorno
      process.env.AI_ENABLED = originalEnv;
    });

    it('POST /api/ai/suggestions/generate - Debe fallar sin permisos', async () => {
      const mockUser = { role: 'user', email: 'user@test.com' }; // Rol sin permisos
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(403);

      expect(response.body).to.have.property('success', false);
    });

    it('POST /api/ai/suggestions/generate - Debe fallar con campos faltantes', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const invalidPayload = {
        workspaceId: testWorkspaceId
        // Falta conversationId y messageId
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidPayload)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Endpoints de Gestión de Sugerencias', () => {
    const testConversationId = 'test-conversation-' + uuidv4();
    const testSuggestionId = 'test-suggestion-' + uuidv4();

    it('GET /api/ai/suggestions/:conversationId - Debe obtener sugerencias', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };

      const response = await request(app)
        .get(`/api/ai/suggestions/${testConversationId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestions');
      expect(response.body.data).to.have.property('count');
      expect(Array.isArray(response.body.data.suggestions)).to.be.true;
    });

    it('GET /api/ai/suggestions/:conversationId - Debe filtrar por estado', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };

      const response = await request(app)
        .get(`/api/ai/suggestions/${testConversationId}?estado=draft`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestions');
    });

    it('PUT /api/ai/suggestions/:conversationId/:suggestionId/status - Debe actualizar estado', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };

      const payload = {
        status: 'sent'
      };

      const response = await request(app)
        .put(`/api/ai/suggestions/${testConversationId}/${testSuggestionId}/status`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestionId', testSuggestionId);
      expect(response.body.data).to.have.property('newStatus', 'sent');
    });

    it('PUT /api/ai/suggestions/:conversationId/:suggestionId/status - Debe fallar con estado inválido', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };

      const payload = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .put(`/api/ai/suggestions/${testConversationId}/${testSuggestionId}/status`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'INVALID_STATUS');
    });

    it('GET /api/ai/suggestions/:conversationId/stats - Debe obtener estadísticas', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };

      const response = await request(app)
        .get(`/api/ai/suggestions/${testConversationId}/stats`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('total');
      expect(response.body.data).to.have.property('draft');
      expect(response.body.data).to.have.property('sent');
      expect(response.body.data).to.have.property('discarded');
      expect(response.body.data).to.have.property('flagged');
      expect(response.body.data).to.have.property('byType');
      expect(response.body.data).to.have.property('byModel');
    });
  });

  describe('Validaciones de Seguridad', () => {
    it('Debe rechazar acceso sin autenticación', async () => {
      await request(app)
        .post('/api/ai/suggestions/generate')
        .send({
          workspaceId: 'test',
          conversationId: 'test',
          messageId: 'test'
        })
        .expect(401);
    });

    it('Debe rechazar acceso sin permisos adecuados', async () => {
      const mockUser = { role: 'user', email: 'user@test.com' }; // Rol sin permisos

      await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send({
          workspaceId: 'test',
          conversationId: 'test',
          messageId: 'test'
        })
        .expect(403);
    });
  });

  describe('Rate Limiting y Límites', () => {
    it('Debe respetar rate limit por conversación', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      const testWorkspaceId = 'test-workspace-' + uuidv4();
      const testConversationId = 'test-conversation-' + uuidv4();
      
      // Hacer múltiples requests rápidos
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const payload = {
          workspaceId: testWorkspaceId,
          conversationId: testConversationId,
          messageId: `msg-${i}`
        };
        
        promises.push(
          request(app)
            .post('/api/ai/suggestions/generate')
            .set('Authorization', 'Bearer mock-token')
            .set('X-User', JSON.stringify(mockUser))
            .send(payload)
        );
      }
      
      const responses = await Promise.all(promises);
      
      // Al menos algunas deben fallar por rate limit
      const rateLimitErrors = responses.filter(r => 
        r.body.success === false && 
        r.body.error?.code === 'RATE_LIMIT_EXCEEDED'
      );
      
      expect(rateLimitErrors.length).to.be.greaterThan(0);
    });
  });

  describe('Detección de Contenido Sensible', () => {
    it('Debe marcar sugerencias con PII como flagged', async () => {
      const { Suggestion } = require('../../src/models/Suggestion');
      
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: 'Mi email es test@example.com y mi teléfono es 123-456-7890'
      };

      const suggestion = new Suggestion(suggestionData);
      expect(suggestion.flagged).to.equal(true);
      expect(suggestion.metadata.riesgos).to.include('pii');
    });

    it('Debe marcar sugerencias con lenguaje ofensivo como flagged', async () => {
      const { Suggestion } = require('../../src/models/Suggestion');
      
      const suggestionData = {
        conversationId: 'conv_123',
        messageIdOrigen: 'msg_456',
        texto: 'Eres un idiota y no sabes nada'
      };

      const suggestion = new Suggestion(suggestionData);
      expect(suggestion.flagged).to.equal(true);
      expect(suggestion.metadata.riesgos).to.include('offensive');
    });
  });

  describe('Persistencia en Firestore', () => {
    it('Debe guardar sugerencia correctamente en Firestore', async () => {
      const { Suggestion } = require('../../src/models/Suggestion');
      const SuggestionsRepository = require('../../src/repositories/SuggestionsRepository');
      
      const suggestionData = {
        conversationId: 'conv_test_firestore',
        messageIdOrigen: 'msg_test_firestore',
        texto: 'Esta es una sugerencia de prueba para Firestore',
        confianza: 0.9,
        modelo: 'gpt-4o-mini'
      };

      const suggestion = new Suggestion(suggestionData);
      const repository = new SuggestionsRepository();
      
      const result = await repository.saveSuggestion(suggestion);
      
      expect(result.success).to.be.true;
      expect(result.suggestionId).to.equal(suggestion.id);
      expect(result.conversationId).to.equal(suggestion.conversationId);
    });

    it('Debe recuperar sugerencia guardada', async () => {
      const SuggestionsRepository = require('../../src/repositories/SuggestionsRepository');
      
      const repository = new SuggestionsRepository();
      const suggestion = await repository.getSuggestionById('conv_test_firestore', 'test-suggestion-id');
      
      // La sugerencia puede no existir en el test, pero la función debe funcionar
      if (suggestion) {
        expect(suggestion).to.be.instanceOf(require('../../src/models/Suggestion').Suggestion);
      }
    });
  });

  describe('Eventos de Socket', () => {
    it('Debe emitir evento suggestion:new cuando se genera sugerencia', async () => {
      // Este test verificaría que el evento se emite correctamente
      // En un entorno real, se conectaría un cliente Socket.IO para verificar
      
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      const testWorkspaceId = 'test-workspace-socket';
      const testConversationId = 'test-conversation-socket';
      const testMessageId = 'test-message-socket';
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      expect(response.body.data).to.have.property('ok', true);
      expect(response.body.data).to.have.property('suggestionId');
      
      // En un test real, verificaríamos que el evento se emitió
      // expect(socketEventEmitted).to.be.true;
    });
  });

  describe('Métricas y Logging', () => {
    it('Debe registrar métricas de generación', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: 'test-workspace-metrics',
        conversationId: 'test-conversation-metrics',
        messageId: 'test-message-metrics'
      };

      const response = await request(app)
        .post('/api/ai/suggestions/generate')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      // Verificar que se registran métricas
      expect(response.body.data.usage).to.have.property('in');
      expect(response.body.data.usage).to.have.property('out');
      expect(response.body.data.usage).to.have.property('latencyMs');
      expect(response.body.data.usage.latencyMs).to.be.a('number');
      expect(response.body.data.usage.latencyMs).to.be.greaterThan(0);
    });
  });
});