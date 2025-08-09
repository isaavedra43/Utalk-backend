const request = require('supertest');
const app = require('../../src/index');
const { generateTestToken } = require('../utils/testHelpers');

describe('📍 Location and Sticker Messages', () => {
  let authToken;
  let testConversationId;

  beforeAll(async () => {
    // Generar token de prueba
    authToken = generateTestToken({
      email: 'test@utalk.com',
      role: 'agent',
      workspaceId: 'test_workspace',
      tenantId: 'test_tenant'
    });

    // Crear conversación de prueba
    testConversationId = 'test_conv_' + Date.now();
  });

  describe('POST /api/messages/send-location', () => {
    it('should send location message successfully', async () => {
      const locationData = {
        to: '+1234567890',
        latitude: 19.4326,
        longitude: -99.1332,
        name: 'Ciudad de México',
        address: 'Centro Histórico',
        conversationId: testConversationId
      };

      const response = await request(app)
        .post('/api/messages/send-location')
        .set('Authorization', `Bearer ${authToken}`)
        .send(locationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBeDefined();
      expect(response.body.data.twilioSid).toBeDefined();
      expect(response.body.data.location).toEqual({
        latitude: 19.4326,
        longitude: -99.1332,
        name: 'Ciudad de México',
        address: 'Centro Histórico'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/messages/send-location')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: '+1234567890'
          // Missing latitude and longitude
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('MISSING_REQUIRED_FIELDS');
    });

    it('should validate coordinate ranges', async () => {
      const response = await request(app)
        .post('/api/messages/send-location')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: '+1234567890',
          latitude: 200, // Invalid latitude
          longitude: -99.1332
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('COORDINATES_OUT_OF_RANGE');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/messages/send-location')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: 'invalid_phone',
          latitude: 19.4326,
          longitude: -99.1332
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/messages/send-sticker', () => {
    it('should send sticker message successfully', async () => {
      const stickerData = {
        to: '+1234567890',
        stickerUrl: 'https://example.com/sticker.webp',
        conversationId: testConversationId
      };

      const response = await request(app)
        .post('/api/messages/send-sticker')
        .set('Authorization', `Bearer ${authToken}`)
        .send(stickerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBeDefined();
      expect(response.body.data.twilioSid).toBeDefined();
      expect(response.body.data.sticker.url).toBe('https://example.com/sticker.webp');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/messages/send-sticker')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: '+1234567890'
          // Missing stickerUrl
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('MISSING_REQUIRED_FIELDS');
    });

    it('should validate sticker URL format', async () => {
      const response = await request(app)
        .post('/api/messages/send-sticker')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: '+1234567890',
          stickerUrl: 'invalid_url'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('INVALID_STICKER_URL');
    });
  });

  describe('Webhook Processing', () => {
    it('should process location webhook correctly', async () => {
      const webhookData = {
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        MessageSid: 'MG' + Date.now(),
        Latitude: '19.4326',
        Longitude: '-99.1332',
        LocationName: 'Ciudad de México',
        LocationAddress: 'Centro Histórico'
      };

      const response = await request(app)
        .post('/api/messages/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Mensaje procesado correctamente');
    });

    it('should process sticker webhook correctly', async () => {
      const webhookData = {
        From: 'whatsapp:+1234567890',
        To: 'whatsapp:+0987654321',
        MessageSid: 'MG' + Date.now(),
        StickerId: 'sticker_123',
        StickerPackId: 'pack_456',
        StickerEmoji: '😀',
        MediaUrl0: 'https://example.com/sticker.webp'
      };

      const response = await request(app)
        .post('/api/messages/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Mensaje procesado correctamente');
    });
  });

  describe('Message Model Validation', () => {
    it('should validate location message structure', () => {
      const Message = require('../../src/models/Message');
      
      const locationMessage = new Message({
        conversationId: 'test_conv',
        content: 'Ubicación compartida',
        type: 'location',
        direction: 'inbound',
        senderIdentifier: '+1234567890',
        recipientIdentifier: '+0987654321',
        location: {
          latitude: 19.4326,
          longitude: -99.1332,
          name: 'Ciudad de México',
          address: 'Centro Histórico'
        }
      });

      expect(locationMessage.type).toBe('location');
      expect(locationMessage.location).toBeDefined();
      expect(locationMessage.location.latitude).toBe(19.4326);
      expect(locationMessage.location.longitude).toBe(-99.1332);
    });

    it('should validate sticker message structure', () => {
      const Message = require('../../src/models/Message');
      
      const stickerMessage = new Message({
        conversationId: 'test_conv',
        content: '😀',
        type: 'sticker',
        direction: 'inbound',
        senderIdentifier: '+1234567890',
        recipientIdentifier: '+0987654321',
        sticker: {
          packId: 'pack_123',
          stickerId: 'sticker_456',
          emoji: '😀',
          url: 'https://example.com/sticker.webp'
        }
      });

      expect(stickerMessage.type).toBe('sticker');
      expect(stickerMessage.sticker).toBeDefined();
      expect(stickerMessage.sticker.packId).toBe('pack_123');
      expect(stickerMessage.sticker.stickerId).toBe('sticker_456');
    });

    it('should throw error for location type without location data', () => {
      const Message = require('../../src/models/Message');
      
      expect(() => {
        new Message({
          conversationId: 'test_conv',
          content: 'Test',
          type: 'location',
          direction: 'inbound',
          senderIdentifier: '+1234567890',
          recipientIdentifier: '+0987654321'
          // Missing location data
        });
      }).toThrow('Mensaje de tipo location debe incluir datos de ubicación');
    });

    it('should throw error for sticker type without sticker data', () => {
      const Message = require('../../src/models/Message');
      
      expect(() => {
        new Message({
          conversationId: 'test_conv',
          content: 'Test',
          type: 'sticker',
          direction: 'inbound',
          senderIdentifier: '+1234567890',
          recipientIdentifier: '+0987654321'
          // Missing sticker data
        });
      }).toThrow('Mensaje de tipo sticker debe incluir datos de sticker');
    });
  });
});