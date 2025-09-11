const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Habilidad de Empleado
 * Gestiona las habilidades y competencias técnicas/blandas
 */
class Skill {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.name = data.name || '';
    this.category = data.category || 'technical'; // 'technical' | 'soft' | 'leadership' | 'language' | 'other'
    this.level = data.level || 'beginner'; // 'beginner' | 'intermediate' | 'advanced' | 'expert'
    this.score = data.score || 0; // 1-5
    this.lastEvaluated = data.lastEvaluated || new Date().toISOString();
    this.evidence = data.evidence || '';
    this.isRequired = data.isRequired || false;
    this.developmentPlan = data.developmentPlan || '';
    this.resources = data.resources || [];
    this.targetLevel = data.targetLevel || null;
    this.targetDate = data.targetDate || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Obtiene las categorías de habilidades disponibles
   */
  static getSkillCategories() {
    return {
      technical: {
        name: 'Técnicas',
        description: 'Habilidades técnicas específicas del puesto',
        icon: 'code',
        color: 'blue'
      },
      soft: {
        name: 'Blandas',
        description: 'Habilidades interpersonales y de comunicación',
        icon: 'users',
        color: 'green'
      },
      leadership: {
        name: 'Liderazgo',
        description: 'Habilidades de liderazgo y gestión',
        icon: 'crown',
        color: 'purple'
      },
      language: {
        name: 'Idiomas',
        description: 'Competencias en idiomas',
        icon: 'globe',
        color: 'orange'
      },
      other: {
        name: 'Otras',
        description: 'Otras habilidades especializadas',
        icon: 'star',
        color: 'gray'
      }
    };
  }

  /**
   * Obtiene los niveles de habilidad
   */
  static getSkillLevels() {
    return {
      beginner: {
        name: 'Principiante',
        description: 'Conocimiento básico, requiere supervisión',
        score: 1,
        color: 'red'
      },
      intermediate: {
        name: 'Intermedio',
        description: 'Conocimiento sólido, trabajo independiente',
        score: 2,
        color: 'yellow'
      },
      advanced: {
        name: 'Avanzado',
        description: 'Conocimiento profundo, puede enseñar a otros',
        score: 4,
        color: 'blue'
      },
      expert: {
        name: 'Experto',
        description: 'Maestría completa, referente en el área',
        score: 5,
        color: 'green'
      }
    };
  }

  /**
   * Habilidades técnicas predefinidas por categoría
   */
  static getPredefinedSkills() {
    return {
      technical: [
        'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'MongoDB',
        'AWS', 'Docker', 'Kubernetes', 'Git', 'CI/CD', 'Testing', 'API Design',
        'Machine Learning', 'Data Analysis', 'Cybersecurity', 'DevOps'
      ],
      soft: [
        'Comunicación', 'Trabajo en Equipo', 'Resolución de Problemas',
        'Pensamiento Crítico', 'Adaptabilidad', 'Gestión del Tiempo',
        'Creatividad', 'Empatía', 'Negociación', 'Presentaciones'
      ],
      leadership: [
        'Gestión de Equipos', 'Toma de Decisiones', 'Delegación',
        'Coaching', 'Planificación Estratégica', 'Gestión de Conflictos',
        'Motivación', 'Mentoring', 'Gestión de Cambio'
      ],
      language: [
        'Inglés', 'Español', 'Francés', 'Alemán', 'Italiano', 'Portugués',
        'Chino Mandarín', 'Japonés', 'Árabe', 'Ruso'
      ]
    };
  }

  /**
   * Actualiza automáticamente el score basado en el nivel
   */
  updateScoreFromLevel() {
    const levels = Skill.getSkillLevels();
    this.score = levels[this.level]?.score || 1;
  }

  /**
   * Valida los datos de la habilidad
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.name || this.name.length < 2) {
      errors.push('El nombre de la habilidad es requerido y debe tener al menos 2 caracteres');
    }

    const validCategories = Object.keys(Skill.getSkillCategories());
    if (!validCategories.includes(this.category)) {
      errors.push('La categoría de habilidad no es válida');
    }

    const validLevels = Object.keys(Skill.getSkillLevels());
    if (!validLevels.includes(this.level)) {
      errors.push('El nivel de habilidad no es válido');
    }

    if (this.score < 1 || this.score > 5) {
      errors.push('El puntaje debe estar entre 1 y 5');
    }

    if (this.targetLevel && !validLevels.includes(this.targetLevel)) {
      errors.push('El nivel objetivo no es válido');
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
      name: this.name,
      category: this.category,
      level: this.level,
      score: this.score,
      lastEvaluated: this.lastEvaluated,
      evidence: this.evidence,
      isRequired: this.isRequired,
      developmentPlan: this.developmentPlan,
      resources: this.resources,
      targetLevel: this.targetLevel,
      targetDate: this.targetDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una habilidad desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new Skill({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la habilidad en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updateScoreFromLevel();
      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('skills').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving skill:', error);
      throw error;
    }
  }

  /**
   * Actualiza la habilidad
   */
  async update(data) {
    try {
      Object.assign(this, data);
      
      // Actualizar score si cambió el nivel
      if (data.level) {
        this.updateScoreFromLevel();
      }
      
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('skills').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating skill:', error);
      throw error;
    }
  }

  /**
   * Busca una habilidad por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('skills').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return Skill.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding skill by ID:', error);
      throw error;
    }
  }

  /**
   * Lista habilidades de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        category = null,
        level = null,
        required = null,
        page = 1,
        limit = 50
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('skills');

      // Filtros
      if (category) {
        query = query.where('category', '==', category);
      }

      if (level) {
        query = query.where('level', '==', level);
      }

      if (required !== null) {
        query = query.where('isRequired', '==', required);
      }

      // Ordenamiento
      query = query.orderBy('category').orderBy('name');

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
      const skills = [];

      snapshot.forEach(doc => {
        skills.push(Skill.fromFirestore(doc));
      });

      return skills;
    } catch (error) {
      console.error('Error listing skills:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de habilidades de un empleado
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('skills').get();

      const summary = {
        totalSkills: 0,
        averageLevel: 0,
        coreSkills: 0,
        byCategory: {},
        byLevel: {},
        recentlyUpdated: 0,
        needsDevelopment: []
      };

      let totalScore = 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      snapshot.forEach(doc => {
        const skill = doc.data();
        
        summary.totalSkills++;
        totalScore += skill.score;
        
        // Contar por categoría
        summary.byCategory[skill.category] = (summary.byCategory[skill.category] || 0) + 1;
        
        // Contar por nivel
        summary.byLevel[skill.level] = (summary.byLevel[skill.level] || 0) + 1;
        
        // Habilidades core (requeridas)
        if (skill.isRequired) {
          summary.coreSkills++;
        }
        
        // Recientemente actualizadas
        if (new Date(skill.lastEvaluated) > thirtyDaysAgo) {
          summary.recentlyUpdated++;
        }
        
        // Necesitan desarrollo (score < 3 y son requeridas)
        if (skill.score < 3 && skill.isRequired) {
          summary.needsDevelopment.push({
            name: skill.name,
            category: skill.category,
            currentLevel: skill.level,
            targetLevel: skill.targetLevel,
            score: skill.score
          });
        }
      });

      // Calcular promedio
      if (summary.totalSkills > 0) {
        summary.averageLevel = Math.round((totalScore / summary.totalSkills) * 10) / 10;
      }

      return summary;
    } catch (error) {
      console.error('Error getting skills summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene brechas de habilidades (skills requeridas faltantes)
   */
  static async getSkillGaps(employeeId, targetPosition) {
    try {
      // Obtener habilidades actuales del empleado
      const currentSkills = await Skill.listByEmployee(employeeId);
      const currentSkillNames = currentSkills.map(skill => skill.name.toLowerCase());
      
      // Habilidades requeridas por posición (esto podría venir de una configuración)
      const requiredSkillsByPosition = {
        'developer': ['JavaScript', 'React', 'Node.js', 'SQL', 'Git'],
        'manager': ['Gestión de Equipos', 'Toma de Decisiones', 'Comunicación', 'Planificación Estratégica'],
        'analyst': ['Data Analysis', 'SQL', 'Excel', 'Python', 'Pensamiento Crítico']
      };
      
      const requiredSkills = requiredSkillsByPosition[targetPosition.toLowerCase()] || [];
      
      const gaps = [];
      const improvements = [];
      
      requiredSkills.forEach(requiredSkill => {
        const currentSkill = currentSkills.find(skill => 
          skill.name.toLowerCase() === requiredSkill.toLowerCase()
        );
        
        if (!currentSkill) {
          // Habilidad faltante
          gaps.push({
            name: requiredSkill,
            status: 'missing',
            currentLevel: null,
            requiredLevel: 'intermediate',
            priority: 'high'
          });
        } else if (currentSkill.score < 3) {
          // Habilidad que necesita mejora
          improvements.push({
            name: requiredSkill,
            status: 'needs_improvement',
            currentLevel: currentSkill.level,
            currentScore: currentSkill.score,
            requiredLevel: 'intermediate',
            requiredScore: 3,
            priority: currentSkill.score < 2 ? 'high' : 'medium'
          });
        }
      });
      
      return {
        gaps,
        improvements,
        totalGaps: gaps.length + improvements.length,
        completionPercentage: Math.round(((requiredSkills.length - gaps.length - improvements.length) / requiredSkills.length) * 100)
      };
    } catch (error) {
      console.error('Error getting skill gaps:', error);
      throw error;
    }
  }

  /**
   * Sugiere plan de desarrollo para una habilidad
   */
  generateDevelopmentPlan() {
    const levels = Skill.getSkillLevels();
    const currentLevel = levels[this.level];
    const targetLevel = this.targetLevel ? levels[this.targetLevel] : null;
    
    if (!targetLevel || currentLevel.score >= targetLevel.score) {
      return 'Habilidad ya en el nivel deseado o superior';
    }
    
    const plans = {
      'beginner_to_intermediate': [
        'Completar curso básico online',
        'Practicar con proyectos pequeños',
        'Buscar mentoring de compañeros experimentados',
        'Dedicar 2-3 horas semanales de práctica'
      ],
      'intermediate_to_advanced': [
        'Tomar curso avanzado o certificación',
        'Liderar proyecto que use esta habilidad',
        'Participar en comunidades profesionales',
        'Enseñar la habilidad a otros (efecto Feynman)'
      ],
      'advanced_to_expert': [
        'Contribuir a proyectos open source',
        'Dar charlas o escribir artículos técnicos',
        'Obtener certificaciones profesionales',
        'Mentorear a otros en esta habilidad'
      ]
    };
    
    const planKey = `${this.level}_to_${this.targetLevel}`;
    return plans[planKey] || plans['beginner_to_intermediate'];
  }

  /**
   * Calcula tiempo estimado para alcanzar nivel objetivo
   */
  estimateTimeToTarget() {
    const levels = Skill.getSkillLevels();
    const currentScore = levels[this.level]?.score || 1;
    const targetScore = this.targetLevel ? levels[this.targetLevel]?.score || 5 : 5;
    
    if (currentScore >= targetScore) {
      return 0;
    }
    
    // Estimación base: 2-4 meses por nivel dependiendo de la categoría
    const timePerLevel = {
      technical: 3, // 3 meses promedio
      soft: 4,      // 4 meses promedio
      leadership: 6, // 6 meses promedio
      language: 8,   // 8 meses promedio
      other: 3
    };
    
    const monthsPerLevel = timePerLevel[this.category] || 3;
    const levelDifference = targetScore - currentScore;
    
    return Math.ceil(levelDifference * monthsPerLevel);
  }
}

/**
 * Modelo de Certificación
 */
class Certification {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.name = data.name || '';
    this.issuer = data.issuer || '';
    this.issueDate = data.issueDate || '';
    this.expirationDate = data.expirationDate || null;
    this.credentialId = data.credentialId || null;
    this.status = data.status || 'active'; // 'active' | 'expired' | 'pending' | 'suspended'
    this.verificationUrl = data.verificationUrl || null;
    this.attachmentUrl = data.attachmentUrl || null;
    this.notes = data.notes || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Verifica si la certificación está expirada
   */
  isExpired() {
    if (!this.expirationDate) return false;
    return new Date(this.expirationDate) < new Date();
  }

  /**
   * Calcula días hasta expiración
   */
  getDaysUntilExpiration() {
    if (!this.expirationDate) return null;
    
    const now = new Date();
    const expiration = new Date(this.expirationDate);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Guarda la certificación en Firebase
   */
  async save() {
    try {
      // Actualizar estado si está expirada
      if (this.isExpired()) {
        this.status = 'expired';
      }
      
      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('certifications').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving certification:', error);
      throw error;
    }
  }

  /**
   * Lista certificaciones de un empleado
   */
  static async listByEmployee(employeeId, includeExpired = false) {
    try {
      let query = db.collection('employees').doc(employeeId)
        .collection('certifications');

      if (!includeExpired) {
        query = query.where('status', '!=', 'expired');
      }

      query = query.orderBy('issueDate', 'desc');

      const snapshot = await query.get();
      const certifications = [];

      snapshot.forEach(doc => {
        certifications.push(new Certification({ id: doc.id, ...doc.data() }));
      });

      return certifications;
    } catch (error) {
      console.error('Error listing certifications:', error);
      throw error;
    }
  }

  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      name: this.name,
      issuer: this.issuer,
      issueDate: this.issueDate,
      expirationDate: this.expirationDate,
      credentialId: this.credentialId,
      status: this.status,
      verificationUrl: this.verificationUrl,
      attachmentUrl: this.attachmentUrl,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Skill, Certification };
