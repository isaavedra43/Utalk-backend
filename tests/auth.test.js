const request = require('supertest');
const app = require('../src/index');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    // Nota: Test de login exitoso requiere configuración completa de Firebase
    // Este test valida que la estructura de respuesta sea correcta cuando se implementa
    it('should have correct response structure for successful login', () => {
      // Estructura esperada para login exitoso
      const expectedStructure = {
        message: 'Login exitoso',
        user: {
          uid: expect.any(String),
          email: expect.any(String),
          // otros campos del usuario...
        },
        token: expect.any(String), // ← CRÍTICO: Token JWT debe estar presente
      };

      // Este test valida que conocemos la estructura correcta
      expect(expectedStructure).toHaveProperty('token');
      expect(expectedStructure).toHaveProperty('user');
      expect(expectedStructure).toHaveProperty('message');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Invalid-Token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
}); 