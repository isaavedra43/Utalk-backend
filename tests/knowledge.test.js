const request = require('supertest');
const _app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Knowledge API', () => {
  let testApp, adminToken, agentToken, viewerToken;

  beforeAll(async () => {
    testApp = await initializeTestApp();

    adminToken = 'Bearer test-admin-token';
    agentToken = 'Bearer test-agent-token';
    viewerToken = 'Bearer test-viewer-token';
  });

  afterAll(async () => {
    await cleanupTest();
  });

  describe('GET /knowledge', () => {
    it('debería listar documentos públicos para todos los usuarios', async () => {
      const response = await request(testApp)
        .get('/knowledge')
        .set('Authorization', viewerToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.documents)).toBe(true);
    });

    it('debería permitir filtros por categoría', async () => {
      const response = await request(testApp)
        .get('/knowledge?category=faq')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });

    it('debería permitir filtros por tipo', async () => {
      const response = await request(testApp)
        .get('/knowledge?type=article')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });

    it('debería permitir búsqueda por tags', async () => {
      const response = await request(testApp)
        .get('/knowledge?tags=importante,guia')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });

    it('debería mostrar documentos fijados primero', async () => {
      const response = await request(testApp)
        .get('/knowledge?isPinned=true')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });

    it('admins deberían ver documentos privados', async () => {
      const response = await request(testApp)
        .get('/knowledge?isPublic=false')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });
  });

  describe('POST /knowledge', () => {
    it('debería crear un nuevo documento con datos válidos', async () => {
      const newDocument = {
        title: 'Guía de Prueba',
        content: 'Este es el contenido de la guía de prueba.',
        category: 'tutorial',
        tags: ['test', 'guia'],
        type: 'article',
        isPublic: true,
      };

      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send(newDocument)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('document');
      expect(response.body.document).toMatchObject({
        title: newDocument.title,
        content: newDocument.content,
        category: newDocument.category,
        type: newDocument.type,
      });
    });

    it('debería validar campos requeridos', async () => {
      const invalidDocument = {
        content: 'Contenido sin título',
        // Falta title
      };

      await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send(invalidDocument)
        .expect(400);
    });

    it('debería procesar tags como string separado por comas', async () => {
      const document = {
        title: 'Test Tags',
        content: 'Test content',
        tags: 'tag1, tag2, tag3',
      };

      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send(document)
        .expect(201);

      expect(response.body.document.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('agentes deberían poder crear documentos', async () => {
      const document = {
        title: 'Agent Document',
        content: 'Created by agent',
        category: 'general',
      };

      await request(testApp)
        .post('/knowledge')
        .set('Authorization', agentToken)
        .send(document)
        .expect(201);
    });
  });

  describe('GET /knowledge/:id', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Document',
          content: 'Test content',
          isPublic: true,
        });
      documentId = response.body.document.id;
    });

    it('debería obtener un documento por ID', async () => {
      const response = await request(testApp)
        .get(`/knowledge/${documentId}`)
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('document');
      expect(response.body.document.id).toBe(documentId);
    });

    it('debería incrementar el contador de vistas', async () => {
      const response1 = await request(testApp)
        .get(`/knowledge/${documentId}`)
        .set('Authorization', agentToken);

      const response2 = await request(testApp)
        .get(`/knowledge/${documentId}`)
        .set('Authorization', agentToken);

      expect(response2.body.document.views).toBeGreaterThan(response1.body.document.views);
    });

    it('debería incluir artículos relacionados', async () => {
      const response = await request(testApp)
        .get(`/knowledge/${documentId}`)
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body.document).toHaveProperty('relatedArticles');
      expect(Array.isArray(response.body.document.relatedArticles)).toBe(true);
    });

    it('debería retornar 404 para documento no existente', async () => {
      await request(testApp)
        .get('/knowledge/nonexistent-id')
        .set('Authorization', agentToken)
        .expect(404);
    });

    it('no debería permitir acceso a documentos privados sin permisos', async () => {
      // Crear documento privado
      const privateDocResponse = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Private Document',
          content: 'Private content',
          isPublic: false,
        });

      await request(testApp)
        .get(`/knowledge/${privateDocResponse.body.document.id}`)
        .set('Authorization', viewerToken)
        .expect(403);
    });
  });

  describe('PUT /knowledge/:id', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Original Title',
          content: 'Original content',
        });
      documentId = response.body.document.id;
    });

    it('debería actualizar un documento existente', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated'],
      };

      const response = await request(testApp)
        .put(`/knowledge/${documentId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200);

      expect(response.body.document.title).toBe(updates.title);
      expect(response.body.document.content).toBe(updates.content);
    });

    it('solo el creador o admin debería poder actualizar', async () => {
      // Intentar actualizar como otro usuario
      await request(testApp)
        .put(`/knowledge/${documentId}`)
        .set('Authorization', agentToken)
        .send({ title: 'Should not update' })
        .expect(403);
    });

    it('debería actualizar lastModifiedBy', async () => {
      const response = await request(testApp)
        .put(`/knowledge/${documentId}`)
        .set('Authorization', adminToken)
        .send({ title: 'Modified Title' })
        .expect(200);

      expect(response.body.document.lastModifiedBy).toBeDefined();
    });
  });

  describe('DELETE /knowledge/:id', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'To Delete',
          content: 'Will be deleted',
        });
      documentId = response.body.document.id;
    });

    it('el creador debería poder eliminar su documento', async () => {
      await request(testApp)
        .delete(`/knowledge/${documentId}`)
        .set('Authorization', adminToken)
        .expect(200);

      // Verificar que el documento ya no está disponible
      await request(testApp)
        .get(`/knowledge/${documentId}`)
        .set('Authorization', adminToken)
        .expect(404);
    });

    it('otros usuarios no deberían poder eliminar documentos ajenos', async () => {
      await request(testApp)
        .delete(`/knowledge/${documentId}`)
        .set('Authorization', agentToken)
        .expect(403);
    });
  });

  describe('GET /knowledge/search', () => {
    beforeEach(async () => {
      // Crear algunos documentos para buscar
      await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'JavaScript Tutorial',
          content: 'Learn JavaScript programming',
          tags: ['javascript', 'programming'],
          isPublic: true,
        });

      await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'React Guide',
          content: 'Building apps with React',
          tags: ['react', 'javascript'],
          isPublic: true,
        });
    });

    it('debería buscar por título', async () => {
      const response = await request(testApp)
        .get('/knowledge/search?q=JavaScript')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('searchTerm', 'JavaScript');
      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('debería buscar por contenido', async () => {
      const response = await request(testApp)
        .get('/knowledge/search?q=programming')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('debería buscar por tags', async () => {
      const response = await request(testApp)
        .get('/knowledge/search?q=react')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('debería requerir parámetro de búsqueda', async () => {
      await request(testApp)
        .get('/knowledge/search')
        .set('Authorization', agentToken)
        .expect(400);
    });

    it('debería permitir filtro por categoría', async () => {
      const response = await request(testApp)
        .get('/knowledge/search?q=JavaScript&category=tutorial')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });
  });

  describe('GET /knowledge/categories', () => {
    it('debería obtener lista de categorías', async () => {
      const response = await request(testApp)
        .get('/knowledge/categories')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });
  });

  describe('POST /knowledge/:id/publish', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', agentToken)
        .send({
          title: 'To Publish',
          content: 'Content to publish',
          isPublic: false,
        });
      documentId = response.body.document.id;
    });

    it('admins deberían poder publicar documentos', async () => {
      const response = await request(testApp)
        .post(`/knowledge/${documentId}/publish`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.document.isPublic).toBe(true);
    });

    it('no-admins no deberían poder publicar', async () => {
      await request(testApp)
        .post(`/knowledge/${documentId}/publish`)
        .set('Authorization', agentToken)
        .expect(403);
    });
  });

  describe('POST /knowledge/:id/unpublish', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'To Unpublish',
          content: 'Published content',
          isPublic: true,
        });
      documentId = response.body.document.id;
    });

    it('admins deberían poder despublicar documentos', async () => {
      const response = await request(testApp)
        .post(`/knowledge/${documentId}/unpublish`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.document.isPublic).toBe(false);
    });
  });

  describe('POST /knowledge/:id/vote-helpful', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Voting Test',
          content: 'Test content',
          isPublic: true,
        });
      documentId = response.body.document.id;
    });

    it('debería registrar voto como útil', async () => {
      const response = await request(testApp)
        .post(`/knowledge/${documentId}/vote-helpful`)
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.helpful).toBeGreaterThan(0);
    });
  });

  describe('POST /knowledge/:id/vote-not-helpful', () => {
    let documentId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Voting Test',
          content: 'Test content',
          isPublic: true,
        });
      documentId = response.body.document.id;
    });

    it('debería registrar voto como no útil', async () => {
      const response = await request(testApp)
        .post(`/knowledge/${documentId}/vote-not-helpful`)
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.notHelpful).toBeGreaterThan(0);
    });
  });

  describe('POST /knowledge/upload', () => {
    it('debería subir archivo correctamente', async () => {
      const fileContent = 'Test file content';

      const response = await request(testApp)
        .post('/knowledge/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(fileContent), 'test.txt')
        .expect(200);

      expect(response.body).toHaveProperty('file');
      expect(response.body.file).toHaveProperty('fileName');
      expect(response.body.file).toHaveProperty('fileUrl');
      expect(response.body.file).toHaveProperty('fileSize');
    });

    it('debería validar tipos de archivo', async () => {
      const fileContent = 'Malicious content';

      await request(testApp)
        .post('/knowledge/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(fileContent), 'malicious.exe')
        .expect(400);
    });

    it('debería requerir archivo', async () => {
      await request(testApp)
        .post('/knowledge/upload')
        .set('Authorization', adminToken)
        .expect(400);
    });
  });

  describe('Permissions', () => {
    it('viewers deberían poder leer documentos públicos', async () => {
      await request(testApp)
        .get('/knowledge')
        .set('Authorization', viewerToken)
        .expect(200);
    });

    it('viewers no deberían poder crear documentos', async () => {
      await request(testApp)
        .post('/knowledge')
        .set('Authorization', viewerToken)
        .send({
          title: 'Should not create',
          content: 'Not allowed',
        })
        .expect(403);
    });

    it('agentes deberían poder crear documentos', async () => {
      await request(testApp)
        .post('/knowledge')
        .set('Authorization', agentToken)
        .send({
          title: 'Agent Document',
          content: 'Agent content',
        })
        .expect(201);
    });

    it('solo admins deberían poder publicar/despublicar', async () => {
      const docResponse = await request(testApp)
        .post('/knowledge')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Doc',
          content: 'Test content',
          isPublic: false,
        });

      await request(testApp)
        .post(`/knowledge/${docResponse.body.document.id}/publish`)
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .post(`/knowledge/${docResponse.body.document.id}/publish`)
        .set('Authorization', adminToken)
        .expect(200);
    });
  });
});
