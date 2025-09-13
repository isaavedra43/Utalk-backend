const TaxConfig = require('../models/TaxConfig');
const EnhancedPayrollService = require('../services/EnhancedPayrollService');
const logger = require('../utils/logger');
const { db } = require('../config/firebase');

/**
 * 🆕 Controlador de Configuración de Impuestos
 * Maneja la configuración de impuestos opcionales globales y por empleado
 */
class TaxConfigController {
  /**
   * Obtener configuraciones globales de impuestos
   * GET /api/tax-config/global
   */
  static async getGlobalTaxConfigs(req, res) {
    try {
      const { companyId = 'default' } = req.query;

      logger.info('📋 Obteniendo configuraciones globales de impuestos', { companyId });

      const taxConfigs = await TaxConfig.findGlobal(companyId);

      res.json({
        success: true,
        data: {
          taxConfigs: taxConfigs.map(config => config.toFirestore()),
          total: taxConfigs.length
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo configuraciones globales', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo configuraciones'
      });
    }
  }

  /**
   * Obtener configuraciones de impuestos por empleado
   * GET /api/tax-config/employee/:employeeId
   */
  static async getEmployeeTaxConfigs(req, res) {
    try {
      const { employeeId } = req.params;

      logger.info('📋 Obteniendo configuraciones de impuestos por empleado', { employeeId });

      const taxConfigs = await TaxConfig.findByEmployee(employeeId);

      res.json({
        success: true,
        data: {
          employeeId,
          taxConfigs: taxConfigs.map(config => config.toFirestore()),
          total: taxConfigs.length
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo configuraciones por empleado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo configuraciones'
      });
    }
  }

  /**
   * Obtener configuración efectiva para un empleado
   * GET /api/tax-config/effective/:employeeId
   */
  static async getEffectiveTaxConfig(req, res) {
    try {
      const { employeeId } = req.params;
      const { companyId = 'default' } = req.query;

      logger.info('📋 Obteniendo configuración efectiva', { employeeId, companyId });

      const effectiveConfig = await TaxConfig.getEffectiveConfig(employeeId, companyId);

      res.json({
        success: true,
        data: {
          employeeId,
          companyId,
          taxConfigs: effectiveConfig.map(config => ({
            ...config.toFirestore(),
            source: config.scope // 'global' o 'employee'
          })),
          total: effectiveConfig.length
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo configuración efectiva', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo configuración efectiva'
      });
    }
  }

  /**
   * Crear configuración global de impuesto
   * POST /api/tax-config/global
   */
  static async createGlobalTaxConfig(req, res) {
    try {
      const taxData = req.body;
      const userId = req.user?.id;
      const { companyId = 'default' } = req.body;

      logger.info('🆕 Creando configuración global de impuesto', { taxData, userId });

      const taxConfig = new TaxConfig({
        ...taxData,
        scope: 'global',
        companyId,
        createdBy: userId,
        updatedBy: userId
      });

      // Validar configuración
      const errors = taxConfig.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Errores de validación: ${errors.join(', ')}`,
          details: errors
        });
      }

      await taxConfig.save();

      res.status(201).json({
        success: true,
        message: 'Configuración global de impuesto creada exitosamente',
        data: {
          taxConfig: taxConfig.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error creando configuración global', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor creando configuración'
      });
    }
  }

  /**
   * Crear configuración de impuesto por empleado
   * POST /api/tax-config/employee/:employeeId
   */
  static async createEmployeeTaxConfig(req, res) {
    try {
      const { employeeId } = req.params;
      const taxData = req.body;
      const userId = req.user?.id;

      logger.info('🆕 Creando configuración de impuesto por empleado', { employeeId, taxData, userId });

      const taxConfig = new TaxConfig({
        ...taxData,
        scope: 'employee',
        employeeId,
        createdBy: userId,
        updatedBy: userId
      });

      // Validar configuración
      const errors = taxConfig.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Errores de validación: ${errors.join(', ')}`,
          details: errors
        });
      }

      await taxConfig.save();

      res.status(201).json({
        success: true,
        message: 'Configuración de impuesto por empleado creada exitosamente',
        data: {
          employeeId,
          taxConfig: taxConfig.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error creando configuración por empleado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor creando configuración'
      });
    }
  }

  /**
   * Actualizar configuración de impuesto
   * PUT /api/tax-config/:configId
   */
  static async updateTaxConfig(req, res) {
    try {
      const { configId } = req.params;
      const updateData = req.body;
      const userId = req.user?.id;

      logger.info('🔄 Actualizando configuración de impuesto', { configId, updateData, userId });

      // Buscar configuración (puede ser global o por empleado)
      let taxConfig = null;
      
      // Intentar buscar en configuraciones globales
      try {
        const globalDoc = await db.collection('globalTaxConfigs').doc(configId).get();
        if (globalDoc.exists) {
          taxConfig = TaxConfig.fromFirestore(globalDoc);
        }
      } catch (error) {
        // Continuar buscando en empleados
      }

      // Si no se encuentra globalmente, buscar en empleados
      if (!taxConfig && updateData.employeeId) {
        try {
          const employeeDoc = await db.collection(`employees/${updateData.employeeId}/taxConfigs`).doc(configId).get();
          if (employeeDoc.exists) {
            taxConfig = TaxConfig.fromFirestore(employeeDoc);
          }
        } catch (error) {
          // Configuración no encontrada
        }
      }

      if (!taxConfig) {
        return res.status(404).json({
          success: false,
          error: 'Configuración de impuesto no encontrada'
        });
      }

      // Actualizar campos
      Object.assign(taxConfig, updateData);
      taxConfig.updatedBy = userId;
      taxConfig.updatedAt = new Date().toISOString();

      // Validar configuración actualizada
      const errors = taxConfig.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Errores de validación: ${errors.join(', ')}`,
          details: errors
        });
      }

      await taxConfig.save();

      res.json({
        success: true,
        message: 'Configuración de impuesto actualizada exitosamente',
        data: {
          taxConfig: taxConfig.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error actualizando configuración de impuesto', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor actualizando configuración'
      });
    }
  }

  /**
   * Eliminar configuración de impuesto
   * DELETE /api/tax-config/:configId
   */
  static async deleteTaxConfig(req, res) {
    try {
      const { configId } = req.params;
      const { employeeId } = req.query;

      logger.info('🗑️ Eliminando configuración de impuesto', { configId, employeeId });

      // Buscar y eliminar configuración
      let deleted = false;
      
      // Intentar eliminar de configuraciones globales
      try {
        const globalDoc = await db.collection('globalTaxConfigs').doc(configId).get();
        if (globalDoc.exists) {
          const taxConfig = TaxConfig.fromFirestore(globalDoc);
          await taxConfig.delete();
          deleted = true;
        }
      } catch (error) {
        // Continuar con empleados
      }

      // Si no se eliminó globalmente, intentar con empleados
      if (!deleted && employeeId) {
        try {
          const employeeDoc = await db.collection(`employees/${employeeId}/taxConfigs`).doc(configId).get();
          if (employeeDoc.exists) {
            const taxConfig = TaxConfig.fromFirestore(employeeDoc);
            await taxConfig.delete();
            deleted = true;
          }
        } catch (error) {
          // Configuración no encontrada
        }
      }

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Configuración de impuesto no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Configuración de impuesto eliminada exitosamente'
      });

    } catch (error) {
      logger.error('❌ Error eliminando configuración de impuesto', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor eliminando configuración'
      });
    }
  }

  /**
   * Crear configuraciones por defecto para México
   * POST /api/tax-config/create-defaults
   */
  static async createDefaultTaxes(req, res) {
    try {
      const { companyId = 'default' } = req.body;
      const userId = req.user?.id;

      logger.info('🏗️ Creando configuraciones por defecto para México', { companyId, userId });

      const defaultTaxes = await TaxConfig.createDefaultMexicoTaxes(companyId, userId);

      res.status(201).json({
        success: true,
        message: 'Configuraciones por defecto creadas exitosamente',
        data: {
          taxConfigs: defaultTaxes.map(config => config.toFirestore()),
          total: defaultTaxes.length
        }
      });

    } catch (error) {
      logger.error('❌ Error creando configuraciones por defecto', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor creando configuraciones por defecto'
      });
    }
  }

  /**
   * Configurar impuestos para un empleado específico
   * PUT /api/tax-config/employee/:employeeId/settings
   */
  static async configureEmployeeTaxes(req, res) {
    try {
      const { employeeId } = req.params;
      const { taxSettings } = req.body;
      const userId = req.user?.id;

      logger.info('⚙️ Configurando impuestos para empleado', { employeeId, taxSettings, userId });

      const updatedConfig = await EnhancedPayrollService.configureTaxes(employeeId, taxSettings, userId);

      res.json({
        success: true,
        message: 'Configuración de impuestos actualizada exitosamente',
        data: {
          employeeId,
          taxSettings: updatedConfig.taxSettings,
          config: updatedConfig.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error configurando impuestos para empleado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor configurando impuestos'
      });
    }
  }

  /**
   * Vista previa de cálculo de impuestos
   * POST /api/tax-config/preview/:employeeId
   */
  static async previewTaxCalculation(req, res) {
    try {
      const { employeeId } = req.params;
      const { grossSalary, periodDate } = req.body;

      logger.info('👁️ Vista previa de cálculo de impuestos', { employeeId, grossSalary, periodDate });

      const preview = await EnhancedPayrollService.previewPayroll(
        employeeId, 
        periodDate ? new Date(periodDate) : new Date()
      );

      res.json({
        success: true,
        data: {
          employeeId,
          preview,
          calculatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('❌ Error generando vista previa de impuestos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor generando vista previa'
      });
    }
  }
}

module.exports = TaxConfigController;
