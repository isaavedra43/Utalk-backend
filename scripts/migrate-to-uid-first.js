// scripts/migrate-to-uid-first.js
/**
 * SCRIPT DE MIGRACIÓN A UID-FIRST
 *
 * IMPORTANTE:
 * 1. HACER UN BACKUP de Firestore antes de ejecutar este script.
 * 2. Ejecutar en un entorno de desarrollo/staging primero.
 * 3. El script está diseñado para ser idempotente (se puede ejecutar varias veces).
 *
 * ¿Qué hace este script?
 * 1. Migra la colección `conversations` a una estructura UID-first:
 *    - Reemplaza el ID basado en teléfonos por un UUID.
 *    - Elimina `agentPhone` y usa `assignedTo` (UID) como la única fuente de verdad.
 *    - Mueve los mensajes de la subcolección antigua a la nueva.
 * 2. No elimina los documentos antiguos por seguridad, solo los marca como migrados.
 *
 * CÓMO EJECUTAR:
 * node scripts/migrate-to-uid-first.js
 */

const { firestore } = require('../src/config/firebase');
const { v4: uuidv4 } = require('uuid');
const User = require('../src/models/User');

const BATCH_SIZE = 50;

// Función para mapear un teléfono a un UID de usuario.
async function getUidFromPhone(phone) {
    if (!phone) return null;
    // Usamos el método del modelo User que ya tiene la lógica de normalización.
    return await User.findUidByPhone(phone);
}

// Función para migrar un lote de documentos.
async function migrateBatch(querySnapshot) {    
    if (querySnapshot.empty) {
        console.log("No hay conversaciones que necesiten migración en este lote.");
        return 0;
    }

    const batch = firestore.batch();
    let migratedCount = 0;

    for (const doc of querySnapshot.docs) {
        const oldData = doc.data();
        const oldId = doc.id;

        console.log(`\nProcesando conversación antigua: ${oldId}...`);

        // 1. Generar nuevo ID (UUID).
        const newId = uuidv4();
        const newConvRef = firestore.collection('conversations').doc(newId);

        // 2. Mapear `agentPhone` a `agentUid`.
        const agentUid = await getUidFromPhone(oldData.agentPhone);

        // 3. Crear la nueva estructura de la conversación.
        const newConvData = {
            id: newId,
            customerPhone: oldData.customerPhone,
            assignedTo: oldData.assignedTo || agentUid,
            participants: [oldData.customerPhone, agentUid].filter(Boolean),
            status: oldData.status || 'open',
            createdAt: oldData.createdAt,
            updatedAt: oldData.updatedAt,
            lastMessage: oldData.lastMessage || null,
            // ... (copiar otros campos relevantes)
            migrationMeta: {
                migratedAt: new Date(),
                originalId: oldId,
            }
        };
        
        batch.set(newConvRef, newConvData);
        console.log(`  -> Preparado nuevo documento de conversación: ${newId}`);

        // 4. Mover mensajes de la subcolección.
        const messagesSnapshot = await doc.ref.collection('messages').get();
        if (!messagesSnapshot.empty) {
            console.log(`  -> Migrando ${messagesSnapshot.size} mensajes...`);
            messagesSnapshot.forEach(msgDoc => {
                const msgData = msgDoc.data();
                const newMsgRef = newConvRef.collection('messages').doc(msgDoc.id);
                
                // Actualizar identificadores en el mensaje
                msgData.conversationId = newId;
                msgData.senderIdentifier = msgData.senderPhone || msgData.sender;
                msgData.recipientIdentifier = msgData.recipientPhone || msgData.recipient;

                batch.set(newMsgRef, msgData);
            });
        }

        // 5. Marcar la conversación antigua como migrada.
        batch.update(doc.ref, { 'migrationMeta.migratedToId': newId, 'migrationMeta.status': 'migrated' });
        console.log(`  -> Marcada conversación antigua como migrada.`);
        
        migratedCount++;
    }

    await batch.commit();
    console.log(`\nLote completado. ${migratedCount} conversaciones migradas.`);
    return migratedCount;
}

async function main() {
    console.log("Iniciando migración de conversaciones a UID-FIRST...");
    
    const conversationsRef = firestore.collection('conversations');
    let totalMigrated = 0;

    while (true) {
        // Buscamos conversaciones que NO hayan sido migradas.
        const query = conversationsRef
            .where('migrationMeta.status', '!=', 'migrated')
            .limit(BATCH_SIZE);
        
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log("No quedan más conversaciones por migrar.");
            break;
        }

        const migratedInBatch = await migrateBatch(snapshot);
        totalMigrated += migratedInBatch;
        
        if (migratedInBatch < BATCH_SIZE) {
            // Si procesamos menos que el tamaño del lote, probablemente hemos terminado.
            break;
        }
    }

    console.log(`\n--- MIGRACIÓN COMPLETADA ---`);
    console.log(`Total de conversaciones migradas: ${totalMigrated}`);
    console.log("----------------------------");
}

main().catch(error => {
    console.error("Error durante la migración:", error);
    process.exit(1);
}); 