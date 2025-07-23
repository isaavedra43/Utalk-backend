/**
 * UTILIDAD DE ASIGNACIÓN AUTOMÁTICA DE AGENTES - UTalk Backend
 *
 * Maneja la lógica de asignación automática de conversaciones a agentes
 * Incluye fallbacks para pruebas y casos edge
 */

const logger = require('./logger');

/**
 * Obtener agente activo para asignación automática
 * @returns {string|null} - ID del agente o null si no hay agentes activos
 */
async function getActiveAgent () {
  try {
    // ✅ IMPLEMENTACIÓN TEMPORAL: Usar agente de prueba para desarrollo
    // En producción, esto debería consultar la base de datos de agentes
    const testAgentId = process.env.TEST_AGENT_ID || 'agent_test_001';

    logger.info('Asignando agente automáticamente', {
      agentId: testAgentId,
      method: 'test_agent',
    });

    return testAgentId;
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
  const {
    customerPhone = null,
    agentPhone = null,
    contact = null,
    priority = 'normal',
  } = options;

  // ✅ LÓGICA DE ASIGNACIÓN AUTOMÁTICA
  let assignedAgent = null;

  // 1. Intentar obtener agente activo
  assignedAgent = await getActiveAgent();

  // 2. Si no hay agente activo, usar agente de fallback
  if (!assignedAgent) {
    assignedAgent = 'bot_agent_001'; // Bot como fallback
    logger.warn('No hay agentes activos, usando bot como fallback', {
      customerPhone,
      assignedAgent,
    });
  }

  // 3. Log de asignación
  logger.info('Conversación asignada automáticamente', {
    customerPhone,
    agentPhone,
    assignedAgent,
    priority,
    contactId: contact?.id || 'sin_contacto',
  });

  return assignedAgent;
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

  // ✅ IMPLEMENTACIÓN TEMPORAL: Validar agentes de prueba
  const validAgents = [
    'agent_test_001',
    'agent_test_002',
    'bot_agent_001',
  ];

  const isValid = validAgents.includes(agentId);

  if (!isValid) {
    logger.warn('Agente inválido', { agentId });
  }

  return isValid;
}

/**
 * Obtener información del agente
 * @param {string} agentId - ID del agente
 * @returns {Object|null} - Información del agente
 */
async function getAgentInfo (agentId) {
  if (!agentId) {
    return null;
  }

  // ✅ IMPLEMENTACIÓN TEMPORAL: Información de agentes de prueba
  const agents = {
    agent_test_001: {
      id: 'agent_test_001',
      name: 'Agente de Prueba 1',
      email: 'agent1@utalk.com',
      status: 'active',
      type: 'human',
    },
    agent_test_002: {
      id: 'agent_test_002',
      name: 'Agente de Prueba 2',
      email: 'agent2@utalk.com',
      status: 'active',
      type: 'human',
    },
    bot_agent_001: {
      id: 'bot_agent_001',
      name: 'Bot Automático',
      email: 'bot@utalk.com',
      status: 'active',
      type: 'bot',
    },
  };

  return agents[agentId] || null;
}

/**
 * Asegurar que una conversación tenga un agente asignado
 * @param {Object} conversationData - Datos de la conversación
 * @returns {Object} - Datos de conversación con assignedTo garantizado
 */
async function ensureConversationAssignment (conversationData) {
  // ✅ SIEMPRE GARANTIZAR CAMPO assignedTo
  if (!conversationData.assignedTo) {
    const assignedAgent = await assignConversationToAgent({
      customerPhone: conversationData.customerPhone,
      agentPhone: conversationData.agentPhone,
      contact: conversationData.contact,
      priority: conversationData.priority || 'normal',
    });

    conversationData.assignedTo = assignedAgent;

    logger.info('Agente asignado automáticamente a conversación', {
      conversationId: conversationData.id,
      assignedAgent,
      customerPhone: conversationData.customerPhone,
    });
  } else {
    // ✅ VALIDAR AGENTE ASIGNADO
    const isValidAgent = await validateAgent(conversationData.assignedTo);
    if (!isValidAgent) {
      logger.warn('Agente asignado inválido, reasignando automáticamente', {
        conversationId: conversationData.id,
        invalidAgent: conversationData.assignedTo,
      });

      const newAssignedAgent = await assignConversationToAgent({
        customerPhone: conversationData.customerPhone,
        agentPhone: conversationData.agentPhone,
        contact: conversationData.contact,
        priority: conversationData.priority || 'normal',
      });

      conversationData.assignedTo = newAssignedAgent;
    }
  }

  return conversationData;
}

module.exports = {
  getActiveAgent,
  assignConversationToAgent,
  validateAgent,
  getAgentInfo,
  ensureConversationAssignment,
};
