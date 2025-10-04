const Equipment = require('../models/Equipment');
const EquipmentReview = require('../models/EquipmentReview');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');
const { 
  EQUIPMENT_CONFIG, 
  getErrorMessage, 
  getSuccessMessage,
  hasPermission,
  calculateDepreciation,
  isWarrantyExpiringSoon,
  isInsuranceExpiringSoon
} = require('../config/equipmentConfig');
const logger = require('../utils/logger');

/**
 * 🎯 CONTROLADOR DE EQUIPOS
 * 
 * Maneja todas las operaciones relacionadas con equipos y herramientas
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EquipmentController {
  /**
   * Obtener todos los equipos de un empleado
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { 
        category, 
        status, 
        condition, 
        search,
        page = 1, 
        limit = 20,
        orderBy = 'assignedDate',
        orderDirection = 'desc'
      } = req.query;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Construir opciones de búsqueda
      const options = {
        category,
        status,
        condition,
        orderBy,
        orderDirection,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      // Obtener equipos
      const equipment = await Equipment.listByEmployee(employeeId, options);

      // Aplicar búsqueda por texto si se proporciona
      let filteredEquipment = equipment;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredEquipment = equipment.filter(item => 
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower) ||
          item.brand?.toLowerCase().includes(searchLower) ||
          item.model?.toLowerCase().includes(searchLower) ||
          item.serialNumber?.toLowerCase().includes(searchLower) ||
          item.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Agregar información adicional a cada equipo
      const equipmentWithExtras = await Promise.all(
        filteredEquipment.map(async (item) => {
          const lastReview = await EquipmentReview.getLastReview(employeeId, item.id);
          const depreciation = calculateDepreciation(item.purchaseDate, item.purchasePrice, item.currentValue);
          
          return {
            ...item,
            lastReview,
            depreciation,
            warrantyExpiringSoon: isWarrantyExpiringSoon(item.warranty.expirationDate),
            insuranceExpiringSoon: isInsuranceExpiringSoon(item.insurance.expirationDate)
          };
        })
      );

      res.json({
        success: true,
        data: equipmentWithExtras,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: equipmentWithExtras.length
        }
      });
    } catch (error) {
      logger.error('Error al obtener equipos del empleado', {
        employeeId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener equipo específico
   */
  static async getById(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Obtener equipo
      const equipment = await Equipment.findById(employeeId, equipmentId);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Obtener información adicional
      const lastReview = await EquipmentReview.getLastReview(employeeId, equipmentId);
      const reviewStats = await EquipmentReview.getReviewStats(employeeId, equipmentId);
      const depreciation = calculateDepreciation(equipment.purchaseDate, equipment.purchasePrice, equipment.currentValue);

      res.json({
        success: true,
        data: {
          ...equipment,
          lastReview,
          reviewStats,
          depreciation,
          warrantyExpiringSoon: isWarrantyExpiringSoon(equipment.warranty.expirationDate),
          insuranceExpiringSoon: isInsuranceExpiringSoon(equipment.insurance.expirationDate)
        }
      });
    } catch (error) {
      logger.error('Error al obtener equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nuevo equipo
   */
  static async create(req, res) {
    try {
      const { id: employeeId } = req.params;
      const equipmentData = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'CREATE_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Crear equipo
      const equipment = new Equipment({
        ...equipmentData,
        employeeId
      });

      // Validar datos
      const errors = equipment.validate();
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Errores de validación',
          details: errors
        });
      }

      // Guardar equipo
      await equipment.save();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_assigned',
        {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          category: equipment.category,
          assignedBy: userName,
          assignedDate: equipment.assignedDate
        },
        userId
      );

      logger.info('Equipo creado exitosamente', {
        equipmentId: equipment.id,
        employeeId,
        equipmentName: equipment.name,
        createdBy: userName
      });

      res.status(201).json({
        success: true,
        data: equipment,
        message: getSuccessMessage('EQUIPMENT_CREATED')
      });
    } catch (error) {
      logger.error('Error al crear equipo', {
        employeeId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar equipo
   */
  static async update(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const updateData = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'UPDATE_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipo existente
      const existingEquipment = await Equipment.findById(employeeId, equipmentId);
      if (!existingEquipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Actualizar equipo
      await existingEquipment.update(updateData);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_updated',
        {
          equipmentId: existingEquipment.id,
          equipmentName: existingEquipment.name,
          updatedBy: userName,
          changes: Object.keys(updateData)
        },
        userId
      );

      logger.info('Equipo actualizado exitosamente', {
        equipmentId: existingEquipment.id,
        employeeId,
        updatedBy: userName
      });

      res.json({
        success: true,
        data: existingEquipment,
        message: getSuccessMessage('EQUIPMENT_UPDATED')
      });
    } catch (error) {
      logger.error('Error al actualizar equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Eliminar equipo
   */
  static async delete(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'DELETE_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipo existente
      const existingEquipment = await Equipment.findById(employeeId, equipmentId);
      if (!existingEquipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Verificar que no esté asignado
      if (existingEquipment.status === 'assigned' || existingEquipment.status === 'in_use') {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('CANNOT_DELETE_ASSIGNED')
        });
      }

      // Eliminar equipo
      await Equipment.delete(employeeId, equipmentId);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_deleted',
        {
          equipmentId: existingEquipment.id,
          equipmentName: existingEquipment.name,
          deletedBy: userName
        },
        userId
      );

      logger.info('Equipo eliminado exitosamente', {
        equipmentId: existingEquipment.id,
        employeeId,
        deletedBy: userName
      });

      res.json({
        success: true,
        message: getSuccessMessage('EQUIPMENT_DELETED')
      });
    } catch (error) {
      logger.error('Error al eliminar equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Devolver equipo
   */
  static async return(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const { condition, notes, photos = [] } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'RETURN_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipo existente
      const existingEquipment = await Equipment.findById(employeeId, equipmentId);
      if (!existingEquipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Verificar que esté asignado
      if (existingEquipment.status !== 'assigned' && existingEquipment.status !== 'in_use') {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('CANNOT_RETURN_NOT_ASSIGNED')
        });
      }

      // Devolver equipo
      const returnDate = new Date().toISOString().split('T')[0];
      await existingEquipment.return(returnDate, condition, notes, photos);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_returned',
        {
          equipmentId: existingEquipment.id,
          equipmentName: existingEquipment.name,
          condition,
          returnedBy: userName,
          returnDate
        },
        userId
      );

      logger.info('Equipo devuelto exitosamente', {
        equipmentId: existingEquipment.id,
        employeeId,
        returnedBy: userName
      });

      res.json({
        success: true,
        data: existingEquipment,
        message: getSuccessMessage('EQUIPMENT_RETURNED')
      });
    } catch (error) {
      logger.error('Error al devolver equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Reportar equipo perdido
   */
  static async reportLost(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const { lostDate, description, policeReportNumber } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'REPORT_LOST')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipo existente
      const existingEquipment = await Equipment.findById(employeeId, equipmentId);
      if (!existingEquipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Reportar como perdido
      await existingEquipment.reportLost(lostDate, description, policeReportNumber);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_lost',
        {
          equipmentId: existingEquipment.id,
          equipmentName: existingEquipment.name,
          lostDate,
          description,
          policeReportNumber,
          reportedBy: userName
        },
        userId
      );

      logger.info('Equipo reportado como perdido', {
        equipmentId: existingEquipment.id,
        employeeId,
        reportedBy: userName
      });

      res.json({
        success: true,
        data: existingEquipment,
        message: getSuccessMessage('EQUIPMENT_LOST_REPORTED')
      });
    } catch (error) {
      logger.error('Error al reportar equipo perdido', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Reportar daño en equipo
   */
  static async reportDamage(req, res) {
    try {
      const { id: employeeId, equipmentId } = req.params;
      const { description, severity, photos = [], estimatedCost } = req.body;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'REPORT_DAMAGE')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipo existente
      const existingEquipment = await Equipment.findById(employeeId, equipmentId);
      if (!existingEquipment) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EQUIPMENT_NOT_FOUND')
        });
      }

      // Reportar daño
      await existingEquipment.reportDamage(description, severity, photos, estimatedCost);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'equipment_damaged',
        {
          equipmentId: existingEquipment.id,
          equipmentName: existingEquipment.name,
          description,
          severity,
          estimatedCost,
          reportedBy: userName
        },
        userId
      );

      logger.info('Daño reportado en equipo', {
        equipmentId: existingEquipment.id,
        employeeId,
        reportedBy: userName
      });

      res.json({
        success: true,
        data: existingEquipment,
        message: getSuccessMessage('EQUIPMENT_DAMAGE_REPORTED')
      });
    } catch (error) {
      logger.error('Error al reportar daño en equipo', {
        employeeId: req.params.id,
        equipmentId: req.params.equipmentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener resumen estadístico
   */
  static async getSummary(req, res) {
    try {
      const { id: employeeId } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Obtener todos los equipos
      const equipment = await Equipment.listByEmployee(employeeId);

      // Calcular estadísticas
      const summary = {
        totalEquipment: equipment.length,
        totalValue: equipment.reduce((sum, item) => sum + item.currentValue, 0),
        assignedEquipment: equipment.filter(item => item.status === 'assigned' || item.status === 'in_use').length,
        inMaintenanceEquipment: equipment.filter(item => item.status === 'maintenance').length,
        returnedEquipment: equipment.filter(item => item.status === 'returned').length,
        lostEquipment: equipment.filter(item => item.status === 'lost').length,
        damagedEquipment: equipment.filter(item => item.status === 'damaged').length,
        
        // Distribuciones
        byCategory: {},
        byCondition: {},
        byStatus: {},
        
        averageConditionScore: 0,
        maintenanceDue: 0,
        warrantyExpiringSoon: 0,
        insuranceExpiringSoon: 0,
        totalReviews: 0
      };

      // Calcular distribuciones
      equipment.forEach(item => {
        // Por categoría
        summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
        
        // Por condición
        summary.byCondition[item.condition] = (summary.byCondition[item.condition] || 0) + 1;
        
        // Por estado
        summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1;
        
        // Alertas
        if (isWarrantyExpiringSoon(item.warranty.expirationDate)) {
          summary.warrantyExpiringSoon++;
        }
        
        if (isInsuranceExpiringSoon(item.insurance.expirationDate)) {
          summary.insuranceExpiringSoon++;
        }
      });

      // Calcular score promedio de condición
      const conditionScores = {
        'excellent': 100,
        'good': 80,
        'fair': 60,
        'poor': 40,
        'damaged': 20
      };
      
      const totalScore = equipment.reduce((sum, item) => sum + (conditionScores[item.condition] || 0), 0);
      summary.averageConditionScore = equipment.length > 0 ? Math.round(totalScore / equipment.length) : 0;

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error al obtener resumen de equipos', {
        employeeId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Exportar equipos
   */
  static async export(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { format = 'excel' } = req.query;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'EXPORT_EQUIPMENT')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener todos los equipos
      const equipment = await Equipment.listByEmployee(employeeId);

      // Preparar datos para exportación
      const exportData = equipment.map(item => ({
        'Nombre': item.name,
        'Categoría': item.category,
        'Marca': item.brand || '',
        'Modelo': item.model || '',
        'Número de Serie': item.serialNumber || '',
        'Descripción': item.description,
        'Condición': item.condition,
        'Estado': item.status,
        'Fecha de Compra': item.purchaseDate,
        'Precio de Compra': item.purchasePrice,
        'Valor Actual': item.currentValue,
        'Moneda': item.currency,
        'Fecha de Asignación': item.assignedDate,
        'Fecha de Devolución': item.returnDate || '',
        'Ubicación': item.location || '',
        'Proveedor': item.invoice.supplier,
        'Número de Factura': item.invoice.number,
        'Garantía': item.warranty.hasWarranty ? 'Sí' : 'No',
        'Vencimiento Garantía': item.warranty.expirationDate || '',
        'Seguro': item.insurance.hasInsurance ? 'Sí' : 'No',
        'Vencimiento Seguro': item.insurance.expirationDate || '',
        'Notas': item.notes || '',
        'Etiquetas': item.tags.join(', ')
      }));

      if (format === 'pdf') {
        // TODO: Implementar generación de PDF
        res.json({
          success: true,
          message: 'Exportación PDF no implementada aún',
          data: exportData
        });
      } else {
        // Exportación Excel (CSV)
        const csvContent = [
          Object.keys(exportData[0] || {}).join(','),
          ...exportData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="equipos_${employeeId}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      }
    } catch (error) {
      logger.error('Error al exportar equipos', {
        employeeId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Generar reporte específico
   */
  static async generateReport(req, res) {
    try {
      const { id: employeeId, reportType } = req.params;

      // Verificar empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('EMPLOYEE_NOT_FOUND')
        });
      }

      // Verificar permisos
      if (!hasPermission(req.user?.role, 'GENERATE_REPORTS')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('UNAUTHORIZED_ACCESS')
        });
      }

      // Obtener equipos
      const equipment = await Equipment.listByEmployee(employeeId);

      let reportData = {};

      switch (reportType) {
        case 'inventory':
          reportData = {
            title: 'Reporte de Inventario de Equipos',
            employee: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            generatedAt: new Date().toISOString(),
            equipment: equipment.map(item => ({
              name: item.name,
              category: item.category,
              condition: item.condition,
              status: item.status,
              currentValue: item.currentValue,
              assignedDate: item.assignedDate
            }))
          };
          break;

        case 'maintenance':
          reportData = {
            title: 'Reporte de Mantenimiento',
            employee: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            generatedAt: new Date().toISOString(),
            equipmentNeedingMaintenance: equipment.filter(item => 
              item.condition === 'poor' || item.condition === 'damaged'
            ).map(item => ({
              name: item.name,
              condition: item.condition,
              lastReview: null // TODO: Obtener última revisión
            }))
          };
          break;

        case 'depreciation':
          reportData = {
            title: 'Reporte de Depreciación',
            employee: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            generatedAt: new Date().toISOString(),
            equipment: equipment.map(item => {
              const depreciation = calculateDepreciation(item.purchaseDate, item.purchasePrice, item.currentValue);
              return {
                name: item.name,
                purchaseDate: item.purchaseDate,
                purchasePrice: item.purchasePrice,
                currentValue: item.currentValue,
                depreciatedValue: depreciation.depreciatedValue,
                yearsInUse: depreciation.yearsInUse,
                depreciationPercentage: depreciation.totalDepreciation
              };
            })
          };
          break;

        case 'responsibility':
          reportData = {
            title: 'Reporte de Responsabilidad',
            employee: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            generatedAt: new Date().toISOString(),
            assignedEquipment: equipment.filter(item => 
              item.status === 'assigned' || item.status === 'in_use'
            ).map(item => ({
              name: item.name,
              category: item.category,
              assignedDate: item.assignedDate,
              condition: item.condition,
              currentValue: item.currentValue
            }))
          };
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Tipo de reporte inválido'
          });
      }

      res.json({
        success: true,
        data: reportData,
        message: getSuccessMessage('REPORT_GENERATED')
      });
    } catch (error) {
      logger.error('Error al generar reporte', {
        employeeId: req.params.id,
        reportType: req.params.reportType,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = EquipmentController;
