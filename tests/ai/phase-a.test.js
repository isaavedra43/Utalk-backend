/**
 * 🧪 TESTS FASE A - MÓDULO IA
 * 
 * Tests para verificar que la implementación base de IA
 * funciona correctamente sin llamar a proveedores reales.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const request = require('supertest');
const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');

// Importar app (asumiendo que exporta la app Express)
let app;

describe('🤖 FASE A - MÓDULO IA', () => {
  before(async () => {
    // Importar la app Express
    const { default: server } = require('../../src/index');
    app = server.app;
  });

  describe('Health Check IA', () => {
    it('GET /api/ai/health - Debe devolver estado saludable', async () => {
      const response = await request(app)
        .get('/api/ai/health')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('status', 'healthy');
      expect(response.body.data).to.have.property('phase', 'A');
      expect(response.body.data.features).to.have.property('fakeMode', true);
    });
  });

  describe('Configuración IA', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();

    it('GET /api/ai/config/:workspaceId - Debe crear configuración por defecto', async () => {
      // Simular usuario admin
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const response = await request(app)
        .get(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('workspaceId', testWorkspaceId);
      expect(response.body.data).to.have.property('ai_enabled', false);
      expect(response.body.data).to.have.property('defaultModel', 'gpt-4o-mini');
      expect(response.body.data).to.have.property('temperature', 0.3);
      expect(response.body.data).to.have.property('maxTokens', 150);
    });

    it('PUT /api/ai/config/:workspaceId - Debe actualizar configuración', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const updates = {
        ai_enabled: true,
        temperature: 0.7,
        maxTokens: 200,
        flags: {
          suggestions: true,
          rag: false
        }
      };

      const response = await request(app)
        .put(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(updates)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('ai_enabled', true);
      expect(response.body.data).to.have.property('temperature', 0.7);
      expect(response.body.data).to.have.property('maxTokens', 200);
      expect(response.body.data.flags).to.have.property('suggestions', true);
    });

    it('PUT /api/ai/config/:workspaceId - Debe validar valores fuera de rango', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const invalidUpdates = {
        temperature: 2.0, // Fuera de rango (0-1)
        maxTokens: 500    // Fuera de rango (1-300)
      };

      const response = await request(app)
        .put(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidUpdates)
        .expect(200);

      // Debe aplicar clamps automáticamente
      expect(response.body.data).to.have.property('temperature', 1.0);
      expect(response.body.data).to.have.property('maxTokens', 300);
    });
  });

  describe('Prueba de Sugerencias IA', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();
    const testConversationId = 'test-conversation-' + uuidv4();
    const testMessageId = 'test-message-' + uuidv4();

    it('POST /api/ai/test-suggestion - Debe generar sugerencia fake', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/test-suggestion')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestion');
      expect(response.body.data.suggestion).to.have.property('id');
      expect(response.body.data.suggestion).to.have.property('conversationId', testConversationId);
      expect(response.body.data.suggestion).to.have.property('messageIdOrigen', testMessageId);
      expect(response.body.data.suggestion.sugerencia).to.have.property('texto');
      expect(response.body.data.suggestion.sugerencia).to.have.property('confianza');
      expect(response.body.data.suggestion.metadata).to.have.property('fake', true);
      expect(response.body.data).to.have.property('context');
      expect(response.body.data).to.have.property('metrics');
    });

    it('POST /api/ai/test-suggestion - Debe fallar con campos faltantes', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const invalidPayload = {
        workspaceId: testWorkspaceId
        // Falta conversationId y messageId
      };

      const response = await request(app)
        .post('/api/ai/test-suggestion')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidPayload)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Gestión de Sugerencias', () => {
    const testConversationId = 'test-conversation-' + uuidv4();

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
        .get(`/api/ai/suggestions/${testConversationId}?status=draft&limit=5`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestions');
    });
  });

  describe('Estadísticas IA', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();

    it('GET /api/ai/stats/:workspaceId - Debe obtener estadísticas', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };

      const response = await request(app)
        .get(`/api/ai/stats/${testWorkspaceId}?days=7`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('suggestions');
      expect(response.body.data).to.have.property('usage');
      expect(response.body.data).to.have.property('workspaceId', testWorkspaceId);
      expect(response.body.data).to.have.property('period', '7 días');
    });
  });

  describe('Validaciones de Seguridad', () => {
    it('Debe rechazar acceso sin autenticación', async () => {
      await request(app)
        .get('/api/ai/health')
        .expect(200); // Health check público

      await request(app)
        .get('/api/ai/config/test-workspace')
        .expect(401); // Config requiere auth
    });

    it('Debe rechazar acceso sin permisos adecuados', async () => {
      const mockUser = { role: 'user', email: 'user@test.com' }; // Rol sin permisos

      await request(app)
        .get('/api/ai/config/test-workspace')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(403);
    });
  });

  describe('Validaciones de Entrada', () => {
    it('Debe validar workspaceId inválido', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };

      await request(app)
        .get('/api/ai/config/') // workspaceId vacío
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .expect(404);
    });

    it('Debe validar modelo inválido', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const invalidConfig = {
        defaultModel: 'invalid-model'
      };

      const response = await request(app)
        .put('/api/ai/config/test-workspace')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidConfig)
        .expect(200);

      // Debe usar modelo por defecto
      expect(response.body.data).to.have.property('defaultModel', 'gpt-4o-mini');
    });
  });
});