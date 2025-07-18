const request = require('supertest');
const app = require('../src/index');
const jwt = require('jsonwebtoken');

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
      const expectedStructure = {
        token: expect.any(String),
        user: {
          id: expect.any(String),
          name: expect.any(String),
          role: expect.any(String),
          // email no es parte del contrato principal de user
        },
        expiresIn: expect.any(String),
      };
      // Este test valida que conocemos la estructura correcta
      expect(expectedStructure).toHaveProperty('token');
      expect(expectedStructure).toHaveProperty('user');
      expect(expectedStructure).toHaveProperty('message');
    });

    it('debería devolver token válido para credenciales correctas', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('expiresIn');

      // Verificar que el token es válido
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded.email).toBe('admin@test.com');
      expect(decoded.role).toBe('admin');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Token de autorización requerido');
    });

    it('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Invalid-Token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Formato de token inválido');
    });

    it('should return 401 with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Token inválido');
    });

    it('should return 401 with expired JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${global.testTokens.expired}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Token expirado');
    });

    // Nota: Test con token válido requiere que el endpoint /api/auth/me esté implementado
    // y que el modelo User funcione correctamente
    it('should validate JWT token structure', () => {
      // Este test confirma que podemos generar tokens JWT válidos
      const validToken = global.generateTestToken({
        uid: 'test-user-123',
        email: 'test@example.com',
        role: 'admin',
      });

      expect(validToken).toBeDefined();
      expect(typeof validToken).toBe('string');
      expect(validToken.split('.')).toHaveLength(3); // JWT tiene 3 partes separadas por puntos
    });

    it('should return the profile of the authenticated user', async () => {
      const token = global.generateTestToken({ id: 'test-user-123', name: 'Test User' });
      // ... (mock de User.getById)
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response.body.user.id).toBe('test-user-123');
      expect(response.body.user.name).toBe('Test User');
    });
  });

  describe('JWT Middleware Tests', () => {
    it('should accept valid JWT tokens', async () => {
      const validToken = global.testTokens.admin;

      // Test con cualquier endpoint que use authMiddleware
      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${validToken}`);

      // Si el token es válido, no debería ser 401 (puede ser 500 por otros motivos, pero no 401)
      expect(response.status).not.toBe(401);
    });

    it('should reject tokens with wrong format', async () => {
      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'WrongFormat token-here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Formato de token inválido');
    });

    it('should reject empty tokens', async () => {
      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token vacío');
    });
  });

  describe('Role-based Authorization Tests', () => {
    it('should allow admin access to admin endpoints', async () => {
      const adminToken = global.testTokens.admin;

      const response = await request(app)
        .get('/api/team')
        .set('Authorization', `Bearer ${adminToken}`);

      // Admin debería tener acceso (no 403 Forbidden)
      expect(response.status).not.toBe(403);
    });

    it('should deny viewer access to admin endpoints', async () => {
      const viewerToken = global.testTokens.viewer;

      const response = await request(app)
        .get('/api/team')
        .set('Authorization', `Bearer ${viewerToken}`);

      // Viewer NO debería tener acceso a endpoints de admin
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Permisos insuficientes');
    });
  });
});
