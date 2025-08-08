/**
 * 🔒 UTILIDAD DE REDACCIÓN PII
 * Enmascara datos sensibles para logs sin exponer información personal
 */

export function redactPII(value) {
  if (value == null) return value;
  const s = String(value);
  if (s.includes('@')) {
    const [u, d] = s.split('@');
    return `${u.slice(0,3)}***@${d}`;
  }
  if (s.startsWith('+')) {
    return `${s.slice(0,3)}******${s.slice(-2)}`;
  }
  if (s.length > 8) {
    return `${s.slice(0,3)}***${s.slice(-2)}`;
  }
  return '***';
}

export function redactObj(obj, keys) {
  const out = { ...obj };
  for (const k of keys) {
    if (k in out) out[k] = redactPII(out[k]);
  }
  return out;
}

/**
 * 🔍 REDACCIÓN ESPECÍFICA PARA LOGS DE CONVERSACIONES
 */
export function redactConversationLog(conversation) {
  if (!conversation) return conversation;
  
  return {
    ...conversation,
    participants: conversation.participants?.map(p => redactPII(p)) || [],
    lastMessage: conversation.lastMessage ? {
      ...conversation.lastMessage,
      senderEmail: redactPII(conversation.lastMessage.senderEmail),
      content: conversation.lastMessage.content?.length > 50 
        ? conversation.lastMessage.content.substring(0, 50) + '...'
        : conversation.lastMessage.content
    } : null,
    workspaceId: redactPII(conversation.workspaceId),
    tenantId: redactPII(conversation.tenantId)
  };
}

/**
 * 🔍 REDACCIÓN ESPECÍFICA PARA LOGS DE MENSAJES
 */
export function redactMessageLog(message) {
  if (!message) return message;
  
  return {
    ...message,
    senderEmail: redactPII(message.senderEmail),
    content: message.content?.length > 50 
      ? message.content.substring(0, 50) + '...'
      : message.content,
    conversationId: redactPII(message.conversationId)
  };
}

/**
 * 🔍 REDACCIÓN PARA QUERY DIAGNÓSTICOS
 */
export function redactQueryLog(queryData) {
  if (!queryData) return queryData;
  
  return {
    ...queryData,
    wheres: queryData.wheres?.map(where => ({
      ...where,
      value: redactPII(where.value)
    })) || [],
    participantsContains: redactPII(queryData.participantsContains),
    workspaceId: redactPII(queryData.workspaceId),
    tenantId: redactPII(queryData.tenantId)
  };
} 