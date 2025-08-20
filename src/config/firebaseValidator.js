const { logger } = require('../utils/logger');

/**
 * 🔧 VALIDADOR DE CONFIGURACIÓN FIREBASE
 * 
 * Valida que todas las variables de entorno y configuraciones
 * necesarias para Firebase estén presentes y correctas.
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class FirebaseValidator {
  constructor() {
    this.validationResults = {
      isValid: false,
      errors: [],
      warnings: [],
      missingVariables: [],
      configStatus: {}
    };
  }

  /**
   * 🔍 Validar configuración completa de Firebase
   */
  validateFirebaseConfig() {
    logger.info('🔧 Iniciando validación de configuración Firebase...');

    try {
      // 1. Validar variables de entorno críticas
      this.validateEnvironmentVariables();

      // 2. Validar configuración de Admin SDK
      this.validateAdminSDK();

      // 3. Validar acceso a servicios
      this.validateServices();

      // 4. Consolidar resultados
      this.consolidateResults();

      logger.info('✅ Validación de Firebase completada', {
        isValid: this.validationResults.isValid,
        errorsCount: this.validationResults.errors.length,
        warningsCount: this.validationResults.warnings.length
      });

      return this.validationResults;

    } catch (error) {
      logger.error('❌ Error crítico validando configuración Firebase', {
        error: error?.message || 'Error desconocido',
        stack: error?.stack?.split('\n').slice(0, 3) || []
      });

      this.validationResults.errors.push({
        type: 'CRITICAL_ERROR',
        message: `Error crítico en validación: ${error?.message || 'Error desconocido'}`,
        details: error
      });

      return this.validationResults;
    }
  }

  /**
   * 🔍 Validar variables de entorno
   */
  validateEnvironmentVariables() {
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY'
    ];

    const optionalVars = [
      'FIREBASE_DATABASE_URL',
      'FIREBASE_STORAGE_BUCKET',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ];

    logger.debug('🔍 Validando variables de entorno Firebase...');

    // Validar variables requeridas
    for (const varName of requiredVars) {
      const value = process.env[varName];
      
      if (!value) {
        this.validationResults.missingVariables.push(varName);
        this.validationResults.errors.push({
          type: 'MISSING_REQUIRED_VAR',
          message: `Variable de entorno requerida faltante: ${varName}`,
          variable: varName
        });
      } else {
        // Validaciones específicas
        this.validateSpecificVariable(varName, value);
      }
    }

    // Validar variables opcionales
    for (const varName of optionalVars) {
      const value = process.env[varName];
      
      if (!value) {
        this.validationResults.warnings.push({
          type: 'MISSING_OPTIONAL_VAR',
          message: `Variable de entorno opcional faltante: ${varName}`,
          variable: varName
        });
      }
    }

    this.validationResults.configStatus.environmentVariables = {
      requiredPresent: requiredVars.filter(v => process.env[v]).length,
      requiredTotal: requiredVars.length,
      optionalPresent: optionalVars.filter(v => process.env[v]).length,
      optionalTotal: optionalVars.length
    };
  }

  /**
   * 🔍 Validar variable específica
   */
  validateSpecificVariable(varName, value) {
    switch (varName) {
      case 'FIREBASE_PRIVATE_KEY':
        if (!value.includes('-----BEGIN PRIVATE KEY-----')) {
          this.validationResults.errors.push({
            type: 'INVALID_PRIVATE_KEY',
            message: 'FIREBASE_PRIVATE_KEY no tiene formato válido',
            variable: varName
          });
        }
        break;

      case 'FIREBASE_CLIENT_EMAIL':
        if (!value.includes('@') || !value.includes('.')) {
          this.validationResults.errors.push({
            type: 'INVALID_EMAIL',
            message: 'FIREBASE_CLIENT_EMAIL no tiene formato de email válido',
            variable: varName
          });
        }
        break;

      case 'FIREBASE_PROJECT_ID':
        if (value.length < 3 || !/^[a-z0-9-]+$/.test(value)) {
          this.validationResults.errors.push({
            type: 'INVALID_PROJECT_ID',
            message: 'FIREBASE_PROJECT_ID no tiene formato válido',
            variable: varName
          });
        }
        break;
    }
  }

  /**
   * 🔍 Validar Admin SDK
   */
  validateAdminSDK() {
    logger.debug('🔍 Validando Firebase Admin SDK...');

    try {
      const admin = require('firebase-admin');

      if (!admin) {
        this.validationResults.errors.push({
          type: 'ADMIN_SDK_NOT_AVAILABLE',
          message: 'Firebase Admin SDK no está disponible'
        });
        return;
      }

      // Validar que el SDK tiene los métodos necesarios
      const requiredMethods = ['apps', 'firestore', 'storage', 'initializeApp'];
      const missingMethods = requiredMethods.filter(method => typeof admin[method] !== 'function' && !admin[method]);

      if (missingMethods.length > 0) {
        this.validationResults.errors.push({
          type: 'ADMIN_SDK_INCOMPLETE',
          message: `Firebase Admin SDK carece de métodos requeridos: ${missingMethods.join(', ')}`,
          missingMethods
        });
      }

      this.validationResults.configStatus.adminSDK = {
        available: true,
        appsCount: admin.apps ? admin.apps.length : 0,
        hasRequiredMethods: missingMethods.length === 0
      };

    } catch (adminError) {
      this.validationResults.errors.push({
        type: 'ADMIN_SDK_ERROR',
        message: `Error cargando Firebase Admin SDK: ${adminError?.message || 'Error desconocido'}`,
        details: adminError
      });

      this.validationResults.configStatus.adminSDK = {
        available: false,
        error: adminError?.message || 'Error desconocido'
      };
    }
  }

  /**
   * 🔍 Validar servicios de Firebase
   */
  validateServices() {
    logger.debug('🔍 Validando servicios Firebase...');

    try {
      const admin = require('firebase-admin');

      if (!admin || !admin.apps || admin.apps.length === 0) {
        this.validationResults.warnings.push({
          type: 'SERVICES_NOT_INITIALIZED',
          message: 'No se pueden validar servicios: Firebase no inicializado'
        });
        return;
      }

      // Validar Firestore
      try {
        const firestore = admin.firestore();
        this.validationResults.configStatus.firestore = {
          available: true,
          configured: !!firestore
        };
      } catch (firestoreError) {
        this.validationResults.warnings.push({
          type: 'FIRESTORE_ERROR',
          message: `Error accediendo a Firestore: ${firestoreError?.message || 'Error desconocido'}`,
          details: firestoreError
        });

        this.validationResults.configStatus.firestore = {
          available: false,
          error: firestoreError?.message || 'Error desconocido'
        };
      }

      // Validar Storage
      try {
        const storage = admin.storage();
        const bucket = storage.bucket();
        
        this.validationResults.configStatus.storage = {
          available: true,
          hasBucket: !!bucket,
          bucketName: bucket?.name || 'unknown'
        };
      } catch (storageError) {
        this.validationResults.warnings.push({
          type: 'STORAGE_ERROR',
          message: `Error accediendo a Storage: ${storageError?.message || 'Error desconocido'}`,
          details: storageError
        });

        this.validationResults.configStatus.storage = {
          available: false,
          error: storageError?.message || 'Error desconocido'
        };
      }

    } catch (servicesError) {
      this.validationResults.errors.push({
        type: 'SERVICES_VALIDATION_ERROR',
        message: `Error validando servicios: ${servicesError?.message || 'Error desconocido'}`,
        details: servicesError
      });
    }
  }

  /**
   * 🔍 Consolidar resultados
   */
  consolidateResults() {
    const hasErrors = this.validationResults.errors.length > 0;
    const hasCriticalErrors = this.validationResults.errors.some(error => 
      ['MISSING_REQUIRED_VAR', 'ADMIN_SDK_NOT_AVAILABLE', 'CRITICAL_ERROR'].includes(error.type)
    );

    this.validationResults.isValid = !hasCriticalErrors;

    // Log de resumen
    if (this.validationResults.isValid) {
      logger.info('✅ Configuración Firebase válida', {
        errorsCount: this.validationResults.errors.length,
        warningsCount: this.validationResults.warnings.length,
        configStatus: this.validationResults.configStatus
      });
    } else {
      logger.error('❌ Configuración Firebase inválida', {
        errorsCount: this.validationResults.errors.length,
        warningsCount: this.validationResults.warnings.length,
        missingVariables: this.validationResults.missingVariables,
        criticalErrors: this.validationResults.errors.filter(e => 
          ['MISSING_REQUIRED_VAR', 'ADMIN_SDK_NOT_AVAILABLE', 'CRITICAL_ERROR'].includes(e.type)
        )
      });
    }
  }

  /**
   * 📋 Obtener reporte de validación
   */
  getValidationReport() {
    return {
      timestamp: new Date().toISOString(),
      isValid: this.validationResults.isValid,
      summary: {
        errorsCount: this.validationResults.errors.length,
        warningsCount: this.validationResults.warnings.length,
        missingVariablesCount: this.validationResults.missingVariables.length
      },
      details: this.validationResults,
      recommendations: this.getRecommendations()
    };
  }

  /**
   * 💡 Obtener recomendaciones
   */
  getRecommendations() {
    const recommendations = [];

    if (this.validationResults.missingVariables.length > 0) {
      recommendations.push({
        type: 'ENV_VARIABLES',
        message: 'Configura las variables de entorno faltantes en tu archivo .env',
        variables: this.validationResults.missingVariables
      });
    }

    if (this.validationResults.errors.some(e => e.type === 'ADMIN_SDK_NOT_AVAILABLE')) {
      recommendations.push({
        type: 'ADMIN_SDK',
        message: 'Instala Firebase Admin SDK: npm install firebase-admin'
      });
    }

    if (!this.validationResults.configStatus.firestore?.available) {
      recommendations.push({
        type: 'FIRESTORE',
        message: 'Verifica la configuración de Firestore en Firebase Console'
      });
    }

    if (!this.validationResults.configStatus.storage?.available) {
      recommendations.push({
        type: 'STORAGE',
        message: 'Configura Firebase Storage y verifica las reglas de seguridad'
      });
    }

    return recommendations;
  }
}

// Crear instancia global del validador
const firebaseValidator = new FirebaseValidator();

module.exports = {
  FirebaseValidator,
  firebaseValidator,
  validateFirebaseConfig: () => firebaseValidator.validateFirebaseConfig(),
  getValidationReport: () => firebaseValidator.getValidationReport()
}; 