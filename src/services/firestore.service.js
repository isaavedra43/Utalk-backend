const admin = require('firebase-admin');
const db = admin.firestore();

exports.saveIncoming = (msg) => {
  return db.collection('messages').add({
    ...msg,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
};

exports.saveOutgoing = (msg) => {
  return db.collection('messages').add({
    ...msg,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
};

exports.getLastMessages = (limit) => {
  return db.collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
    .then(snapshot => snapshot.docs.map(doc => doc.data()));
};
