const Equipment = require('../models/Equipment');
const EquipmentReview = require('../models/EquipmentReview');
const Employee = require('../models/Employee');
const { db } = require('../config/firebase');
const { 
  EQUIPMENT_CONFIG,
  calculateDepreciation,
  isWarrantyExpiringSoon,
  isInsuranceExpiringSoon
} = require('../config/equipmentConfig');
const logger = require('../utils/logger');

/**
 * 🎯 SERVICIO DE INICIALIZACIÓN DE EQUIPOS
 * 
 * Servicio para inicializar y migrar datos de equipos
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EquipmentInitializationService {
  /**
   * Inicializar datos de equipos para un nuevo empleado
   */
  static async initializeForNewEmployee(employeeId, employeeData) {
    try {
      logger.info('Inicializando datos de equipos para nuevo empleado', {
        employeeId,
        employeeName: `${employeeData.firstName} ${employeeData.lastName}`
      });

      // Crear colección de equipos vacía para el empleado
      const equipmentRef = db.collection('employees')
        .doc(employeeId)
        .collection('equipment');

      // Verificar si ya existe
      const snapshot = await equipmentRef.limit(1).get();
      
      if (snapshot.empty) {
        // Crear documento inicial para la colección
        await equipmentRef.doc('_initialized').set({
          initialized: true,
          initializedAt: new Date().toISOString(),
          employeeId: employeeId,
          employeeName: `${employeeData.firstName} ${employeeData.lastName}`
        });

        logger.info('Datos de equipos inicializados para nuevo empleado', {
          employeeId
        });
      }

      return true;
    } catch (error) {
      logger.error('Error al inicializar datos de equipos para nuevo empleado', {
        employeeId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Migrar empleados existentes que no tienen datos de equipos
   */
  static async migrateExistingEmployees() {
    try {
      logger.info('Iniciando migración de datos de equipos para empleados existentes');

      const employeesSnapshot = await db.collection('employees').get();
      let migratedCount = 0;
      let errorCount = 0;

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeId = employeeDoc.id;
          const employeeData = employeeDoc.data();

          // Verificar si ya tiene datos de equipos
          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeId)
            .collection('equipment')
            .limit(1)
            .get();

          if (equipmentSnapshot.empty) {
            await this.initializeForNewEmployee(employeeId, employeeData.personalInfo);
            migratedCount++;
          }
        } catch (error) {
          logger.error('Error al migrar empleado individual', {
            employeeId: employeeDoc.id,
            error: error.message
          });
          errorCount++;
        }
      }

      logger.info('Migración de datos de equipos completada', {
        totalEmployees: employeesSnapshot.size,
        migratedCount,
        errorCount
      });

      return {
        totalEmployees: employeesSnapshot.size,
        migratedCount,
        errorCount
      };
    } catch (error) {
      logger.error('Error en migración de datos de equipos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Recalcular estadísticas de todos los equipos
   */
  static async recalculateAllStatistics() {
    try {
      logger.info('Iniciando recálculo de estadísticas de equipos');

      const employeesSnapshot = await db.collection('employees').get();
      let processedEmployees = 0;
      let processedEquipment = 0;

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeId = employeeDoc.id;
          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeId)
            .collection('equipment')
            .get();

          for (const equipmentDoc of equipmentSnapshot.docs) {
            if (equipmentDoc.id === '_initialized') continue;

            try {
              const equipment = Equipment.fromFirestore(equipmentDoc);
              
              // Recalcular depreciación
              const depreciation = calculateDepreciation(
                equipment.purchaseDate, 
                equipment.purchasePrice, 
                equipment.currentValue
              );

              // Actualizar campos calculados
              await equipment.update({
                depreciation: depreciation,
                warrantyExpiringSoon: isWarrantyExpiringSoon(equipment.warranty.expirationDate),
                insuranceExpiringSoon: isInsuranceExpiringSoon(equipment.insurance.expirationDate)
              });

              processedEquipment++;
            } catch (equipmentError) {
              logger.error('Error al procesar equipo individual', {
                employeeId,
                equipmentId: equipmentDoc.id,
                error: equipmentError.message
              });
            }
          }

          processedEmployees++;
        } catch (employeeError) {
          logger.error('Error al procesar empleado individual', {
            employeeId: employeeDoc.id,
            error: employeeError.message
          });
        }
      }

      logger.info('Recálculo de estadísticas de equipos completado', {
        processedEmployees,
        processedEquipment
      });

      return {
        processedEmployees,
        processedEquipment
      };
    } catch (error) {
      logger.error('Error en recálculo de estadísticas de equipos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generar reporte de equipos por departamento
   */
  static async generateDepartmentReport() {
    try {
      logger.info('Generando reporte de equipos por departamento');

      const employeesSnapshot = await db.collection('employees').get();
      const departmentStats = {};

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeData = employeeDoc.data();
          const department = employeeData.position?.department || 'Sin departamento';
          
          if (!departmentStats[department]) {
            departmentStats[department] = {
              totalEmployees: 0,
              totalEquipment: 0,
              totalValue: 0,
              byCategory: {},
              byCondition: {},
              byStatus: {},
              warrantyExpiringSoon: 0,
              insuranceExpiringSoon: 0
            };
          }

          departmentStats[department].totalEmployees++;

          // Obtener equipos del empleado
          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeDoc.id)
            .collection('equipment')
            .get();

          for (const equipmentDoc of equipmentSnapshot.docs) {
            if (equipmentDoc.id === '_initialized') continue;

            try {
              const equipment = Equipment.fromFirestore(equipmentDoc);
              
              departmentStats[department].totalEquipment++;
              departmentStats[department].totalValue += equipment.currentValue;

              // Por categoría
              departmentStats[department].byCategory[equipment.category] = 
                (departmentStats[department].byCategory[equipment.category] || 0) + 1;

              // Por condición
              departmentStats[department].byCondition[equipment.condition] = 
                (departmentStats[department].byCondition[equipment.condition] || 0) + 1;

              // Por estado
              departmentStats[department].byStatus[equipment.status] = 
                (departmentStats[department].byStatus[equipment.status] || 0) + 1;

              // Alertas
              if (isWarrantyExpiringSoon(equipment.warranty.expirationDate)) {
                departmentStats[department].warrantyExpiringSoon++;
              }

              if (isInsuranceExpiringSoon(equipment.insurance.expirationDate)) {
                departmentStats[department].insuranceExpiringSoon++;
              }
            } catch (equipmentError) {
              logger.error('Error al procesar equipo en reporte', {
                employeeId: employeeDoc.id,
                equipmentId: equipmentDoc.id,
                error: equipmentError.message
              });
            }
          }
        } catch (employeeError) {
          logger.error('Error al procesar empleado en reporte', {
            employeeId: employeeDoc.id,
            error: employeeError.message
          });
        }
      }

      logger.info('Reporte de equipos por departamento generado', {
        departments: Object.keys(departmentStats).length
      });

      return departmentStats;
    } catch (error) {
      logger.error('Error al generar reporte de equipos por departamento', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Identificar equipos críticos que requieren atención
   */
  static async identifyCriticalEquipment() {
    try {
      logger.info('Identificando equipos críticos');

      const employeesSnapshot = await db.collection('employees').get();
      const criticalEquipment = [];

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeId = employeeDoc.id;
          const employeeData = employeeDoc.data();
          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeId)
            .collection('equipment')
            .get();

          for (const equipmentDoc of equipmentSnapshot.docs) {
            if (equipmentDoc.id === '_initialized') continue;

            try {
              const equipment = Equipment.fromFirestore(equipmentDoc);
              const issues = [];

              // Verificar condiciones críticas
              if (equipment.condition === 'damaged') {
                issues.push('Equipo dañado');
              }

              if (equipment.status === 'lost') {
                issues.push('Equipo perdido');
              }

              if (isWarrantyExpiringSoon(equipment.warranty.expirationDate)) {
                issues.push('Garantía por vencer');
              }

              if (isInsuranceExpiringSoon(equipment.insurance.expirationDate)) {
                issues.push('Seguro por vencer');
              }

              // Verificar depreciación excesiva
              const depreciation = calculateDepreciation(
                equipment.purchaseDate, 
                equipment.purchasePrice, 
                equipment.currentValue
              );

              if (depreciation.totalDepreciation > 80) {
                issues.push('Depreciación excesiva');
              }

              if (issues.length > 0) {
                criticalEquipment.push({
                  equipmentId: equipment.id,
                  employeeId: employeeId,
                  employeeName: `${employeeData.personalInfo?.firstName || ''} ${employeeData.personalInfo?.lastName || ''}`,
                  equipmentName: equipment.name,
                  category: equipment.category,
                  condition: equipment.condition,
                  status: equipment.status,
                  currentValue: equipment.currentValue,
                  issues: issues,
                  depreciation: depreciation
                });
              }
            } catch (equipmentError) {
              logger.error('Error al procesar equipo crítico', {
                employeeId,
                equipmentId: equipmentDoc.id,
                error: equipmentError.message
              });
            }
          }
        } catch (employeeError) {
          logger.error('Error al procesar empleado para equipos críticos', {
            employeeId: employeeDoc.id,
            error: employeeError.message
          });
        }
      }

      logger.info('Identificación de equipos críticos completada', {
        criticalCount: criticalEquipment.length
      });

      return criticalEquipment;
    } catch (error) {
      logger.error('Error al identificar equipos críticos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Limpiar datos obsoletos de equipos
   */
  static async cleanupObsoleteData() {
    try {
      logger.info('Iniciando limpieza de datos obsoletos de equipos');

      const employeesSnapshot = await db.collection('employees').get();
      let cleanedCount = 0;

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeId = employeeDoc.id;
          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeId)
            .collection('equipment')
            .get();

          for (const equipmentDoc of equipmentSnapshot.docs) {
            if (equipmentDoc.id === '_initialized') continue;

            try {
              const equipment = Equipment.fromFirestore(equipmentDoc);
              
              // Eliminar equipos devueltos hace más de 1 año
              if (equipment.status === 'returned' && equipment.returnDate) {
                const returnDate = new Date(equipment.returnDate);
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                if (returnDate < oneYearAgo) {
                  await Equipment.delete(employeeId, equipment.id);
                  cleanedCount++;
                  
                  logger.info('Equipo obsoleto eliminado', {
                    equipmentId: equipment.id,
                    employeeId,
                    returnDate: equipment.returnDate
                  });
                }
              }
            } catch (equipmentError) {
              logger.error('Error al limpiar equipo individual', {
                employeeId,
                equipmentId: equipmentDoc.id,
                error: equipmentError.message
              });
            }
          }
        } catch (employeeError) {
          logger.error('Error al limpiar empleado individual', {
            employeeId: employeeDoc.id,
            error: employeeError.message
          });
        }
      }

      logger.info('Limpieza de datos obsoletos de equipos completada', {
        cleanedCount
      });

      return {
        cleanedCount
      };
    } catch (error) {
      logger.error('Error en limpieza de datos obsoletos de equipos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Validar integridad de datos de equipos
   */
  static async validateDataIntegrity() {
    try {
      logger.info('Iniciando validación de integridad de datos de equipos');

      const employeesSnapshot = await db.collection('employees').get();
      const validationResults = {
        totalEmployees: 0,
        totalEquipment: 0,
        validationErrors: [],
        orphanedEquipment: [],
        invalidData: []
      };

      for (const employeeDoc of employeesSnapshot.docs) {
        try {
          const employeeId = employeeDoc.id;
          validationResults.totalEmployees++;

          const equipmentSnapshot = await db.collection('employees')
            .doc(employeeId)
            .collection('equipment')
            .get();

          for (const equipmentDoc of equipmentSnapshot.docs) {
            if (equipmentDoc.id === '_initialized') continue;

            try {
              validationResults.totalEquipment++;
              const equipment = Equipment.fromFirestore(equipmentDoc);

              // Validar datos del equipo
              const errors = equipment.validate();
              if (errors.length > 0) {
                validationResults.invalidData.push({
                  equipmentId: equipment.id,
                  employeeId: employeeId,
                  errors: errors
                });
              }

              // Verificar que el empleado existe
              if (equipment.employeeId !== employeeId) {
                validationResults.orphanedEquipment.push({
                  equipmentId: equipment.id,
                  expectedEmployeeId: employeeId,
                  actualEmployeeId: equipment.employeeId
                });
              }
            } catch (equipmentError) {
              validationResults.validationErrors.push({
                equipmentId: equipmentDoc.id,
                employeeId: employeeId,
                error: equipmentError.message
              });
            }
          }
        } catch (employeeError) {
          validationResults.validationErrors.push({
            employeeId: employeeDoc.id,
            error: employeeError.message
          });
        }
      }

      logger.info('Validación de integridad de datos de equipos completada', {
        totalEmployees: validationResults.totalEmployees,
        totalEquipment: validationResults.totalEquipment,
        errors: validationResults.validationErrors.length,
        invalidData: validationResults.invalidData.length,
        orphanedEquipment: validationResults.orphanedEquipment.length
      });

      return validationResults;
    } catch (error) {
      logger.error('Error en validación de integridad de datos de equipos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = EquipmentInitializationService;
