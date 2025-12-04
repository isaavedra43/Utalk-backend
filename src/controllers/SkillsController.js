const EmployeeSkills = require('../models/EmployeeSkills');

class SkillsController {
  // -------- SKILLS --------
  static async listSkills(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const { data, total } = await EmployeeSkills.list(employeeId, 'skills', { page: Number(page), limit: Number(limit) });
      return res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
    } catch (error) {
      console.error('Error listing skills:', error);
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  }
  static async createSkill(req, res) {
    try {
      const { id: employeeId } = req.params;
      const idk = req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
      const body = req.body || {};
      // Validaciones mínimas
      const levels = ['beginner','intermediate','advanced','expert'];
      if (body.level && !levels.includes(body.level)) return res.status(400).json({ success: false, error: 'Nivel inválido' });
      const result = await EmployeeSkills.create(employeeId, 'skills', body, req.user?.id || 'system', idk);
      if (result.idempotent) return res.json({ success: true, data: result.existing });
      return res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error creating skill:', error);
      return res.status(500).json({ success: false, error: 'Error al crear skill', details: error.message });
    }
  }
  static async updateSkill(req, res) {
    try {
      const { id: employeeId, skillId } = req.params;
      const levels = ['beginner','intermediate','advanced','expert'];
      if (req.body.level && !levels.includes(req.body.level)) return res.status(400).json({ success: false, error: 'Nivel inválido' });
      const data = await EmployeeSkills.update(employeeId, 'skills', skillId, req.body, req.user?.id || 'system');
      if (!data) return res.status(404).json({ success: false, error: 'Skill no encontrada' });
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error updating skill:', error);
      return res.status(500).json({ success: false, error: 'Error al actualizar skill', details: error.message });
    }
  }
  static async deleteSkill(req, res) {
    try {
      const { id: employeeId, skillId } = req.params;
      const ok = await EmployeeSkills.remove(employeeId, 'skills', skillId);
      if (!ok) return res.status(404).json({ success: false, error: 'Skill no encontrada' });
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting skill:', error);
      return res.status(500).json({ success: false, error: 'Error al eliminar skill', details: error.message });
    }
  }

  // -------- CERTIFICATIONS --------
  static async listCertifications(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const { data, total } = await EmployeeSkills.list(employeeId, 'skills_certifications', { page: Number(page), limit: Number(limit) });
      // Marcar expiradas
      const now = new Date();
      data.forEach(c => { if (c.expiryDate && new Date(c.expiryDate) < now) c.status = 'expired'; });
      return res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
    } catch (error) {
      console.error('Error listing certifications:', error);
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  }
  static async createCertification(req, res) {
    try {
      const { id: employeeId } = req.params;
      const idk = req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
      const body = req.body || {};
      if (body.issueDate && body.expiryDate && new Date(body.issueDate) > new Date(body.expiryDate)) {
        return res.status(400).json({ success: false, error: 'issueDate debe ser <= expiryDate' });
      }
      const result = await EmployeeSkills.create(employeeId, 'skills_certifications', { status: 'active', ...body }, req.user?.id || 'system', idk);
      return res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error creating certification:', error);
      return res.status(500).json({ success: false, error: 'Error al crear certificación', details: error.message });
    }
  }
  static async updateCertification(req, res) {
    try {
      const { id: employeeId, certId } = req.params;
      const body = req.body || {};
      if (body.issueDate && body.expiryDate && new Date(body.issueDate) > new Date(body.expiryDate)) {
        return res.status(400).json({ success: false, error: 'issueDate debe ser <= expiryDate' });
      }
      const data = await EmployeeSkills.update(employeeId, 'skills_certifications', certId, body, req.user?.id || 'system');
      if (!data) return res.status(404).json({ success: false, error: 'Certificación no encontrada' });
      // Actualizar status según expiración
      if (data.expiryDate && new Date(data.expiryDate) < new Date()) data.status = 'expired';
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error updating certification:', error);
      return res.status(500).json({ success: false, error: 'Error al actualizar certificación', details: error.message });
    }
  }
  static async deleteCertification(req, res) {
    try {
      const { id: employeeId, certId } = req.params;
      const ok = await EmployeeSkills.remove(employeeId, 'skills_certifications', certId);
      if (!ok) return res.status(404).json({ success: false, error: 'Certificación no encontrada' });
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting certification:', error);
      return res.status(500).json({ success: false, error: 'Error al eliminar certificación', details: error.message });
    }
  }

  // -------- DEVELOPMENT PLANS --------
  static async listPlans(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const { data, total } = await EmployeeSkills.list(employeeId, 'skills_development_plans', { page: Number(page), limit: Number(limit) });
      return res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
    } catch (error) {
      console.error('Error listing development plans:', error);
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  }
  static async createPlan(req, res) {
    try {
      const { id: employeeId } = req.params;
      const idk = req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
      const body = req.body || {};
      const result = await EmployeeSkills.create(employeeId, 'skills_development_plans', body, req.user?.id || 'system', idk);
      return res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error creating development plan:', error);
      return res.status(500).json({ success: false, error: 'Error al crear plan', details: error.message });
    }
  }
  static async updatePlan(req, res) {
    try {
      const { id: employeeId, planId } = req.params;
      const data = await EmployeeSkills.update(employeeId, 'skills_development_plans', planId, req.body, req.user?.id || 'system');
      if (!data) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error updating development plan:', error);
      return res.status(500).json({ success: false, error: 'Error al actualizar plan', details: error.message });
    }
  }
  static async deletePlan(req, res) {
    try {
      const { id: employeeId, planId } = req.params;
      const ok = await EmployeeSkills.remove(employeeId, 'skills_development_plans', planId);
      if (!ok) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting development plan:', error);
      return res.status(500).json({ success: false, error: 'Error al eliminar plan', details: error.message });
    }
  }

  // -------- EVALUATIONS --------
  static async listEvaluations(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const { data, total } = await EmployeeSkills.list(employeeId, 'skills_evaluations', { page: Number(page), limit: Number(limit), orderBy: 'evaluatedAt', order: 'desc' });
      return res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
    } catch (error) {
      console.error('Error listing skill evaluations:', error);
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  }
  static async createEvaluation(req, res) {
    try {
      const { id: employeeId } = req.params;
      const idk = req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
      const body = req.body || {};
      if (!['percent','five'].includes(body.scale)) return res.status(400).json({ success: false, error: 'scale inválido' });
      if (body.scale === 'percent' && (body.score < 0 || body.score > 100)) return res.status(400).json({ success: false, error: 'score fuera de rango' });
      if (body.scale === 'five' && (body.score < 1 || body.score > 5)) return res.status(400).json({ success: false, error: 'score fuera de rango' });
      const result = await EmployeeSkills.create(employeeId, 'skills_evaluations', body, req.user?.id || 'system', idk);
      return res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error creating skill evaluation:', error);
      return res.status(500).json({ success: false, error: 'Error al crear evaluación', details: error.message });
    }
  }
  static async updateEvaluation(req, res) {
    try {
      const { id: employeeId, evaluationId } = req.params;
      const body = req.body || {};
      if (body.scale && !['percent','five'].includes(body.scale)) return res.status(400).json({ success: false, error: 'scale inválido' });
      if (body.scale === 'percent' && (body.score < 0 || body.score > 100)) return res.status(400).json({ success: false, error: 'score fuera de rango' });
      if (body.scale === 'five' && (body.score < 1 || body.score > 5)) return res.status(400).json({ success: false, error: 'score fuera de rango' });
      const data = await EmployeeSkills.update(employeeId, 'skills_evaluations', evaluationId, body, req.user?.id || 'system');
      if (!data) return res.status(404).json({ success: false, error: 'Evaluación no encontrada' });
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error updating evaluation:', error);
      return res.status(500).json({ success: false, error: 'Error al actualizar evaluación', details: error.message });
    }
  }
  static async deleteEvaluation(req, res) {
    try {
      const { id: employeeId, evaluationId } = req.params;
      const ok = await EmployeeSkills.remove(employeeId, 'skills_evaluations', evaluationId);
      if (!ok) return res.status(404).json({ success: false, error: 'Evaluación no encontrada' });
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting evaluation:', error);
      return res.status(500).json({ success: false, error: 'Error al eliminar evaluación', details: error.message });
    }
  }

  // -------- SUMMARY --------
  static async summary(req, res) {
    try {
      const { id: employeeId } = req.params;
      const data = await EmployeeSkills.summary(employeeId);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting skills summary:', error);
      return res.json({ success: true, data: { totalSkills: 0, byLevel: {}, totalCertifications: 0, expiringCertifications: 0, activePlans: 0, lastEvaluationAt: null } });
    }
  }
}

module.exports = SkillsController;


