const request = require('supertest');
const app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Contacts API', () => {
  let testApp, adminToken, agentToken;

  beforeAll(async () => {
    testApp = await initializeTestApp();
    
    // Crear tokens de prueba
    adminToken = 'Bearer test-admin-token';
    agentToken = 'Bearer test-agent-token';
  });

  afterAll(async () => {
    await cleanupTest();
  });

  describe('GET /contacts', () => {
    it('debería listar contactos con autenticación válida', async () => {
      const response = await request(testApp)
        .get('/contacts')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('contacts');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.contacts)).toBe(true);
    });

    it('debería rechazar requests sin autenticación', async () => {
      await request(testApp)
        .get('/contacts')
        .expect(401);
    });

    it('debería permitir filtros de búsqueda', async () => {
      const response = await request(testApp)
        .get('/contacts?search=test&tags=importante')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('contacts');
    });

    it('debería permitir paginación', async () => {
      const response = await request(testApp)
        .get('/contacts?page=1&limit=10')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10
      });
    });
  });

  describe('POST /contacts', () => {
    it('debería crear un nuevo contacto con datos válidos', async () => {
      const newContact = {
        name: 'Juan Pérez',
        phone: '+1234567890',
        email: 'juan@example.com',
        tags: ['cliente', 'vip'],
        customFields: {
          empresa: 'Acme Corp',
          cargo: 'Manager'
        }
      };

      const response = await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send(newContact)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('contact');
      expect(response.body.contact).toMatchObject({
        name: newContact.name,
        phone: newContact.phone,
        email: newContact.email
      });
    });

    it('debería validar campos requeridos', async () => {
      const invalidContact = {
        email: 'invalid-email'
      };

      await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send(invalidContact)
        .expect(400);
    });

    it('debería rechazar teléfonos duplicados', async () => {
      const contact1 = {
        name: 'Contact 1',
        phone: '+1111111111'
      };

      const contact2 = {
        name: 'Contact 2',
        phone: '+1111111111'
      };

      // Crear primer contacto
      await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send(contact1)
        .expect(201);

      // Intentar crear segundo contacto con mismo teléfono
      await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send(contact2)
        .expect(400);
    });
  });

  describe('GET /contacts/:id', () => {
    let contactId;

    beforeEach(async () => {
      // Crear un contacto de prueba
      const response = await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({
          name: 'Test Contact',
          phone: '+9876543210'
        });
      contactId = response.body.contact.id;
    });

    it('debería obtener un contacto por ID', async () => {
      const response = await request(testApp)
        .get(`/contacts/${contactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('contact');
      expect(response.body.contact.id).toBe(contactId);
    });

    it('debería retornar 404 para contacto no existente', async () => {
      await request(testApp)
        .get('/contacts/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('PUT /contacts/:id', () => {
    let contactId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({
          name: 'Original Name',
          phone: '+5555555555'
        });
      contactId = response.body.contact.id;
    });

    it('debería actualizar un contacto existente', async () => {
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com',
        tags: ['actualizado']
      };

      const response = await request(testApp)
        .put(`/contacts/${contactId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200);

      expect(response.body.contact.name).toBe(updates.name);
      expect(response.body.contact.email).toBe(updates.email);
    });

    it('debería validar datos de actualización', async () => {
      const invalidUpdates = {
        email: 'invalid-email-format'
      };

      await request(testApp)
        .put(`/contacts/${contactId}`)
        .set('Authorization', adminToken)
        .send(invalidUpdates)
        .expect(400);
    });
  });

  describe('DELETE /contacts/:id', () => {
    let contactId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({
          name: 'To Delete',
          phone: '+1111111111'
        });
      contactId = response.body.contact.id;
    });

    it('debería eliminar un contacto existente', async () => {
      await request(testApp)
        .delete(`/contacts/${contactId}`)
        .set('Authorization', adminToken)
        .expect(200);

      // Verificar que el contacto ya no existe
      await request(testApp)
        .get(`/contacts/${contactId}`)
        .set('Authorization', adminToken)
        .expect(404);
    });

    it('debería retornar 404 para contacto no existente', async () => {
      await request(testApp)
        .delete('/contacts/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('POST /contacts/import/csv', () => {
    it('debería permitir importar contactos desde CSV', async () => {
      const csvContent = `name,phone,email,tags
Juan Pérez,+1234567890,juan@example.com,cliente
María García,+0987654321,maria@example.com,prospecto`;

      const response = await request(testApp)
        .post('/contacts/import/csv')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body).toHaveProperty('imported');
      expect(response.body).toHaveProperty('errors');
    });

    it('debería manejar errores en CSV inválido', async () => {
      const invalidCsv = 'invalid,csv,format';

      await request(testApp)
        .post('/contacts/import/csv')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(invalidCsv), 'invalid.csv')
        .expect(400);
    });
  });

  describe('GET /contacts/export/csv', () => {
    it('debería exportar contactos a CSV', async () => {
      // Crear algunos contactos primero
      await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({ name: 'Export Test 1', phone: '+1111111111' });

      await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({ name: 'Export Test 2', phone: '+2222222222' });

      const response = await request(testApp)
        .get('/contacts/export/csv')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('POST /contacts/:id/tag', () => {
    let contactId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/contacts')
        .set('Authorization', adminToken)
        .send({
          name: 'Tag Test',
          phone: '+3333333333'
        });
      contactId = response.body.contact.id;
    });

    it('debería agregar tags a un contacto', async () => {
      const response = await request(testApp)
        .post(`/contacts/${contactId}/tag`)
        .set('Authorization', adminToken)
        .send({ tags: ['nuevo', 'importante'] })
        .expect(200);

      expect(response.body.contact.tags).toContain('nuevo');
      expect(response.body.contact.tags).toContain('importante');
    });
  });

  describe('GET /contacts/tags', () => {
    it('debería obtener lista de tags disponibles', async () => {
      const response = await request(testApp)
        .get('/contacts/tags')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
    });
  });

  describe('Permissions', () => {
    it('los agentes deberían poder listar contactos', async () => {
      await request(testApp)
        .get('/contacts')
        .set('Authorization', agentToken)
        .expect(200);
    });

    it('los agentes deberían poder crear contactos', async () => {
      await request(testApp)
        .post('/contacts')
        .set('Authorization', agentToken)
        .send({
          name: 'Agent Created',
          phone: '+4444444444'
        })
        .expect(201);
    });

    it('solo admins deberían poder importar CSV', async () => {
      const csvContent = 'name,phone\nTest,+1234567890';
      
      await request(testApp)
        .post('/contacts/import/csv')
        .set('Authorization', agentToken)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(403);
    });
  });
}); 