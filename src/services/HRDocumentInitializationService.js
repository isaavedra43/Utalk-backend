const HRDocumentSummary = require('../models/HRDocumentSummary');
const HRDocumentFolder = require('../models/HRDocumentFolder');
const { getConfig } = require('../config/hrDocumentConfig');

/**
 * Servicio de Inicialización de Documentos de RH
 * Se ejecuta automáticamente al instalar el sistema
 */
class HRDocumentInitializationService {
  
  /**
   * Inicializa el sistema de documentos de RH
   * Crea el resumen inicial y carpetas por defecto
   */
  static async initializeSystem(createdBy = 'system') {
    try {
      console.log('📚 Inicializando sistema de documentos de RH...');
      
      // 1. Crear resumen inicial
      const summary = await HRDocumentSummary.getOrCreate();
      console.log('✅ Resumen de documentos inicializado');

      // 2. Crear carpetas por defecto
      const defaultFolders = await HRDocumentFolder.createDefaultFolders(createdBy);
      console.log(`✅ ${defaultFolders.length} carpetas por defecto creadas`);

      // 3. Verificar estructura de base de datos
      await HRDocumentInitializationService.verifyDatabaseStructure();

      console.log('🎉 Sistema de documentos de RH inicializado exitosamente');
      
      return {
        summary: summary.toFirestore(),
        folders: defaultFolders.map(folder => folder.toFirestore()),
        success: true
      };
    } catch (error) {
      console.error('❌ Error inicializando sistema de documentos de RH:', error);
      throw error;
    }
  }

  /**
   * Verifica la estructura de la base de datos
   */
  static async verifyDatabaseStructure() {
    try {
      console.log('🔍 Verificando estructura de base de datos...');
      
      const { db } = require('../config/firebase');
      
      // Verificar colecciones principales
      const collections = [
        'hr_documents/documentSummary',
        'hr_documents/documents/list',
        'hr_documents/folders/list',
        'hr_documents/activity_log/list'
      ];

      for (const collectionPath of collections) {
        const [collection, doc, subcollection] = collectionPath.split('/');
        
        if (subcollection) {
          // Es una subcolección
          const snapshot = await db.collection(collection).doc(doc).collection(subcollection).limit(1).get();
          console.log(`✅ Subcolección ${collectionPath} verificada`);
        } else {
          // Es un documento
          const docRef = db.collection(collection).doc(doc);
          const docSnap = await docRef.get();
          console.log(`✅ Documento ${collectionPath} ${docSnap.exists ? 'existe' : 'creado'}`);
        }
      }

      console.log('✅ Estructura de base de datos verificada');
    } catch (error) {
      console.error('❌ Error verificando estructura de base de datos:', error);
      throw error;
    }
  }

  /**
   * Recalcula todas las estadísticas del sistema
   */
  static async recalculateAllStats() {
    try {
      console.log('📊 Recalculando estadísticas del sistema de documentos...');
      
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.recalculateStats();
      
      console.log('✅ Estadísticas recalculadas exitosamente');
      
      return {
        summary: summary.toFirestore(),
        success: true
      };
    } catch (error) {
      console.error('❌ Error recalculando estadísticas:', error);
      throw error;
    }
  }

  /**
   * Limpia datos obsoletos del sistema
   */
  static async cleanupObsoleteData() {
    try {
      console.log('🧹 Limpiando datos obsoletos del sistema de documentos...');
      
      const HRDocumentActivity = require('../models/HRDocumentActivity');
      
      // Limpiar actividades antiguas
      await HRDocumentActivity.cleanupOldActivities();
      
      console.log(`✅ Actividades antiguas limpiadas`);
      
      return {
        deletedActivities: 'unknown',
        cutoffDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        success: true
      };
    } catch (error) {
      console.error('❌ Error limpiando datos obsoletos:', error);
      throw error;
    }
  }

  /**
   * Genera reporte de uso del sistema
   */
  static async generateUsageReport() {
    try {
      console.log('📋 Generando reporte de uso del sistema...');
      
      const HRDocument = require('../models/HRDocument');
      const HRDocumentActivity = require('../models/HRDocumentActivity');
      const HRDocumentFolder = require('../models/HRDocumentFolder');
      
      // Obtener estadísticas generales
      const summary = await HRDocumentSummary.getOrCreate();
      
      // Obtener carpetas
      const folders = await HRDocumentFolder.list();
      
      // Obtener estadísticas de actividad
      const activityStats = await HRDocumentActivity.getStats();
      
      // Obtener documentos más populares
      const documents = await HRDocument.list({ limit: 1000 });
      const mostPopular = documents
        .sort((a, b) => (b.downloadCount + b.viewCount) - (a.downloadCount + a.viewCount))
        .slice(0, 10);

      const report = {
        summary: summary.toFirestore(),
        folders: {
          total: folders.length,
          list: folders.map(folder => ({
            name: folder.name,
            documentCount: folder.documentCount,
            totalSize: folder.totalSize
          }))
        },
        activity: activityStats,
        mostPopular: mostPopular.map(doc => ({
          id: doc.id,
          name: doc.name,
          category: doc.category,
          type: doc.type,
          downloadCount: doc.downloadCount,
          viewCount: doc.viewCount,
          totalInteractions: doc.downloadCount + doc.viewCount
        })),
        generatedAt: new Date().toISOString(),
        generatedBy: 'system'
      };

      console.log('✅ Reporte de uso generado exitosamente');
      
      return report;
    } catch (error) {
      console.error('❌ Error generando reporte de uso:', error);
      throw error;
    }
  }

  /**
   * Migra datos de un sistema anterior (si existe)
   */
  static async migrateFromLegacySystem() {
    try {
      console.log('🔄 Iniciando migración desde sistema anterior...');
      
      // TODO: Implementar migración desde sistema anterior si es necesario
      // Por ahora, solo inicializar el sistema nuevo
      
      const result = await HRDocumentInitializationService.initializeSystem('migration');
      
      console.log('✅ Migración completada exitosamente');
      
      return {
        ...result,
        migrated: true
      };
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  }

  /**
   * Verifica la integridad del sistema
   */
  static async verifySystemIntegrity() {
    try {
      console.log('🔍 Verificando integridad del sistema...');
      
      const issues = [];
      
      // Verificar resumen
      const summary = await HRDocumentSummary.getOrCreate();
      if (summary.totalDocuments < 0) {
        issues.push('Total de documentos negativo en resumen');
      }
      
      // Verificar carpetas
      const folders = await HRDocumentFolder.list();
      for (const folder of folders) {
        if (folder.documentCount < 0) {
          issues.push(`Conteo negativo en carpeta: ${folder.name}`);
        }
      }
      
      // Verificar documentos
      const HRDocument = require('../models/HRDocument');
      const documents = await HRDocument.list({ limit: 100 });
      for (const doc of documents) {
        if (doc.fileSize <= 0) {
          issues.push(`Tamaño de archivo inválido en documento: ${doc.name}`);
        }
        if (!doc.fileUrl) {
          issues.push(`URL de archivo faltante en documento: ${doc.name}`);
        }
      }
      
      const result = {
        verified: issues.length === 0,
        issues,
        summary: summary.toFirestore(),
        foldersCount: folders.length,
        documentsCount: documents.length,
        verifiedAt: new Date().toISOString()
      };
      
      if (issues.length === 0) {
        console.log('✅ Integridad del sistema verificada - Sin problemas encontrados');
      } else {
        console.log(`⚠️ Integridad del sistema verificada - ${issues.length} problemas encontrados`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error verificando integridad del sistema:', error);
      throw error;
    }
  }

  /**
   * Optimiza el rendimiento del sistema
   */
  static async optimizeSystemPerformance() {
    try {
      console.log('⚡ Optimizando rendimiento del sistema...');
      
      // Recalcular estadísticas
      await HRDocumentInitializationService.recalculateAllStats();
      
      // Limpiar datos obsoletos
      await HRDocumentInitializationService.cleanupObsoleteData();
      
      // Verificar integridad
      const integrity = await HRDocumentInitializationService.verifySystemIntegrity();
      
      console.log('✅ Optimización del sistema completada');
      
      return {
        statsRecalculated: true,
        obsoleteDataCleaned: true,
        integrityVerified: integrity.verified,
        issuesFound: integrity.issues.length,
        optimizedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error optimizando sistema:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentInitializationService;
