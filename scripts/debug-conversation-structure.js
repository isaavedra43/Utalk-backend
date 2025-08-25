/**
 * 🔍 SCRIPT DE DEBUG PARA ESTRUCTURA DE CONVERSACIÓN
 * 
 * Verifica la estructura de datos de una conversación específica
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'utalk-backend'
  });
}

const db = admin.firestore();

async function debugConversationStructure(conversationId) {
  try {
    console.log('🔍 Debuggeando estructura de conversación:', conversationId);
    
    // Buscar en todos los contactos
    const contactsSnapshot = await db.collection('contacts').get();
    
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      
      const conversationDoc = await db
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (conversationDoc.exists) {
        const data = conversationDoc.data();
        
        console.log('\n📋 ESTRUCTURA DE CONVERSACIÓN ENCONTRADA:');
        console.log('==========================================');
        console.log('Conversation ID:', conversationId);
        console.log('Contact ID:', contactId);
        console.log('Contact Name:', contactDoc.data().name);
        
        console.log('\n🔧 CAMPOS DE ASIGNACIÓN:');
        console.log('------------------------');
        console.log('assignedTo:', data.assignedTo);
        console.log('assignedAt:', data.assignedAt);
        console.log('primaryAgent:', data.primaryAgent);
        
        console.log('\n👥 ASSIGNED AGENTS:');
        console.log('-------------------');
        if (data.assignedAgents && Array.isArray(data.assignedAgents)) {
          console.log('✅ assignedAgents existe y es un array');
          console.log('📊 Cantidad de agentes:', data.assignedAgents.length);
          
          data.assignedAgents.forEach((agent, index) => {
            console.log(`\n  Agente ${index + 1}:`);
            console.log(`    email: ${agent.email}`);
            console.log(`    name: ${agent.name}`);
            console.log(`    role: ${agent.role}`);
            console.log(`    assignedAt: ${agent.assignedAt}`);
            console.log(`    assignedBy: ${agent.assignedBy}`);
          });
        } else {
          console.log('❌ assignedAgents NO existe o NO es un array');
          console.log('Tipo de assignedAgents:', typeof data.assignedAgents);
          console.log('Valor de assignedAgents:', data.assignedAgents);
        }
        
        console.log('\n📝 TODOS LOS CAMPOS:');
        console.log('---------------------');
        Object.keys(data).forEach(key => {
          const value = data[key];
          const type = Array.isArray(value) ? 'array' : typeof value;
          const preview = Array.isArray(value) 
            ? `[${value.length} elementos]` 
            : typeof value === 'object' && value !== null
            ? `{${Object.keys(value).length} propiedades}`
            : String(value).substring(0, 50);
          
          console.log(`${key}: (${type}) ${preview}`);
        });
        
        return {
          conversationId,
          contactId,
          data
        };
      }
    }
    
    console.log('❌ Conversación no encontrada');
    return null;
    
  } catch (error) {
    console.error('❌ Error debuggeando conversación:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const conversationId = process.argv[2];
  
  if (!conversationId) {
    console.log('Uso: node scripts/debug-conversation-structure.js <conversationId>');
    console.log('Ejemplo: node scripts/debug-conversation-structure.js conv_+5214773790184_+5214793176502');
    process.exit(1);
  }
  
  debugConversationStructure(conversationId)
    .then(() => {
      console.log('\n🎉 Debug completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = {
  debugConversationStructure
};
