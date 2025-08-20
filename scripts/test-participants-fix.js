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
    logger.info('Verificando participantes en conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
    
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Conversación no encontrada' });
      return false;
    }
    
    const data = conversationDoc.data();
    const participants = data.participants || [];
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Datos de la conversación:' });
    logger.info('- ID: ${conversationDoc.id}', { category: 'AUTO_MIGRATED' });
    logger.info('- Customer Phone: ${data.customerPhone || 'N/A'}', { category: 'AUTO_MIGRATED' });
    logger.info('- Status: ${data.status || 'N/A'}', { category: 'AUTO_MIGRATED' });
    logger.info('- Participants Count: ${participants.length}', { category: 'AUTO_MIGRATED' });
    logger.info('- Participants: ${JSON.stringify(participants, null, 2)}', { category: 'AUTO_MIGRATED' });
    
    // Verificar si tiene los participantes por defecto
    const defaultViewers = getDefaultViewerEmails();
    logger.info('\n Viewers por defecto configurados:', { category: 'AUTO_MIGRATED' });
    logger.info('- Default Viewers: ${JSON.stringify(defaultViewers, null, 2)}', { category: 'AUTO_MIGRATED' });
    
    const hasDefaultViewers = defaultViewers.every(viewer => 
      participants.some(p => p.toLowerCase() === viewer.toLowerCase())
    );
    
    logger.info('\n Verificación de participantes:', { category: 'AUTO_MIGRATED' });
    logger.info('- Tiene participantes: ${participants.length > 0 ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    logger.info('- Tiene viewers por defecto: ${hasDefaultViewers ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return participants.length > 0 && hasDefaultViewers;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error verificando conversación:', error.message);
    return false;
  }
}

/**
 * Función para listar conversaciones recientes
 */
async function listRecentConversations(limit = 10) {
  try {
    logger.info('Listando las ${limit} conversaciones más recientes:', { category: 'AUTO_MIGRATED' });
    
    const snapshot = await db.collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    
    if (snapshot.empty) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ No se encontraron conversaciones' });
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
      logger.info('${index + 1}. ${conv.id}', { category: 'AUTO_MIGRATED' });
      logger.info('- Customer: ${conv.customerPhone}', { category: 'AUTO_MIGRATED' });
      logger.info('- Status: ${conv.status}', { category: 'AUTO_MIGRATED' });
      logger.info('- Participants: ${conv.participantsCount}', { category: 'AUTO_MIGRATED' });
      logger.info('- Has Participants: ${conv.hasParticipants ? '' : '❌'}', { category: 'AUTO_MIGRATED' });
      logger.info('- Updated: ${conv.updatedAt}', { category: 'AUTO_MIGRATED' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
    });
    
    return conversations;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error listando conversaciones:', error.message);
    return [];
  }
}

/**
 * Función para verificar configuración de viewers por defecto
 */
function checkDefaultViewersConfig() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Verificando configuración de viewers por defecto:' });
  
  const defaultViewers = getDefaultViewerEmails();
  logger.info('- DEFAULT_VIEWER_EMAILS: ${process.env.DEFAULT_VIEWER_EMAILS || 'No configurado'}', { category: 'AUTO_MIGRATED' });
  logger.info('- DEFAULT_AGENT_EMAIL: ${process.env.DEFAULT_AGENT_EMAIL || 'No configurado'}', { category: 'AUTO_MIGRATED' });
  logger.info('- Viewers resultantes: ${JSON.stringify(defaultViewers, null, 2)}', { category: 'AUTO_MIGRATED' });
  
  return defaultViewers;
}

/**
 * Función principal
 */
async function runTest() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 INICIANDO PRUEBA DE PARTICIPANTES' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=' .repeat(50));
  
  try {
    // 1. Verificar configuración
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n1️⃣ Verificando configuración...' });
    const defaultViewers = checkDefaultViewersConfig();
    
    if (defaultViewers.length === 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ ADVERTENCIA: No hay viewers por defecto configurados' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Esto puede causar problemas de permisos en las conversaciones' });
    }
    
    // 2. Listar conversaciones recientes
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2️⃣ Listando conversaciones recientes...' });
    const conversations = await listRecentConversations(5);
    
    if (conversations.length === 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ No hay conversaciones para verificar' });
      return;
    }
    
    // 3. Verificar participantes en las conversaciones más recientes
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3️⃣ Verificando participantes en conversaciones recientes...' });
    
    let conversationsWithParticipants = 0;
    let conversationsWithoutParticipants = 0;
    
    for (const conv of conversations) {
      const hasParticipants = await checkConversationParticipants(conv.id);
      
      if (hasParticipants) {
        conversationsWithParticipants++;
      } else {
        conversationsWithoutParticipants++;
      }
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' }); // Separador
    }
    
    // 4. Resumen
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 RESUMEN:' });
    logger.info('- Total de conversaciones verificadas: ${conversations.length}', { category: 'AUTO_MIGRATED' });
    logger.info('- Con participantes: ${conversationsWithParticipants}', { category: 'AUTO_MIGRATED' });
    logger.info('- Sin participantes: ${conversationsWithoutParticipants} ❌', { category: 'AUTO_MIGRATED' });
    
    if (conversationsWithoutParticipants > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ PROBLEMA DETECTADO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Algunas conversaciones no tienen la colección de participantes.' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Esto puede causar problemas de permisos de acceso.' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔧 SOLUCIÓN:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Ejecuta el script de backfill para agregar participantes:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   node scripts/backfill_add_viewers.js' });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ TODAS LAS CONVERSACIONES TIENEN PARTICIPANTES' });
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '\n❌ ERROR EN LA PRUEBA:', error.message);
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