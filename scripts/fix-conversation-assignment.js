/**
 * 🔧 SCRIPT DE REPARACIÓN DE ASIGNACIONES DE CONVERSACIONES
 * 
 * Repara conversaciones que tienen participants pero no assignedTo
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

/**
 * Reparar asignaciones de conversaciones
 */
async function fixConversationAssignments() {
  try {
    logger.info('🔧 Iniciando reparación de asignaciones de conversaciones...');
    
    // Obtener todos los contactos
    const contactsSnapshot = await firestore.collection('contacts').get();
    
    let totalConversations = 0;
    let fixedConversations = 0;
    let errors = 0;
    
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      
      // Obtener conversaciones de este contacto
      const conversationsSnapshot = await firestore
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .get();
      
      for (const conversationDoc of conversationsSnapshot.docs) {
        const conversationId = conversationDoc.id;
        const conversationData = conversationDoc.data();
        
        totalConversations++;
        
        try {
          // Verificar si tiene participants pero no assignedTo
          const hasParticipants = conversationData.participants && 
                                 Array.isArray(conversationData.participants) && 
                                 conversationData.participants.length > 0;
          
          const hasAssignedTo = conversationData.assignedTo && 
                               typeof conversationData.assignedTo === 'string' && 
                               conversationData.assignedTo.length > 0;
          
          if (hasParticipants && !hasAssignedTo) {
            // Encontrar el primer email en participants (asumiendo que es el agente)
            const agentEmail = conversationData.participants.find(p => 
              typeof p === 'string' && p.includes('@')
            );
            
            if (agentEmail) {
              // Actualizar la conversación con assignedTo
              await firestore
                .collection('contacts')
                .doc(contactId)
                .collection('conversations')
                .doc(conversationId)
                .update({
                  assignedTo: agentEmail,
                  assignedAt: new Date(),
                  updatedAt: new Date()
                });
              
              fixedConversations++;
              
              logger.info('✅ Conversación reparada', {
                conversationId,
                contactId,
                assignedTo: agentEmail,
                participants: conversationData.participants
              });
            } else {
              logger.warn('⚠️ No se encontró email válido en participants', {
                conversationId,
                contactId,
                participants: conversationData.participants
              });
            }
          } else if (hasAssignedTo && !hasParticipants) {
            // Caso inverso: tiene assignedTo pero no participants
            const participants = [conversationData.assignedTo];
            
            await firestore
              .collection('contacts')
              .doc(contactId)
              .collection('conversations')
              .doc(conversationId)
              .update({
                participants: participants,
                updatedAt: new Date()
              });
            
            fixedConversations++;
            
            logger.info('✅ Participants agregados a conversación', {
              conversationId,
              contactId,
              assignedTo: conversationData.assignedTo,
              participants: participants
            });
          }
          
        } catch (error) {
          errors++;
          logger.error('❌ Error procesando conversación', {
            conversationId,
            contactId,
            error: error.message
          });
        }
      }
    }
    
    logger.info('🎉 Reparación completada', {
      totalConversations,
      fixedConversations,
      errors
    });
    
    return {
      totalConversations,
      fixedConversations,
      errors
    };
    
  } catch (error) {
    logger.error('❌ Error en reparación de asignaciones', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Verificar estado de una conversación específica
 */
async function checkConversationStatus(conversationId) {
  try {
    // Buscar la conversación en todos los contactos
    const contactsSnapshot = await firestore.collection('contacts').get();
    
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      
      const conversationDoc = await firestore
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (conversationDoc.exists) {
        const data = conversationDoc.data();
        
        logger.info('📋 Estado de conversación', {
          conversationId,
          contactId,
          hasParticipants: !!(data.participants && data.participants.length > 0),
          hasAssignedTo: !!(data.assignedTo && data.assignedTo.length > 0),
          participants: data.participants || [],
          assignedTo: data.assignedTo || null,
          status: data.status,
          lastMessageAt: data.lastMessageAt
        });
        
        return {
          conversationId,
          contactId,
          data
        };
      }
    }
    
    logger.warn('⚠️ Conversación no encontrada', { conversationId });
    return null;
    
  } catch (error) {
    logger.error('❌ Error verificando conversación', {
      conversationId,
      error: error.message
    });
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === 'check') {
    const conversationId = args[1];
    if (conversationId) {
      checkConversationStatus(conversationId)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Error:', error.message);
          process.exit(1);
        });
    } else {
      console.log('Uso: node fix-conversation-assignment.js check <conversationId>');
      process.exit(1);
    }
  } else {
    fixConversationAssignments()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
      });
  }
}

module.exports = {
  fixConversationAssignments,
  checkConversationStatus
};
