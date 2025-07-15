const request = require('supertest');
const app = require('../src/index');
const { initializeTestApp, cleanupTest } = require('./setup');

describe('Dashboard API', () => {
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

  describe('GET /dashboard/metrics', () => {
    it('debería obtener métricas generales del dashboard', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('contacts');
      expect(response.body).toHaveProperty('campaigns');
      expect(response.body).toHaveProperty('userActivity');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('trends');
    });

    it('debería permitir especificar período', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics?period=30d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period.type).toBe('30d');
    });

    it('debería permitir fechas específicas', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';
      
      const response = await request(testApp)
        .get(`/dashboard/metrics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period.start).toContain('2023-01-01');
      expect(response.body.period.end).toContain('2023-01-31');
    });

    it('agentes deberían ver solo sus métricas', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', agentToken)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      // Los agentes ven sus propias métricas, no las globales
    });

    it('admins deberían ver métricas globales', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('totalMessages');
      expect(response.body.summary).toHaveProperty('totalContacts');
      expect(response.body.summary).toHaveProperty('totalCampaigns');
      expect(response.body.summary).toHaveProperty('activeUsers');
    });

    it('debería rechazar usuarios sin autenticación', async () => {
      await request(testApp)
        .get('/dashboard/metrics')
        .expect(401);
    });
  });

  describe('GET /dashboard/messages/stats', () => {
    it('debería obtener estadísticas específicas de mensajes', async () => {
      const response = await request(testApp)
        .get('/dashboard/messages/stats')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('inbound');
      expect(response.body.stats).toHaveProperty('outbound');
      expect(response.body.stats).toHaveProperty('byStatus');
      expect(response.body.stats).toHaveProperty('byType');
      expect(response.body.stats).toHaveProperty('responseTime');
    });

    it('debería permitir filtros de período', async () => {
      const response = await request(testApp)
        .get('/dashboard/messages/stats?period=7d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period).toBeDefined();
    });
  });

  describe('GET /dashboard/contacts/stats', () => {
    it('debería obtener estadísticas específicas de contactos', async () => {
      const response = await request(testApp)
        .get('/dashboard/contacts/stats')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('new');
      expect(response.body.stats).toHaveProperty('active');
      expect(response.body.stats).toHaveProperty('growth');
    });
  });

  describe('GET /dashboard/campaigns/stats', () => {
    it('debería obtener estadísticas específicas de campañas', async () => {
      const response = await request(testApp)
        .get('/dashboard/campaigns/stats')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('new');
      expect(response.body.stats).toHaveProperty('completed');
      expect(response.body.stats).toHaveProperty('active');
      expect(response.body.stats).toHaveProperty('draft');
      expect(response.body.stats).toHaveProperty('successRate');
    });
  });

  describe('GET /dashboard/activity/recent', () => {
    it('debería obtener actividad reciente', async () => {
      const response = await request(testApp)
        .get('/dashboard/activity/recent')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('debería permitir limitar la cantidad de actividades', async () => {
      const response = await request(testApp)
        .get('/dashboard/activity/recent?limit=5')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.activities.length).toBeLessThanOrEqual(5);
    });

    it('las actividades deberían tener estructura correcta', async () => {
      const response = await request(testApp)
        .get('/dashboard/activity/recent?limit=1')
        .set('Authorization', adminToken)
        .expect(200);

      if (response.body.activities.length > 0) {
        const activity = response.body.activities[0];
        expect(activity).toHaveProperty('type');
        expect(activity).toHaveProperty('action');
        expect(activity).toHaveProperty('data');
        expect(activity).toHaveProperty('timestamp');
        expect(activity).toHaveProperty('user');
      }
    });
  });

  describe('GET /dashboard/export', () => {
    it('debería exportar reporte en JSON por defecto', async () => {
      const response = await request(testApp)
        .get('/dashboard/export')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('details');
    });

    it('debería exportar reporte en CSV', async () => {
      const response = await request(testApp)
        .get('/dashboard/export?format=csv')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('debería permitir especificar período para exportación', async () => {
      const response = await request(testApp)
        .get('/dashboard/export?period=90d&format=json')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period.type).toBe('90d');
    });

    it('debería incluir todas las métricas en el reporte', async () => {
      const response = await request(testApp)
        .get('/dashboard/export')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.details).toHaveProperty('messages');
      expect(response.body.details).toHaveProperty('contacts');
      expect(response.body.details).toHaveProperty('campaigns');
    });
  });

  describe('GET /dashboard/performance', () => {
    it('solo admins deberían acceder a métricas de rendimiento del equipo', async () => {
      await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', viewerToken)
        .expect(403);
    });

    it('admins deberían obtener métricas de rendimiento del equipo', async () => {
      const response = await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('teamMetrics');
      expect(response.body).toHaveProperty('rankings');
      expect(response.body).toHaveProperty('summary');
    });

    it('debería incluir rankings por diferentes métricas', async () => {
      const response = await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.rankings).toHaveProperty('byMessages');
      expect(response.body.rankings).toHaveProperty('byContacts');
      expect(response.body.rankings).toHaveProperty('byCampaigns');
      expect(response.body.rankings).toHaveProperty('byProductivity');
    });

    it('cada métrica de usuario debería tener estructura correcta', async () => {
      const response = await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', adminToken)
        .expect(200);

      if (response.body.teamMetrics.length > 0) {
        const userMetric = response.body.teamMetrics[0];
        expect(userMetric).toHaveProperty('user');
        expect(userMetric).toHaveProperty('metrics');
        expect(userMetric.user).toHaveProperty('uid');
        expect(userMetric.user).toHaveProperty('displayName');
        expect(userMetric.user).toHaveProperty('email');
        expect(userMetric.user).toHaveProperty('role');
        expect(userMetric.metrics).toHaveProperty('messages');
        expect(userMetric.metrics).toHaveProperty('contacts');
        expect(userMetric.metrics).toHaveProperty('campaigns');
        expect(userMetric.metrics).toHaveProperty('productivity');
      }
    });

    it('debería permitir diferentes períodos', async () => {
      const response = await request(testApp)
        .get('/dashboard/performance?period=90d')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.period.type).toBe('90d');
    });

    it('debería calcular estadísticas de resumen del equipo', async () => {
      const response = await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.summary).toHaveProperty('totalUsers');
      expect(response.body.summary).toHaveProperty('avgProductivity');
      expect(typeof response.body.summary.totalUsers).toBe('number');
      expect(typeof response.body.summary.avgProductivity).toBe('number');
    });
  });

  describe('Validación de períodos', () => {
    const validPeriods = ['1d', '7d', '30d', '90d', '1y'];

    validPeriods.forEach(period => {
      it(`debería aceptar período ${period}`, async () => {
        await request(testApp)
          .get(`/dashboard/metrics?period=${period}`)
          .set('Authorization', adminToken)
          .expect(200);
      });
    });

    it('debería usar período por defecto para períodos inválidos', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics?period=invalid')
        .set('Authorization', adminToken)
        .expect(200);

      // Debería usar el período por defecto (7d)
      expect(response.body.period).toBeDefined();
    });
  });

  describe('Datos de tendencias', () => {
    it('las métricas deberían incluir datos de tendencias', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('trends');
      expect(Array.isArray(response.body.trends)).toBe(true);
    });

    it('cada punto de tendencia debería tener estructura correcta', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics?period=7d')
        .set('Authorization', adminToken)
        .expect(200);

      if (response.body.trends.length > 0) {
        const trendPoint = response.body.trends[0];
        expect(trendPoint).toHaveProperty('date');
        expect(trendPoint).toHaveProperty('messages');
        expect(trendPoint).toHaveProperty('contacts');
        expect(trendPoint).toHaveProperty('inbound');
        expect(trendPoint).toHaveProperty('outbound');
      }
    });
  });

  describe('Permissions', () => {
    it('viewers deberían poder ver métricas básicas', async () => {
      await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', viewerToken)
        .expect(200);
    });

    it('agentes deberían poder ver sus métricas', async () => {
      await request(testApp)
        .get('/dashboard/metrics')
        .set('Authorization', agentToken)
        .expect(200);
    });

    it('solo admins deberían poder ver métricas de rendimiento', async () => {
      await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', agentToken)
        .expect(403);

      await request(testApp)
        .get('/dashboard/performance')
        .set('Authorization', adminToken)
        .expect(200);
    });

    it('todos los usuarios autenticados deberían poder exportar sus reportes', async () => {
      await request(testApp)
        .get('/dashboard/export')
        .set('Authorization', viewerToken)
        .expect(200);

      await request(testApp)
        .get('/dashboard/export')
        .set('Authorization', agentToken)
        .expect(200);

      await request(testApp)
        .get('/dashboard/export')
        .set('Authorization', adminToken)
        .expect(200);
    });
  });

  describe('Error handling', () => {
    it('debería manejar errores de período inválido gracefully', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics?period=invalid-period')
        .set('Authorization', adminToken)
        .expect(200);

      // Debería usar período por defecto
      expect(response.body.period).toBeDefined();
    });

    it('debería manejar fechas inválidas', async () => {
      const response = await request(testApp)
        .get('/dashboard/metrics?startDate=invalid-date&endDate=invalid-date')
        .set('Authorization', adminToken)
        .expect(200);

      // Debería usar período por defecto
      expect(response.body.period).toBeDefined();
    });
  });
}); 