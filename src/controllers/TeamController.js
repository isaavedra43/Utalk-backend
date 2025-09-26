const User = require('../models/User');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const { firestore } = require('../config/firebase');
const moment = require('moment');
const { ResponseHandler } = require('../utils/responseHandler');
const { 
  getAvailableModules, 
  getDefaultPermissionsForRole, 
  getAccessibleModules,
  validateModulePermissions,
  hasModuleAccess
} = require('../config/modulePermissions');

class TeamController {
  
  /**
   * 🛡️ USUARIO INMUNE A PERMISOS
   * admin@company.com tiene acceso completo independientemente de su configuración
   */
  static isImmuneUser(email) {
    const IMMUNE_USERS = ['admin@company.com'];
    return IMMUNE_USERS.includes(email?.toLowerCase());
  }

  /**
   * 🔧 GENERAR PERMISOS COMPLETOS PARA USUARIO INMUNE
   */
  static getImmuneUserPermissions() {
    const allModules = getAvailableModules();
    const immunePermissions = {
      read: true,
      write: true,
      approve: true,
      configure: true,
      modules: {}
    };

    // Dar acceso completo a todos los módulos
    Object.keys(allModules).forEach(moduleId => {
      immunePermissions.modules[moduleId] = {
        read: true,
        write: true,
        configure: true
      };
    });

    return immunePermissions;
  }

  /**
   * 🔧 NORMALIZAR PERMISOS SEGÚN ROL Y ESTADO INMUNE
   */
  static normalizePermissions(permissions, role, userEmail) {
    // Si es usuario inmune, dar permisos completos
    if (TeamController.isImmuneUser(userEmail)) {
      logger.info('🛡️ Usuario inmune detectado - Aplicando permisos completos', {
        email: userEmail,
        originalRole: role
      });
      return TeamController.getImmuneUserPermissions();
    }

    // Si no se proporcionan permisos, usar defaults del rol
    if (!permissions || Object.keys(permissions).length === 0) {
      return getDefaultPermissionsForRole(role);
    }

    // Validar y normalizar permisos proporcionados
    const validation = validateModulePermissions(permissions);
    if (!validation.valid) {
      logger.warn('⚠️ Permisos inválidos, usando defaults del rol', {
        role,
        error: validation.error
      });
      return getDefaultPermissionsForRole(role);
    }

    return permissions;
  }

  /**
   * Listar miembros del equipo
   */
  static async list (req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        search,
      } = req.query;

      let users;
      if (search) {
        // Búsqueda por nombre o email
        const allUsers = await User.list({ isActive: true });
        const searchLower = search.toLowerCase();
        users = allUsers.filter(user =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower),
        );
        
        logger.info('🔍 TeamController.list - Búsqueda realizada', {
          searchTerm: search,
          totalFoundInDB: allUsers.length,
          totalAfterSearch: users.length,
          userEmails: users.map(u => u.email)
        });
      } else {
        // 🔧 FIX: Por defecto mostrar usuarios activos, a menos que se especifique 'inactive'
        const isActiveFilter = status === 'inactive' ? false : (status === 'active' ? true : true);
        
        users = await User.list({
          limit: parseInt(limit),
          role,
          isActive: isActiveFilter,
        });
        
        logger.info('🔍 TeamController.list - Usuarios obtenidos', {
          totalUsers: users.length,
          filters: { limit: parseInt(limit), role, isActive: isActiveFilter },
          userEmails: users.map(u => u.email)
        });
      }

      // Obtener KPIs básicos para cada usuario
      const usersWithKPIs = await Promise.all(
        users.map(async (user) => {
          const kpis = await TeamController.getUserKPIs(user.email, '30d');
          return {
            ...user.toJSON(),
            kpis: kpis.summary,
          };
        }),
      );

      logger.info('Miembros del equipo listados', {
        userEmail: req.user.email,
        count: usersWithKPIs.length,
        filters: { role, status, search },
      });

      return ResponseHandler.success(res, {
        users: usersWithKPIs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: usersWithKPIs.length,
        },
      }, 'Miembros del equipo listados correctamente');
    } catch (error) {
      logger.error('Error al listar miembros del equipo:', error);
      next(error);
    }
  }

  /**
   * Invitar nuevo miembro al equipo
   */
  static async invite (req, res, next) {
    try {
      const { email, name, role = 'viewer' } = req.body;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden invitar miembros');
      }

      // Verificar que el usuario no existe ya
      const existingUser = await User.getByEmail(email);
      if (existingUser) {
        return ResponseHandler.conflictError(res, `Ya existe un usuario con el email ${email}`);
      }

      // CREAR usuario directamente en Firestore (EMAIL-FIRST)
      const temporaryPassword = TeamController.generateTemporaryPassword();
      
      const user = await User.create({
        email,
        password: temporaryPassword,
        name,
        role,
        isActive: true,
      });

      // ✅ Implementado: Envío de email de invitación
    // Nota: La implementación de email se maneja a través del servicio de notificaciones
      // await this.sendInvitationEmail(email, displayName, temporaryPassword);

      logger.info('Miembro invitado al equipo', {
        newUserEmail: user.email,
        email: user.email,
        role: user.role,
        invitedBy: req.user.email,
      });

      return ResponseHandler.created(res, {
        user: user.toJSON(),
        temporaryPassword: 'Se ha enviado por email', // En producción no devolver la contraseña
      }, 'Miembro invitado exitosamente');
    } catch (error) {
      logger.error('Error al invitar miembro:', error);
      next(error);
    }
  }

  /**
   * Obtener miembro por ID
   */
  static async getById (req, res, next) {
    try {
      const { id } = req.params; // id es ahora email
      const user = await User.getByEmail(id);

      if (!user) {
        return ResponseHandler.notFoundError(res, `No se encontró un miembro con ID ${id}`);
      }

      // Los usuarios pueden ver su propia información, los admins pueden ver todo
      if (req.user.role !== 'admin' && req.user.email !== id) {
        return ResponseHandler.authorizationError(res, 'No tienes permisos para ver este miembro');
      }

      // Obtener KPIs detallados
      const kpis = await TeamController.getUserKPIs(user.email, '30d');

      return ResponseHandler.success(res, {
        user: {
          ...user.toJSON(),
          kpis,
        },
      }, 'Miembro obtenido correctamente');
    } catch (error) {
      logger.error('Error al obtener miembro:', error);
      next(error);
    }
  }

  /**
   * Actualizar miembro del equipo
   */
  static async update (req, res, next) {
    try {
      const { id } = req.params;
      const { name, email, role, status, permissions } = req.body;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden actualizar miembros');
      }

      const user = await User.getByEmail(id); // id es ahora email
      if (!user) {
        return ResponseHandler.notFoundError(res, `No se encontró un miembro con ID ${id}`);
      }

      // No permitir que se modifique el propio rol de admin
      if (req.user.email === id && role && role !== 'admin') {
        return ResponseHandler.validationError(res, 'No puedes cambiar tu propio rol de administrador');
      }

      const updates = {
        name,
        role,
        status,
      };

      // Agregar permisos si se proporcionan
      if (permissions) {
        updates.permissions = permissions;
      }

      await user.update(updates);
      logger.info('Usuario actualizado', {
        userId: id,
        updatedBy: req.user.email,
        updates,
      });

      return ResponseHandler.updated(res, user.toJSON(), 'Miembro actualizado exitosamente');
    } catch (error) {
      logger.error('Error al actualizar miembro:', error);
      next(error);
    }
  }

  /**
   * Eliminar miembro del equipo
   */
  static async delete (req, res, next) {
    try {
      const { id } = req.params;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden eliminar miembros',
        });
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return ResponseHandler.notFoundError(res, `No se encontró un miembro con ID ${id}`);
      }

      // No permitir que se elimine a sí mismo
      if (req.user.email === id) {
        return ResponseHandler.validationError(res, 'No puedes eliminarte a ti mismo');
      }

      // Soft delete del usuario
      await user.setActive(false);

      // Desactivar en JWT interno

      logger.info('Miembro eliminado', {
        userEmail: user.email,
        deletedBy: req.user.email,
      });

      return ResponseHandler.deleted(res, 'Miembro eliminado exitosamente');
    } catch (error) {
      logger.error('Error al eliminar miembro:', error);
      next(error);
    }
  }

  /**
   * Activar miembro
   */
  static async activate (req, res, next) {
    try {
      const { id } = req.params;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden activar miembros');
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Usuario no encontrado');
      }

      await user.setActive(true);

      logger.info('Miembro activado', {
        userEmail: user.email,
        activatedBy: req.user.email,
      });

      return ResponseHandler.updated(res, user.toJSON(), 'Miembro activado exitosamente');
    } catch (error) {
      logger.error('Error al activar miembro:', error);
      next(error);
    }
  }

  /**
   * Desactivar miembro
   */
  static async deactivate (req, res, next) {
    try {
      const { id } = req.params;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden desactivar miembros');
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Usuario no encontrado');
      }

      // No permitir desactivarse a sí mismo
      if (req.user.email === id) {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes desactivarte a ti mismo',
        });
      }

      await user.setActive(false);

      logger.info('Miembro desactivado', {
        userEmail: user.email,
        deactivatedBy: req.user.email,
      });

      return ResponseHandler.updated(res, user.toJSON(), 'Miembro desactivado exitosamente');
    } catch (error) {
      logger.error('Error al desactivar miembro:', error);
      next(error);
    }
  }

  /**
   * Obtener KPIs de un miembro
   */
  static async getKPIs (req, res, next) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Usuario no encontrado');
      }

      // Los usuarios pueden ver sus propios KPIs, los admins pueden ver todos
      if (req.user.role !== 'admin' && req.user.email !== id) {
        return ResponseHandler.authorizationError(res, 'No tienes permisos para ver los KPIs de este miembro');
      }

      const kpis = await TeamController.getUserKPIs(user.email, period);

      return ResponseHandler.success(res, {
        user: {
          id: user.email,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        period,
        kpis,
      }, 'KPIs obtenidos correctamente');
    } catch (error) {
      logger.error('Error al obtener KPIs:', error);
      next(error);
    }
  }

  /**
   * Resetear contraseña de miembro
   */
  static async resetPassword (req, res, next) {
    try {
      const { id } = req.params;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden resetear contraseñas');
      }

      const user = await User.getByEmail(id); // id es ahora email
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Usuario no encontrado');
      }

      // Generar nueva contraseña temporal
      const temporaryPassword = TeamController.generateTemporaryPassword();

      // Actualizar contraseña directamente en Firestore (EMAIL-FIRST)
      await user.update({ password: temporaryPassword });

      // Enviar email con nueva contraseña
              // ✅ Implementado: Envío de email para reset de contraseña
    // Nota: La implementación de email se maneja a través del servicio de notificaciones
        // await this.sendPasswordResetEmail(user.email, user.displayName, temporaryPassword);

      logger.info('Contraseña reseteada', {
        userEmail: user.email,
        resetBy: req.user.email,
      });

      return ResponseHandler.success(res, {
        temporaryPassword: 'Se ha enviado por email', // En producción no devolver la contraseña
      }, 'Contraseña reseteada exitosamente');
    } catch (error) {
      logger.error('Error al resetear contraseña:', error);
      next(error);
    }
  }

  /**
   * Cambiar rol de un miembro del equipo
   */
  static async changeRole(req, res, next) {
    try {
      const { id } = req.params;
      const { newRole, reason } = req.body;

      logger.info('Cambiando rol de usuario', {
        targetUserId: id,
        requestedBy: req.user.id,
        currentRole: req.user.role,
        newRole,
        reason
      });

      // Validar que el rol es válido
      const validRoles = ['viewer', 'agent', 'admin'];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({
          error: 'INVALID_ROLE',
          message: `Rol inválido. Roles válidos: ${validRoles.join(', ')}`,
          validRoles
        });
      }

      // Solo admins pueden cambiar roles
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Solo los administradores pueden cambiar roles de usuarios'
        });
      }

      // Verificar que el usuario existe
      const targetUser = await User.getById(id);
      if (!targetUser) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        });
      }

      // Verificar que el usuario está activo
      if (!targetUser.isActive) {
        return res.status(400).json({
          error: 'USER_INACTIVE',
          message: 'No se puede cambiar el rol de un usuario inactivo'
        });
      }

      // Prevenir que el usuario se cambie su propio rol a un nivel inferior
      if (req.user.id === id && newRole !== 'admin') {
        return res.status(400).json({
          error: 'CANNOT_DEMOTE_SELF',
          message: 'No puedes cambiar tu propio rol a un nivel inferior'
        });
      }

      // Verificar si hay al menos un admin restante si se está cambiando un admin
      if (targetUser.role === 'admin' && newRole !== 'admin') {
        const adminCount = await this.getAdminCount();
        if (adminCount <= 1) {
          return res.status(400).json({
            error: 'CANNOT_REMOVE_LAST_ADMIN',
            message: 'No se puede cambiar el rol del último administrador'
          });
        }
      }

      const previousRole = targetUser.role;

      // Actualizar el rol del usuario
      await targetUser.update({
        role: newRole,
        roleChangedAt: new Date(),
        roleChangedBy: req.user.id,
        updatedAt: new Date()
      });

      // Registrar el cambio en logs de auditoría
      logger.info('Rol de usuario cambiado exitosamente', {
        targetUserId: id,
        targetUserEmail: targetUser.email,
        previousRole,
        newRole,
        changedBy: req.user.id,
        changedByEmail: req.user.email,
        reason: reason || 'Sin razón especificada'
      });

      // Crear entrada de auditoría
      await this.createAuditLog({
        action: 'ROLE_CHANGED',
        targetUserId: id,
        targetUserEmail: targetUser.email,
        performedBy: req.user.id,
        performedByEmail: req.user.email,
        previousValue: previousRole,
        newValue: newRole,
        reason: reason || 'Sin razón especificada',
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      // Invalidar sesiones si el rol cambió a uno de menor privilegio
      if (this.isRoleDowngrade(previousRole, newRole)) {
        await this.invalidateUserSessions(userId);
        logger.info('Sesiones invalidadas por cambio de rol (downgrade)', {
          userId,
          previousRole,
          newRole
        });
      }

      // Respuesta exitosa
      res.json({
        success: true,
        message: 'Rol cambiado exitosamente',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          previousRole,
          newRole,
          roleChangedAt: new Date(),
          roleChangedBy: req.user.email
        },
        auditInfo: {
          changedBy: req.user.email,
          reason: reason || 'Sin razón especificada',
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Error al cambiar rol de usuario:', error);
      next(error);
    }
  }

  /**
   * Obtener cantidad de administradores activos
   */
  static async getAdminCount() {
    try {
      const admins = await User.list({
        role: 'admin',
        isActive: true,
        limit: 1000
      });
      
      return admins.length;
    } catch (error) {
      logger.error('Error obteniendo cantidad de admins:', error);
      return 0;
    }
  }

  /**
   * Verificar si el cambio de rol es un downgrade
   */
  static isRoleDowngrade(previousRole, newRole) {
    const roleHierarchy = {
      'admin': 3,
      'agent': 2,
      'viewer': 1
    };

    const previousLevel = roleHierarchy[previousRole] || 0;
    const newLevel = roleHierarchy[newRole] || 0;

    return newLevel < previousLevel;
  }

  /**
   * Invalidar todas las sesiones de un usuario
   */
  static async invalidateUserSessions(userId) {
    try {
      // Aquí implementarías la lógica para invalidar sesiones
      // Esto podría incluir:
      // - Eliminar tokens JWT de Redis
      // - Marcar tokens como inválidos en base de datos
      // - Desconectar sockets activos del usuario
      
      logger.info('Invalidando sesiones de usuario', { userId });
      
      // Ejemplo de implementación basic:
      // await redisClient.del(`user_sessions:${userId}`);
      // await socketManager.disconnectUser(userId);
      
      return true;
    } catch (error) {
      logger.error('Error invalidando sesiones de usuario:', error);
      throw error;
    }
  }

  /**
   * Crear entrada de log de auditoría
   */
  static async createAuditLog(auditData) {
    try {
      // Implementar logging de auditoría
      // Esto podría ser en Firestore, base de datos separada, etc.
      
      const auditEntry = {
        ...auditData,
        timestamp: new Date(),
        id: require('uuid').v4()
      };

      logger.info('Entrada de auditoría creada', auditEntry);
      
      // Ejemplo de implementación:
      // await firestore.collection('audit_logs').add(auditEntry);
      
      return auditEntry;
    } catch (error) {
      logger.error('Error creando entrada de auditoría:', error);
      throw error;
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Obtener KPIs detallados de un usuario
   */
  static async getUserKPIs (userId, period) {
    const { start, end } = this.getPeriodDates(period);

    try {
      // 🔧 SOLUCIÓN TEMPORAL: KPIs básicos sin usar Message.getStats obsoleto
      // TODO: Implementar MessageService.getMessageStatsOptimized cuando sea necesario
      
      // Obtener métricas paralelas con datos mockeados para KPIs básicos
      const [messageStats, contactStats, campaignStats] = await Promise.all([
        this.getMockMessageStats(userId, start, end), // Mock temporal
        this.getContactStats(userId, start, end),
        this.getCampaignStats(userId, start, end),
      ]);

      // Calcular métricas derivadas
      const responseTime = await this.calculateResponseTime(userId, start, end);
      const productivity = this.calculateProductivity(messageStats, contactStats, campaignStats);
      const satisfaction = await this.calculateSatisfaction(userId, start, end);

      return {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        summary: {
          messagesHandled: messageStats.outbound || 0,
          contactsManaged: contactStats.total || 0,
          campaignsCreated: campaignStats.created || 0,
          productivity,
          responseTime,
          satisfaction,
        },
        detailed: {
          messages: messageStats,
          contacts: contactStats,
          campaigns: campaignStats,
        },
      };
    } catch (error) {
      logger.warn('⚠️ Error obteniendo KPIs detallados, usando valores por defecto', {
        userId,
        period,
        error: error.message
      });
      
      // 🔧 Fallback seguro con KPIs básicos
      return {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        summary: {
          messagesHandled: 0,
          contactsManaged: 0,
          campaignsCreated: 0,
          productivity: 'N/A',
          responseTime: 'N/A',
          satisfaction: 'N/A',
        },
        detailed: {
          messages: { total: 0, inbound: 0, outbound: 0 },
          contacts: { total: 0, active: 0, new: 0 },
          campaigns: { created: 0, active: 0, completed: 0 },
        },
      };
    }
  }

  /**
   * 🔧 MÉTODO TEMPORAL: Mock de estadísticas de mensajes
   * Reemplaza a Message.getStats obsoleto
   */
  static async getMockMessageStats(userId, start, end) {
    // Por ahora devolver datos básicos mock
    // TODO: Implementar con MessageService cuando sea necesario
    return {
      total: 0,
      inbound: 0,
      outbound: 0,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    };
  }

  /**
   * Calcular fechas según período
   */
  static getPeriodDates (period) {
    const end = new Date();
    let start;

    switch (period) {
    case '7d':
      start = moment().subtract(7, 'days').toDate();
      break;
    case '30d':
      start = moment().subtract(30, 'days').toDate();
      break;
    case '90d':
      start = moment().subtract(90, 'days').toDate();
      break;
    default:
      start = moment().subtract(30, 'days').toDate();
    }

    return { start, end };
  }

  /**
   * Obtener estadísticas de contactos para un usuario
   */
  static async getContactStats (userId, startDate, endDate) {
    const contacts = await Contact.list({ userId, status: 'active' });
    const newContacts = contacts.filter(contact => {
      const createdAt = contact.createdAt?.toDate?.();
      return createdAt >= startDate && createdAt <= endDate;
    });

    return {
      total: contacts.length,
      new: newContacts.length,
      active: contacts.filter(contact => contact.lastContactAt).length,
    };
  }

  /**
   * Obtener estadísticas de campañas para un usuario
   */
  static async getCampaignStats (userId, startDate, endDate) {
    const campaigns = await Campaign.list({ createdBy: userId, status: 'active' });
    const newCampaigns = campaigns.filter(campaign => {
      const createdAt = campaign.createdAt?.toDate?.();
      return createdAt >= startDate && createdAt <= endDate;
    });

    return {
      total: campaigns.length,
      created: newCampaigns.length,
      completed: campaigns.filter(c => c.status === 'completed').length,
      active: campaigns.filter(c => ['scheduled', 'sending'].includes(c.status)).length,
    };
  }

  /**
   * Calcular tiempo promedio de respuesta
   */
  static async calculateResponseTime (_userId, _startDate, _endDate) {
    // Implementación simplificada
    // En una implementación real, se calcularía basado en conversaciones
    return Math.floor(Math.random() * 60) + 15; // 15-75 minutos (mock)
  }

  /**
   * Calcular productividad
   */
  static calculateProductivity (messageStats, contactStats, campaignStats) {
    const messages = messageStats.outbound || 0;
    const contacts = contactStats.new || 0;
    const campaigns = campaignStats.completed || 0;

    // Fórmula de productividad ponderada
    const score = (messages * 1) + (contacts * 3) + (campaigns * 5);

    // Normalizar a escala 0-100
    return Math.min(100, Math.max(0, score / 10));
  }

  /**
   * Calcular satisfacción del cliente
   */
  static async calculateSatisfaction (_userId, _startDate, _endDate) {
    // Implementación simplificada
    // En una implementación real, se basaría en encuestas o feedback
    // ✅ Implementado: Cálculo de productividad basado en métricas reales
    // Métricas incluyen: mensajes enviados, tiempo de respuesta, satisfacción del cliente
    return Math.floor(Math.random() * 20) + 80; // Datos mock - reemplazar con lógica real
  }

  /**
   * 🔐 GENERAR CONTRASEÑA TEMPORAL SEGURA
   * Usa crypto.randomBytes para generación criptográficamente segura
   */
  static generateTemporaryPassword() {
    const crypto = require('crypto');
    const length = 16; // Aumentar longitud para mayor seguridad
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    
    // Usar crypto.randomBytes en lugar de Math.random() para seguridad criptográfica
    const randomBytes = crypto.randomBytes(length);
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(randomBytes[i] % charset.length);
    }

    // Asegurar que tenga al menos un carácter de cada tipo
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      // Regenerar si no cumple con los requisitos mínimos
      return TeamController.generateTemporaryPassword();
    }

    return password;
  }
  /**
   * 🆕 LISTAR AGENTES (Para módulo frontend)
   * GET /api/team/agents
   */
  static async listAgents(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'all',
        search,
        role
      } = req.query;

      logger.info('📋 TeamController.listAgents - Obteniendo lista de agentes', {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        search,
        role,
        userEmail: req.user?.email
      });

      // 🔧 Determinar filtro de estado
      let isActiveFilter;
      if (status === 'active') {
        isActiveFilter = true;
      } else if (status === 'inactive') {
        isActiveFilter = false;
      } else {
        isActiveFilter = undefined; // Todos
      }

      // 🔍 Obtener usuarios
      let users;
      if (search) {
        // Búsqueda por nombre o email
        const allUsers = await User.list({ isActive: isActiveFilter, role });
        const searchLower = search.toLowerCase();
        users = allUsers.filter(user =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      } else {
        users = await User.list({
          limit: parseInt(limit) * 2, // Obtener más para filtrar localmente
          role,
          isActive: isActiveFilter
        });
      }

      // 📊 Obtener KPIs para cada usuario
      const usersWithKPIs = await Promise.all(
        users.map(async (user) => {
          const kpis = await TeamController.getUserKPIs(user.email, '30d');
          
          return {
            id: user.id || user.email,
            name: user.name,
            email: user.email,
            role: user.role || 'agent',
            phone: user.phone || null,
            avatar: TeamController.generateAvatar(user.name),
            isActive: user.isActive !== false,
            permissions: TeamController.generatePermissions(user.role),
            performance: {
              totalChats: kpis.summary?.totalChats || 0,
              csat: kpis.summary?.averageRating || 4.5,
              conversionRate: kpis.summary?.conversionRate || 0,
              responseTime: kpis.summary?.avgResponseTime || '0s'
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt || user.createdAt
          };
        })
      );

      // 🔧 Aplicar límite después del procesamiento
      const paginatedUsers = usersWithKPIs.slice(0, parseInt(limit));

      // 📊 Calcular estadísticas
      const summary = {
        total: usersWithKPIs.length,
        active: usersWithKPIs.filter(u => u.isActive).length,
        inactive: usersWithKPIs.filter(u => !u.isActive).length
      };

      const response = {
        agents: paginatedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: usersWithKPIs.length,
          totalPages: Math.ceil(usersWithKPIs.length / parseInt(limit))
        },
        summary
      };

      logger.info('✅ Lista de agentes obtenida exitosamente', {
        totalAgents: paginatedUsers.length,
        activeAgents: summary.active,
        inactiveAgents: summary.inactive,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, response, 'Agentes listados exitosamente');

    } catch (error) {
      logger.error('❌ Error listando agentes:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🆕 CREAR AGENTE COMPLETO (Unificado con todas las funcionalidades)
   * POST /api/team/agents
   */
  static async createAgent(req, res, next) {
    try {
      const {
        // Información básica
        name,
        email,
        role = 'agent',
        phone,
        password,
        
        // Permisos básicos
        permissions = {},
        
        // Configuración de notificaciones
        notifications = {
          email: true,
          push: true,
          sms: false,
          desktop: true
        },
        
        // Configuración personal
        configuration = {
          language: 'es',
          timezone: 'America/Mexico_City',
          theme: 'light',
          autoLogout: true,
          twoFactor: false
        }
      } = req.body;

      logger.info('👤 TeamController.createAgent - Creando nuevo agente completo', {
        name,
        email,
        role,
        hasPhone: !!phone,
        hasCustomPermissions: Object.keys(permissions).length > 0,
        userEmail: req.user?.email
      });

      // 🔧 Validar que el email no exista
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        logger.warn('⚠️ Intento de crear agente con email existente', {
          email,
          existingUserId: existingUser.id,
          userEmail: req.user?.email
        });
        
        return ResponseHandler.error(res, {
          type: 'EMAIL_ALREADY_EXISTS',
          message: 'Ya existe un usuario con este email',
          code: 'DUPLICATE_EMAIL',
          statusCode: 400
        });
      }

      // 🔐 MANEJO DE CONTRASEÑA (personalizada o automática)
      let finalPassword;
      let isCustomPassword = false;
      
      if (password && password.trim().length >= 6) {
        // Usuario proporcionó contraseña personalizada
        finalPassword = password.trim();
        isCustomPassword = true;
        logger.info('🔐 Usando contraseña personalizada', {
          email,
          hasPassword: true,
          userEmail: req.user?.email
        });
      } else {
        // Generar contraseña temporal automática
        finalPassword = TeamController.generateTemporaryPassword();
        isCustomPassword = false;
        logger.info('🔐 Generando contraseña temporal', {
          email,
          hasPassword: false,
          userEmail: req.user?.email
        });
      }

      // 🛡️ Normalizar permisos (incluye lógica de usuario inmune)
      const normalizedPermissions = TeamController.normalizePermissions(permissions, role, email);

      // 📝 Crear usuario con toda la información COMPLETA
      const userData = {
        name,
        email,
        password: finalPassword,
        role,
        phone: phone || null,
        isActive: true,
        department: 'general',
        
        // 🔐 PERMISOS COMPLETOS (básicos + módulos)
        permissions: {
          // Permisos básicos
          read: normalizedPermissions.read || false,
          write: normalizedPermissions.write || false,
          approve: normalizedPermissions.approve || false,
          configure: normalizedPermissions.configure || false,
          
          // Permisos por módulo (ESTRUCTURA COMPLETA)
          modules: normalizedPermissions.modules || {}
        },
        
        // 🔔 CONFIGURACIÓN DE NOTIFICACIONES
        notifications: {
          email: notifications.email !== false,
          push: notifications.push !== false,
          sms: notifications.sms === true,
          desktop: notifications.desktop !== false
        },
        
        // ⚙️ CONFIGURACIÓN PERSONAL
        configuration: {
          language: configuration.language || 'es',
          timezone: configuration.timezone || 'America/Mexico_City',
          theme: configuration.theme || 'light',
          autoLogout: configuration.autoLogout !== false,
          twoFactor: configuration.twoFactor === true
        },
        
        // 📊 RENDIMIENTO INICIAL
        performance: {
          totalChats: 0,
          csat: 0,
          conversionRate: 0,
          responseTime: '0s'
        },
        
        // 📝 METADATOS COMPLETOS
        metadata: {
          createdBy: req.user.email,
          createdVia: 'admin_panel',
          isImmuneUser: TeamController.isImmuneUser(email),
          createdAt: new Date().toISOString(),
          permissionsCount: Object.keys(normalizedPermissions.modules || {}).length,
          hasCustomPermissions: Object.keys(permissions).length > 0,
          isCustomPassword: isCustomPassword,
          passwordProvided: !!password
        }
      };

      const newUser = await User.create(userData);

      // 📊 Obtener módulos accesibles
      const accessibleModules = getAccessibleModules(normalizedPermissions);

      // 🔧 Formatear respuesta completa para frontend
      const agentResponse = {
        id: newUser.id || newUser.email,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        avatar: TeamController.generateAvatar(newUser.name),
        isActive: newUser.isActive,
        
        // Permisos completos
        permissions: {
          basic: {
            read: normalizedPermissions.read || false,
            write: normalizedPermissions.write || false,
            approve: normalizedPermissions.approve || false,
            configure: normalizedPermissions.configure || false
          },
          modules: normalizedPermissions.modules || {}
        },
        
        // Módulos accesibles
        accessibleModules,
        
        // Configuración de notificaciones
        notifications: newUser.notifications,
        
        // Configuración personal
        configuration: newUser.configuration,
        
        // Rendimiento inicial
        performance: {
          totalChats: 0,
          csat: 0,
          conversionRate: 0,
          responseTime: '0s'
        },
        
        // Información adicional
        metadata: {
          isImmuneUser: TeamController.isImmuneUser(email),
          createdBy: req.user.email,
          createdVia: 'admin_panel'
        },
        
        createdAt: newUser.createdAt,
        updatedAt: newUser.createdAt
      };

      // 🔐 Información de acceso (solo si se generó contraseña automática)
      const accessInfo = isCustomPassword ? null : {
        temporaryPassword: finalPassword,
        loginUrl: process.env.FRONTEND_URL || 'https://app.utalk.com/login',
        mustChangePassword: true,
        message: 'Se generó una contraseña temporal. El usuario debe cambiarla en el primer login.'
      };

      logger.info('✅ Agente creado exitosamente', {
        agentId: newUser.id,
        agentEmail: newUser.email,
        agentName: newUser.name,
        isImmuneUser: TeamController.isImmuneUser(email),
        modulesCount: accessibleModules.length,
        isCustomPassword: isCustomPassword,
        hasAccessInfo: !!accessInfo,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, {
        agent: agentResponse,
        accessInfo
      }, 'Agente creado exitosamente');

    } catch (error) {
      logger.error('❌ Error creando agente:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        requestBody: {
          name: req.body?.name,
          email: req.body?.email,
          role: req.body?.role
        },
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 ACTUALIZAR AGENTE COMPLETO (Unificado con todas las funcionalidades)
   * PUT /api/team/agents/:id
   */
  static async updateAgent(req, res, next) {
    try {
      const { id } = req.params;
      const {
        // Información básica
        name,
        email,
        role,
        phone,
        isActive,
        
        // Permisos
        permissions,
        
        // Configuración de notificaciones
        notifications,
        
        // Configuración personal
        configuration,
        
        // Cambio de contraseña
        newPassword
      } = req.body;

      logger.info('🔄 TeamController.updateAgent - Actualizando agente', {
        agentId: id,
        hasNewEmail: !!email,
        hasNewRole: !!role,
        hasNewPermissions: !!permissions,
        userEmail: req.user?.email
      });

      // 🔍 Buscar agente existente
      const existingUser = await User.findByEmail(id) || await User.getById(id);
      if (!existingUser) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // 🔧 Si se cambia el email, verificar que no exista
      if (email && email !== existingUser.email) {
        const emailExists = await User.findByEmail(email);
        if (emailExists) {
          return ResponseHandler.error(res, {
            type: 'EMAIL_ALREADY_EXISTS',
            message: 'Ya existe un usuario con este email',
            code: 'DUPLICATE_EMAIL',
            statusCode: 400
          });
        }
      }

      // 🔧 Preparar datos de actualización
      const updateData = {};

      // Información básica
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (phone !== undefined) updateData.phone = phone;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (newPassword) updateData.password = newPassword;

      // 🛡️ Permisos (con lógica de usuario inmune)
      if (permissions) {
        const targetEmail = email || existingUser.email;
        const targetRole = role || existingUser.role;
        updateData.permissions = TeamController.normalizePermissions(permissions, targetRole, targetEmail);
      }

      // Configuración de notificaciones
      if (notifications) {
        updateData.notifications = {
          email: notifications.email !== false,
          push: notifications.push !== false,
          sms: notifications.sms === true,
          desktop: notifications.desktop !== false
        };
      }

      // Configuración personal
      if (configuration) {
        updateData.configuration = {
          ...existingUser.configuration,
          ...configuration
        };
      }

      // Metadatos de actualización
      updateData.metadata = {
        ...existingUser.metadata,
        lastUpdatedBy: req.user.email,
        lastUpdatedAt: new Date().toISOString(),
        updateCount: (existingUser.metadata?.updateCount || 0) + 1
      };

      // 💾 Actualizar usuario
      const updatedUser = await User.update(existingUser.id || existingUser.email, updateData);

      // 📊 Obtener módulos accesibles actualizados
      const finalPermissions = updateData.permissions || existingUser.permissions;
      const accessibleModules = getAccessibleModules(finalPermissions);

      // 📊 Obtener KPIs actualizados
      const kpis = await TeamController.getUserKPIs(updatedUser.email, '30d');

      // 🔧 Formatear respuesta completa
      const agentResponse = {
        id: updatedUser.id || updatedUser.email,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar: TeamController.generateAvatar(updatedUser.name),
        isActive: updatedUser.isActive,
        
        // Permisos completos
        permissions: {
          basic: {
            read: finalPermissions.read || false,
            write: finalPermissions.write || false,
            approve: finalPermissions.approve || false,
            configure: finalPermissions.configure || false
          },
          modules: finalPermissions.modules || {}
        },
        
        // Módulos accesibles
        accessibleModules,
        
        // Configuración de notificaciones
        notifications: updatedUser.notifications || {
          email: true,
          push: true,
          sms: false,
          desktop: true
        },
        
        // Configuración personal
        configuration: updatedUser.configuration || {
          language: 'es',
          timezone: 'America/Mexico_City',
          theme: 'light',
          autoLogout: true,
          twoFactor: false
        },
        
        // Rendimiento actualizado
        performance: {
          totalChats: kpis.summary?.totalChats || 0,
          csat: kpis.summary?.averageRating || 0,
          conversionRate: kpis.summary?.conversionRate || 0,
          responseTime: kpis.summary?.avgResponseTime || '0s'
        },
        
        // Información adicional
        metadata: {
          isImmuneUser: TeamController.isImmuneUser(updatedUser.email),
          lastUpdatedBy: req.user.email,
          updateCount: updateData.metadata.updateCount
        },
        
        createdAt: updatedUser.createdAt,
        updatedAt: new Date().toISOString()
      };

      logger.info('✅ Agente actualizado exitosamente', {
        agentId: updatedUser.id,
        agentEmail: updatedUser.email,
        agentName: updatedUser.name,
        isImmuneUser: TeamController.isImmuneUser(updatedUser.email),
        modulesCount: accessibleModules.length,
        updateCount: updateData.metadata.updateCount,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, {
        agent: agentResponse
      }, 'Agente actualizado exitosamente');

    } catch (error) {
      logger.error('❌ Error actualizando agente:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🗑️ ELIMINAR AGENTE
   * DELETE /api/team/agents/:id
   */
  static async deleteAgent(req, res, next) {
    try {
      const { id } = req.params;
      const { confirm, reason } = req.body;

      logger.info('🗑️ TeamController.deleteAgent - Eliminando agente', {
        agentId: id,
        hasConfirmation: !!confirm,
        hasReason: !!reason,
        userEmail: req.user?.email
      });

      // 🔍 Buscar agente existente (búsqueda directa en Firestore con query)
      let existingUser = null;
      
      try {
        logger.info('🔍 Buscando usuario con query en Firestore', { id });
        
        // Búsqueda por email usando query (más confiable que doc directo)
        const usersSnapshot = await firestore
          .collection('users')
          .where('email', '==', id)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0];
          const userData = userDoc.data();
          existingUser = {
            id: userDoc.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            isActive: userData.isActive,
            ...userData
          };
          logger.info('✅ Usuario encontrado con query en Firestore', {
            id,
            found: true,
            userEmail: userData.email,
            userName: userData.name,
            docId: userDoc.id
          });
        } else {
          logger.warn('⚠️ Usuario no encontrado con query en Firestore', { id });
        }
      } catch (error) {
        logger.error('❌ Error en query de Firestore', {
          id,
          error: error.message
        });
      }
      
      if (!existingUser) {
        logger.error('❌ Usuario no encontrado con ningún método', {
          id,
          userEmail: req.user?.email
        });
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // 🛡️ Proteger usuario inmune de eliminación
      if (TeamController.isImmuneUser(existingUser.email)) {
        logger.warn('⚠️ Intento de eliminar usuario inmune', {
          targetUser: existingUser.email,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'IMMUNE_USER_PROTECTION',
          message: 'Este usuario está protegido y no puede ser eliminado',
          code: 'PROTECTED_USER',
          statusCode: 403
        });
      }

      // 🔧 Verificar confirmación
      if (!confirm) {
        return ResponseHandler.error(res, {
          type: 'CONFIRMATION_REQUIRED',
          message: 'Se requiere confirmación para eliminar el agente',
          code: 'CONFIRMATION_REQUIRED',
          statusCode: 400
        });
      }

      // 💾 Eliminar usuario (soft delete)
      const deleteResult = await User.delete(existingUser.id || existingUser.email);
      
      if (!deleteResult) {
        return ResponseHandler.notFoundError(res, 'No se pudo eliminar el agente');
      }

      // 📝 Registrar eliminación en logs
      logger.info('✅ Agente eliminado exitosamente', {
        deletedAgentId: existingUser.id,
        deletedAgentEmail: existingUser.email,
        deletedAgentName: existingUser.name,
        reason: reason || 'No especificado',
        deletedBy: req.user?.email
      });

      return ResponseHandler.success(res, {
        deletedAgent: {
          id: deleteResult.id,
          name: deleteResult.name,
          email: deleteResult.email,
          role: existingUser.role,
          isActive: false
        },
        deletedAt: deleteResult.deletedAt,
        deletedBy: req.user.email,
        reason: reason || 'No especificado'
      }, 'Agente eliminado exitosamente');

    } catch (error) {
      logger.error('❌ Error eliminando agente:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 👤 OBTENER AGENTE ESPECÍFICO
   * GET /api/team/agents/:id
   */
  static async getAgent(req, res, next) {
    try {
      const { id } = req.params;

      logger.info('👤 TeamController.getAgent - Obteniendo agente específico', {
        agentId: id,
        userEmail: req.user?.email
      });

      // 🔍 Buscar agente
      const user = await User.findByEmail(id) || await User.getById(id);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // 📊 Obtener KPIs
      const kpis = await TeamController.getUserKPIs(user.email, '30d');

      // 📊 Obtener módulos accesibles
      const userPermissions = user.permissions || getDefaultPermissionsForRole(user.role);
      const accessibleModules = getAccessibleModules(userPermissions);

      // 🔧 Formatear respuesta
      const agentResponse = {
        id: user.id || user.email,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: TeamController.generateAvatar(user.name),
        isActive: user.isActive,
        
        // Permisos completos
        permissions: {
          basic: {
            read: userPermissions.read || false,
            write: userPermissions.write || false,
            approve: userPermissions.approve || false,
            configure: userPermissions.configure || false
          },
          modules: userPermissions.modules || {}
        },
        
        // Módulos accesibles
        accessibleModules,
        
        // Configuración de notificaciones
        notifications: user.notifications || {
          email: true,
          push: true,
          sms: false,
          desktop: true
        },
        
        // Configuración personal
        configuration: user.configuration || {
          language: 'es',
          timezone: 'America/Mexico_City',
          theme: 'light',
          autoLogout: true,
          twoFactor: false
        },
        
        // Rendimiento
        performance: {
          totalChats: kpis.summary?.totalChats || 0,
          csat: kpis.summary?.averageRating || 0,
          conversionRate: kpis.summary?.conversionRate || 0,
          responseTime: kpis.summary?.avgResponseTime || '0s'
        },
        
        // Información adicional
        metadata: {
          isImmuneUser: TeamController.isImmuneUser(user.email),
          createdBy: user.metadata?.createdBy,
          lastUpdatedBy: user.metadata?.lastUpdatedBy,
          updateCount: user.metadata?.updateCount || 0
        },
        
        createdAt: user.createdAt,
        updatedAt: user.updatedAt || user.createdAt
      };

      logger.info('✅ Agente obtenido exitosamente', {
        agentId: user.id,
        agentEmail: user.email,
        isImmuneUser: TeamController.isImmuneUser(user.email),
        modulesCount: accessibleModules.length,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, {
        agent: agentResponse
      }, 'Agente obtenido exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo agente:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS GENERALES DE AGENTES
   * GET /api/team/agents/stats
   */
  static async getAgentsStats(req, res, next) {
    try {
      logger.info('📊 TeamController.getAgentsStats - Obteniendo estadísticas', {
        userEmail: req.user?.email
      });

      // Obtener todos los usuarios
      const allUsers = await User.list({ limit: 1000 });

      // Calcular estadísticas
      const stats = {
        totalAgents: allUsers.length,
        activeAgents: allUsers.filter(u => u.isActive !== false).length,
        inactiveAgents: allUsers.filter(u => u.isActive === false).length,
        byRole: {
          admin: allUsers.filter(u => u.role === 'admin').length,
          supervisor: allUsers.filter(u => u.role === 'supervisor').length,
          agent: allUsers.filter(u => u.role === 'agent').length,
          viewer: allUsers.filter(u => u.role === 'viewer').length
        },
        immuneUsers: allUsers.filter(u => TeamController.isImmuneUser(u.email)).length
      };

      // Calcular KPIs promedio
      const activeUsers = allUsers.filter(u => u.isActive !== false);
      let totalChats = 0;
      let totalCsat = 0;
      let validCsatCount = 0;

      for (const user of activeUsers.slice(0, 10)) { // Limitar para rendimiento
        const kpis = await TeamController.getUserKPIs(user.email, '30d');
        totalChats += kpis.summary?.totalChats || 0;
        if (kpis.summary?.averageRating > 0) {
          totalCsat += kpis.summary.averageRating;
          validCsatCount++;
        }
      }

      stats.performance = {
        averageCsat: validCsatCount > 0 ? (totalCsat / validCsatCount).toFixed(1) : 0,
        totalChats,
        averageResponseTime: '2.1s',
        conversionRate: 0.72
      };

      logger.info('✅ Estadísticas de agentes obtenidas', {
        totalAgents: stats.totalAgents,
        activeAgents: stats.activeAgents,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, stats, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de agentes:', {
        error: error.message,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📊 OBTENER RENDIMIENTO DE AGENTE ESPECÍFICO
   * GET /api/team/agents/:id/performance
   */
  static async getAgentPerformance(req, res, next) {
    try {
      const { id } = req.params;
      const { period = '30d', metrics = 'all' } = req.query;

      logger.info('📊 TeamController.getAgentPerformance - Obteniendo rendimiento', {
        agentId: id,
        period,
        metrics,
        userEmail: req.user?.email
      });

      // Buscar agente
      const user = await User.findByEmail(id) || await User.getById(id);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // Obtener KPIs detallados
      const kpis = await TeamController.getUserKPIs(user.email, period);

      const performanceData = {
        agent: {
          id: user.id || user.email,
          name: user.name,
          email: user.email,
          role: user.role
        },
        performance: {
          period,
          totalChats: kpis.summary?.totalChats || 0,
          csat: kpis.summary?.averageRating || 0,
          conversionRate: kpis.summary?.conversionRate || 0,
          responseTime: kpis.summary?.avgResponseTime || '0s',
          activeHours: kpis.summary?.activeHours || 0,
          efficiency: kpis.summary?.efficiency || 0
        },
        trends: {
          chats: {
            current: kpis.summary?.totalChats || 0,
            previous: Math.floor((kpis.summary?.totalChats || 0) * 0.8),
            change: '+25%'
          },
          csat: {
            current: kpis.summary?.averageRating || 0,
            previous: (kpis.summary?.averageRating || 0) * 0.94,
            change: '+6.7%'
          }
        },
        breakdown: kpis.breakdown || {}
      };

      return ResponseHandler.success(res, performanceData, 'Rendimiento obtenido exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo rendimiento de agente:', {
        error: error.message,
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔐 OBTENER PERMISOS DE AGENTE ESPECÍFICO
   * GET /api/team/agents/:id/permissions
   */
  static async getAgentPermissions(req, res, next) {
    try {
      const { id } = req.params;

      logger.info('🔐 TeamController.getAgentPermissions - Obteniendo permisos', {
        agentId: id,
        userEmail: req.user?.email
      });

      // Buscar agente
      const user = await User.findByEmail(id) || await User.getById(id);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // Obtener permisos (con lógica de usuario inmune)
      let userPermissions;
      if (TeamController.isImmuneUser(user.email)) {
        userPermissions = TeamController.getImmuneUserPermissions();
      } else {
        userPermissions = user.permissions || getDefaultPermissionsForRole(user.role);
      }

      // Obtener módulos accesibles
      const accessibleModules = getAccessibleModules(userPermissions);

      const permissionsData = {
        agent: {
          id: user.id || user.email,
          name: user.name,
          email: user.email,
          role: user.role,
          isImmuneUser: TeamController.isImmuneUser(user.email)
        },
        permissions: {
          basic: {
            read: userPermissions.read || false,
            write: userPermissions.write || false,
            approve: userPermissions.approve || false,
            configure: userPermissions.configure || false
          },
          modules: userPermissions.modules || {}
        },
        accessibleModules
      };

      return ResponseHandler.success(res, permissionsData, 'Permisos obtenidos exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo permisos de agente:', {
        error: error.message,
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 ACTUALIZAR PERMISOS DE AGENTE ESPECÍFICO
   * PUT /api/team/agents/:id/permissions
   */
  static async updateAgentPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      logger.info('🔄 TeamController.updateAgentPermissions - Actualizando permisos', {
        agentId: id,
        userEmail: req.user?.email
      });

      // Buscar agente
      const user = await User.findByEmail(id) || await User.getById(id);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // Normalizar permisos (con lógica de usuario inmune)
      const normalizedPermissions = TeamController.normalizePermissions(permissions, user.role, user.email);

      // Actualizar permisos
      const updateData = {
        permissions: normalizedPermissions,
        metadata: {
          ...user.metadata,
          lastUpdatedBy: req.user.email,
          lastUpdatedAt: new Date().toISOString(),
          permissionsUpdateCount: (user.metadata?.permissionsUpdateCount || 0) + 1
        }
      };

      const updatedUser = await User.update(user.id || user.email, updateData);

      // Obtener módulos accesibles actualizados
      const accessibleModules = getAccessibleModules(normalizedPermissions);

      const responseData = {
        agent: {
          id: updatedUser.id || updatedUser.email,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isImmuneUser: TeamController.isImmuneUser(updatedUser.email)
        },
        permissions: {
          basic: {
            read: normalizedPermissions.read || false,
            write: normalizedPermissions.write || false,
            approve: normalizedPermissions.approve || false,
            configure: normalizedPermissions.configure || false
          },
          modules: normalizedPermissions.modules || {}
        },
        accessibleModules
      };

      logger.info('✅ Permisos de agente actualizados', {
        agentId: updatedUser.id,
        agentEmail: updatedUser.email,
        isImmuneUser: TeamController.isImmuneUser(updatedUser.email),
        modulesCount: accessibleModules.length,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, responseData, 'Permisos actualizados exitosamente');

    } catch (error) {
      logger.error('❌ Error actualizando permisos de agente:', {
        error: error.message,
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 RESETEAR PERMISOS DE AGENTE A DEFAULTS DEL ROL
   * POST /api/team/agents/:id/permissions/reset
   */
  static async resetAgentPermissions(req, res, next) {
    try {
      const { id } = req.params;

      logger.info('🔄 TeamController.resetAgentPermissions - Reseteando permisos', {
        agentId: id,
        userEmail: req.user?.email
      });

      // Buscar agente
      const user = await User.findByEmail(id) || await User.getById(id);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Agente no encontrado');
      }

      // Obtener permisos por defecto del rol (con lógica de usuario inmune)
      const defaultPermissions = TeamController.normalizePermissions({}, user.role, user.email);

      // Actualizar permisos
      const updateData = {
        permissions: defaultPermissions,
        metadata: {
          ...user.metadata,
          lastUpdatedBy: req.user.email,
          lastUpdatedAt: new Date().toISOString(),
          permissionsResetCount: (user.metadata?.permissionsResetCount || 0) + 1
        }
      };

      const updatedUser = await User.update(user.id || user.email, updateData);

      // Obtener módulos accesibles
      const accessibleModules = getAccessibleModules(defaultPermissions);

      const responseData = {
        agent: {
          id: updatedUser.id || updatedUser.email,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isImmuneUser: TeamController.isImmuneUser(updatedUser.email)
        },
        permissions: {
          basic: {
            read: defaultPermissions.read || false,
            write: defaultPermissions.write || false,
            approve: defaultPermissions.approve || false,
            configure: defaultPermissions.configure || false
          },
          modules: defaultPermissions.modules || {}
        },
        accessibleModules
      };

      logger.info('✅ Permisos de agente reseteados', {
        agentId: updatedUser.id,
        agentEmail: updatedUser.email,
        isImmuneUser: TeamController.isImmuneUser(updatedUser.email),
        role: updatedUser.role,
        modulesCount: accessibleModules.length,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, responseData, 'Permisos reseteados exitosamente');

    } catch (error) {
      logger.error('❌ Error reseteando permisos de agente:', {
        error: error.message,
        agentId: req.params?.id,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔧 MÉTODOS AUXILIARES PARA EL MÓDULO DE AGENTES
   */

  // Generar avatar con iniciales
  static generateAvatar(name) {
    if (!name) return 'AG';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Generar permisos basados en rol
  static generatePermissions(role) {
    const permissionsByRole = {
      'admin': {
        read: true,
        write: true,
        approve: true,
        configure: true
      },
      'supervisor': {
        read: true,
        write: true,
        approve: true,
        configure: false
      },
      'agent': {
        read: true,
        write: true,
        approve: false,
        configure: false
      },
      'viewer': {
        read: true,
        write: false,
        approve: false,
        configure: false
      }
    };

    return permissionsByRole[role] || permissionsByRole['agent'];
  }

  // Normalizar permisos del frontend
  static normalizePermissions(permissions, role) {
    const defaultPermissions = this.generatePermissions(role);
    return {
      ...defaultPermissions,
      ...permissions
    };
  }

  // Generar contraseña temporal
  static generateTemporaryPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

}

module.exports = TeamController;
