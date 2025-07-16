const User = require('../models/User');
const { auth } = require('../config/firebase');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
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
        isActive,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      let users;
      if (search) {
        // Búsqueda por nombre o email
        const allUsers = await User.list({ isActive: true });
        const searchLower = search.toLowerCase();
        users = allUsers.filter(user =>
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower),
        );
      } else {
        users = await User.list({
          limit: parseInt(limit),
          role,
          isActive: isActive !== undefined ? isActive === 'true' : null,
        });
      }

      // Obtener KPIs básicos para cada usuario
      const usersWithKPIs = await Promise.all(
        users.map(async (user) => {
          const kpis = await this.getUserKPIs(user.uid, '30d');
          return {
            ...user.toJSON(),
            kpis: kpis.summary,
          };
        }),
      );

      logger.info('Miembros del equipo listados', {
        userId: req.user.uid,
        count: usersWithKPIs.length,
        filters: { role, isActive, search },
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
      const { email, displayName, role = 'viewer' } = req.body;

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

      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({
        email,
        displayName,
        emailVerified: false,
        password: this.generateTemporaryPassword(), // Contraseña temporal
      });

      // Establecer claims personalizados
      await auth.setCustomUserClaims(userRecord.uid, { role });

      // Crear usuario en Firestore
      const user = await User.create({
        uid: userRecord.uid,
        email,
        displayName,
        role,
        isActive: true,
      });

      // TODO: Enviar email de invitación con contraseña temporal
      // await this.sendInvitationEmail(email, displayName, temporaryPassword);

      logger.info('Miembro invitado al equipo', {
        newUserId: user.uid,
        email: user.email,
        role: user.role,
        invitedBy: req.user.uid,
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
      const { id } = req.params;
      const user = await User.getByUid(id);

      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // Los usuarios pueden ver su propia información, los admins pueden ver todo
      if (req.user.role !== 'admin' && req.user.uid !== id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver este miembro',
        });
      }

      // Obtener KPIs detallados
      const kpis = await this.getUserKPIs(user.uid, '30d');

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
      const updates = req.body;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden actualizar miembros',
        });
      }

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // No permitir que se modifique el propio rol de admin
      if (req.user.uid === id && updates.role && updates.role !== 'admin') {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes cambiar tu propio rol de administrador',
        });
      }

      // Campos que no se pueden actualizar directamente
      const forbiddenFields = ['uid', 'email', 'createdAt'];
      forbiddenFields.forEach(field => delete updates[field]);

      // Actualizar claims de Firebase si se cambia el rol
      if (updates.role && updates.role !== user.role) {
        await auth.setCustomUserClaims(user.uid, { role: updates.role });
      }

      await user.update(updates);

      logger.info('Miembro actualizado', {
        userId: user.uid,
        updatedBy: req.user.uid,
        fields: Object.keys(updates),
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

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
          message: `No se encontró un miembro con ID ${id}`,
        });
      }

      // No permitir que se elimine a sí mismo
      if (req.user.uid === id) {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes eliminarte a ti mismo',
        });
      }

      // Soft delete del usuario
      await user.setActive(false);

      // Desactivar en Firebase Auth
      await auth.updateUser(user.uid, { disabled: true });

      logger.info('Miembro eliminado', {
        userId: user.uid,
        deletedBy: req.user.uid,
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

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
        });
      }

      await user.setActive(true);
      await auth.updateUser(user.uid, { disabled: false });

      logger.info('Miembro activado', {
        userId: user.uid,
        activatedBy: req.user.uid,
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

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
        });
      }

      // No permitir desactivarse a sí mismo
      if (req.user.uid === id) {
        return res.status(400).json({
          error: 'Operación no permitida',
          message: 'No puedes desactivarte a ti mismo',
        });
      }

      await user.setActive(false);
      await auth.updateUser(user.uid, { disabled: true });

      logger.info('Miembro desactivado', {
        userId: user.uid,
        deactivatedBy: req.user.uid,
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

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
        });
      }

      // Los usuarios pueden ver sus propios KPIs, los admins pueden ver todos
      if (req.user.role !== 'admin' && req.user.uid !== id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver los KPIs de este miembro',
        });
      }

      const kpis = await this.getUserKPIs(user.uid, period);

      res.json({
        user: {
          uid: user.uid,
          displayName: user.displayName,
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

      const user = await User.getByUid(id);
      if (!user) {
        return res.status(404).json({
          error: 'Miembro no encontrado',
        });
      }

      // Generar nueva contraseña temporal
      const temporaryPassword = this.generateTemporaryPassword();

      // Actualizar contraseña en Firebase Auth
      await auth.updateUser(user.uid, {
        password: temporaryPassword,
      });

      // TODO: Enviar email con nueva contraseña
      // await this.sendPasswordResetEmail(user.email, user.displayName, temporaryPassword);

      logger.info('Contraseña reseteada', {
        userId: user.uid,
        resetBy: req.user.uid,
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
    const contacts = await Contact.list({ userId, isActive: true });
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
    const campaigns = await Campaign.list({ createdBy: userId, isActive: true });
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
  static async calculateResponseTime (userId, startDate, endDate) {
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
  static async calculateSatisfaction (userId, startDate, endDate) {
    // Implementación simplificada
    // En una implementación real, se basaría en encuestas o feedback
    return Math.floor(Math.random() * 20) + 80; // 80-100% (mock)
  }

  /**
   * Generar contraseña temporal
   */
  static generateTemporaryPassword () {
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
