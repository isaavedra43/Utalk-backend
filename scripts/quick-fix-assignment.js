/**
 * 🔧 SCRIPT RÁPIDO PARA ARREGLAR ASIGNACIÓN
 * 
 * Arregla la asignación de una conversación específica
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

async function fixAssignment() {
  const conversationId = 'conv_+5214773790184_+5214793176502';
  const agentEmail = 'admin@company.com';
  
  try {
    console.log('🔍 Buscando conversación...');
    
    // Buscar en todos los contactos
    const contactsSnapshot = await db.collection('contacts').get();
    
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      
      const conversationRef = db
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .doc(conversationId);
      
      const conversationDoc = await conversationRef.get();
      
      if (conversationDoc.exists) {
        const data = conversationDoc.data();
        
        console.log('📋 Estado actual:', {
          conversationId,
          contactId,
          hasParticipants: !!(data.participants && data.participants.length > 0),
          hasAssignedTo: !!(data.assignedTo && data.assignedTo.length > 0),
          participants: data.participants || [],
          assignedTo: data.assignedTo || null
        });
        
        // Actualizar assignedTo
        await conversationRef.update({
          assignedTo: agentEmail,
          assignedAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log('✅ Asignación actualizada:', {
          conversationId,
          contactId,
          assignedTo: agentEmail
        });
        
        return;
      }
    }
    
    console.log('❌ Conversación no encontrada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixAssignment()
  .then(() => {
    console.log('🎉 Completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
