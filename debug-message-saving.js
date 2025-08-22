#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar el guardado de mensajes
 * Verifica la estructura exacta de la conversación y mensajes
 */

// Cargar variables de entorno
require('dotenv').config();

const admin = require('firebase-admin');

// Inicializar Firebase usando las mismas configuraciones del proyecto
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no configurada');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    process.exit(1);
  }
}

const firestore = admin.firestore();

async function debugConversationStructure() {
  try {
    const conversationId = 'conv_+5214773790184_+5214793176502';
    
    console.log('🔍 DIAGNÓSTICO DE ESTRUCTURA DE CONVERSACIÓN');
    console.log('='.repeat(50));
    console.log(`ConversationId: ${conversationId}`);
    console.log();

    // 1. Buscar en todos los contactos para encontrar la conversación
    console.log('📋 PASO 1: Buscando conversación en todos los contactos...');
    const contactsSnapshot = await firestore.collection('contacts').get();
    
    let foundContact = null;
    let foundConversation = null;
    
    for (const contactDoc of contactsSnapshot.docs) {
      const contactId = contactDoc.id;
      const contactData = contactDoc.data();
      
      console.log(`  📁 Contacto: ${contactId} (phone: ${contactData.phone})`);
      
      // Buscar conversación en este contacto
      const conversationRef = firestore
        .collection('contacts').doc(contactId)
        .collection('conversations').doc(conversationId);
      
      const conversationDoc = await conversationRef.get();
      
      if (conversationDoc.exists) {
        foundContact = { id: contactId, data: contactData };
        foundConversation = { id: conversationId, data: conversationDoc.data() };
        
        console.log(`  ✅ CONVERSACIÓN ENCONTRADA en contacto: ${contactId}`);
        console.log(`  📊 Datos de conversación:`, JSON.stringify(conversationDoc.data(), null, 2));
        
        // 2. Buscar mensajes en esta conversación
        console.log('\n📨 PASO 2: Verificando mensajes en la conversación...');
        const messagesSnapshot = await conversationRef.collection('messages').get();
        
        console.log(`  📊 Total de mensajes encontrados: ${messagesSnapshot.size}`);
        
        if (messagesSnapshot.size > 0) {
          console.log('\n  📝 LISTA DE MENSAJES:');
          messagesSnapshot.docs.forEach((msgDoc, index) => {
            const msgData = msgDoc.data();
            console.log(`    ${index + 1}. ID: ${msgDoc.id}`);
            console.log(`       Content: "${msgData.content || 'N/A'}"`);
            console.log(`       Direction: ${msgData.direction}`);
            console.log(`       Status: ${msgData.status}`);
            console.log(`       Timestamp: ${msgData.timestamp?.toDate?.() || msgData.timestamp}`);
            console.log(`       Created: ${msgData.createdAt?.toDate?.() || msgData.createdAt}`);
            console.log();
          });
        } else {
          console.log('  ❌ NO SE ENCONTRARON MENSAJES');
        }
        
        break;
      }
    }
    
    if (!foundConversation) {
      console.log('❌ CONVERSACIÓN NO ENCONTRADA en ningún contacto');
      
      // 3. Verificar si existe en la estructura antigua (para debug)
      console.log('\n🔍 PASO 3: Verificando estructura antigua...');
      try {
        const oldConversationRef = firestore.collection('conversations').doc(conversationId);
        const oldConversationDoc = await oldConversationRef.get();
        
        if (oldConversationDoc.exists) {
          console.log('⚠️  CONVERSACIÓN ENCONTRADA EN ESTRUCTURA ANTIGUA');
          console.log('📊 Datos:', JSON.stringify(oldConversationDoc.data(), null, 2));
        } else {
          console.log('✅ No existe en estructura antigua');
        }
      } catch (error) {
        console.log('❌ Error verificando estructura antigua:', error.message);
      }
    }
    
    // 4. Verificar logs recientes
    console.log('\n📋 RESUMEN:');
    console.log(`- Contacto encontrado: ${foundContact ? `${foundContact.id} (${foundContact.data.phone})` : 'NO'}`);
    console.log(`- Conversación encontrada: ${foundConversation ? 'SÍ' : 'NO'}`);
    console.log(`- MessageCount esperado vs real: ${foundConversation?.data?.messageCount || 0}`);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

async function main() {
  await debugConversationStructure();
  process.exit(0);
}

if (require.main === module) {
  main();
}
