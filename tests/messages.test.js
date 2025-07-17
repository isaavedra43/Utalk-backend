const request = require('supertest');
const app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Messages API', () => {
  let testApp, adminToken, agentToken, viewerToken, testContactId;

  beforeAll(async () => {
    testApp = await initializeTestApp();

    adminToken = 'Bearer test-admin-token';
    agentToken = 'Bearer test-agent-token';
    viewerToken = 'Bearer test-viewer-token';

    // Crear un contacto para usar en los mensajes
    const contactResponse = await request(testApp)
      .post('/contacts')
      .set('Authorization', adminToken)
      .send({
        name: 'Message Test Contact',
        phone: '+1234567890',
      });
    testContactId = contactResponse.body.contact.id;
  });

  afterAll(async () => {
    await cleanupTest();
  });

  describe('GET /messages', () => {
    it('debería listar mensajes con autenticación válida', async () => {
      const response = await request(testApp)
        .get('/messages')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('debería rechazar requests sin autenticación', async () => {
      await request(testApp)
        .get('/messages')
        .expect(401);
    });

    it('debería permitir filtros por contacto', async () => {
      const response = await request(testApp)
        .get(`/messages?contactId=${testContactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('debería permitir filtros por dirección', async () => {
      const response = await request(testApp)
        .get('/messages?direction=inbound')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('debería permitir filtros por estado', async () => {
      const response = await request(testApp)
        .get('/messages?status=sent')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('debería permitir búsqueda en contenido', async () => {
      const response = await request(testApp)
        .get('/messages?search=hola')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('debería permitir filtros por rango de fechas', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';

      const response = await request(testApp)
        .get(`/messages?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });

    it('debería permitir paginación', async () => {
      const response = await request(testApp)
        .get('/messages?page=1&limit=10')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
      });
    });
  });

  describe('POST /messages/send', () => {
    it('debería enviar mensaje con datos válidos', async () => {
      const messageData = {
        contactId: testContactId,
        content: 'Hola, este es un mensaje de prueba.',
        type: 'text',
      };

      const response = await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Mensaje enviado exitosamente');
      expect(response.body).toHaveProperty('messageRecord');
      expect(response.body.messageRecord).toMatchObject({
        contactId: messageData.contactId,
        content: messageData.content,
        direction: 'outbound',
        status: 'sent',
      });
    });

    it('debería validar campos requeridos', async () => {
      const invalidMessage = {
        content: 'Mensaje sin contacto',
        // Falta contactId
      };

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send(invalidMessage)
        .expect(400);
    });

    it('debería validar que el contacto existe', async () => {
      const messageWithInvalidContact = {
        contactId: 'nonexistent-contact',
        content: 'Mensaje a contacto inexistente',
      };

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send(messageWithInvalidContact)
        .expect(400);
    });

    it('debería sanitizar contenido del mensaje', async () => {
      const messageWithHtml = {
        contactId: testContactId,
        content: '<script>alert("xss")</script>Mensaje con HTML',
        type: 'text',
      };

      const response = await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send(messageWithHtml)
        .expect(201);

      // El contenido debería estar sanitizado
      expect(response.body.messageRecord.content).not.toContain('<script>');
    });

    it('agentes deberían poder enviar mensajes', async () => {
      const messageData = {
        contactId: testContactId,
        content: 'Mensaje enviado por agente',
        type: 'text',
      };

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', agentToken)
        .send(messageData)
        .expect(201);
    });

    it('viewers no deberían poder enviar mensajes', async () => {
      const messageData = {
        contactId: testContactId,
        content: 'Mensaje no permitido',
        type: 'text',
      };

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', viewerToken)
        .send(messageData)
        .expect(403);
    });
  });

  describe('GET /messages/:id', () => {
    let messageId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send({
          contactId: testContactId,
          content: 'Mensaje para obtener por ID',
          type: 'text',
        });
      messageId = response.body.messageRecord.id;
    });

    it('debería obtener un mensaje por ID', async () => {
      const response = await request(testApp)
        .get(`/messages/${messageId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message.id).toBe(messageId);
    });

    it('debería incluir información del contacto', async () => {
      const response = await request(testApp)
        .get(`/messages/${messageId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.message).toHaveProperty('contact');
      expect(response.body.message.contact).toHaveProperty('name');
      expect(response.body.message.contact).toHaveProperty('phone');
    });

    it('debería retornar 404 para mensaje no existente', async () => {
      await request(testApp)
        .get('/messages/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('POST /messages/:id/read', () => {
    let messageId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send({
          contactId: testContactId,
          content: 'Mensaje para marcar como leído',
          type: 'text',
        });
      messageId = response.body.messageRecord.id;
    });

    it('debería marcar mensaje como leído', async () => {
      const response = await request(testApp)
        .post(`/messages/${messageId}/read`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.message.readAt).toBeDefined();
      expect(response.body.message.isRead).toBe(true);
    });

    it('debería retornar 404 para mensaje no existente', async () => {
      await request(testApp)
        .post('/messages/nonexistent-id/read')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('GET /messages/conversation/:contactId', () => {
    beforeEach(async () => {
      // Crear varios mensajes para una conversación
      await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send({
          contactId: testContactId,
          content: 'Primer mensaje',
          type: 'text',
        });

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send({
          contactId: testContactId,
          content: 'Segundo mensaje',
          type: 'text',
        });
    });

    it('debería obtener conversación completa con un contacto', async () => {
      const response = await request(testApp)
        .get(`/messages/conversation/${testContactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('contact');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('debería ordenar mensajes por timestamp', async () => {
      const response = await request(testApp)
        .get(`/messages/conversation/${testContactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      if (response.body.messages.length > 1) {
        const timestamps = response.body.messages.map(msg => new Date(msg.timestamp).getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
        expect(timestamps).toEqual(sortedTimestamps);
      }
    });

    it('debería incluir información del contacto', async () => {
      const response = await request(testApp)
        .get(`/messages/conversation/${testContactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.contact).toHaveProperty('id', testContactId);
      expect(response.body.contact).toHaveProperty('name');
      expect(response.body.contact).toHaveProperty('phone');
    });

    it('debería permitir paginación en conversaciones', async () => {
      const response = await request(testApp)
        .get(`/messages/conversation/${testContactId}?page=1&limit=5`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
    });

    it('debería retornar 404 para contacto no existente', async () => {
      await request(testApp)
        .get('/messages/conversation/nonexistent-contact')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('GET /messages/stats', () => {
    it('debería obtener estadísticas de mensajes', async () => {
      const response = await request(testApp)
        .get('/messages/stats')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('inbound');
      expect(response.body).toHaveProperty('outbound');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byType');
    });

    it('debería permitir filtros por período', async () => {
      const response = await request(testApp)
        .get('/messages/stats?period=7d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('total');
    });

    it('debería permitir filtros por fechas específicas', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';

      const response = await request(testApp)
        .get(`/messages/stats?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('total');
    });

    it('agentes deberían ver sus propias estadísticas', async () => {
      const response = await request(testApp)
        .get('/messages/stats')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /webhook/whatsapp', () => {
    it('debería procesar webhook de WhatsApp válido', async () => {
      const webhookData = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test-id',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: 'test-phone-id',
              },
              messages: [{
                from: testContactId,
                id: 'test-message-id',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: 'Mensaje de prueba desde WhatsApp',
                },
                type: 'text',
              }],
            },
          }],
        }],
      };

      const response = await request(testApp)
        .post('/webhook/whatsapp')
        .send(webhookData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
    });

    it('debería validar signature de Twilio', async () => {
      const invalidWebhookData = {
        invalid: 'data',
      };

      // Sin signature válida, debería fallar
      await request(testApp)
        .post('/webhook/whatsapp')
        .send(invalidWebhookData)
        .expect(400);
    });

    it('debería crear contacto automáticamente si no existe', async () => {
      const newPhoneNumber = '+9999999999';
      const webhookData = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test-id',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: 'test-phone-id',
              },
              messages: [{
                from: newPhoneNumber,
                id: 'test-message-id-2',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: 'Mensaje desde nuevo contacto',
                },
                type: 'text',
              }],
            },
          }],
        }],
      };

      await request(testApp)
        .post('/webhook/whatsapp')
        .send(webhookData)
        .expect(200);

      // Verificar que el contacto fue creado
      const contactsResponse = await request(testApp)
        .get('/contacts')
        .set('Authorization', adminToken);

      const newContact = contactsResponse.body.contacts.find(
        contact => contact.phone === newPhoneNumber,
      );
      expect(newContact).toBeDefined();
    });

    it('debería manejar diferentes tipos de mensaje', async () => {
      const webhookDataImage = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test-id',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: 'test-phone-id',
              },
              messages: [{
                from: testContactId,
                id: 'test-image-message',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                image: {
                  mime_type: 'image/jpeg',
                  sha256: 'image-hash',
                  id: 'image-media-id',
                },
                type: 'image',
              }],
            },
          }],
        }],
      };

      await request(testApp)
        .post('/webhook/whatsapp')
        .send(webhookDataImage)
        .expect(200);
    });

    it('debería manejar actualizaciones de estado de mensaje', async () => {
      const statusUpdate = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test-id',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: 'test-phone-id',
              },
              statuses: [{
                id: 'test-message-id',
                status: 'delivered',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                recipient_id: testContactId,
              }],
            },
          }],
        }],
      };

      await request(testApp)
        .post('/webhook/whatsapp')
        .send(statusUpdate)
        .expect(200);
    });
  });

  describe('GET /webhook/whatsapp', () => {
    it('debería verificar webhook de WhatsApp', async () => {
      const verifyToken = process.env.TWILIO_WEBHOOK_TOKEN || 'test-verify-token';
      const challenge = 'test-challenge';

      const response = await request(testApp)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge,
        })
        .expect(200);

      expect(response.text).toBe(challenge);
    });

    it('debería rechazar token de verificación incorrecto', async () => {
      const wrongToken = 'wrong-token';
      const challenge = 'test-challenge';

      await request(testApp)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': wrongToken,
          'hub.challenge': challenge,
        })
        .expect(403);
    });
  });

  describe('Permissions', () => {
    it('viewers deberían poder leer mensajes', async () => {
      await request(testApp)
        .get('/messages')
        .set('Authorization', viewerToken)
        .expect(200);
    });

    it('viewers no deberían poder enviar mensajes', async () => {
      await request(testApp)
        .post('/messages/send')
        .set('Authorization', viewerToken)
        .send({
          contactId: testContactId,
          content: 'No permitido',
        })
        .expect(403);
    });

    it('agentes deberían poder enviar y leer mensajes', async () => {
      await request(testApp)
        .get('/messages')
        .set('Authorization', agentToken)
        .expect(200);

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', agentToken)
        .send({
          contactId: testContactId,
          content: 'Mensaje de agente',
        })
        .expect(201);
    });

    it('admins deberían tener acceso completo', async () => {
      await request(testApp)
        .get('/messages')
        .set('Authorization', adminToken)
        .expect(200);

      await request(testApp)
        .post('/messages/send')
        .set('Authorization', adminToken)
        .send({
          contactId: testContactId,
          content: 'Mensaje de admin',
        })
        .expect(201);

      await request(testApp)
        .get('/messages/stats')
        .set('Authorization', adminToken)
        .expect(200);
    });
  });
});
