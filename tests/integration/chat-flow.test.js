/**
 * 🧪 TESTS DE INTEGRACIÓN - FLUJO COMPLETO DE CHAT
 * 
 * Valida todos los endpoints y flujos del módulo de chat/mensajería
 * siguiendo las mejores prácticas de testing para APIs RESTful.
 * 
 * FLUJOS PROBADOS:
 * 1. Login → Listar conversaciones → Leer mensajes → Enviar mensaje → Marcar leído
 * 2. Asignar conversación → Transferir → Cambiar prioridad
 * 3. WebSocket: Conectar → Unirse a conversación → Recibir mensaje tiempo real
 * 4. Webhook: Recibir de Twilio → Crear conversación → Notificar WebSocket
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const request = require('supertest');
const { expect } = require('chai');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Conversation = require('../../src/models/Conversation');
const Message = require('../../src/models/Message');
const { firestore } = require('../../src/config/firebase');
const jwt = require('jsonwebtoken');
const io = require('socket.io-client');

describe('🧪 CHAT FLOW - INTEGRATION TESTS', function() {
  this.timeout(30000); // 30 segundos para tests de integración

  // Variables globales para los tests
  let adminToken, agentToken, viewerToken;
  let adminUser, agentUser, viewerUser;
  let testConversation;
  let testMessage;
  let socketClient;

  before(async function() {
    console.log('🚀 Iniciando tests de integración del módulo de chat');
    
    // Limpiar base de datos de test
    await cleanupTestData();
    
    // Crear usuarios de test
    await createTestUsers();
    
    console.log('✅ Setup de tests completado');
  });

  after(async function() {
    console.log('🧹 Limpiando datos de test');
    
    // Cerrar conexión de socket si existe
    if (socketClient) {
      socketClient.close();
    }
    
    // Limpiar datos de test
    await cleanupTestData();
    
    console.log('✅ Cleanup completado');
  });

  /**
   * 🔐 TEST SUITE: AUTENTICACIÓN
   */
  describe('🔐 AUTENTICACIÓN', function() {
    it('debería autenticar usuario admin correctamente', async function() {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data.user).to.have.property('email', 'admin@test.com');
      expect(response.body.data.user).to.have.property('role', 'admin');

      adminToken = response.body.data.token;
    });

    it('debería autenticar usuario agente correctamente', async function() {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'agent@test.com',
          password: 'testpassword123'
        })
        .expect(200);

      agentToken = response.body.data.token;
    });

    it('debería autenticar usuario viewer correctamente', async function() {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'viewer@test.com',
          password: 'testpassword123'
        })
        .expect(200);

      viewerToken = response.body.data.token;
    });

    it('debería rechazar credenciales inválidas', async function() {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
    });
  });

  /**
   * 💬 TEST SUITE: CONVERSACIONES
   */
  describe('💬 CONVERSACIONES', function() {
    it('debería crear nueva conversación', async function() {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerPhone: '+1234567890',
          assignedTo: 'agent@test.com',
          initialMessage: 'Mensaje inicial de test',
          priority: 'normal',
          tags: ['test', 'integration']
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('id');
      expect(response.body.data).to.have.property('customerPhone', '+1234567890');
      expect(response.body.data).to.have.property('assignedTo');
      expect(response.body.data.assignedTo).to.have.property('email', 'agent@test.com');
      expect(response.body.data).to.have.property('priority', 'normal');
      expect(response.body.data).to.have.property('tags').that.includes('test');

      testConversation = response.body.data;
    });

    it('debería listar conversaciones con filtros', async function() {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          limit: 10,
          assignedTo: 'agent@test.com',
          status: 'open',
          priority: 'normal'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
      expect(response.body).to.have.property('pagination');
      expect(response.body.pagination).to.have.property('hasMore');
      expect(response.body.pagination).to.have.property('totalResults');
      
      // Verificar que nuestra conversación de test está en los resultados
      const foundConv = response.body.data.find(conv => conv.id === testConversation.id);
      expect(foundConv).to.not.be.undefined;
    });

    it('debería obtener conversación específica', async function() {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('id', testConversation.id);
      expect(response.body.data).to.have.property('customerPhone', '+1234567890');
    });

    it('debería asignar conversación a agente', async function() {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignedTo: 'agent@test.com'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data.assignedTo).to.have.property('email', 'agent@test.com');
    });

    it('debería cambiar prioridad de conversación', async function() {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'high',
          reason: 'Cliente VIP'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('priority', 'high');
    });

    it('debería obtener conversaciones sin asignar', async function() {
      const response = await request(app)
        .get('/api/conversations/unassigned')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
    });

    it('debería obtener estadísticas de conversaciones', async function() {
      const response = await request(app)
        .get('/api/conversations/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: '7d',
          agentEmail: 'agent@test.com'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('total');
      expect(response.body.data).to.have.property('open');
      expect(response.body.data).to.have.property('byPriority');
    });
  });

  /**
   * 📨 TEST SUITE: MENSAJES
   */
  describe('📨 MENSAJES', function() {
    it('debería crear mensaje en conversación', async function() {
      const response = await request(app)
        .post(`/api/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          content: 'Mensaje de test desde agente',
          type: 'text',
          metadata: { testFlag: true }
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('id');
      expect(response.body.data).to.have.property('content', 'Mensaje de test desde agente');
      expect(response.body.data).to.have.property('conversationId', testConversation.id);
      expect(response.body.data.sender).to.have.property('identifier', 'agent@test.com');

      testMessage = response.body.data;
    });

    it('debería listar mensajes de conversación', async function() {
      const response = await request(app)
        .get(`/api/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${agentToken}`)
        .query({
          limit: 50,
          orderBy: 'timestamp',
          order: 'asc'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
      expect(response.body).to.have.property('pagination');
      
      // Verificar que nuestro mensaje está en los resultados
      const foundMsg = response.body.data.find(msg => msg.id === testMessage.id);
      expect(foundMsg).to.not.be.undefined;
    });

    it('debería marcar mensaje como leído', async function() {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/messages/${testMessage.id}/read`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('messageId', testMessage.id);
      expect(response.body.data).to.have.property('readBy', 'agent@test.com');
    });

    it('debería marcar toda la conversación como leída', async function() {
      const response = await request(app)
        .put(`/api/conversations/${testConversation.id}/read-all`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('conversationId', testConversation.id);
      expect(response.body.data).to.have.property('markedCount');
    });

    it('debería enviar mensaje independiente', async function() {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          to: '+1987654321',
          content: 'Mensaje independiente de test',
          type: 'text'
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('message');
      expect(response.body.data).to.have.property('conversation');
      expect(response.body.data.message).to.have.property('content', 'Mensaje independiente de test');
    });
  });

  /**
   * 🔐 TEST SUITE: CONTROL DE PERMISOS
   */
  describe('🔐 CONTROL DE PERMISOS', function() {
    it('viewer no debería poder crear conversaciones', async function() {
      await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          customerPhone: '+1111111111',
          assignedTo: 'agent@test.com'
        })
        .expect(403);
    });

    it('viewer no debería poder enviar mensajes', async function() {
      await request(app)
        .post(`/api/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          content: 'Mensaje no autorizado'
        })
        .expect(403);
    });

    it('agente no debería poder ver conversaciones de otros sin permisos', async function() {
      // Crear conversación no asignada al agente de test
      const adminConvResponse = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerPhone: '+1555555555',
          assignedTo: 'admin@test.com'
        });

      const adminConvId = adminConvResponse.body.data.id;

      // Intentar acceder con token de agente (que no tiene la conversación asignada)
      const response = await request(app)
        .get(`/api/conversations/${adminConvId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
    });
  });

  /**
   * 🔍 TEST SUITE: BÚSQUEDA Y FILTROS
   */
  describe('🔍 BÚSQUEDA Y FILTROS', function() {
    it('debería buscar conversaciones por término', async function() {
      const response = await request(app)
        .get('/api/conversations/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          q: '+1234567890',
          limit: 10
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
    });

    it('debería filtrar conversaciones por múltiples criterios', async function() {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          assignedTo: 'agent@test.com',
          status: 'open',
          priority: 'high',
          tags: 'test,integration',
          limit: 20
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data').that.is.an('array');
      expect(response.body).to.have.property('pagination');
    });
  });

  /**
   * 🔗 TEST SUITE: WEBHOOK DE TWILIO
   */
  describe('🔗 WEBHOOK DE TWILIO', function() {
    it('debería procesar webhook entrante de Twilio', async function() {
      const webhookPayload = {
        From: '+1999888777',
        To: '+1234567890',
        Body: 'Mensaje de test desde webhook',
        MessageSid: 'test_message_sid_' + Date.now(),
        NumMedia: '0',
        ApiVersion: '2010-04-01'
      };

      const response = await request(app)
        .post('/api/messages/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).to.have.property('status', 'success');
      expect(response.body).to.have.property('messageId');
      expect(response.body).to.have.property('conversationId');
    });

    it('debería manejar webhook con datos faltantes', async function() {
      const webhookPayload = {
        From: '+1999888777',
        // Falta 'Body' intencionalmente
        MessageSid: 'test_incomplete_' + Date.now()
      };

      const response = await request(app)
        .post('/api/messages/webhook')
        .send(webhookPayload)
        .expect(200); // Siempre responder 200 OK a Twilio

      expect(response.body).to.have.property('status');
    });
  });

  /**
   * 📊 TEST SUITE: ESTADÍSTICAS
   */
  describe('📊 ESTADÍSTICAS', function() {
    it('debería obtener estadísticas de mensajes', async function() {
      const response = await request(app)
        .get('/api/messages/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: '7d',
          agentEmail: 'agent@test.com'
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('total');
      expect(response.body.data).to.have.property('inbound');
      expect(response.body.data).to.have.property('outbound');
    });
  });

  /**
   * 🌐 TEST SUITE: WEBSOCKETS (Básico)
   */
  describe('🌐 WEBSOCKETS', function() {
    it('debería conectar via WebSocket con token válido', function(done) {
      const socketUrl = process.env.SOCKET_URL || 'http://localhost:3001';
      
      socketClient = io(socketUrl, {
        auth: {
          token: agentToken
        },
        transports: ['websocket']
      });

      socketClient.on('connect', () => {
        expect(socketClient.connected).to.be.true;
        done();
      });

      socketClient.on('connect_error', (error) => {
        done(error);
      });
    });

    it('debería recibir confirmación de conexión', function(done) {
      socketClient.on('connected', (data) => {
        expect(data).to.have.property('email', 'agent@test.com');
        expect(data).to.have.property('role', 'agent');
        expect(data).to.have.property('capabilities');
        done();
      });
    });

    it('debería poder unirse a una conversación', function(done) {
      socketClient.emit('join-conversation', testConversation.id, (response) => {
        expect(response).to.have.property('success', true);
        expect(response).to.have.property('conversationId', testConversation.id);
        done();
      });
    });
  });

  /**
   * 🛠️ UTILIDADES DE TEST
   */
  async function createTestUsers() {
    // Crear usuarios de test
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'testpassword123',
      name: 'Admin Test',
      role: 'admin',
      isActive: true
    });

    agentUser = await User.create({
      email: 'agent@test.com',
      password: 'testpassword123',
      name: 'Agent Test',
      role: 'agent',
      isActive: true
    });

    viewerUser = await User.create({
      email: 'viewer@test.com',
      password: 'testpassword123',
      name: 'Viewer Test',
      role: 'viewer',
      isActive: true
    });
  }

  async function cleanupTestData() {
    try {
      // Limpiar conversaciones de test
      const conversationsSnapshot = await firestore
        .collection('conversations')
        .where('customerPhone', 'in', ['+1234567890', '+1987654321', '+1999888777', '+1555555555'])
        .get();

      const batch = firestore.batch();
      
      for (const doc of conversationsSnapshot.docs) {
        // Eliminar mensajes de la conversación
        const messagesSnapshot = await doc.ref.collection('messages').get();
        messagesSnapshot.docs.forEach(msgDoc => {
          batch.delete(msgDoc.ref);
        });
        
        // Eliminar conversación
        batch.delete(doc.ref);
      }

      // Limpiar usuarios de test
      const usersSnapshot = await firestore
        .collection('users')
        .where('email', 'in', ['admin@test.com', 'agent@test.com', 'viewer@test.com'])
        .get();

      usersSnapshot.docs.forEach(userDoc => {
        batch.delete(userDoc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.log('Error limpiando datos de test:', error.message);
    }
  }
}); 