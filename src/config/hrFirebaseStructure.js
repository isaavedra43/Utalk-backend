/**
 * Estructura de Colecciones Firebase para Módulo de Recursos Humanos
 * Define la organización de datos en Firestore para máximo rendimiento y escalabilidad
 */

/**
 * ESTRUCTURA PRINCIPAL DE COLECCIONES
 * 
 * employees/
 * ├── {employeeId}/
 * │   ├── personalInfo: object
 * │   ├── position: object
 * │   ├── location: object
 * │   ├── contract: object
 * │   ├── status: string
 * │   ├── createdAt: timestamp
 * │   ├── updatedAt: timestamp
 * │   └── subcollections/
 * │       ├── extras/
 * │       │   ├── {movementId}/
 * │       │   │   ├── type: string
 * │       │   │   ├── amount: number
 * │       │   │   ├── quantity: number
 * │       │   │   ├── status: string
 * │       │   │   └── ...
 * │       │   └── ...
 * │       ├── vacations/
 * │       │   ├── {vacationId}/
 * │       │   │   ├── endDate: string
 * │       │   │   ├── days: number
 * │       │   │   └── status: string
 * │       │   └── ...
 * │       ├── documents/
 * │       │   ├── {documentId}/
 * │       │   │   ├── fileName: string
 * │       │   │   ├── fileType: string
 * │       │   │   ├── fileSize: number
 * │       │   │   └── uploadedAt: timestamp
 * │       │   └── ...
 * │       ├── vacationBalances/
 * │       │   ├── {year}/
 * │       │   │   ├── totalDays: number
 * │       │   │   ├── usedDays: number
 * │       │   │   └── availableDays: number
 * │       │   └── ...
 * │       ├── documents/
 * │       │   ├── {documentId}/
 * │       │   │   ├── fileName: string
 * │       │   │   ├── fileUrl: string
 * │       │   │   ├── category: string
 * │       │   │   └── isConfidential: boolean
 * │       │   └── ...
 * │       ├── incidents/
 * │       │   ├── {incidentId}/
 * │       │   │   ├── type: string
 * │       │   │   ├── severity: string
 * │       │   │   ├── description: string
 * │       │   │   └── status: string
 * │       │   └── ...
 * │       ├── evaluations/
 * │       │   ├── {evaluationId}/
 * │       │   │   ├── type: string
 * │       │   │   ├── overallScore: number
 * │       │   │   ├── status: string
 * │       │   │   ├── objectives/
 * │       │   │   │   └── {objectiveId}/
 * │       │   │   └── competencies/
 * │       │   │       └── {competencyId}/
 * │       │   └── ...
 * │       ├── skills/
 * │       │   ├── {skillId}/
 * │       │   │   ├── name: string
 * │       │   │   ├── category: string
 * │       │   │   ├── level: string
 * │       │   │   └── score: number
 * │       │   └── ...
 * │       ├── certifications/
 * │       │   ├── {certificationId}/
 * │       │   │   ├── name: string
 * │       │   │   ├── issuer: string
 * │       │   │   ├── issueDate: string
 * │       │   │   └── status: string
 * │       │   └── ...
 * │       └── history/
 * │           ├── {historyId}/
 * │           │   ├── type: string
 * │           │   ├── description: string
 * │           │   ├── changedAt: timestamp
 * │           │   └── changedBy: string
 * │           └── ...
 * 
 * audit_logs/
 * ├── {logId}/
 * │   ├── entityType: string
 * │   ├── entityId: string
 * │   ├── employeeId: string
 * │   ├── action: string
 * │   ├── changedBy: string
 * │   └── changedAt: timestamp
 * 
 * hr_settings/
 * ├── departments/
 * │   ├── {departmentId}/
 * │   │   ├── name: string
 * │   │   ├── budget: number
 * │   │   └── manager: string
 * │   └── ...
 * ├── positions/
 * │   ├── {positionId}/
 * │   │   ├── title: string
 * │   │   ├── department: string
 * │   │   ├── level: string
 * │   │   └── salaryRange: object
 * │   └── ...
 * └── policies/
 *     ├── vacation_policy/
 *     ├── attendance_policy/
 *     └── ...
 */

const HR_COLLECTIONS = {
  // Colección principal de empleados
  EMPLOYEES: 'employees',
  
  // Subcolecciones de empleados
  EXTRAS: 'extras',
  VACATIONS: 'vacations',
  VACATION_BALANCES: 'vacationBalances',
  DOCUMENTS: 'documents',
  INCIDENTS: 'incidents',
  EVALUATIONS: 'evaluations',
  OBJECTIVES: 'objectives',
  COMPETENCIES: 'competencies',
  SKILLS: 'skills',
  CERTIFICATIONS: 'certifications',
  HISTORY: 'history',
  
  // Colecciones globales
  AUDIT_LOGS: 'audit_logs',
  HR_SETTINGS: 'hr_settings',
  DEPARTMENTS: 'departments',
  POSITIONS: 'positions',
  POLICIES: 'policies'
};

/**
 * ÍNDICES REQUERIDOS PARA FIRESTORE
 * Estos índices deben ser creados para optimizar las consultas
 */
const REQUIRED_INDEXES = [
  // Índices para empleados
  {
    collectionGroup: 'employees',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'position.department', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'employees',
    fields: [
      { fieldPath: 'position.department', order: 'ASCENDING' },
      { fieldPath: 'position.level', order: 'ASCENDING' },
      { fieldPath: 'contract.salary', order: 'DESCENDING' }
    ]
  },
  
  // Índices para extras
  {
    collectionGroup: 'extras',
    fields: [
      { fieldPath: 'employeeId', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'extras',
    fields: [
      { fieldPath: 'employeeId', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' }
    ]
  },
  
  // Índices para vacaciones
  {
    collectionGroup: 'vacations',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'startDate', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'vacations',
    fields: [
      { fieldPath: 'startDate', order: 'ASCENDING' },
      { fieldPath: 'endDate', order: 'ASCENDING' }
    ]
  },
  
  // Índices para documentos
  {
    collectionGroup: 'documents',
    fields: [
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'uploadedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'documents',
    fields: [
      { fieldPath: 'isConfidential', order: 'ASCENDING' },
      { fieldPath: 'category', order: 'ASCENDING' }
    ]
  },
  
  // Índices para incidencias
  {
    collectionGroup: 'incidents',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'severity', order: 'DESCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'incidents',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' }
    ]
  },
  
  // Índices para evaluaciones
  {
    collectionGroup: 'evaluations',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'evaluations',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'overallScore', order: 'DESCENDING' }
    ]
  },
  
  // Índices para habilidades
  {
    collectionGroup: 'skills',
    fields: [
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'level', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'skills',
    fields: [
      { fieldPath: 'isRequired', order: 'ASCENDING' },
      { fieldPath: 'score', order: 'DESCENDING' }
    ]
  },
  
  // Índices para historial
  {
    collectionGroup: 'history',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'changedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'history',
    fields: [
      { fieldPath: 'changedBy', order: 'ASCENDING' },
      { fieldPath: 'changedAt', order: 'DESCENDING' }
    ]
  },
  
  // Índices para logs de auditoría
  {
    collectionGroup: 'audit_logs',
    fields: [
      { fieldPath: 'entityType', order: 'ASCENDING' },
      { fieldPath: 'changedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'audit_logs',
    fields: [
      { fieldPath: 'employeeId', order: 'ASCENDING' },
      { fieldPath: 'changedAt', order: 'DESCENDING' }
    ]
  }
];

/**
 * REGLAS DE SEGURIDAD DE FIRESTORE
 * Definen quién puede acceder a qué datos
 */
const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reglas para empleados
    match /employees/{employeeId} {
      // Solo usuarios autenticados pueden leer empleados
      allow read: if request.auth != null && 
        (hasHRRole(['HR_ADMIN', 'HR_MANAGER']) || 
         request.auth.uid == employeeId);
      
      // Solo HR Admin puede crear/actualizar/eliminar
      allow write: if request.auth != null && 
        hasHRRole(['HR_ADMIN']);
      
      // Subcolecciones de empleados
      match /{subcollection}/{docId} {
        // HR Admin puede acceder a todo
        allow read, write: if request.auth != null && 
          hasHRRole(['HR_ADMIN']);
        
        // HR Manager puede leer y crear ciertos documentos
        allow read, create: if request.auth != null && 
          hasHRRole(['HR_MANAGER']) && 
          subcollection in ['vacations', 'evaluations'];
        
        // Empleados pueden acceder solo a sus propios datos
        allow read: if request.auth != null && 
          request.auth.uid == employeeId &&
          subcollection in ['vacations', 'documents', 'skills', 'history'];
        
        // Empleados pueden crear ciertos tipos de documentos
        allow create: if request.auth != null && 
          request.auth.uid == employeeId &&
          subcollection in ['vacations', 'documents', 'skills'];
      }
    }
    
    // Reglas para logs de auditoría
    match /audit_logs/{logId} {
      allow read: if request.auth != null && hasHRRole(['HR_ADMIN']);
      allow create: if request.auth != null;
      allow update, delete: if false; // Los logs no se pueden modificar
    }
    
    // Reglas para configuraciones HR
    match /hr_settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && hasHRRole(['HR_ADMIN']);
    }
    
    // Función auxiliar para verificar roles HR
    function hasHRRole(roles) {
      return request.auth.token.hrRole in roles;
    }
  }
}
`;

/**
 * CONFIGURACIÓN DE COLECCIONES
 * Metadatos y configuraciones específicas para cada colección
 */
const COLLECTION_CONFIGS = {
  employees: {
    maxDocuments: 10000,
    retentionDays: null, // Permanente
    backupEnabled: true,
    encryptionEnabled: true,
    auditEnabled: true,
    fields: {
      required: ['personalInfo.firstName', 'personalInfo.lastName', 'position.title'],
      indexed: ['status', 'position.department', 'position.level'],
      encrypted: ['personalInfo.rfc', 'personalInfo.curp', 'contract.salary']
    }
  },
  
  extras: {
    maxDocuments: 365, // 1 año de movimientos por empleado
    retentionDays: 3650, // 10 años
    backupEnabled: true,
    encryptionEnabled: true,
    auditEnabled: true,
    fields: {
      required: ['periodStart', 'periodEnd', 'grossSalary'],
      indexed: ['year', 'weekNumber', 'status'],
      encrypted: ['grossSalary', 'netSalary', 'taxes']
    }
  },
  
  vacations: {
    maxDocuments: 100, // Máximo solicitudes por empleado
    retentionDays: 1825, // 5 años
    backupEnabled: true,
    encryptionEnabled: false,
    auditEnabled: true,
    fields: {
      required: ['startDate', 'endDate', 'type'],
      indexed: ['status', 'startDate', 'type'],
      encrypted: []
    }
  },
  
  documents: {
    maxDocuments: 500, // Máximo documentos por empleado
    retentionDays: null, // Depende de la categoría
    backupEnabled: true,
    encryptionEnabled: true,
    auditEnabled: true,
    fields: {
      required: ['fileName', 'category', 'fileUrl'],
      indexed: ['category', 'isConfidential', 'uploadedAt'],
      encrypted: ['fileUrl']
    }
  },
  
  incidents: {
    maxDocuments: 200, // Máximo incidencias por empleado
    retentionDays: 2555, // 7 años
    backupEnabled: true,
    encryptionEnabled: true,
    auditEnabled: true,
    fields: {
      required: ['type', 'title', 'description'],
      indexed: ['type', 'severity', 'status', 'date'],
      encrypted: ['description', 'investigationNotes']
    }
  },
  
  evaluations: {
    maxDocuments: 50, // Máximo evaluaciones por empleado
    retentionDays: 1825, // 5 años
    backupEnabled: true,
    encryptionEnabled: false,
    auditEnabled: true,
    fields: {
      required: ['type', 'evaluatorId'],
      indexed: ['type', 'status', 'overallScore'],
      encrypted: []
    }
  },
  
  skills: {
    maxDocuments: 100, // Máximo habilidades por empleado
    retentionDays: 1095, // 3 años
    backupEnabled: true,
    encryptionEnabled: false,
    auditEnabled: false,
    fields: {
      required: ['name', 'category', 'level'],
      indexed: ['category', 'level', 'isRequired'],
      encrypted: []
    }
  },
  
  history: {
    maxDocuments: 1000, // Máximo eventos por empleado
    retentionDays: 1825, // 5 años
    backupEnabled: true,
    encryptionEnabled: false,
    auditEnabled: false,
    fields: {
      required: ['type', 'description', 'changedAt'],
      indexed: ['type', 'changedAt', 'changedBy'],
      encrypted: []
    }
  }
};

/**
 * CONFIGURACIÓN DE TRIGGERS
 * Funciones que se ejecutan automáticamente en eventos de Firestore
 */
const FIRESTORE_TRIGGERS = {
  // Trigger cuando se crea un empleado
  onEmployeeCreate: {
    event: 'create',
    collection: 'employees',
    actions: [
      'createVacationBalance',
      'createAuditLog',
      'sendWelcomeNotification'
    ]
  },
  
  // Trigger cuando se actualiza un empleado
  onEmployeeUpdate: {
    event: 'update',
    collection: 'employees',
    actions: [
      'updateVacationBalance',
      'createAuditLog',
      'syncRelatedData'
    ]
  },
  
  // Trigger cuando se crea una solicitud de vacaciones
  onVacationCreate: {
    event: 'create',
    collection: 'vacations',
    actions: [
      'updateVacationBalance',
      'createAuditLog',
      'sendApprovalNotification'
    ]
  },
  
  // Trigger cuando se actualiza el estado de vacaciones
  onVacationStatusUpdate: {
    event: 'update',
    collection: 'vacations',
    fields: ['status'],
    actions: [
      'updateVacationBalance',
      'createAuditLog',
      'sendStatusNotification'
    ]
  },
  
  // Trigger cuando se sube un documento
  onDocumentUpload: {
    event: 'create',
    collection: 'documents',
    actions: [
      'scanForVirus',
      'createAuditLog',
      'checkDocumentRequirements'
    ]
  }
};

/**
 * UTILIDADES PARA GESTIÓN DE FIRESTORE
 */
class FirestoreHRUtils {
  /**
   * Inicializa la estructura de colecciones para un nuevo empleado
   */
  static async initializeEmployeeCollections(employeeId) {
    const { db } = require('../config/firebase');
    
    try {
      // Crear documento de balance de vacaciones inicial
      const currentYear = new Date().getFullYear();
      await db.collection('employees').doc(employeeId)
        .collection('vacationBalances').doc(currentYear.toString())
        .set({
          year: currentYear,
          totalDays: 6, // Días mínimos legales
          usedDays: 0,
          availableDays: 6,
          carriedOverDays: 0,
          createdAt: new Date().toISOString()
        });
      
      console.log(`Initialized collections for employee ${employeeId}`);
    } catch (error) {
      console.error('Error initializing employee collections:', error);
      throw error;
    }
  }
  
  /**
   * Limpia colecciones de un empleado eliminado
   */
  static async cleanupEmployeeCollections(employeeId, retainData = true) {
    const { db } = require('../config/firebase');
    
    try {
      if (!retainData) {
        // Eliminar todas las subcolecciones
        const subcollections = Object.values(HR_COLLECTIONS).filter(col => 
          !['employees', 'audit_logs', 'hr_settings'].includes(col)
        );
        
        for (const subcollection of subcollections) {
          const snapshot = await db.collection('employees').doc(employeeId)
            .collection(subcollection).get();
          
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }
      
      console.log(`Cleaned up collections for employee ${employeeId}`);
    } catch (error) {
      console.error('Error cleaning up employee collections:', error);
      throw error;
    }
  }
  
  /**
   * Crea índices requeridos
   */
  static async createRequiredIndexes() {
    // Los índices se crean automáticamente cuando se realizan las consultas
    // o se pueden crear manualmente usando Firebase CLI
    console.log('Required indexes:', REQUIRED_INDEXES);
    return REQUIRED_INDEXES;
  }
  
  /**
   * Valida la estructura de un documento antes de guardarlo
   */
  static validateDocumentStructure(collection, data) {
    const config = COLLECTION_CONFIGS[collection];
    if (!config) {
      throw new Error(`Configuración no encontrada para la colección ${collection}`);
    }
    
    const errors = [];
    
    // Verificar campos requeridos
    for (const field of config.fields.required) {
      if (!this.getNestedProperty(data, field)) {
        errors.push(`Campo requerido faltante: ${field}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Obtiene una propiedad anidada de un objeto
   */
  static getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }
  
  /**
   * Obtiene estadísticas de uso de colecciones
   */
  static async getCollectionStats(employeeId = null) {
    const { db } = require('../config/firebase');
    
    try {
      const stats = {};
      
      if (employeeId) {
        // Estadísticas para un empleado específico
        for (const [name, collection] of Object.entries(HR_COLLECTIONS)) {
          if (['employees', 'audit_logs', 'hr_settings'].includes(collection)) continue;
          
          const snapshot = await db.collection('employees').doc(employeeId)
            .collection(collection).get();
          
          stats[name] = {
            documents: snapshot.size,
            maxAllowed: COLLECTION_CONFIGS[collection]?.maxDocuments || 'unlimited'
          };
        }
      } else {
        // Estadísticas globales
        const employeesSnapshot = await db.collection('employees').get();
        stats.totalEmployees = employeesSnapshot.size;
        
        const auditSnapshot = await db.collection('audit_logs').get();
        stats.totalAuditLogs = auditSnapshot.size;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting collection stats:', error);
      throw error;
    }
  }
}

module.exports = {
  HR_COLLECTIONS,
  REQUIRED_INDEXES,
  SECURITY_RULES,
  COLLECTION_CONFIGS,
  FIRESTORE_TRIGGERS,
  FirestoreHRUtils
};
