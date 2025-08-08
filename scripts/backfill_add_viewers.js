"use strict";

const admin = require('firebase-admin');
const { getDefaultViewerEmails } = require('../src/config/defaultViewers');

if (!admin.apps.length) {
  // Usa credenciales por GOOGLE_APPLICATION_CREDENTIALS o default creds del entorno
  admin.initializeApp();
}
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN !== 'false'; // true por defecto
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '300', 10);

(async () => {
  const viewers = getDefaultViewerEmails().map(v => v.toLowerCase());
  const colName = process.env.CONVERSATIONS_COLLECTION_PATH || 'conversations';
  const col = db.collection(colName);

  let cursor = null, touched = 0, unchanged = 0, errored = 0, batches = 0;

  while (true) {
    let q = col.orderBy('updatedAt', 'desc').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      try {
        const data = doc.data() || {};
        const parts = Array.isArray(data.participants)
          ? data.participants.map(x => String(x || '').toLowerCase())
          : [];
        const missing = viewers.filter(v => !parts.includes(v));
        if (missing.length) {
          if (!DRY_RUN) {
            batch.update(doc.ref, {
              participants: admin.firestore.FieldValue.arrayUnion(...missing)
            });
          }
          touched++; batchCount++;
        } else {
          unchanged++;
        }
      } catch (e) {
        errored++;
        // No PII
        console.error(JSON.stringify({ event: 'backfill.error', id: doc.id, msg: e.message }));
      }
    }

    if (!DRY_RUN && batchCount) await batch.commit();
    batches++;
    cursor = snap.docs[snap.docs.length - 1];
  }

  console.log(JSON.stringify({ event: 'backfill.viewers.done', DRY_RUN, BATCH_SIZE, touched, unchanged, errored, batches }));
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); }); 