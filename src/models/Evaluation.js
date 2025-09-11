const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Evaluación de Empleado
 * Gestiona las evaluaciones de desempeño y competencias
 */
class Evaluation {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.type = data.type || 'annual'; // 'annual' | 'quarterly' | 'monthly' | 'performance' | 'objectives' | 'competencies'
    this.period = data.period || '';
    this.evaluatorId = data.evaluatorId || '';
    this.overallScore = data.overallScore || 0;
    this.status = data.status || 'draft'; // 'draft' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'archived'
    this.feedback = data.feedback || '';
    this.strengths = data.strengths || [];
    this.areasForImprovement = data.areasForImprovement || [];
    this.goals = data.goals || [];
    this.completedAt = data.completedAt || null;
    this.approvedAt = data.approvedAt || null;
    this.approvedBy = data.approvedBy || null;
    this.rejectionReason = data.rejectionReason || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Obtiene los tipos de evaluación disponibles
   */
  static getEvaluationTypes() {
    return {
      annual: {
        name: 'Anual',
        description: 'Evaluación anual completa de desempeño',
        frequency: 'yearly',
        duration: '365 days'
      },
      quarterly: {
        name: 'Trimestral',
        description: 'Evaluación trimestral de objetivos',
        frequency: 'quarterly',
        duration: '90 days'
      },
      monthly: {
        name: 'Mensual',
        description: 'Revisión mensual de progreso',
        frequency: 'monthly',
        duration: '30 days'
      },
      performance: {
        name: 'Desempeño',
        description: 'Evaluación específica de desempeño',
        frequency: 'as_needed',
        duration: 'variable'
      },
      objectives: {
        name: 'Objetivos',
        description: 'Evaluación de cumplimiento de objetivos',
        frequency: 'as_needed',
        duration: 'variable'
      },
      competencies: {
        name: 'Competencias',
        description: 'Evaluación de habilidades y competencias',
        frequency: 'as_needed',
        duration: 'variable'
      }
    };
  }

  /**
   * Calcula el puntaje promedio de objetivos y competencias
   */
  async calculateOverallScore() {
    try {
      const objectives = await Objective.listByEvaluation(this.employeeId, this.id);
      const competencies = await Competency.listByEvaluation(this.employeeId, this.id);
      
      let totalScore = 0;
      let totalWeight = 0;
      
      // Calcular puntaje de objetivos (peso 60%)
      if (objectives.length > 0) {
        const objectiveScore = objectives.reduce((sum, obj) => sum + (obj.progress * obj.weight), 0);
        const objectiveWeight = objectives.reduce((sum, obj) => sum + obj.weight, 0);
        
        if (objectiveWeight > 0) {
          totalScore += (objectiveScore / objectiveWeight) * 0.6;
          totalWeight += 0.6;
        }
      }
      
      // Calcular puntaje de competencias (peso 40%)
      if (competencies.length > 0) {
        const competencyScore = competencies.reduce((sum, comp) => sum + comp.score, 0);
        const competencyAvg = competencyScore / competencies.length;
        
        totalScore += (competencyAvg / 5) * 0.4; // Normalizar a escala 0-1
        totalWeight += 0.4;
      }
      
      // Normalizar a escala 1-5
      this.overallScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 5 * 10) / 10 : 0;
      
      return this.overallScore;
    } catch (error) {
      console.error('Error calculating overall score:', error);
      return this.overallScore;
    }
  }

  /**
   * Valida los datos de la evaluación
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.evaluatorId) {
      errors.push('El ID del evaluador es requerido');
    }

    const validTypes = Object.keys(Evaluation.getEvaluationTypes());
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de evaluación no es válido');
    }

    if (!this.period) {
      errors.push('El período de evaluación es requerido');
    }

    const validStatuses = ['draft', 'in_progress', 'completed', 'approved', 'rejected', 'archived'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado de la evaluación no es válido');
    }

    if (this.overallScore < 0 || this.overallScore > 5) {
      errors.push('El puntaje general debe estar entre 0 y 5');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      type: this.type,
      period: this.period,
      evaluatorId: this.evaluatorId,
      overallScore: this.overallScore,
      status: this.status,
      feedback: this.feedback,
      strengths: this.strengths,
      areasForImprovement: this.areasForImprovement,
      goals: this.goals,
      completedAt: this.completedAt,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una evaluación desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new Evaluation({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la evaluación en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('evaluations').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving evaluation:', error);
      throw error;
    }
  }

  /**
   * Actualiza la evaluación
   */
  async update(data) {
    try {
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('evaluations').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating evaluation:', error);
      throw error;
    }
  }

  /**
   * Completa la evaluación
   */
  async complete() {
    try {
      await this.calculateOverallScore();
      
      this.status = 'completed';
      this.completedAt = new Date().toISOString();
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error completing evaluation:', error);
      throw error;
    }
  }

  /**
   * Aprueba la evaluación
   */
  async approve(approvedBy) {
    try {
      if (this.status !== 'completed') {
        throw new Error('Solo se pueden aprobar evaluaciones completadas');
      }
      
      this.status = 'approved';
      this.approvedBy = approvedBy;
      this.approvedAt = new Date().toISOString();
      this.rejectionReason = null;
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error approving evaluation:', error);
      throw error;
    }
  }

  /**
   * Rechaza la evaluación
   */
  async reject(rejectedBy, reason) {
    try {
      this.status = 'rejected';
      this.approvedBy = rejectedBy;
      this.rejectionReason = reason;
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error rejecting evaluation:', error);
      throw error;
    }
  }

  /**
   * Busca una evaluación por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('evaluations').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return Evaluation.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding evaluation by ID:', error);
      throw error;
    }
  }

  /**
   * Lista evaluaciones de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        type = null,
        status = null,
        year = null,
        page = 1,
        limit = 20
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('evaluations');

      // Filtros
      if (type) {
        query = query.where('type', '==', type);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query.where('createdAt', '>=', startOfYear)
                     .where('createdAt', '<=', endOfYear);
      }

      // Ordenamiento
      query = query.orderBy('createdAt', 'desc');

      // Paginación
      const offset = (page - 1) * limit;
      if (offset > 0) {
        const offsetSnapshot = await query.limit(offset).get();
        if (!offsetSnapshot.empty) {
          const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      const evaluations = [];

      snapshot.forEach(doc => {
        evaluations.push(Evaluation.fromFirestore(doc));
      });

      return evaluations;
    } catch (error) {
      console.error('Error listing evaluations:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de evaluaciones de un empleado
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('evaluations').get();

      const summary = {
        totalEvaluations: 0,
        averageScore: 0,
        completedEvaluations: 0,
        pendingEvaluations: 0,
        byType: {},
        byStatus: {},
        lastEvaluation: null,
        scoreHistory: []
      };

      let totalScore = 0;
      let scoredEvaluations = 0;
      let lastEvaluationDate = null;

      snapshot.forEach(doc => {
        const evaluation = doc.data();
        
        summary.totalEvaluations++;
        
        // Contar por tipo
        summary.byType[evaluation.type] = (summary.byType[evaluation.type] || 0) + 1;
        
        // Contar por estado
        summary.byStatus[evaluation.status] = (summary.byStatus[evaluation.status] || 0) + 1;
        
        // Evaluaciones completadas
        if (['completed', 'approved'].includes(evaluation.status)) {
          summary.completedEvaluations++;
        } else {
          summary.pendingEvaluations++;
        }
        
        // Puntaje promedio
        if (evaluation.overallScore > 0) {
          totalScore += evaluation.overallScore;
          scoredEvaluations++;
          
          // Historial de puntajes
          summary.scoreHistory.push({
            date: evaluation.createdAt,
            score: evaluation.overallScore,
            type: evaluation.type
          });
        }
        
        // Última evaluación
        if (!lastEvaluationDate || evaluation.createdAt > lastEvaluationDate) {
          lastEvaluationDate = evaluation.createdAt;
          summary.lastEvaluation = evaluation;
        }
      });

      // Calcular promedio
      if (scoredEvaluations > 0) {
        summary.averageScore = Math.round((totalScore / scoredEvaluations) * 10) / 10;
      }

      // Ordenar historial por fecha
      summary.scoreHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

      return summary;
    } catch (error) {
      console.error('Error getting evaluation summary:', error);
      throw error;
    }
  }
}

/**
 * Modelo de Objetivo de Evaluación
 */
class Objective {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.evaluationId = data.evaluationId || '';
    this.employeeId = data.employeeId || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.targetDate = data.targetDate || '';
    this.status = data.status || 'not_started'; // 'not_started' | 'in_progress' | 'completed' | 'exceeded' | 'not_met'
    this.progress = data.progress || 0; // 0-100
    this.weight = data.weight || 1; // Peso del objetivo
    this.actualResult = data.actualResult || null;
    this.notes = data.notes || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Guarda el objetivo en Firebase
   */
  async save() {
    const docRef = db.collection('employees').doc(this.employeeId)
      .collection('evaluations').doc(this.evaluationId)
      .collection('objectives').doc(this.id);
    
    await docRef.set(this.toFirestore());
    return this;
  }

  /**
   * Lista objetivos de una evaluación
   */
  static async listByEvaluation(employeeId, evaluationId) {
    const snapshot = await db.collection('employees').doc(employeeId)
      .collection('evaluations').doc(evaluationId)
      .collection('objectives')
      .orderBy('createdAt')
      .get();

    const objectives = [];
    snapshot.forEach(doc => {
      objectives.push(new Objective({ id: doc.id, ...doc.data() }));
    });

    return objectives;
  }

  toFirestore() {
    return {
      id: this.id,
      evaluationId: this.evaluationId,
      employeeId: this.employeeId,
      title: this.title,
      description: this.description,
      targetDate: this.targetDate,
      status: this.status,
      progress: this.progress,
      weight: this.weight,
      actualResult: this.actualResult,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Modelo de Competencia de Evaluación
 */
class Competency {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.evaluationId = data.evaluationId || '';
    this.employeeId = data.employeeId || '';
    this.name = data.name || '';
    this.level = data.level || 'beginner'; // 'beginner' | 'intermediate' | 'advanced' | 'expert'
    this.score = data.score || 0; // 1-5
    this.evidence = data.evidence || '';
    this.developmentPlan = data.developmentPlan || '';
    this.resources = data.resources || [];
    this.lastEvaluated = data.lastEvaluated || new Date().toISOString();
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Guarda la competencia en Firebase
   */
  async save() {
    const docRef = db.collection('employees').doc(this.employeeId)
      .collection('evaluations').doc(this.evaluationId)
      .collection('competencies').doc(this.id);
    
    await docRef.set(this.toFirestore());
    return this;
  }

  /**
   * Lista competencias de una evaluación
   */
  static async listByEvaluation(employeeId, evaluationId) {
    const snapshot = await db.collection('employees').doc(employeeId)
      .collection('evaluations').doc(evaluationId)
      .collection('competencies')
      .orderBy('name')
      .get();

    const competencies = [];
    snapshot.forEach(doc => {
      competencies.push(new Competency({ id: doc.id, ...doc.data() }));
    });

    return competencies;
  }

  toFirestore() {
    return {
      id: this.id,
      evaluationId: this.evaluationId,
      employeeId: this.employeeId,
      name: this.name,
      level: this.level,
      score: this.score,
      evidence: this.evidence,
      developmentPlan: this.developmentPlan,
      resources: this.resources,
      lastEvaluated: this.lastEvaluated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Evaluation, Objective, Competency };
