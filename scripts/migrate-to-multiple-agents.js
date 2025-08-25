/**
 * 🔄 SCRIPT DE MIGRACIÓN A MÚLTIPLES AGENTES
 * 
 * Migra conversaciones existentes del formato legacy (assignedTo) 
 * al nuevo formato (assignedAgents)
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

/**
 * Migrar conversaciones a formato de múltiples agentes
 */
async function migrateToMultipleAgents() {
  try {
    logger.info('🔄 Iniciando migración a múltiples agentes...');
    
    // Obtener todos los contactos
    const contactsSnapshot = await firestore.collection('contacts').get();
    
    let totalConversations = 0;
    let migratedConversations = 0;
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
          // Verificar si necesita migración
          const hasLegacyAssignedTo = conversationData.assignedTo && 
                                     typeof conversationData.assignedTo === 'string' && 
                                     conversationData.assignedTo.length > 0;
          
          const hasNewAssignedAgents = conversationData.assignedAgents && 
                                      Array.isArray(conversationData.assignedAgents) && 
                                      conversationData.assignedAgents.length > 0;
          
          if (hasLegacyAssignedTo && !hasNewAssignedAgents) {
            // Crear estructura de múltiples agentes
            const assignedAgent = {
              email: conversationData.assignedTo,
              name: conversationData.assignedTo.split('@')[0], // Usar parte del email como nombre
              role: 'principal',
              assignedAt: conversationData.assignedAt || new Date(),
              assignedBy: 'migration'
            };
            
            // Actualizar conversación
            await firestore
              .collection('contacts')
              .doc(contactId)
              .collection('conversations')
              .doc(conversationId)
              .update({
                assignedAgents: [assignedAgent],
                primaryAgent: conversationData.assignedTo,
                migratedAt: new Date(),
                updatedAt: new Date()
              });
            
            migratedConversations++;
            
            logger.info('✅ Conversación migrada', {
              conversationId,
              contactId,
              legacyAssignedTo: conversationData.assignedTo,
              newAssignedAgents: [assignedAgent]
            });
          } else if (hasNewAssignedAgents) {
            logger.info('ℹ️ Conversación ya migrada', {
              conversationId,
              contactId,
              assignedAgentsCount: conversationData.assignedAgents.length
            });
          } else {
            logger.info('ℹ️ Conversación sin asignación', {
              conversationId,
              contactId
            });
          }
          
        } catch (error) {
          errors++;
          logger.error('❌ Error migrando conversación', {
            conversationId,
            contactId,
            error: error.message
          });
        }
      }
    }
    
    logger.info('🎉 Migración completada', {
      totalConversations,
      migratedConversations,
      errors
    });
    
    return {
      totalConversations,
      migratedConversations,
      errors
    };
    
  } catch (error) {
    logger.error('❌ Error en migración', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Verificar estado de migración de una conversación específica
 */
async function checkMigrationStatus(conversationId) {
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
        
        logger.info('📋 Estado de migración', {
          conversationId,
          contactId,
          hasLegacyAssignedTo: !!(data.assignedTo && data.assignedTo.length > 0),
          hasNewAssignedAgents: !!(data.assignedAgents && data.assignedAgents.length > 0),
          legacyAssignedTo: data.assignedTo || null,
          newAssignedAgents: data.assignedAgents || [],
          primaryAgent: data.primaryAgent || null,
          migratedAt: data.migratedAt || null
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
    logger.error('❌ Error verificando migración', {
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
      checkMigrationStatus(conversationId)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Error:', error.message);
          process.exit(1);
        });
    } else {
      console.log('Uso: node migrate-to-multiple-agents.js check <conversationId>');
      process.exit(1);
    }
  } else {
    migrateToMultipleAgents()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
      });
  }
}

module.exports = {
  migrateToMultipleAgents,
  checkMigrationStatus
};
