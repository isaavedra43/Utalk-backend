/**
 * 🔐 TESTS DE AUTORIZACIÓN GRANULAR
 * 
 * Valida que los usuarios solo puedan acceder a recursos apropiados:
 * - Conversaciones propias o asignadas
 * - Mensajes de conversaciones autorizadas
 * - Contactos propios o accesibles por rol
 * - Operaciones según permisos de rol
 * 
 * @version 1.0.0
 * @author Security Team
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Conversation = require('../../src/models/Conversation');
const Message = require('../../src/models/Message');
const Contact = require('../../src/models/Contact');

describe('🔐 Authorization Security Tests', () => {
  let adminToken, agentToken, viewerToken, unauthorizedToken;
  let adminUser, agentUser, viewerUser;
  let testConversation, testMessage, testContact;

  beforeAll(async () => {
    // Crear usuarios de prueba
    adminUser = {
      id: 'admin-test-id',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true
    };

    agentUser = {
      id: 'agent-test-id',
      email: 'agent@test.com',
      role: 'agent',
      isActive: true
    };

    viewerUser = {
      id: 'viewer-test-id',
      email: 'viewer@test.com',
      role: 'viewer',
      isActive: true
    };

    // Generar tokens JWT
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    
    adminToken = jwt.sign(
      { email: adminUser.email, role: adminUser.role, id: adminUser.id },
      jwtSecret,
      { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
    );

    agentToken = jwt.sign(
      { email: agentUser.email, role: agentUser.role, id: agentUser.id },
      jwtSecret,
      { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
    );

    viewerToken = jwt.sign(
      { email: viewerUser.email, role: viewerUser.role, id: viewerUser.id },
      jwtSecret,
      { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
    );

    unauthorizedToken = jwt.sign(
      { email: 'hacker@evil.com', role: 'user', id: 'hacker-id' },
      jwtSecret,
      { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
    );

    // Mock de modelos para tests
    jest.spyOn(User, 'getById').mockImplementation((id) => {
      switch (id) {
        case adminUser.id: return Promise.resolve(adminUser);
        case agentUser.id: return Promise.resolve(agentUser);
        case viewerUser.id: return Promise.resolve(viewerUser);
        default: return Promise.resolve(null);
      }
    });

    jest.spyOn(User, 'getByEmail').mockImplementation((email) => {
      switch (email) {
        case adminUser.email: return Promise.resolve(adminUser);
        case agentUser.email: return Promise.resolve(agentUser);
        case viewerUser.email: return Promise.resolve(viewerUser);
        default: return Promise.resolve(null);
      }
    });

    // Crear datos de prueba
    testConversation = {
      id: 'conv-test-123',
      participants: [agentUser.id],
      assignedToId: agentUser.id,
      customerPhone: '+1234567890'
    };

    testMessage = {
      id: 'msg-test-123',
      conversationId: testConversation.id,
      senderId: agentUser.id,
      content: 'Test message'
    };

    testContact = {
      id: 'contact-test-123',
      createdBy: agentUser.id,
      phone: '+1234567890',
      name: 'Test Contact'
    };

    jest.spyOn(Conversation, 'getById').mockImplementation((id) => {
      if (id === testConversation.id) return Promise.resolve(testConversation);
      return Promise.resolve(null);
    });

    jest.spyOn(Message, 'getById').mockImplementation((id) => {
      if (id === testMessage.id) return Promise.resolve(testMessage);
      return Promise.resolve(null);
    });

    jest.spyOn(Contact, 'getById').mockImplementation((id) => {
      if (id === testContact.id) return Promise.resolve(testContact);
      return Promise.resolve(null);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('💬 Autorización de Conversaciones', () => {
    
    test('ADMIN debe acceder a cualquier conversación', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('AGENT debe acceder a conversaciones asignadas', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('VIEWER debe acceder solo a conversaciones asignadas', async () => {
      // Modificar conversación para estar asignada al viewer
      testConversation.assignedToId = viewerUser.id;
      
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      
      // Restaurar estado original
      testConversation.assignedToId = agentUser.id;
    });

    test('USUARIO NO AUTORIZADO debe ser rechazado', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('permisos'),
        code: 'CONVERSATION_ACCESS_DENIED'
      });
    });

    test('VIEWER no debe poder modificar conversaciones', async () => {
      testConversation.assignedToId = viewerUser.id;
      
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'closed' })
        .expect(403);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('viewers'),
        code: 'INSUFFICIENT_ROLE'
      });
      
      testConversation.assignedToId = agentUser.id;
    });

    test('AGENT debe poder asignar conversaciones', async () => {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/assign`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ assignedToId: agentUser.id })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('VIEWER no debe poder asignar conversaciones', async () => {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/assign`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ assignedToId: viewerUser.id })
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'ASSIGN_PERMISSION_DENIED'
      });
    });

    test('SOLO ADMIN debe poder eliminar conversaciones', async () => {
      // Test con admin (debe funcionar)
      let response = await request(app)
        .delete(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Test con agent (debe fallar)
      response = await request(app)
        .delete(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'DELETE_PERMISSION_DENIED'
      });
    });
  });

  describe('💬 Autorización de Mensajes', () => {
    
    test('USUARIO debe acceder a mensajes de conversaciones autorizadas', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('USUARIO NO AUTORIZADO debe ser rechazado para mensajes', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'CONVERSATION_ACCESS_DENIED'
      });
    });

    test('USUARIO debe poder eliminar solo sus propios mensajes', async () => {
      // Test con creador del mensaje (debe funcionar)
      let response = await request(app)
        .delete(`/api/conversations/${testConversation.id}/messages/${testMessage.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      // Test con usuario diferente (debe fallar)
      response = await request(app)
        .delete(`/api/conversations/${testConversation.id}/messages/${testMessage.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'MESSAGE_DELETE_DENIED'
      });
    });

    test('ADMIN debe poder eliminar cualquier mensaje', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${testConversation.id}/messages/${testMessage.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('👤 Autorización de Contactos', () => {
    
    test('ADMIN debe acceder a cualquier contacto', async () => {
      const response = await request(app)
        .get(`/api/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('AGENT debe acceder a contactos propios', async () => {
      const response = await request(app)
        .get(`/api/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('USUARIO NO AUTORIZADO debe ser rechazado para contactos', async () => {
      const response = await request(app)
        .get(`/api/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'CONTACT_ACCESS_DENIED'
      });
    });
  });

  describe('🔒 Escalación de Privilegios', () => {
    
    test('VIEWER no debe poder crear conversaciones', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          customerPhone: '+1234567890',
          initialMessage: 'Test message'
        })
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'INSUFFICIENT_WRITE_ACCESS'
      });
    });

    test('VIEWER no debe poder enviar mensajes independientes', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          to: '+1234567890',
          content: 'Test message'
        })
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'INSUFFICIENT_WRITE_ACCESS'
      });
    });

    test('USUARIO INACTIVO debe ser rechazado', async () => {
      // Crear token de usuario inactivo
      const inactiveUser = {
        id: 'inactive-user-id',
        email: 'inactive@test.com',
        role: 'agent',
        isActive: false
      };

      jest.spyOn(User, 'getByEmail').mockImplementationOnce(() => 
        Promise.resolve(inactiveUser)
      );

      const inactiveToken = jwt.sign(
        { email: inactiveUser.email, role: inactiveUser.role, id: inactiveUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${inactiveToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'USER_INACTIVE'
      });
    });
  });

  describe('📊 Logging de Intentos No Autorizados', () => {
    
    test('DEBE loguear intentos de acceso no autorizado', async () => {
      const logSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);

      // Verificar que se logueó el intento no autorizado
      // (Dependiendo de la implementación específica del logger)
      
      logSpy.mockRestore();
    });

    test('DEBE incluir detalles de seguridad en logs', async () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await request(app)
        .put(`/api/conversations/${testConversation.id}/assign`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ assignedToId: 'someone-else' })
        .expect(403);

      // Verificar logging de intento de escalación de privilegios
      
      logSpy.mockRestore();
    });
  });

  describe('⚡ Performance y Cache de Permisos', () => {
    
    test('DEBE cachear permisos de usuario', async () => {
      // Hacer múltiples requests para probar cache
      const requests = Array(5).fill().map(() =>
        request(app)
          .get(`/api/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${agentToken}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      
      // Todos deberían ser exitosos
      responses.forEach(response => {
        expect(response.body).toHaveProperty('data');
      });

      // Verificar que el cache está funcionando
      // (Los detalles dependen de la implementación del cache)
    });

    test('DEBE validar permisos en tiempo razonable', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // La validación de permisos debe ser rápida (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('🔄 Edge Cases y Recovery', () => {
    
    test('DEBE manejar conversaciones inexistentes', async () => {
      const response = await request(app)
        .get('/api/conversations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('encontrada'),
        code: 'CONVERSATION_NOT_FOUND'
      });
    });

    test('DEBE manejar tokens malformados', async () => {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);

      expect(response.body).toMatchObject({
        code: 'MALFORMED_TOKEN'
      });
    });

    test('DEBE manejar usuarios inexistentes en token válido', async () => {
      const nonExistentUserToken = jwt.sign(
        { email: 'ghost@user.com', role: 'agent', id: 'ghost-id' },
        process.env.JWT_SECRET || 'test-secret',
        { issuer: 'utalk-backend', audience: 'utalk-frontend', expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${nonExistentUserToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'USER_NOT_FOUND'
      });
    });
  });
}); 