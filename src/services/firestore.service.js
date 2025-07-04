// src/services/firestore.service.js
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Guarda un mensaje entrante en Firestore.
 * @param {{ sid: string, from: string, body: string, timestamp?: FirebaseFirestore.FieldValue }} data
 */
async function saveIncomingMessage({ sid, from, body, timestamp }) {
  return db.collection('messages').add({
    sid,
    from,
    body,
    direction: 'in',
    timestamp: timestamp || admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Guarda un mensaje saliente en Firestore.
 * @param {{ sid: string, from: string, to: string, body: string, timestamp?: FirebaseFirestore.FieldValue }} data
 */
async function saveOutgoingMessage({ sid, from, to, body, timestamp }) {
  return db.collection('messages').add({
    sid,
    from,
    to,
    body,
    direction: 'out',
    timestamp: timestamp || admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Recupera los últimos mensajes ordenados por timestamp descendente.
 * @param {number} [limit=50]
 * @returns {Promise<Array<Object>>}
 */
async function listLastMessages(limit = 50) {
  const snapshot = await db
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

module.exports = {
  saveIncomingMessage,
  saveOutgoingMessage,
  listLastMessages
};
