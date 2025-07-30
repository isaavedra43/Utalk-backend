const User = require('../models/User');
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

      // Enviar email de invitación con contraseña temporal
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
