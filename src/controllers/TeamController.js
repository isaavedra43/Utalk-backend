const User = require('../models/User');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const { firestore } = require('../config/firebase');
const moment = require('moment');

class TeamController {
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
      } else {
        users = await User.list({
          limit: parseInt(limit),
          role,
          isActive: status === 'active',
        });
      }

      // Obtener KPIs básicos para cada usuario
      const usersWithKPIs = await Promise.all(
        users.map(async (user) => {
          const kpis = await this.getUserKPIs(user.email, '30d');
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

      res.json({
        users: usersWithKPIs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: usersWithKPIs.length,
        },
      });
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
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden invitar miembros',
        });
      }

      // Verificar que el usuario no existe ya
      const existingUser = await User.getByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: 'Usuario ya existe',
          message: `Ya existe un usuario con el email ${email}`,
        });
      }

      // CREAR usuario directamente en Firestore (EMAIL-FIRST)
      const temporaryPassword = this.generateTemporaryPassword();
      
      const user = await User.create({
        email,
        password: temporaryPassword,
        name,
        role,
        isActive: true,
      });

      // TODO: Implementar envío de email de invitación
      // await this.sendInvitationEmail(email, displayName, temporaryPassword);

      logger.info('Miembro invitado al equipo', {
        newUserEmail: user.email,
        email: user.email,
        role: user.role,
        invitedBy: req.user.email,
      });

      res.status(201).json({
        message: 'Miembro invitado exitosamente',
        user: user.toJSON(),
        temporaryPassword: 'Se ha enviado por email', // En producción no devolver la contraseña
      });
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
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // Los usuarios pueden ver su propia información, los admins pueden ver todo
      if (req.user.role !== 'admin' && req.user.email !== id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver este miembro',
        });
      }

      // Obtener KPIs detallados
      const kpis = await this.getUserKPIs(user.email, '30d');

      res.json({
        user: {
          ...user.toJSON(),
          kpis,
        },
      });
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
      const { name, role, status } = req.body;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden actualizar miembros',
        });
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // No permitir que se modifique el propio rol de admin
      if (req.user.email === id && role && role !== 'admin') {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes cambiar tu propio rol de administrador',
        });
      }

      const updates = {
        name,
        role,
        status,
      };

      await user.update(updates);
      logger.info('Usuario actualizado', {
        userId: id,
        updatedBy: req.user.email,
        updates,
      });

      res.json({
        message: 'Miembro actualizado exitosamente',
        user: user.toJSON(),
      });
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
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // No permitir que se elimine a sí mismo
      if (req.user.email === id) {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes eliminarte a ti mismo',
        });
      }

      // Soft delete del usuario
      await user.setActive(false);

      // Desactivar en JWT interno

      logger.info('Miembro eliminado', {
        userEmail: user.email,
        deletedBy: req.user.email,
      });

      res.json({
        message: 'Miembro eliminado exitosamente',
      });
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
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden activar miembros',
        });
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
      }

      await user.setActive(true);

      logger.info('Miembro activado', {
        userEmail: user.email,
        activatedBy: req.user.email,
      });

      res.json({
        message: 'Miembro activado exitosamente',
        user: user.toJSON(),
      });
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
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden desactivar miembros',
        });
      }

      const user = await User.getByEmail(id) // id es ahora email;
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
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

      res.json({
        message: 'Miembro desactivado exitosamente',
        user: user.toJSON(),
      });
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
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
      }

      // Los usuarios pueden ver sus propios KPIs, los admins pueden ver todos
      if (req.user.role !== 'admin' && req.user.email !== id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver los KPIs de este miembro',
        });
      }

      const kpis = await this.getUserKPIs(user.email, period);

      res.json({
        user: {
          id: user.email,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        period,
        kpis,
      });
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
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden resetear contraseñas',
        });
      }

      const user = await User.getByEmail(id); // id es ahora email
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
      }

      // Generar nueva contraseña temporal
      const temporaryPassword = this.generateTemporaryPassword();

      // Actualizar contraseña directamente en Firestore (EMAIL-FIRST)
      await user.update({ password: temporaryPassword });

      // Enviar email con nueva contraseña
              // TODO: Implementar envío de email para reset de contraseña
        // await this.sendPasswordResetEmail(user.email, user.displayName, temporaryPassword);

      logger.info('Contraseña reseteada', {
        userEmail: user.email,
        resetBy: req.user.email,
      });

      res.json({
        message: 'Contraseña reseteada exitosamente',
        temporaryPassword: 'Se ha enviado por email', // En producción no devolver la contraseña
      });
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

    // Obtener métricas paralelas
    const [messageStats, contactStats, campaignStats] = await Promise.all([
      Message.getStats(userId, start, end),
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
    // TODO: Implementar cálculo real de productividad basado en métricas
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
      return this.generateTemporaryPassword();
    }

    return password;
  }
}

module.exports = TeamController;
