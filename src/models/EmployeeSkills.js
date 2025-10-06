const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

// Utilidad para idempotencia en POST
async function checkIdempotent(ref, idempotencyKey) {
  if (!idempotencyKey) return null;
  const snap = await ref.where('idempotencyKey', '==', idempotencyKey).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

class EmployeeSkillsModel {
  static async list(employeeId, collection, { page = 1, limit = 20, orderBy = 'createdAt', order = 'desc' } = {}) {
    const ref = db.collection('employees').doc(employeeId).collection(collection);
    const snap = await ref.orderBy(orderBy, order).get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total = all.length;
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return { data, total };
  }

  static async create(employeeId, collection, payload, userId, idempotencyKey) {
    const colRef = db.collection('employees').doc(employeeId).collection(collection);
    const existing = await checkIdempotent(colRef, idempotencyKey);
    if (existing) return { existing, idempotent: true };

    const id = uuidv4();
    const now = new Date().toISOString();
    const data = { ...payload, id, createdAt: now, createdBy: userId || 'system', updatedAt: now, updatedBy: userId || 'system', idempotencyKey: idempotencyKey || null };
    await colRef.doc(id).set(data);
    return { data, idempotent: false };
  }

  static async update(employeeId, collection, id, patch, userId) {
    const ref = db.collection('employees').doc(employeeId).collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const now = new Date().toISOString();
    const data = { ...doc.data(), ...patch, updatedAt: now, updatedBy: userId || 'system' };
    await ref.update(data);
    return data;
  }

  static async remove(employeeId, collection, id) {
    const ref = db.collection('employees').doc(employeeId).collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  static async summary(employeeId, { expiringInDays = 60 } = {}) {
    const skillsSnap = await db.collection('employees').doc(employeeId).collection('skills').get();
    const totalSkills = skillsSnap.size;
    const byLevel = {};
    skillsSnap.forEach(d => { const lv = d.data().level; if (lv) byLevel[lv] = (byLevel[lv] || 0) + 1; });

    const certsSnap = await db.collection('employees').doc(employeeId).collection('skills_certifications').get();
    const totalCertifications = certsSnap.size;
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + expiringInDays);
    let expiringCertifications = 0;
    certsSnap.forEach(d => {
      const c = d.data();
      if (c.expiryDate) {
        const exp = new Date(c.expiryDate);
        if (exp >= now && exp <= threshold) expiringCertifications += 1;
      }
    });

    const plansSnap = await db.collection('employees').doc(employeeId).collection('skills_development_plans').where('status', '==', 'active').get();
    const activePlans = plansSnap.size;

    const evalSnap = await db.collection('employees').doc(employeeId).collection('skills_evaluations').orderBy('evaluatedAt', 'desc').limit(1).get();
    const lastEvaluationAt = evalSnap.empty ? null : evalSnap.docs[0].data().evaluatedAt;

    return { totalSkills, byLevel, totalCertifications, expiringCertifications, activePlans, lastEvaluationAt };
  }
}

module.exports = EmployeeSkillsModel;


