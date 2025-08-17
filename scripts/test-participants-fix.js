#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE PRUEBA: Verificar generación de participantes
 * 
 * Este script prueba que las nuevas conversaciones se creen
 * con la colección de participantes correcta.
 */

const admin = require('firebase-admin');
const { getDefaultViewerEmails } = require('../src/config/defaultViewers');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Función para verificar participantes en una conversación
 */
async function checkConversationParticipants(conversationId) {
  try {
    console.log(`🔍 Verificando participantes en conversación: ${conversationId}`);
    
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      console.log('❌ Conversación no encontrada');
      return false;
    }
    
    const data = conversationDoc.data();
    const participants = data.participants || [];
    
    console.log('📋 Datos de la conversación:');
    console.log(`  - ID: ${conversationDoc.id}`);
    console.log(`  - Customer Phone: ${data.customerPhone || 'N/A'}`);
    console.log(`  - Status: ${data.status || 'N/A'}`);
    console.log(`  - Participants Count: ${participants.length}`);
    console.log(`  - Participants: ${JSON.stringify(participants, null, 2)}`);
    
    // Verificar si tiene los participantes por defecto
    const defaultViewers = getDefaultViewerEmails();
    console.log(`\n📋 Viewers por defecto configurados:`);
    console.log(`  - Default Viewers: ${JSON.stringify(defaultViewers, null, 2)}`);
    
    const hasDefaultViewers = defaultViewers.every(viewer => 
      participants.some(p => p.toLowerCase() === viewer.toLowerCase())
    );
    
    console.log(`\n✅ Verificación de participantes:`);
    console.log(`  - Tiene participantes: ${participants.length > 0 ? 'SÍ' : 'NO'}`);
    console.log(`  - Tiene viewers por defecto: ${hasDefaultViewers ? 'SÍ' : 'NO'}`);
    
    return participants.length > 0 && hasDefaultViewers;
    
  } catch (error) {
    console.error('❌ Error verificando conversación:', error.message);
    return false;
  }
}

/**
 * Función para listar conversaciones recientes
 */
async function listRecentConversations(limit = 10) {
  try {
    console.log(`📋 Listando las ${limit} conversaciones más recientes:`);
    
    const snapshot = await db.collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    
    if (snapshot.empty) {
      console.log('❌ No se encontraron conversaciones');
      return [];
    }
    
    const conversations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        customerPhone: data.customerPhone,
        status: data.status,
        participantsCount: (data.participants || []).length,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        hasParticipants: !!(data.participants && data.participants.length > 0)
      });
    });
    
    conversations.forEach((conv, index) => {
      console.log(`  ${index + 1}. ${conv.id}`);
      console.log(`     - Customer: ${conv.customerPhone}`);
      console.log(`     - Status: ${conv.status}`);
      console.log(`     - Participants: ${conv.participantsCount}`);
      console.log(`     - Has Participants: ${conv.hasParticipants ? '✅' : '❌'}`);
      console.log(`     - Updated: ${conv.updatedAt}`);
      console.log('');
    });
    
    return conversations;
    
  } catch (error) {
    console.error('❌ Error listando conversaciones:', error.message);
    return [];
  }
}

/**
 * Función para verificar configuración de viewers por defecto
 */
function checkDefaultViewersConfig() {
  console.log('🔧 Verificando configuración de viewers por defecto:');
  
  const defaultViewers = getDefaultViewerEmails();
  console.log(`  - DEFAULT_VIEWER_EMAILS: ${process.env.DEFAULT_VIEWER_EMAILS || 'No configurado'}`);
  console.log(`  - DEFAULT_AGENT_EMAIL: ${process.env.DEFAULT_AGENT_EMAIL || 'No configurado'}`);
  console.log(`  - Viewers resultantes: ${JSON.stringify(defaultViewers, null, 2)}`);
  
  return defaultViewers;
}

/**
 * Función principal
 */
async function runTest() {
  console.log('🚀 INICIANDO PRUEBA DE PARTICIPANTES');
  console.log('=' .repeat(50));
  
  try {
    // 1. Verificar configuración
    console.log('\n1️⃣ Verificando configuración...');
    const defaultViewers = checkDefaultViewersConfig();
    
    if (defaultViewers.length === 0) {
      console.log('⚠️ ADVERTENCIA: No hay viewers por defecto configurados');
      console.log('   Esto puede causar problemas de permisos en las conversaciones');
    }
    
    // 2. Listar conversaciones recientes
    console.log('\n2️⃣ Listando conversaciones recientes...');
    const conversations = await listRecentConversations(5);
    
    if (conversations.length === 0) {
      console.log('❌ No hay conversaciones para verificar');
      return;
    }
    
    // 3. Verificar participantes en las conversaciones más recientes
    console.log('\n3️⃣ Verificando participantes en conversaciones recientes...');
    
    let conversationsWithParticipants = 0;
    let conversationsWithoutParticipants = 0;
    
    for (const conv of conversations) {
      const hasParticipants = await checkConversationParticipants(conv.id);
      
      if (hasParticipants) {
        conversationsWithParticipants++;
      } else {
        conversationsWithoutParticipants++;
      }
      
      console.log(''); // Separador
    }
    
    // 4. Resumen
    console.log('\n📊 RESUMEN:');
    console.log(`  - Total de conversaciones verificadas: ${conversations.length}`);
    console.log(`  - Con participantes: ${conversationsWithParticipants} ✅`);
    console.log(`  - Sin participantes: ${conversationsWithoutParticipants} ❌`);
    
    if (conversationsWithoutParticipants > 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO:');
      console.log('   Algunas conversaciones no tienen la colección de participantes.');
      console.log('   Esto puede causar problemas de permisos de acceso.');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   Ejecuta el script de backfill para agregar participantes:');
      console.log('   node scripts/backfill_add_viewers.js');
    } else {
      console.log('\n✅ TODAS LAS CONVERSACIONES TIENEN PARTICIPANTES');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = {
  checkConversationParticipants,
  listRecentConversations,
  checkDefaultViewersConfig,
  runTest
}; 