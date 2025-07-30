/**
 * Utilidad de asignación automática de agentes
 */

const logger = require('./logger');

/**
 * Obtener agente activo para asignación automática
 * @returns {string|null} - ID del agente o null si no hay agentes activos
 */
async function getActiveAgent () {
  try {
    const agentId = process.env.DEFAULT_AGENT_ID || 'system';

    logger.info('Asignando agente automáticamente', {
      agentId,
      method: 'auto_assignment',
    });

    return agentId;
  } catch (error) {
    logger.error('Error obteniendo agente activo', { error: error.message });
    return null;
  }
}

/**
 * Asignar conversación a agente automáticamente
 * @param {Object} options - Opciones de asignación
 * @returns {string} - ID del agente asignado
 */
async function assignConversationToAgent (options = {}) {
  const { conversationId, customerPhone, contact } = options;

  try {
    const assignedAgent = await getActiveAgent();

    if (!assignedAgent) {
      logger.warn('No hay agentes disponibles para asignación automática', {
        conversationId,
        customerPhone,
      });
      return null;
    }

    const isValidAgent = await validateAgent(assignedAgent);
    if (!isValidAgent) {
      logger.warn('Agente asignado no es válido', {
        agentId: assignedAgent,
        conversationId,
      });
      return null;
    }

    logger.info('Conversación asignada automáticamente', {
      conversationId,
      agentId: assignedAgent,
      customerPhone,
      contactId: contact?.id || 'sin_contacto',
    });

    return assignedAgent;
  } catch (error) {
    logger.error('Error en asignación automática', {
      error: error.message,
      conversationId,
      customerPhone,
    });
    return null;
  }
}

/**
 * Validar si un agente existe y está activo
 * @param {string} agentId - ID del agente
 * @returns {boolean} - true si el agente es válido
 */
async function validateAgent (agentId) {
  if (!agentId) {
    return false;
  }

  // Validación básica de formato
  if (typeof agentId !== 'string' || agentId.length < 3) {
    logger.warn('Agente inválido', { agentId });
    return false;
  }

  return true;
}

/**
 * Obtener información del agente
 * @param {string} agentId - ID del agente
 * @returns {Object|null} - Información del agente
 */
async function getAgentInfo (agentId) {
  try {
    if (!agentId) {
      return null;
    }

    const isValid = await validateAgent(agentId);
    if (!isValid) {
      return null;
    }

    return {
      id: agentId,
      name: agentId,
      isActive: true,
      assignedAt: new Date(),
    };
  } catch (error) {
    logger.error('Error obteniendo información del agente', {
      error: error.message,
      agentId,
    });
    return null;
  }
}

/**
 * Obtener carga de trabajo del agente
 * @param {string} agentId - ID del agente
 * @returns {number} - Número de conversaciones asignadas
 */
async function getAgentWorkload (agentId) {
  try {
    if (!agentId) {
      return 0;
    }

    // Simulación básica - en producción consultaría la base de datos
    return 0;
  } catch (error) {
    logger.error('Error obteniendo carga de trabajo del agente', {
      error: error.message,
      agentId,
    });
    return 0;
  }
}

/**
 * Reasignar conversación a otro agente
 * @param {string} conversationId - ID de la conversación
 * @param {string} newAgentId - ID del nuevo agente
 * @returns {boolean} - true si se reasignó exitosamente
 */
async function reassignConversation (conversationId, newAgentId) {
  try {
    const isValidAgent = await validateAgent(newAgentId);
    if (!isValidAgent) {
      logger.warn('Agente de reasignación no es válido', {
        agentId: newAgentId,
        conversationId,
      });
      return false;
    }

    logger.info('Conversación reasignada', {
      conversationId,
      newAgentId,
    });

    return true;
  } catch (error) {
    logger.error('Error en reasignación', {
      error: error.message,
      conversationId,
      newAgentId,
    });
    return false;
  }
}

module.exports = {
  getActiveAgent,
  assignConversationToAgent,
  validateAgent,
  getAgentInfo,
  getAgentWorkload,
  reassignConversation,
};
