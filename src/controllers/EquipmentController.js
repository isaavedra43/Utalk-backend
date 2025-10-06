const EquipmentItem = require('../models/EquipmentItem');
const { db } = require('../config/firebase');

class EquipmentController {
  static async list(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, limit = 20, status = null, type = null, search = null } = req.query;
      const { data, total } = await EquipmentItem.listByEmployee(employeeId, { page: Number(page), limit: Number(limit), status, type, search });
      return res.json({
        success: true,
        data: data.map(i => i.toFirestore()),
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) }
      });
    } catch (error) {
      console.error('Error listing equipment:', error);
      return res.status(500).json({ success: false, error: 'Error al listar equipo', details: error.message });
    }
  }

  static async summary(req, res) {
    try {
      const { id: employeeId } = req.params;
      const snapshot = await db.collection('employees').doc(employeeId).collection('equipment').get();
      if (snapshot.empty) {
        return res.json({ success: true, data: { total: 0, byStatus: {}, byType: {}, pendingReturns: 0, lostOrDamaged: 0 } });
      }
      const now = new Date().toISOString();
      const byStatus = {};
      const byType = {};
      let total = 0;
      let pendingReturns = 0;
      let lostOrDamaged = 0;
      let lastMovementAt = null;

      for (const doc of snapshot.docs) {
        const item = doc.data();
        total += 1;
        byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        if (item.type) byType[item.type] = (byType[item.type] || 0) + 1;
        if (item.status === 'assigned' && item.dueAt && item.dueAt < now) pendingReturns += 1;
        if (item.status === 'lost' || item.status === 'damaged') lostOrDamaged += 1;
        // buscar último movimiento por item
        const movSnap = await db.collection('employees').doc(employeeId).collection('equipment').doc(item.id).collection('movements').orderBy('occurredAt', 'desc').limit(1).get();
        if (!movSnap.empty) {
          const lm = movSnap.docs[0].data().occurredAt;
          if (!lastMovementAt || lm > lastMovementAt) lastMovementAt = lm;
        }
      }

      return res.json({ success: true, data: { total, byStatus, byType, pendingReturns, lostOrDamaged, lastMovementAt } });
    } catch (error) {
      console.error('Error getting equipment summary:', error);
      return res.json({ success: true, data: { total: 0, byStatus: {}, byType: {}, pendingReturns: 0, lostOrDamaged: 0 } });
    }
  }

  static async assign(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { item, movement = {}, idempotencyKey } = req.body;

      // validar duplicado activo por serial
      if (item?.serial) {
        const dupSnap = await db.collection('employees').doc(employeeId).collection('equipment')
          .where('serial', '==', item.serial).where('status', '==', 'assigned').limit(1).get();
        if (!dupSnap.empty) {
          return res.status(409).json({ success: false, error: 'Ya existe un equipo asignado con el mismo serial para este empleado' });
        }
      }

      const equipment = new EquipmentItem({ ...item, employeeId, status: 'assigned', assignedAt: new Date().toISOString() });
      await equipment.save();

      // movimiento assign con idempotencia
      await equipment.addMovement({ type: 'assign', notes: movement.notes, attachments: movement.attachments || [], idempotencyKey: idempotencyKey || req.headers['idempotency-key'], createdBy: req.user?.id || 'system' });

      return res.status(201).json({ success: true, data: equipment.toFirestore() });
    } catch (error) {
      console.error('Error assigning equipment:', error);
      return res.status(500).json({ success: false, error: 'Error al asignar equipo', details: error.message });
    }
  }

  static async addMovement(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { itemId, type, details, attachments, idempotencyKey } = req.body;
      const item = await EquipmentItem.findById(employeeId, itemId);
      if (!item) return res.status(404).json({ success: false, error: 'Item no encontrado' });

      // máquina de estados
      const transitions = {
        assigned: ['returned','maintenance','lost','damaged','transferred'],
        maintenance: ['assigned','damaged'],
        returned: []
      };
      const next = type === 'return' ? 'returned' : (type === 'maintenance' ? 'maintenance' : (type === 'assign' ? 'assigned' : (type === 'lost' ? 'lost' : (type === 'damage' ? 'damaged' : (type === 'transfer' ? 'transferred' : item.status)))));
      if (transitions[item.status] && !transitions[item.status].includes(next) && next !== item.status) {
        return res.status(422).json({ success: false, error: 'Transición de estado inválida' });
      }

      const movement = await item.addMovement({ type, notes: details, attachments: attachments || [], idempotencyKey: idempotencyKey || req.headers['idempotency-key'], createdBy: req.user?.id || 'system' });

      // actualizar estado
      const patch = {};
      if (type === 'return') { patch.status = 'returned'; patch.returnedAt = new Date().toISOString(); }
      else if (type === 'maintenance') { patch.status = 'maintenance'; }
      else if (type === 'assign') { patch.status = 'assigned'; patch.assignedAt = new Date().toISOString(); }
      else if (type === 'lost') { patch.status = 'lost'; }
      else if (type === 'damage') { patch.status = 'damaged'; }
      else if (type === 'transfer') { patch.status = 'transferred'; }

      if (Object.keys(patch).length > 0) {
        await item.update(patch, req.user?.id || 'system');
      }

      return res.status(201).json({ success: true, data: movement });
    } catch (error) {
      console.error('Error adding equipment movement:', error);
      return res.status(500).json({ success: false, error: 'Error al registrar movimiento', details: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id: employeeId, itemId } = req.params;
      const item = await EquipmentItem.findById(employeeId, itemId);
      if (!item) return res.status(404).json({ success: false, error: 'Item no encontrado' });
      await item.update(req.body, req.user?.id || 'system');
      return res.json({ success: true, data: item.toFirestore() });
    } catch (error) {
      console.error('Error updating equipment:', error);
      return res.status(500).json({ success: false, error: 'Error al actualizar equipo', details: error.message });
    }
  }

  static async returnItem(req, res) {
    try {
      const { id: employeeId, itemId } = req.params;
      const { condition = 'ok', notes, attachments, idempotencyKey } = req.body;
      const item = await EquipmentItem.findById(employeeId, itemId);
      if (!item) return res.status(404).json({ success: false, error: 'Item no encontrado' });
      if (item.status === 'returned') return res.json({ success: true, data: item.toFirestore() });

      await item.addMovement({ type: 'return', notes: `condition:${condition}${notes ? ' - ' + notes : ''}`, attachments: attachments || [], idempotencyKey: idempotencyKey || req.headers['idempotency-key'], createdBy: req.user?.id || 'system' });
      await item.update({ status: 'returned', returnedAt: new Date().toISOString() }, req.user?.id || 'system');
      return res.json({ success: true, data: item.toFirestore() });
    } catch (error) {
      console.error('Error returning equipment:', error);
      return res.status(500).json({ success: false, error: 'Error al devolver equipo', details: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const { id: employeeId, itemId } = req.params;
      const item = await EquipmentItem.findById(employeeId, itemId);
      if (!item) return res.status(404).json({ success: false, error: 'Item no encontrado' });
      await item.delete();
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      return res.status(500).json({ success: false, error: 'Error al eliminar equipo', details: error.message });
    }
  }
}

module.exports = EquipmentController;
