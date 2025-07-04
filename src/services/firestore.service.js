const admin = require('firebase-admin');
const db = admin.firestore();

exports.saveIncoming = (sid, from, body) => {
  return db.collection('messages').add({
    sid,
    from,
    body,
    direction: 'in',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
};

exports.saveOutgoing = (sid, from, to, body) => {
  return db.collection('messages').add({
    sid,
    from,
    to,
    body,
    direction: 'out',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
};

exports.fetchRecent = async (limit = 50) => {
  const snap = await db.collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(doc => doc.data());
};
