const User = require('../models/User');
const logger = require('../utils/logger');
const { memoryManager } = require('../utils/memoryManager');
const performanceMetrics = require('../services/PerformanceMetricsService');

/**
 * UserRepository - Cascarón para operaciones de usuarios
 * 
 * Inicialmente delega a User.js sin cambiar contratos.
 * Preparado para futuras optimizaciones (caché, índices, etc.)
 */
class UserRepository {
  /**
   * Obtener usuario por email con caché optimizado
   */
  static async getByEmail(email) {
    const startTime = Date.now();
    const cacheKey = `user:email:${email}`;
    const cacheTTL = 5 * 60 * 1000; // 5 minutos
    
    logger.debug('UserRepository.getByEmail con caché optimizado', {
      category: 'REPOSITORY_CACHE',
      email: email?.substring(0, 10) + '...',
      cacheKey
    });

    try {
      // Intentar obtener del caché primero
      const cachedUser = memoryManager.get('userCache', cacheKey);
      if (cachedUser) {
        const cacheTime = Date.now() - startTime;
        
        // Registrar métrica de caché hit
        performanceMetrics.recordCache('userCache', 'get', true, true);
        performanceMetrics.recordRepository('UserRepository', 'getByEmail', cacheTime, true, true);
        
        logger.info('UserRepository.getByEmail cache hit', {
          category: 'REPOSITORY_CACHE_HIT',
          email: email?.substring(0, 10) + '...',
          cacheTime: `${cacheTime}ms`
        });
        return cachedUser;
      }

      // Si no está en caché, consultar base de datos
      const user = await User.getByEmail(email);
      
      // Guardar en caché si el usuario existe
      if (user) {
        memoryManager.set('userCache', cacheKey, user, cacheTTL);
        
        // Registrar métrica de caché set
        performanceMetrics.recordCache('userCache', 'set', true, false);
        
        logger.debug('UserRepository.getByEmail guardado en caché', {
          category: 'REPOSITORY_CACHE_SET',
          email: email?.substring(0, 10) + '...',
          cacheKey
        });
      }

      const queryTime = Date.now() - startTime;
      
      // Registrar métrica de repositorio
      performanceMetrics.recordRepository('UserRepository', 'getByEmail', queryTime, true, false);
      
      logger.info('UserRepository.getByEmail completado', {
        category: 'REPOSITORY_PERFORMANCE',
        email: email?.substring(0, 10) + '...',
        userFound: !!user,
        queryTime: `${queryTime}ms`,
        cacheHit: false
      });

      return user;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      
      logger.error('UserRepository.getByEmail error', {
        category: 'REPOSITORY_ERROR',
        email: email?.substring(0, 10) + '...',
        error: error.message,
        queryTime: `${queryTime}ms`
      });
      
      throw error;
    }
  }

  /**
   * Validar contraseña de usuario
   */
  static async validatePassword(email, passwordInput) {
    logger.debug('UserRepository.validatePassword delegando a User.validatePassword', {
      category: 'REPOSITORY_DELEGATION',
      email: email?.substring(0, 10) + '...'
    });
    return User.validatePassword(email, passwordInput);
  }

  /**
   * Crear usuario
   */
  static async create(userData) {
    logger.debug('UserRepository.create delegando a User.create', {
      category: 'REPOSITORY_DELEGATION',
      email: userData.email?.substring(0, 10) + '...',
      role: userData.role
    });
    return User.create(userData);
  }

  /**
   * Listar usuarios
   */
  static async list(options = {}) {
    logger.debug('UserRepository.list delegando a User.list', {
      category: 'REPOSITORY_DELEGATION',
      hasOptions: !!options
    });
    return User.list(options);
  }

  /**
   * Encontrar email por teléfono
   */
  static async findEmailByPhone(phone) {
    logger.debug('UserRepository.findEmailByPhone delegando a User.findEmailByPhone', {
      category: 'REPOSITORY_DELEGATION',
      phone: phone?.substring(0, 10) + '...'
    });
    return User.findEmailByPhone(phone);
  }

  /**
   * Invalidar caché de usuario
   */
  static invalidateUserCache(email) {
    if (email) {
      const cacheKey = `user:email:${email}`;
      memoryManager.delete('userCache', cacheKey);
      logger.debug('UserRepository.invalidateUserCache', {
        category: 'REPOSITORY_CACHE_INVALIDATE',
        email: email?.substring(0, 10) + '...',
        cacheKey
      });
    }
  }

  /**
   * Limpiar todo el caché de usuarios
   */
  static clearUserCache() {
    memoryManager.clear('userCache');
    logger.info('UserRepository.clearUserCache', {
      category: 'REPOSITORY_CACHE_CLEAR'
    });
  }
}

module.exports = UserRepository; 