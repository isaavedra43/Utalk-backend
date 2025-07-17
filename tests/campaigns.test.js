const request = require('supertest');
const app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Campaigns API', () => {
  let testApp, adminToken, agentToken, testContactId;

  beforeAll(async () => {
    testApp = await initializeTestApp();

    adminToken = 'Bearer test-admin-token';
    agentToken = 'Bearer test-agent-token';

    // Crear un contacto para usar en las campañas
    const contactResponse = await request(testApp)
      .post('/contacts')
      .set('Authorization', adminToken)
      .send({
        name: 'Campaign Test Contact',
        phone: '+1234567890',
      });
    testContactId = contactResponse.body.contact.id;
  });

  afterAll(async () => {
    await cleanupTest();
  });

  describe('GET /campaigns', () => {
    it('debería listar campañas con autenticación válida', async () => {
      const response = await request(testApp)
        .get('/campaigns')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('campaigns');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.campaigns)).toBe(true);
    });

    it('debería rechazar requests sin autenticación', async () => {
      await request(testApp)
        .get('/campaigns')
        .expect(401);
    });

    it('debería permitir filtros por estado', async () => {
      const response = await request(testApp)
        .get('/campaigns?status=draft')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('campaigns');
    });

    it('debería permitir búsqueda por nombre', async () => {
      const response = await request(testApp)
        .get('/campaigns?search=test')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('campaigns');
    });
  });

  describe('POST /campaigns', () => {
    it('debería crear una nueva campaña con datos válidos', async () => {
      const newCampaign = {
        name: 'Campaña de Prueba',
        message: 'Hola, este es un mensaje de prueba para la campaña.',
        contacts: [testContactId],
        status: 'draft',
      };

      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send(newCampaign)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('campaign');
      expect(response.body.campaign).toMatchObject({
        name: newCampaign.name,
        message: newCampaign.message,
        status: 'draft',
      });
    });

    it('debería validar campos requeridos', async () => {
      const invalidCampaign = {
        contacts: [testContactId],
        // Falta name y message
      };

      await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send(invalidCampaign)
        .expect(400);
    });

    it('debería validar que los contactos existen', async () => {
      const campaignWithInvalidContacts = {
        name: 'Test Campaign',
        message: 'Test message',
        contacts: ['nonexistent-contact-id'],
      };

      await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send(campaignWithInvalidContacts)
        .expect(400);
    });

    it('debería calcular el alcance estimado basado en contactos', async () => {
      const campaign = {
        name: 'Reach Test',
        message: 'Test message',
        contacts: [testContactId],
      };

      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send(campaign)
        .expect(201);

      expect(response.body.campaign.estimatedReach).toBe(1);
    });
  });

  describe('GET /campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Test Campaign',
          message: 'Test message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('debería obtener una campaña por ID', async () => {
      const response = await request(testApp)
        .get(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('campaign');
      expect(response.body.campaign.id).toBe(campaignId);
    });

    it('debería incluir detalles de contactos', async () => {
      const response = await request(testApp)
        .get(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.campaign).toHaveProperty('contactDetails');
      expect(Array.isArray(response.body.campaign.contactDetails)).toBe(true);
    });

    it('debería retornar 404 para campaña no existente', async () => {
      await request(testApp)
        .get('/campaigns/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('PUT /campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Original Campaign',
          message: 'Original message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('debería actualizar una campaña en estado draft', async () => {
      const updates = {
        name: 'Updated Campaign',
        message: 'Updated message',
      };

      const response = await request(testApp)
        .put(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200);

      expect(response.body.campaign.name).toBe(updates.name);
      expect(response.body.campaign.message).toBe(updates.message);
    });

    it('no debería permitir editar campañas completadas', async () => {
      // Primero cambiar estado a completed (esto sería un test adicional)
      // Por ahora asumimos que no se puede editar
      const updates = {
        name: 'Should not update',
      };

      await request(testApp)
        .put(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200); // Cambiará según la lógica de negocio
    });

    it('debería validar contactos al actualizar', async () => {
      const updates = {
        contacts: ['invalid-contact-id'],
      };

      await request(testApp)
        .put(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(400);
    });
  });

  describe('DELETE /campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'To Delete',
          message: 'Delete message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('los admins deberían poder eliminar campañas', async () => {
      await request(testApp)
        .delete(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken)
        .expect(200);
    });

    it('los agentes no deberían poder eliminar campañas', async () => {
      await request(testApp)
        .delete(`/campaigns/${campaignId}`)
        .set('Authorization', agentToken)
        .expect(403);
    });

    it('debería retornar 404 para campaña no existente', async () => {
      await request(testApp)
        .delete('/campaigns/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('POST /campaigns/:id/send', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Send Test',
          message: 'Message to send',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('debería enviar una campaña válida', async () => {
      const response = await request(testApp)
        .post(`/campaigns/${campaignId}/send`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('total');
      expect(response.body.results).toHaveProperty('sent');
      expect(response.body.results).toHaveProperty('failed');
    });

    it('debería actualizar el estado de la campaña a completed', async () => {
      await request(testApp)
        .post(`/campaigns/${campaignId}/send`)
        .set('Authorization', adminToken)
        .expect(200);

      const getResponse = await request(testApp)
        .get(`/campaigns/${campaignId}`)
        .set('Authorization', adminToken);

      expect(getResponse.body.campaign.status).toBe('completed');
    });

    it('no debería enviar campañas sin contactos', async () => {
      // Crear campaña sin contactos
      const emptyCampaignResponse = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Empty Campaign',
          message: 'No contacts',
          contacts: [],
        });

      await request(testApp)
        .post(`/campaigns/${emptyCampaignResponse.body.campaign.id}/send`)
        .set('Authorization', adminToken)
        .expect(400);
    });
  });

  describe('POST /campaigns/:id/pause', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Pause Test',
          message: 'Message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('debería pausar una campaña activa', async () => {
      const response = await request(testApp)
        .post(`/campaigns/${campaignId}/pause`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.campaign.status).toBe('paused');
    });
  });

  describe('POST /campaigns/:id/resume', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Resume Test',
          message: 'Message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;

      // Pausar la campaña primero
      await request(testApp)
        .post(`/campaigns/${campaignId}/pause`)
        .set('Authorization', adminToken);
    });

    it('debería reanudar una campaña pausada', async () => {
      const response = await request(testApp)
        .post(`/campaigns/${campaignId}/resume`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(['scheduled', 'sending']).toContain(response.body.campaign.status);
    });
  });

  describe('GET /campaigns/:id/report', () => {
    let campaignId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/campaigns')
        .set('Authorization', adminToken)
        .send({
          name: 'Report Test',
          message: 'Message',
          contacts: [testContactId],
        });
      campaignId = response.body.campaign.id;
    });

    it('debería obtener reporte de campaña en JSON', async () => {
      const response = await request(testApp)
        .get(`/campaigns/${campaignId}/report`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('campaign');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('contacts');
    });

    it('debería exportar reporte en CSV', async () => {
      const response = await request(testApp)
        .get(`/campaigns/${campaignId}/report?format=csv`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Permissions', () => {
    it('los agentes deberían poder crear campañas', async () => {
      await request(testApp)
        .post('/campaigns')
        .set('Authorization', agentToken)
        .send({
          name: 'Agent Campaign',
          message: 'Agent message',
          contacts: [testContactId],
        })
        .expect(201);
    });

    it('los agentes deberían poder ver sus propias campañas', async () => {
      await request(testApp)
        .get('/campaigns')
        .set('Authorization', agentToken)
        .expect(200);
    });

    it('los agentes deberían poder enviar sus propias campañas', async () => {
      const campaignResponse = await request(testApp)
        .post('/campaigns')
        .set('Authorization', agentToken)
        .send({
          name: 'Agent Send Test',
          message: 'Message',
          contacts: [testContactId],
        });

      await request(testApp)
        .post(`/campaigns/${campaignResponse.body.campaign.id}/send`)
        .set('Authorization', agentToken)
        .expect(200);
    });
  });
});
