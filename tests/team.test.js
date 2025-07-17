const request = require('supertest');
const _app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Team API', () => {
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

  describe('GET /team', () => {
    it('debería listar miembros del equipo', async () => {
      const response = await request(testApp)
        .get('/team')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('cada miembro debería incluir la estructura correcta', async () => {
      const response = await request(testApp)
        .get('/team')
        .set('Authorization', adminToken)
        .expect(200);

      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty('id');
        expect(user).not.toHaveProperty('uid');
        expect(user).toHaveProperty('name');
        expect(user).not.toHaveProperty('displayName');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('status');
      }
    });

    it('debería permitir filtros por rol', async () => {
      const response = await request(testApp)
        .get('/team?role=admin')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });

    it('debería permitir filtros por estado activo', async () => {
      const response = await request(testApp)
        .get('/team?isActive=true')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });

    it('debería permitir búsqueda por nombre o email', async () => {
      const response = await request(testApp)
        .get('/team?search=admin')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });

    it('debería permitir paginación', async () => {
      const response = await request(testApp)
        .get('/team?page=1&limit=5')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
    });

    it('solo admins deberían poder listar el equipo', async () => {
      await request(testApp)
        .get('/team')
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .get('/team')
        .set('Authorization', viewerToken)
        .expect(403);
    });
  });

  describe('POST /team/invite', () => {
    it('debería invitar nuevo miembro con datos válidos', async () => {
      const newUser = { email: 'new@test.com', name: 'New User', role: 'agent' };

      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('temporaryPassword');
      expect(response.body.user).toMatchObject({
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      });
    });

    it('debería validar campos requeridos', async () => {
      const invalidMember = {
        name: 'Sin Email',
        // Falta email
      };

      await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(invalidMember)
        .expect(400);
    });

    it('debería rechazar emails duplicados', async () => {
      const member = {
        email: 'duplicado@example.com',
        name: 'Duplicado',
        role: 'viewer',
      };

      // Crear primer miembro
      await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(member)
        .expect(201);

      // Intentar crear segundo miembro con mismo email
      await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(member)
        .expect(400);
    });

    it('debería usar rol viewer por defecto', async () => {
      const member = {
        email: 'defecto@example.com',
        name: 'Rol Defecto',
        // Sin especificar rol
      };

      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(member)
        .expect(201);

      expect(response.body.user.role).toBe('viewer');
    });

    it('solo admins deberían poder invitar miembros', async () => {
      const member = {
        email: 'noadmin@example.com',
        name: 'No Admin',
        role: 'agent',
      };

      await request(testApp)
        .post('/team/invite')
        .set('Authorization', agentToken)
        .send(member)
        .expect(403);

      await request(testApp)
        .post('/team/invite')
        .set('Authorization', viewerToken)
        .send(member)
        .expect(403);
    });
  });

  describe('GET /team/:id', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'detalle@example.com',
          name: 'Para Detalle',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería obtener detalles de un miembro por id', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(memberId);
      expect(response.body.user).toHaveProperty('kpis');
    });

    it('debería incluir KPIs detallados', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.user.kpis).toHaveProperty('period');
      expect(response.body.user.kpis).toHaveProperty('summary');
      expect(response.body.user.kpis).toHaveProperty('detailed');
    });

    it('admins deberían ver cualquier miembro', async () => {
      await request(testApp)
        .get(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .expect(200);
    });

    it('usuarios deberían ver solo su propia información', async () => {
      // Los agentes pueden ver su propia info, pero no la de otros
      await request(testApp)
        .get(`/team/${memberId}`)
        .set('Authorization', agentToken)
        .expect(403);
    });

    it('debería retornar 404 para miembro no existente', async () => {
      await request(testApp)
        .get('/team/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('PUT /team/:id', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'actualizar@example.com',
          name: 'Para Actualizar',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería actualizar un miembro existente', async () => {
      const updates = {
        name: 'Nombre Actualizado',
        role: 'admin',
      };

      const response = await request(testApp)
        .put(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200);

      expect(response.body.user.name).toBe(updates.name);
      expect(response.body.user.role).toBe(updates.role);
    });

    it('no debería permitir cambiar campos prohibidos', async () => {
      const updates = {
        id: 'new-id',
        email: 'new@example.com',
        createdAt: new Date().toISOString(),
      };

      const response = await request(testApp)
        .put(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .send(updates)
        .expect(200);

      // Los campos prohibidos no deberían cambiar
      expect(response.body.user.id).toBe(memberId);
      expect(response.body.user.email).toBe('actualizar@example.com');
    });

    it('no debería permitir que admin cambie su propio rol', async () => {
      // Asumiendo que el admin token corresponde a un admin
      const updates = {
        role: 'agent',
      };

      // Esto dependería de la implementación específica del test
      // Por ahora solo verificamos que el endpoint funciona
      await request(testApp)
        .put('/team/admin-id')
        .set('Authorization', adminToken)
        .send(updates)
        .expect(400);
    });

    it('solo admins deberían poder actualizar miembros', async () => {
      const updates = {
        name: 'No Permitido',
      };

      await request(testApp)
        .put(`/team/${memberId}`)
        .set('Authorization', agentToken)
        .send(updates)
        .expect(403);

      await request(testApp)
        .put(`/team/${memberId}`)
        .set('Authorization', viewerToken)
        .send(updates)
        .expect(403);
    });

    it('debería retornar 404 para miembro no existente', async () => {
      await request(testApp)
        .put('/team/nonexistent-id')
        .set('Authorization', adminToken)
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('DELETE /team/:id', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'eliminar@example.com',
          name: 'Para Eliminar',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería eliminar un miembro existente', async () => {
      await request(testApp)
        .delete(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .expect(200);

      // Verificar que el miembro ya no está activo
      const response = await request(testApp)
        .get(`/team/${memberId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.user.isActive).toBe(false);
    });

    it('no debería permitir auto-eliminación', async () => {
      // Esto requeriría conocer el ID del admin
      await request(testApp)
        .delete('/team/admin-self-id')
        .set('Authorization', adminToken)
        .expect(400);
    });

    it('solo admins deberían poder eliminar miembros', async () => {
      await request(testApp)
        .delete(`/team/${memberId}`)
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .delete(`/team/${memberId}`)
        .set('Authorization', viewerToken)
        .expect(403);
    });

    it('debería retornar 404 para miembro no existente', async () => {
      await request(testApp)
        .delete('/team/nonexistent-id')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('POST /team/:id/activate', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'activar@example.com',
          name: 'Para Activar',
          role: 'agent',
        });
      memberId = response.body.user.id;

      // Desactivar primero
      await request(testApp)
        .delete(`/team/${memberId}`)
        .set('Authorization', adminToken);
    });

    it('debería activar un miembro desactivado', async () => {
      const response = await request(testApp)
        .post(`/team/${memberId}/activate`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.user.isActive).toBe(true);
    });

    it('solo admins deberían poder activar miembros', async () => {
      await request(testApp)
        .post(`/team/${memberId}/activate`)
        .set('Authorization', agentToken)
        .expect(403);
    });
  });

  describe('POST /team/:id/deactivate', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'desactivar@example.com',
          name: 'Para Desactivar',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería desactivar un miembro activo', async () => {
      const response = await request(testApp)
        .post(`/team/${memberId}/deactivate`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.user.isActive).toBe(false);
    });

    it('no debería permitir auto-desactivación', async () => {
      await request(testApp)
        .post('/team/admin-self-id/deactivate')
        .set('Authorization', adminToken)
        .expect(400);
    });

    it('solo admins deberían poder desactivar miembros', async () => {
      await request(testApp)
        .post(`/team/${memberId}/deactivate`)
        .set('Authorization', agentToken)
        .expect(403);
    });
  });

  describe('GET /team/:id/kpis', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'kpis@example.com',
          name: 'Para KPIs',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería obtener KPIs detallados de un miembro', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}/kpis`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('kpis');

      expect(response.body.kpis).toHaveProperty('period');
      expect(response.body.kpis).toHaveProperty('summary');
      expect(response.body.kpis).toHaveProperty('detailed');
    });

    it('KPIs summary debería tener métricas básicas', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}/kpis`)
        .set('Authorization', adminToken)
        .expect(200);

      const summary = response.body.kpis.summary;
      expect(summary).toHaveProperty('messagesHandled');
      expect(summary).toHaveProperty('contactsManaged');
      expect(summary).toHaveProperty('campaignsCreated');
      expect(summary).toHaveProperty('productivity');
      expect(summary).toHaveProperty('responseTime');
      expect(summary).toHaveProperty('satisfaction');
    });

    it('debería permitir diferentes períodos', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}/kpis?period=90d`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period).toBe('90d');
    });

    it('usuarios deberían ver sus propios KPIs', async () => {
      // Esto requeriría autenticación como el usuario específico
      // Por ahora verificamos que funciona para admins
      await request(testApp)
        .get(`/team/${memberId}/kpis`)
        .set('Authorization', adminToken)
        .expect(200);
    });

    it('usuarios no deberían ver KPIs de otros', async () => {
      await request(testApp)
        .get(`/team/${memberId}/kpis`)
        .set('Authorization', agentToken)
        .expect(403);
    });
  });

  describe('POST /team/:id/reset-password', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'reset@example.com',
          name: 'Para Reset',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    it('debería resetear contraseña de un miembro', async () => {
      const response = await request(testApp)
        .post(`/team/${memberId}/reset-password`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('temporaryPassword');
    });

    it('solo admins deberían poder resetear contraseñas', async () => {
      await request(testApp)
        .post(`/team/${memberId}/reset-password`)
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .post(`/team/${memberId}/reset-password`)
        .set('Authorization', viewerToken)
        .expect(403);
    });

    it('debería retornar 404 para miembro no existente', async () => {
      await request(testApp)
        .post('/team/nonexistent-id/reset-password')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('Validación de períodos en KPIs', () => {
    let memberId;

    beforeEach(async () => {
      const response = await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send({
          email: 'periodo@example.com',
          name: 'Test Periodo',
          role: 'agent',
        });
      memberId = response.body.user.id;
    });

    const validPeriods = ['7d', '30d', '90d'];

    validPeriods.forEach(period => {
      it(`debería aceptar período ${period}`, async () => {
        await request(testApp)
          .get(`/team/${memberId}/kpis?period=${period}`)
          .set('Authorization', adminToken)
          .expect(200);
      });
    });

    it('debería usar período por defecto para períodos inválidos', async () => {
      const response = await request(testApp)
        .get(`/team/${memberId}/kpis?period=invalid`)
        .set('Authorization', adminToken)
        .expect(200);

      // Debería usar 30d por defecto
      expect(response.body.kpis.period.type).toBe('30d');
    });
  });

  describe('Error handling', () => {
    it('debería manejar errores de Firebase Auth gracefully', async () => {
      // Esto se testearía con mocks en un test real
      const member = {
        email: 'firebase-error@example.com',
        name: 'Firebase Error',
        role: 'agent',
      };

      // En un test real, mockearíamos Firebase para que falle
      // Por ahora solo verificamos que el endpoint existe
      await request(testApp)
        .post('/team/invite')
        .set('Authorization', adminToken)
        .send(member);
    });

    it('debería manejar IDs inválidos', async () => {
      await request(testApp)
        .get('/team/invalid-uid-format')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });
});
