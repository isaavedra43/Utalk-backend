/**
 * 🧪 ENTERPRISE SOCKET MANAGER TESTS
 * 
 * Tests comprehensivos para validar la nueva arquitectura de tiempo real
 * basada en mejores prácticas de Socket.IO y prevención de memory leaks.
 * 
 * @version 1.0.0
 * @author Testing Team
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const EnterpriseSocketManager = require('../../src/socket/enterpriseSocketManager');

describe('🚀 Enterprise Socket Manager', () => {
  let httpServer, socketManager, clientSocket;
  const JWT_SECRET = 'test-secret-key';
  const SERVER_PORT = 3002; // Different from main server

  beforeAll(() => {
    // Set test environment variables
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize Enterprise Socket Manager
    socketManager = new EnterpriseSocketManager(httpServer);
    await socketManager.initialize();
    
    // Start server
    await new Promise((resolve) => {
      httpServer.listen(SERVER_PORT, resolve);
    });
  });

  afterEach(async () => {
    // Cleanup client socket
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
    
    // Graceful shutdown of socket manager
    if (socketManager && !socketManager.isShuttingDown) {
      await socketManager.gracefulShutdown('test');
    }
    
    // Close HTTP server
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  describe('🔐 Authentication Tests', () => {
    test('should reject connection without JWT token', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        autoConnect: false
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('AUTHENTICATION_REQUIRED');
        done();
      });

      clientSocket.connect();
    });

    test('should reject connection with invalid JWT token', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: {
          token: 'invalid-token-here'
        },
        autoConnect: false
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('AUTHENTICATION_FAILED');
        done();
      });

      clientSocket.connect();
    });

    test('should accept connection with valid JWT token', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: {
          token: validToken
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(new Error(`Unexpected connection error: ${error.message}`));
      });
    });

    test('should handle JWT token in authorization header', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        extraHeaders: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(new Error(`Unexpected connection error: ${error.message}`));
      });
    });

    test('should disconnect existing session when user connects from new device', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      // First connection
      const firstSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      firstSocket.on('connect', () => {
        // Second connection with same user
        clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
          auth: { token: validToken }
        });

        firstSocket.on('sync-required', (data) => {
          expect(data.reason).toBe('new_session_detected');
          firstSocket.close();
          done();
        });
      });
    });
  });

  describe('🧠 Memory Management Tests', () => {
    let validToken;

    beforeEach(() => {
      validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );
    });

    test('should register user in connectedUsers map on connection', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        expect(socketManager.connectedUsers.size).toBe(1);
        expect(socketManager.connectedUsers.has('test@example.com')).toBe(true);
        done();
      });
    });

    test('should clean up user from connectedUsers map on disconnect', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        expect(socketManager.connectedUsers.size).toBe(1);
        
        clientSocket.on('disconnect', () => {
          // Wait for cleanup
          setTimeout(() => {
            expect(socketManager.connectedUsers.size).toBe(0);
            done();
          }, 100);
        });

        clientSocket.close();
      });
    });

    test('should clean up event listeners on disconnect', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        const socketId = clientSocket.id;
        expect(socketManager.eventListeners.has(socketId)).toBe(true);

        clientSocket.on('disconnect', () => {
          // Wait for cleanup
          setTimeout(() => {
            expect(socketManager.eventListeners.has(socketId)).toBe(false);
            done();
          }, 100);
        });

        clientSocket.close();
      });
    });

    test('should handle multiple connections without memory leaks', async () => {
      const connections = [];
      const connectionPromises = [];

      // Create 100 connections
      for (let i = 0; i < 100; i++) {
        const token = jwt.sign(
          { email: `user${i}@example.com` },
          JWT_SECRET,
          { 
            issuer: 'utalk-backend',
            audience: 'utalk-frontend',
            expiresIn: '1h'
          }
        );

        const socket = Client(`http://localhost:${SERVER_PORT}`, {
          auth: { token },
          autoConnect: false
        });

        connectionPromises.push(new Promise((resolve) => {
          socket.on('connect', () => {
            connections.push(socket);
            resolve();
          });
          socket.connect();
        }));
      }

      // Wait for all connections
      await Promise.all(connectionPromises);

      expect(connections.length).toBe(100);
      expect(socketManager.connectedUsers.size).toBe(100);

      // Disconnect all
      const disconnectPromises = connections.map(socket => {
        return new Promise((resolve) => {
          socket.on('disconnect', resolve);
          socket.close();
        });
      });

      await Promise.all(disconnectPromises);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(socketManager.connectedUsers.size).toBe(0);
      expect(socketManager.eventListeners.size).toBe(0);
    });
  });

  describe('🚦 Rate Limiting Tests', () => {
    let validToken;

    beforeEach(() => {
      validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );
    });

    test('should apply rate limiting to rapid events', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        let errorCount = 0;

        clientSocket.on('error', (error) => {
          if (error.error === 'RATE_LIMIT_EXCEEDED') {
            errorCount++;
            if (errorCount >= 5) {
              done();
            }
          }
        });

        // Send rapid typing events (should trigger rate limiting)
        for (let i = 0; i < 10; i++) {
          clientSocket.emit('typing', {
            conversationId: 'test-conversation'
          });
        }
      });
    });

    test('should allow events within rate limit', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        let errorReceived = false;

        clientSocket.on('error', (error) => {
          if (error.error === 'RATE_LIMIT_EXCEEDED') {
            errorReceived = true;
          }
        });

        // Send one typing event (should be allowed)
        clientSocket.emit('typing', {
          conversationId: 'test-conversation'
        });

        // Wait and check no rate limit error
        setTimeout(() => {
          expect(errorReceived).toBe(false);
          done();
        }, 100);
      });
    });
  });

  describe('🔄 State Synchronization Tests', () => {
    let validToken;

    beforeEach(() => {
      validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );
    });

    test('should respond to sync-state request', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        clientSocket.on('state-synced', (data) => {
          expect(data).toHaveProperty('conversations');
          expect(data).toHaveProperty('unreadCounts');
          expect(data).toHaveProperty('onlineUsers');
          expect(data).toHaveProperty('serverTime');
          expect(data).toHaveProperty('syncId');
          done();
        });

        clientSocket.emit('sync-state', {
          syncId: Date.now()
        });
      });
    });

    test('should send initial state sync on connection', (done) => {
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('state-synced', (data) => {
        expect(data.syncId).toContain('initial_');
        expect(data).toHaveProperty('conversations');
        expect(Array.isArray(data.conversations)).toBe(true);
        done();
      });
    });
  });

  describe('💬 Message Events Tests', () => {
    let validToken;

    beforeEach(() => {
      validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );
    });

    test('should require authentication for message events', (done) => {
      // Connect without authentication
      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        autoConnect: false
      });

      // Force connection without auth (should fail in middleware)
      // This test validates that events require proper authentication
      const socketWithoutAuth = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      socketWithoutAuth.on('connect', () => {
        // Override userEmail to simulate unauthenticated socket
        const originalUserEmail = socketWithoutAuth.userEmail;
        delete socketWithoutAuth.userEmail;

        socketWithoutAuth.on('error', (error) => {
          if (error.error === 'AUTHENTICATION_REQUIRED') {
            socketWithoutAuth.userEmail = originalUserEmail;
            socketWithoutAuth.close();
            done();
          }
        });

        // This should trigger authentication error
        socketWithoutAuth.emit('new-message', {
          conversationId: 'test',
          content: 'test message'
        });
      });
    });

    test('should handle typing events', (done) => {
      const userToken1 = jwt.sign(
        { email: 'user1@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      const userToken2 = jwt.sign(
        { email: 'user2@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      const socket1 = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: userToken1 }
      });

      const socket2 = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: userToken2 }
      });

      let connectionsReady = 0;

      const checkReady = () => {
        connectionsReady++;
        if (connectionsReady === 2) {
          // Both connected, join same conversation
          socket1.emit('join-conversation', {
            conversationId: 'test-conversation'
          });
          
          socket2.emit('join-conversation', {
            conversationId: 'test-conversation'
          });

          // User1 starts typing
          socket1.emit('typing', {
            conversationId: 'test-conversation'
          });
        }
      };

      socket1.on('connect', checkReady);
      socket2.on('connect', checkReady);

      // User2 should receive typing notification
      socket2.on('typing', (data) => {
        expect(data.conversationId).toBe('test-conversation');
        expect(data.userEmail).toBe('user1@example.com');
        
        socket1.close();
        socket2.close();
        done();
      });
    });
  });

  describe('📊 Performance Tests', () => {
    test('should handle rapid connections and disconnections', async () => {
      const connectionCycles = 50;
      const tokens = [];

      // Generate tokens
      for (let i = 0; i < connectionCycles; i++) {
        tokens.push(jwt.sign(
          { email: `perftest${i}@example.com` },
          JWT_SECRET,
          { 
            issuer: 'utalk-backend',
            audience: 'utalk-frontend',
            expiresIn: '1h'
          }
        ));
      }

      const startTime = Date.now();

      // Rapid connect/disconnect cycles
      for (let i = 0; i < connectionCycles; i++) {
        const socket = Client(`http://localhost:${SERVER_PORT}`, {
          auth: { token: tokens[i] },
          autoConnect: false
        });

        await new Promise((resolve) => {
          socket.on('connect', () => {
            socket.close();
            resolve();
          });
          socket.connect();
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Memory should be clean
      expect(socketManager.connectedUsers.size).toBe(0);
      expect(socketManager.eventListeners.size).toBe(0);
    });

    test('should maintain stable memory usage under load', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      const connections = [];

      // Create 200 connections
      for (let i = 0; i < 200; i++) {
        const token = jwt.sign(
          { email: `loadtest${i}@example.com` },
          JWT_SECRET,
          { 
            issuer: 'utalk-backend',
            audience: 'utalk-frontend',
            expiresIn: '1h'
          }
        );

        const socket = Client(`http://localhost:${SERVER_PORT}`, {
          auth: { token },
          autoConnect: false
        });

        await new Promise((resolve) => {
          socket.on('connect', () => {
            connections.push(socket);
            resolve();
          });
          socket.connect();
        });
      }

      expect(connections.length).toBe(200);

      // Simulate activity
      for (let i = 0; i < 100; i++) {
        const randomSocket = connections[Math.floor(Math.random() * connections.length)];
        randomSocket.emit('sync-state', { syncId: Date.now() });
      }

      // Wait for activity to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Disconnect all
      for (const socket of connections) {
        socket.close();
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force GC again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // All connections should be cleaned up
      expect(socketManager.connectedUsers.size).toBe(0);
      expect(socketManager.eventListeners.size).toBe(0);
    });
  });

  describe('🛑 Graceful Shutdown Tests', () => {
    test('should notify connected users on shutdown', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        clientSocket.on('server-shutdown', (data) => {
          expect(data).toHaveProperty('message');
          expect(data).toHaveProperty('timestamp');
          expect(data).toHaveProperty('reason');
          done();
        });

        // Trigger graceful shutdown
        setTimeout(() => {
          socketManager.gracefulShutdown('test');
        }, 100);
      });
    });

    test('should clean up all resources on shutdown', async () => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      await new Promise(resolve => clientSocket.on('connect', resolve));

      expect(socketManager.connectedUsers.size).toBe(1);

      await socketManager.gracefulShutdown('test');

      expect(socketManager.isShuttingDown).toBe(true);
      expect(socketManager.connectedUsers.size).toBe(0);
    });
  });

  describe('📈 Stats and Monitoring Tests', () => {
    test('should provide detailed stats', () => {
      const stats = socketManager.getDetailedStats();

      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('conversations');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('serverInfo');

      expect(stats.connections).toHaveProperty('total');
      expect(stats.connections).toHaveProperty('byRole');
      expect(stats.memory).toHaveProperty('connectedUsers');
      expect(stats.performance).toHaveProperty('connectionsPerSecond');
    });

    test('should track connection metrics', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      const initialMetrics = socketManager.metrics.connectionsPerSecond;

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        expect(socketManager.metrics.connectionsPerSecond).toBeGreaterThan(initialMetrics);
        done();
      });
    });

    test('should provide connected users list', (done) => {
      const validToken = jwt.sign(
        { email: 'test@example.com' },
        JWT_SECRET,
        { 
          issuer: 'utalk-backend',
          audience: 'utalk-frontend',
          expiresIn: '1h'
        }
      );

      clientSocket = Client(`http://localhost:${SERVER_PORT}`, {
        auth: { token: validToken }
      });

      clientSocket.on('connect', () => {
        const connectedUsers = socketManager.getConnectedUsers();
        
        expect(Array.isArray(connectedUsers)).toBe(true);
        expect(connectedUsers.length).toBe(1);
        expect(connectedUsers[0]).toHaveProperty('email');
        expect(connectedUsers[0]).toHaveProperty('role');
        expect(connectedUsers[0]).toHaveProperty('connectedAt');
        expect(connectedUsers[0]).toHaveProperty('lastActivity');
        
        done();
      });
    });
  });
});

// Helper functions for testing
function createValidJWT(payload, options = {}) {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'test-secret',
    {
      issuer: 'utalk-backend',
      audience: 'utalk-frontend',
      expiresIn: '1h',
      ...options
    }
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createValidJWT,
  delay
}; 