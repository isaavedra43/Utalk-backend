/**
 * 🧪 TESTS FASE B - PROVEEDOR REAL Y SALUD
 * 
 * Tests para verificar la integración con proveedores reales de IA
 * y funcionalidades de health check, timeouts, retries y guardrails.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const request = require('supertest');
const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');

// Importar app (asumiendo que exporta la app Express)
let app;

describe('🤖 FASE B - PROVEEDOR REAL Y SALUD', () => {
  before(async () => {
    // Importar la app Express
    const { default: server } = require('../../src/index');
    app = server.app;
  });

  describe('Health Check con Proveedores', () => {
    it('GET /api/ai/health - Debe verificar proveedores', async () => {
      const response = await request(app)
        .get('/api/ai/health')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('phase', 'B');
      expect(response.body.data).to.have.property('features');
      expect(response.body.data.features).to.have.property('provider_ready');
      expect(response.body.data).to.have.property('providers');
      expect(response.body.data).to.have.property('environment');
      expect(response.body.data.environment).to.have.property('openaiKey');
    });

    it('GET /api/ai/health - Debe responder disabled si AI_ENABLED=false', async () => {
      // Simular AI_ENABLED=false
      const originalEnv = process.env.AI_ENABLED;
      process.env.AI_ENABLED = 'false';

      const response = await request(app)
        .get('/api/ai/health')
        .expect(200);

      expect(response.body.data).to.have.property('status', 'disabled');
      expect(response.body.data).to.have.property('reason', 'AI_ENABLED=false');

      // Restaurar variable de entorno
      process.env.AI_ENABLED = originalEnv;
    });

    it('GET /api/ai/health - Debe mostrar estado de proveedores', async () => {
      const response = await request(app)
        .get('/api/ai/health')
        .expect(200);

      const providers = response.body.data.providers;
      
      expect(providers).to.have.property('openai');
      expect(providers.openai).to.have.property('ok');
      expect(providers.openai).to.have.property('provider', 'openai');
      
      if (!providers.openai.ok) {
        expect(providers.openai).to.have.property('error');
        expect(providers.openai).to.have.property('message');
      }
    });
  });

  describe('Configuración IA con Clamps', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();

    it('PUT /api/ai/config/:workspaceId - Debe aplicar clamps automáticamente', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const invalidConfig = {
        temperature: 2.0, // Fuera de rango (0-1)
        maxTokens: 500,   // Fuera de rango (1-300)
        limits: {
          maxTokensOut: 200, // Fuera de rango (1-150)
          timeout: 20000,    // Fuera de rango (500-10000)
          maxRetries: 5      // Fuera de rango (0-3)
        }
      };

      const response = await request(app)
        .put(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidConfig)
        .expect(200);

      // Verificar que se aplicaron clamps
      expect(response.body.data).to.have.property('temperature', 1.0);
      expect(response.body.data).to.have.property('maxTokens', 300);
      expect(response.body.data.limits).to.have.property('maxTokensOut', 150);
      expect(response.body.data.limits).to.have.property('timeout', 10000);
      expect(response.body.data.limits).to.have.property('maxRetries', 3);
    });

    it('PUT /api/ai/config/:workspaceId - Debe validar provider', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const configWithInvalidProvider = {
        provider: 'invalid-provider',
        defaultModel: 'invalid-model'
      };

      const response = await request(app)
        .put(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(configWithInvalidProvider)
        .expect(200);

      // Verificar que se corrigieron valores inválidos
      expect(response.body.data).to.have.property('provider', 'openai');
      expect(response.body.data).to.have.property('defaultModel', 'gpt-4o-mini');
    });

    it('PUT /api/ai/config/:workspaceId - Debe habilitar provider_ready', async () => {
      const mockUser = { role: 'admin', email: 'admin@test.com' };
      
      const configWithProviderReady = {
        ai_enabled: true,
        provider: 'openai',
        flags: {
          provider_ready: true,
          suggestions: true
        }
      };

      const response = await request(app)
        .put(`/api/ai/config/${testWorkspaceId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(configWithProviderReady)
        .expect(200);

      expect(response.body.data).to.have.property('ai_enabled', true);
      expect(response.body.data).to.have.property('provider', 'openai');
      expect(response.body.data.flags).to.have.property('provider_ready', true);
      expect(response.body.data.flags).to.have.property('suggestions', true);
    });
  });

  describe('Dry Run de Sugerencias', () => {
    const testWorkspaceId = 'test-workspace-' + uuidv4();
    const testConversationId = 'test-conversation-' + uuidv4();
    const testMessageId = 'test-message-' + uuidv4();

    it('POST /api/ai/dry-run/suggest - Debe generar sugerencia sin guardar en DB', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/dry-run/suggest')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('ok', true);
      expect(response.body.data).to.have.property('suggestion_preview');
      expect(response.body.data).to.have.property('usage');
      expect(response.body.data.usage).to.have.property('in');
      expect(response.body.data.usage).to.have.property('out');
      expect(response.body.data.usage).to.have.property('latencyMs');
      expect(response.body.data).to.have.property('warnings');
      expect(response.body.data).to.have.property('provider');
      expect(response.body.data).to.have.property('isReal');
      
      // Verificar que la sugerencia no excede 300 caracteres
      expect(response.body.data.suggestion_preview.length).to.be.at.most(300);
    });

    it('POST /api/ai/dry-run/suggest - Debe detectar latencia alta', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        messageId: testMessageId
      };

      const response = await request(app)
        .post('/api/ai/dry-run/suggest')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      const warnings = response.body.data.warnings;
      
      // Verificar que se detectan warnings apropiados
      if (response.body.data.usage.latencyMs > 2500) {
        expect(warnings).to.include('Latencia alta detectada');
      }
      
      if (!response.body.data.isReal) {
        expect(warnings).to.include('Usando modo fake (proveedor no disponible)');
      }
    });

    it('POST /api/ai/dry-run/suggest - Debe fallar con campos faltantes', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const invalidPayload = {
        workspaceId: testWorkspaceId
        // Falta conversationId y messageId
      };

      const response = await request(app)
        .post('/api/ai/dry-run/suggest')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(invalidPayload)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Rate Limiting y Circuit Breaker', () => {
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
            .post('/api/ai/dry-run/suggest')
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

  describe('Validaciones de Seguridad', () => {
    it('Debe rechazar acceso sin autenticación', async () => {
      await request(app)
        .post('/api/ai/dry-run/suggest')
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
        .post('/api/ai/dry-run/suggest')
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

  describe('Fallback y Resiliencia', () => {
    it('Debe hacer fallback a fake si proveedor falla', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      // Simular configuración con proveedor real pero sin API key
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      
      const payload = {
        workspaceId: 'test-workspace-fallback',
        conversationId: 'test-conversation-fallback',
        messageId: 'test-message-fallback'
      };

      const response = await request(app)
        .post('/api/ai/dry-run/suggest')
        .set('Authorization', 'Bearer mock-token')
        .set('X-User', JSON.stringify(mockUser))
        .send(payload)
        .expect(200);

      // Debe funcionar con fallback a fake
      expect(response.body.data).to.have.property('ok', true);
      expect(response.body.data).to.have.property('isReal', false);
      expect(response.body.data.warnings).to.include('Usando modo fake (proveedor no disponible)');
      
      // Restaurar variable de entorno
      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('Métricas y Logging', () => {
    it('Debe registrar métricas de uso', async () => {
      const mockUser = { role: 'agent', email: 'agent@test.com' };
      
      const payload = {
        workspaceId: 'test-workspace-metrics',
        conversationId: 'test-conversation-metrics',
        messageId: 'test-message-metrics'
      };

      const response = await request(app)
        .post('/api/ai/dry-run/suggest')
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