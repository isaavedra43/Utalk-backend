const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Equipo/Herramienta asignado a un empleado
 * Estructura base: employees/{employeeId}/equipment/{itemId}
 * Movimientos: employees/{employeeId}/equipment/{itemId}/movements/{movementId}
 */
class EquipmentItem {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.code = data.code || '';
    this.serial = data.serial || '';
    this.type = data.type || '';
    this.subtype = data.subtype || '';
    this.name = data.name || '';
    this.brand = data.brand || '';
    this.model = data.model || '';
    this.specs = data.specs || '';
    this.assignedAt = data.assignedAt || null;
    this.dueAt = data.dueAt || null;
    this.returnedAt = data.returnedAt || null;
    this.status = data.status || 'assigned';
    this.value = data.value || null;
    this.currency = data.currency || 'MXN';
    this.notes = data.notes || '';
    this.attachments = Array.isArray(data.attachments) ? data.attachments : [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.createdBy = data.createdBy || null;
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.updatedBy = data.updatedBy || null;
  }

  validate() {
    const errors = [];
    if (!this.employeeId) errors.push('employeeId es requerido');
    if (!this.name && !this.code && !this.serial) errors.push('Debe incluir name o code o serial');
    if (!['assigned','returned','maintenance','lost','damaged','transferred'].includes(this.status)) {
      errors.push('Estado inválido');
    }
    return errors;
  }

  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      code: this.code,
      serial: this.serial,
      type: this.type,
      subtype: this.subtype,
      name: this.name,
      brand: this.brand,
      model: this.model,
      specs: this.specs,
      assignedAt: this.assignedAt,
      dueAt: this.dueAt,
      returnedAt: this.returnedAt,
      status: this.status,
      value: this.value,
      currency: this.currency,
      notes: this.notes,
      attachments: this.attachments,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };
  }

  static fromFirestore(doc) {
    return new EquipmentItem({ id: doc.id, ...doc.data() });
  }

  async save() {
    const errors = this.validate();
    if (errors.length) throw new Error(errors.join(', '));
    this.updatedAt = new Date().toISOString();
    const ref = db.collection('employees').doc(this.employeeId)
      .collection('equipment').doc(this.id);
    await ref.set(this.toFirestore());
    return this;
  }

  async update(data, updatedBy = null) {
    Object.assign(this, data);
    this.updatedBy = updatedBy || this.updatedBy;
    const errors = this.validate();
    if (errors.length) throw new Error(errors.join(', '));
    this.updatedAt = new Date().toISOString();
    const ref = db.collection('employees').doc(this.employeeId)
      .collection('equipment').doc(this.id);
    await ref.update(this.toFirestore());
    return this;
  }

  async delete() {
    const ref = db.collection('employees').doc(this.employeeId)
      .collection('equipment').doc(this.id);
    await ref.delete();
  }

  static async findById(employeeId, itemId) {
    const doc = await db.collection('employees').doc(employeeId)
      .collection('equipment').doc(itemId).get();
    if (!doc.exists) return null;
    return EquipmentItem.fromFirestore(doc);
  }

  static async listByEmployee(employeeId, { page = 1, limit = 20, status = null, type = null, search = null } = {}) {
    let query = db.collection('employees').doc(employeeId).collection('equipment');
    if (status) query = query.where('status', '==', status);
    if (type) query = query.where('type', '==', type);
    // Firestore no soporta búsquedas contains genéricas; el frontend puede filtrar por client-side si search
    query = query.orderBy('createdAt', 'desc');
    const snapshot = await query.get();
    const all = snapshot.docs.map(doc => EquipmentItem.fromFirestore(doc));
    const total = all.length;
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return { data, total };
  }

  async addMovement(movement) {
    // idempotencia
    if (movement.idempotencyKey) {
      const dupSnap = await db.collection('employees').doc(this.employeeId)
        .collection('equipment').doc(this.id)
        .collection('movements')
        .where('idempotencyKey', '==', movement.idempotencyKey)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        return dupSnap.docs[0].data();
      }
    }
    const toWrite = {
      id: movement.id || uuidv4(),
      type: movement.type,
      occurredAt: movement.occurredAt || new Date().toISOString(),
      notes: movement.notes || null,
      attachments: movement.attachments || [],
      createdAt: new Date().toISOString(),
      createdBy: movement.createdBy || null,
      idempotencyKey: movement.idempotencyKey || null
    };
    const ref = db.collection('employees').doc(this.employeeId)
      .collection('equipment').doc(this.id)
      .collection('movements').doc(toWrite.id);
    await ref.set(toWrite);
    return toWrite;
  }
}

module.exports = EquipmentItem;


