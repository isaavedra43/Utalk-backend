const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Revisión de Equipo
 * Gestiona las revisiones periódicas de equipos
 * Alineado 100% con especificaciones del Frontend
 */
class EquipmentReview {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.equipmentId = data.equipmentId || '';
    this.employeeId = data.employeeId || '';
    this.reviewDate = data.reviewDate || new Date().toISOString().split('T')[0];
    this.reviewType = data.reviewType || 'monthly';
    this.condition = data.condition || 'good';
    this.cleanliness = data.cleanliness || 'good';
    this.functionality = data.functionality || 'good';
    
    // Daños detectados
    this.damages = data.damages || [];
    
    this.maintenanceRequired = data.maintenanceRequired || false;
    this.maintenanceDescription = data.maintenanceDescription || null;
    this.replacementRequired = data.replacementRequired || false;
    this.reviewedBy = data.reviewedBy || '';
    this.reviewedByName = data.reviewedByName || '';
    this.employeeComments = data.employeeComments || null;
    this.photos = data.photos || [];
    this.score = data.score || 0;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Valida los datos de la revisión
   */
  validate() {
    const errors = [];

    // Validaciones obligatorias
    if (!this.equipmentId.trim()) {
      errors.push('El ID del equipo es requerido');
    }

    if (!this.employeeId.trim()) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.reviewDate) {
      errors.push('La fecha de revisión es requerida');
    }

    if (!this.reviewedBy.trim()) {
      errors.push('El revisor es requerido');
    }

    if (!this.reviewedByName.trim()) {
      errors.push('El nombre del revisor es requerido');
    }

    // Validar formato de fecha
    if (this.reviewDate) {
      const reviewDate = new Date(this.reviewDate);
      if (isNaN(reviewDate.getTime())) {
        errors.push('La fecha de revisión no tiene un formato válido');
      }
    }

    // Validar que la fecha no sea futura
    if (this.reviewDate) {
      const reviewDate = new Date(this.reviewDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (reviewDate > today) {
        errors.push('La fecha de revisión no puede ser en el futuro');
      }
    }

    // Validar descripción de mantenimiento si es requerido
    if (this.maintenanceRequired && !this.maintenanceDescription?.trim()) {
      errors.push('La descripción del mantenimiento es requerida');
    }

    // Validar daños
    if (this.damages && this.damages.length > 0) {
      this.damages.forEach((damage, index) => {
        if (!damage.type?.trim()) {
          errors.push(`El tipo de daño ${index + 1} es requerido`);
        }
        if (!damage.description?.trim()) {
          errors.push(`La descripción del daño ${index + 1} es requerida`);
        }
      });
    }

    return errors;
  }

  /**
   * Calcula el score de la revisión
   */
  calculateScore() {
    let score = 100;

    // Penalizar por condición
    const conditionPenalties = {
      'excellent': 0,
      'good': 5,
      'fair': 15,
      'poor': 25,
      'damaged': 40
    };
    score -= conditionPenalties[this.condition] || 0;

    // Penalizar por limpieza
    const cleanlinessPenalties = {
      'excellent': 0,
      'good': 3,
      'fair': 8,
      'poor': 15
    };
    score -= cleanlinessPenalties[this.cleanliness] || 0;

    // Penalizar por funcionalidad
    const functionalityPenalties = {
      'excellent': 0,
      'good': 5,
      'fair': 15,
      'poor': 25,
      'not_working': 50
    };
    score -= functionalityPenalties[this.functionality] || 0;

    // Penalizar por daños
    if (this.damages && this.damages.length > 0) {
      this.damages.forEach(damage => {
        const severityPenalties = {
          'minor': 5,
          'moderate': 10,
          'severe': 20
        };
        score -= severityPenalties[damage.severity] || 0;
      });
    }

    // Penalizar por mantenimiento requerido
    if (this.maintenanceRequired) {
      score -= 10;
    }

    // Penalizar por reemplazo requerido
    if (this.replacementRequired) {
      score -= 20;
    }

    this.score = Math.max(0, Math.min(100, score));
    return this.score;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      equipmentId: this.equipmentId,
      employeeId: this.employeeId,
      reviewDate: this.reviewDate,
      reviewType: this.reviewType,
      condition: this.condition,
      cleanliness: this.cleanliness,
      functionality: this.functionality,
      damages: this.damages,
      maintenanceRequired: this.maintenanceRequired,
      maintenanceDescription: this.maintenanceDescription,
      replacementRequired: this.replacementRequired,
      reviewedBy: this.reviewedBy,
      reviewedByName: this.reviewedByName,
      employeeComments: this.employeeComments,
      photos: this.photos,
      score: this.score,
      createdAt: this.createdAt
    };
  }

  /**
   * Crea una revisión desde datos de Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new EquipmentReview({
      id: doc.id,
      ...data
    });
  }

  /**
   * Guarda la revisión en Firebase
   */
  async save() {
    try {
      // Calcular score antes de guardar
      this.calculateScore();

      const reviewRef = db.collection('employees')
        .doc(this.employeeId)
        .collection('equipment')
        .doc(this.equipmentId)
        .collection('reviews')
        .doc(this.id);

      await reviewRef.set(this.toFirestore());
      return this;
    } catch (error) {
      throw new Error(`Error al guardar revisión: ${error.message}`);
    }
  }

  /**
   * Busca una revisión por ID
   */
  static async findById(employeeId, equipmentId, id) {
    try {
      const reviewRef = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(equipmentId)
        .collection('reviews')
        .doc(id);

      const doc = await reviewRef.get();
      if (!doc.exists) {
        return null;
      }

      return EquipmentReview.fromFirestore(doc);
    } catch (error) {
      throw new Error(`Error al buscar revisión: ${error.message}`);
    }
  }

  /**
   * Lista revisiones de un equipo
   */
  static async listByEquipment(employeeId, equipmentId, options = {}) {
    try {
      let query = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(equipmentId)
        .collection('reviews');

      // Aplicar filtros
      if (options.reviewType) {
        query = query.where('reviewType', '==', options.reviewType);
      }

      if (options.condition) {
        query = query.where('condition', '==', options.condition);
      }

      // Ordenamiento
      const orderBy = options.orderBy || 'reviewDate';
      const orderDirection = options.orderDirection || 'desc';
      query = query.orderBy(orderBy, orderDirection);

      // Paginación
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      const snapshot = await query.get();
      const reviews = [];

      snapshot.forEach(doc => {
        reviews.push(EquipmentReview.fromFirestore(doc));
      });

      return reviews;
    } catch (error) {
      throw new Error(`Error al listar revisiones: ${error.message}`);
    }
  }

  /**
   * Lista todas las revisiones de un empleado (de todos sus equipos)
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      // Obtener todos los equipos del empleado
      const equipmentSnapshot = await db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .get();

      if (equipmentSnapshot.empty) {
        return { reviews: [], total: 0 };
      }

      const allReviews = [];
      const equipmentIds = [];

      // Recopilar todos los IDs de equipos
      equipmentSnapshot.forEach(doc => {
        equipmentIds.push(doc.id);
      });

      // Obtener revisiones de cada equipo
      for (const equipmentId of equipmentIds) {
        let query = db.collection('employees')
          .doc(employeeId)
          .collection('equipment')
          .doc(equipmentId)
          .collection('reviews');

        // Aplicar filtros
        if (options.equipmentId && options.equipmentId !== equipmentId) {
          continue; // Saltar este equipo si no coincide con el filtro
        }

        if (options.reviewType) {
          query = query.where('reviewType', '==', options.reviewType);
        }

        if (options.condition) {
          query = query.where('condition', '==', options.condition);
        }

        if (options.dateFrom) {
          query = query.where('reviewDate', '>=', options.dateFrom);
        }

        if (options.dateTo) {
          query = query.where('reviewDate', '<=', options.dateTo);
        }

        const reviewsSnapshot = await query.get();
        
        reviewsSnapshot.forEach(doc => {
          const review = EquipmentReview.fromFirestore(doc);
          // Agregar información del equipo
          const equipmentDoc = equipmentSnapshot.docs.find(eq => eq.id === equipmentId);
          if (equipmentDoc) {
            const equipmentData = equipmentDoc.data();
            review.equipment = {
              id: equipmentId,
              name: equipmentData.name || '',
              brand: equipmentData.brand || '',
              model: equipmentData.model || '',
              type: equipmentData.type || '',
              serial: equipmentData.serial || ''
            };
          }
          allReviews.push(review);
        });
      }

      // Ordenar todas las revisiones
      const orderBy = options.orderBy || 'createdAt';
      const orderDirection = options.orderDirection || 'desc';
      
      allReviews.sort((a, b) => {
        const aValue = a[orderBy];
        const bValue = b[orderBy];
        
        if (orderDirection === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // Aplicar paginación
      const total = allReviews.length;
      const offset = options.offset || 0;
      const limit = options.limit || 20;
      const paginatedReviews = allReviews.slice(offset, offset + limit);

      return {
        reviews: paginatedReviews,
        total: total
      };
    } catch (error) {
      throw new Error(`Error al listar revisiones del empleado: ${error.message}`);
    }
  }

  /**
   * Obtiene la última revisión de un equipo
   */
  static async getLastReview(employeeId, equipmentId) {
    try {
      const query = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(equipmentId)
        .collection('reviews')
        .orderBy('reviewDate', 'desc')
        .limit(1);

      const snapshot = await query.get();
      if (snapshot.empty) {
        return null;
      }

      return EquipmentReview.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      throw new Error(`Error al obtener última revisión: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de revisiones de un equipo
   */
  static async getReviewStats(employeeId, equipmentId) {
    try {
      const query = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(equipmentId)
        .collection('reviews')
        .orderBy('reviewDate', 'desc');

      const snapshot = await query.get();
      const reviews = [];

      snapshot.forEach(doc => {
        reviews.push(EquipmentReview.fromFirestore(doc));
      });

      if (reviews.length === 0) {
        return {
          totalReviews: 0,
          averageScore: 0,
          lastReviewDate: null,
          conditionTrend: 'stable',
          maintenanceRequired: 0,
          replacementRequired: 0
        };
      }

      // Calcular estadísticas
      const totalReviews = reviews.length;
      const averageScore = reviews.reduce((sum, review) => sum + review.score, 0) / totalReviews;
      const lastReviewDate = reviews[0].reviewDate;
      const maintenanceRequired = reviews.filter(r => r.maintenanceRequired).length;
      const replacementRequired = reviews.filter(r => r.replacementRequired).length;

      // Calcular tendencia de condición
      let conditionTrend = 'stable';
      if (reviews.length >= 2) {
        const lastCondition = reviews[0].condition;
        const previousCondition = reviews[1].condition;
        
        const conditionValues = {
          'excellent': 5,
          'good': 4,
          'fair': 3,
          'poor': 2,
          'damaged': 1
        };

        if (conditionValues[lastCondition] > conditionValues[previousCondition]) {
          conditionTrend = 'improving';
        } else if (conditionValues[lastCondition] < conditionValues[previousCondition]) {
          conditionTrend = 'declining';
        }
      }

      return {
        totalReviews,
        averageScore: Math.round(averageScore * 10) / 10,
        lastReviewDate,
        conditionTrend,
        maintenanceRequired,
        replacementRequired
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de revisiones: ${error.message}`);
    }
  }

  /**
   * Elimina una revisión
   */
  static async delete(employeeId, equipmentId, id) {
    try {
      const reviewRef = db.collection('employees')
        .doc(employeeId)
        .collection('equipment')
        .doc(equipmentId)
        .collection('reviews')
        .doc(id);

      await reviewRef.delete();
      return true;
    } catch (error) {
      throw new Error(`Error al eliminar revisión: ${error.message}`);
    }
  }

  /**
   * Obtiene el siguiente tipo de revisión programada
   */
  static getNextReviewType(lastReviewType) {
    const reviewTypes = ['daily', 'third_day', 'weekly', 'monthly', 'quarterly', 'annual'];
    const currentIndex = reviewTypes.indexOf(lastReviewType);
    
    if (currentIndex === -1 || currentIndex === reviewTypes.length - 1) {
      return 'monthly'; // Default
    }
    
    return reviewTypes[currentIndex + 1];
  }

  /**
   * Calcula la próxima fecha de revisión
   */
  static calculateNextReviewDate(lastReviewDate, reviewType) {
    const lastDate = new Date(lastReviewDate);
    const nextDate = new Date(lastDate);

    switch (reviewType) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'third_day':
        nextDate.setDate(nextDate.getDate() + 3);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'annual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate.toISOString().split('T')[0];
  }
}

module.exports = EquipmentReview;
