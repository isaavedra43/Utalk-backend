/**
 * 📦 SERVICIO DE PROVEEDORES
 * 
 * Maneja la lógica de negocio para proveedores de materiales.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const Provider = require('../models/Provider');
const Platform = require('../models/Platform');
const Material = require('../models/Material');
const ProviderMaterial = require('../models/ProviderMaterial');
const PurchaseOrder = require('../models/PurchaseOrder');
const Payment = require('../models/Payment');
const ProviderDocument = require('../models/ProviderDocument');
const ProviderActivity = require('../models/ProviderActivity');
const ProviderRating = require('../models/ProviderRating');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

class ProviderService {
  /**
   * Lista todos los proveedores del usuario
   */
  async listProviders(userId, options = {}) {
    try {
      logger.info('Listando proveedores', { userId, options });

      const result = await Provider.listByUser(userId, options);

      // Agregar estadísticas a cada proveedor si se solicita
      if (options.includeStats) {
        const providersWithStats = await Promise.all(
          result.providers.map(async (provider) => {
            const stats = await Provider.getStats(userId, provider.id);
            return {
              ...provider,
              stats
            };
          })
        );
        result.providers = providersWithStats;
      }

      logger.info('Proveedores listados exitosamente', {
        userId,
        count: result.providers.length
      });

      return result;
    } catch (error) {
      logger.error('Error listando proveedores', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene un proveedor por ID
   */
  async getProvider(userId, providerId) {
    try {
      logger.info('Obteniendo proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      logger.info('Proveedor obtenido exitosamente', { userId, providerId });

      return provider;
    } catch (error) {
      logger.error('Error obteniendo proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo proveedor
   */
  async createProvider(userId, providerData) {
    try {
      logger.info('Creando proveedor', { userId, name: providerData.name });

      const provider = new Provider({
        ...providerData,
        userId
      });

      await provider.save();

      // ✅ ACTUALIZAR RELACIÓN: Agregar providerId a los materiales
      if (provider.materialIds && provider.materialIds.length > 0) {
        logger.info('Actualizando relación proveedor-materiales', {
          userId,
          providerId: provider.id,
          materialsCount: provider.materialIds.length
        });

        for (const materialId of provider.materialIds) {
          const material = await Material.findById(userId, materialId);
          
          if (material) {
            // Agregar providerId si no existe
            if (!material.providerIds.includes(provider.id)) {
              material.providerIds.push(provider.id);
              await material.save();
              
              logger.info('Material actualizado con providerId', {
                materialId,
                providerId: provider.id
              });
            }
          } else {
            logger.warn('Material no encontrado al crear proveedor', {
              materialId,
              providerId: provider.id
            });
          }
        }
      }

      logger.info('Proveedor creado exitosamente', { userId, providerId: provider.id });

      return provider;
    } catch (error) {
      logger.error('Error creando proveedor', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un proveedor
   */
  async updateProvider(userId, providerId, updates) {
    try {
      logger.info('Actualizando proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // ✅ ACTUALIZAR RELACIÓN: Si se modifican los materialIds
      if (updates.materialIds) {
        const oldMaterialIds = provider.materialIds || [];
        const newMaterialIds = updates.materialIds || [];

        // Materiales eliminados: quitar providerId
        const removedMaterials = oldMaterialIds.filter(id => !newMaterialIds.includes(id));
        for (const materialId of removedMaterials) {
          const material = await Material.findById(userId, materialId);
          if (material) {
            material.providerIds = material.providerIds.filter(id => id !== providerId);
            await material.save();
            logger.info('Proveedor removido del material', { materialId, providerId });
          }
        }

        // Materiales agregados: agregar providerId
        const addedMaterials = newMaterialIds.filter(id => !oldMaterialIds.includes(id));
        for (const materialId of addedMaterials) {
          const material = await Material.findById(userId, materialId);
          if (material) {
            if (!material.providerIds.includes(providerId)) {
              material.providerIds.push(providerId);
              await material.save();
              logger.info('Proveedor agregado al material', { materialId, providerId });
            }
          }
        }
      }

      await provider.update(updates);

      logger.info('Proveedor actualizado exitosamente', { userId, providerId });

      return provider;
    } catch (error) {
      logger.error('Error actualizando proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un proveedor
   */
  async deleteProvider(userId, providerId) {
    try {
      logger.info('Eliminando proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      await provider.delete();

      logger.info('Proveedor eliminado exitosamente', { userId, providerId });

      return true;
    } catch (error) {
      logger.error('Error eliminando proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene plataformas de un proveedor
   */
  async getProviderPlatforms(userId, providerId, options = {}) {
    try {
      logger.info('Obteniendo plataformas del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const result = await Platform.listByProvider(userId, providerId, options);

      logger.info('Plataformas del proveedor obtenidas', {
        userId,
        providerId,
        count: result.platforms.length
      });

      return result;
    } catch (error) {
      logger.error('Error obteniendo plataformas del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene materiales de un proveedor
   */
  async getProviderMaterials(userId, providerId) {
    try {
      logger.info('Obteniendo materiales del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        // Si el proveedor no existe, retornar todos los materiales activos del usuario
        logger.warn('Proveedor no encontrado, retornando todos los materiales activos', { 
          userId, 
          providerId 
        });
        
        const allMaterialsResult = await Material.listByUser(userId, { 
          active: true,
          limit: 1000 
        });
        
        return allMaterialsResult.materials;
      }

      // Si el proveedor no tiene materiales asociados, retornar todos los materiales activos
      if (!provider.materialIds || provider.materialIds.length === 0) {
        logger.info('Proveedor sin materiales asociados, retornando todos los materiales activos', {
          userId,
          providerId
        });
        
        const allMaterialsResult = await Material.listByUser(userId, { 
          active: true,
          limit: 1000 
        });
        
        return allMaterialsResult.materials;
      }

      // Obtener materiales específicos del proveedor
      const materials = await Promise.all(
        provider.materialIds.map(materialId => Material.findById(userId, materialId))
      );

      // Filtrar nulls
      const validMaterials = materials.filter(m => m !== null);

      logger.info('Materiales del proveedor obtenidos', {
        userId,
        providerId,
        count: validMaterials.length
      });

      return validMaterials;
    } catch (error) {
      logger.error('Error obteniendo materiales del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de un proveedor
   */
  async getProviderStats(userId, providerId) {
    try {
      logger.info('Obteniendo estadísticas del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const stats = await Provider.getStats(userId, providerId);

      // Obtener plataformas para estadísticas más detalladas
      const platformsResult = await Platform.listByProvider(userId, providerId, { limit: 10000 });
      const platforms = platformsResult.platforms;

      // Materiales más usados
      const materialUsage = {};
      platforms.forEach(platform => {
        platform.pieces.forEach(piece => {
          if (!materialUsage[piece.material]) {
            materialUsage[piece.material] = {
              count: 0,
              linearMeters: 0
            };
          }
          materialUsage[piece.material].count++;
          materialUsage[piece.material].linearMeters += piece.linearMeters || 0;
        });
      });

      const mostUsed = Object.entries(materialUsage)
        .map(([material, data]) => ({
          materialId: material,
          name: material,
          count: data.count,
          totalLinearMeters: data.linearMeters
        }))
        .sort((a, b) => b.totalLinearMeters - a.totalLinearMeters)
        .slice(0, 5);

      const detailedStats = {
        provider: {
          id: provider.id,
          name: provider.name
        },
        platforms: {
          total: platforms.length,
          inProgress: platforms.filter(p => p.status === 'in_progress').length,
          completed: platforms.filter(p => p.status === 'completed').length,
          exported: platforms.filter(p => p.status === 'exported').length
        },
        materials: {
          total: provider.materialIds.length,
          mostUsed
        },
        totals: {
          totalLinearMeters: stats.totalLinearMeters,
          totalLength: platforms.reduce((sum, p) => sum + p.totalLength, 0),
          averageLinearMetersPerPlatform: platforms.length > 0 
            ? stats.totalLinearMeters / platforms.length 
            : 0
        },
        timeline: {
          lastDelivery: stats.lastDelivery,
          averageDeliveryTime: stats.averageDeliveryTime,
          deliveriesThisMonth: platforms.filter(p => {
            const date = new Date(p.receptionDate);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length,
          deliveriesLastMonth: platforms.filter(p => {
            const date = new Date(p.receptionDate);
            const now = new Date();
            const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
            return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
          }).length
        },
        performance: {
          onTimeDeliveries: 0.85,
          qualityScore: 4.2,
          customerSatisfaction: 4.5
        }
      };

      logger.info('Estadísticas del proveedor obtenidas', { userId, providerId });

      return detailedStats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  // ==========================================
  // MATERIALES DEL PROVEEDOR
  // ==========================================

  /**
   * Lista todos los materiales de un proveedor
   */
  async listProviderMaterials(userId, providerId, options = {}) {
    try {
      logger.info('Listando materiales del proveedor', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const materials = await ProviderMaterial.listByProvider(providerId, options);

      logger.info('Materiales del proveedor listados', {
        userId,
        providerId,
        count: materials.length
      });

      return materials;
    } catch (error) {
      logger.error('Error listando materiales del proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene un material específico de un proveedor
   */
  async getProviderMaterial(userId, providerId, materialId) {
    try {
      logger.info('Obteniendo material del proveedor', { userId, providerId, materialId });

      const material = await ProviderMaterial.findById(providerId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      logger.info('Material del proveedor obtenido', { userId, providerId, materialId });

      return material;
    } catch (error) {
      logger.error('Error obteniendo material del proveedor', { userId, providerId, materialId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo material para un proveedor
   */
  async createProviderMaterial(userId, providerId, materialData) {
    try {
      logger.info('Creando material del proveedor', { userId, providerId, name: materialData.name });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const material = new ProviderMaterial({
        ...materialData,
        providerId
      });

      await material.save();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'material_added',
        `Material "${material.name}" agregado`,
        {
          entityType: 'material',
          entityId: material.id,
          createdBy: userId,
          createdByName: materialData.createdByName || userId
        }
      );

      logger.info('Material del proveedor creado', { userId, providerId, materialId: material.id });

      return material;
    } catch (error) {
      logger.error('Error creando material del proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un material de un proveedor
   */
  async updateProviderMaterial(userId, providerId, materialId, updates) {
    try {
      logger.info('Actualizando material del proveedor', { userId, providerId, materialId });

      const material = await ProviderMaterial.findById(providerId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      await material.update(updates);

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'material_updated',
        `Material "${material.name}" actualizado`,
        {
          entityType: 'material',
          entityId: material.id,
          createdBy: userId,
          createdByName: updates.createdByName || userId
        }
      );

      logger.info('Material del proveedor actualizado', { userId, providerId, materialId });

      return material;
    } catch (error) {
      logger.error('Error actualizando material del proveedor', { userId, providerId, materialId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un material de un proveedor (soft delete)
   */
  async deleteProviderMaterial(userId, providerId, materialId) {
    try {
      logger.info('Eliminando material del proveedor', { userId, providerId, materialId });

      const material = await ProviderMaterial.findById(providerId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      // Validar que no esté siendo usado en órdenes activas
      const activeOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const ordersUsingMaterial = activeOrders.filter(order => {
        const activeStatuses = ['draft', 'sent', 'accepted', 'in_transit'];
        if (!activeStatuses.includes(order.status)) return false;
        
        return order.items.some(item => item.materialId === materialId);
      });

      if (ordersUsingMaterial.length > 0) {
        throw ApiError.badRequestError(
          `No se puede eliminar el material porque está siendo usado en ${ordersUsingMaterial.length} orden(es) activa(s)`
        );
      }

      const materialName = material.name;
      
      // Soft delete: marcar como inactivo en lugar de eliminar
      await material.update({ isActive: false });

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'material_deleted',
        `Material "${materialName}" eliminado`,
        {
          entityType: 'material',
          entityId: materialId,
          createdBy: userId,
          createdByName: userId
        }
      );

      logger.info('Material del proveedor eliminado', { userId, providerId, materialId });

      return true;
    } catch (error) {
      logger.error('Error eliminando material del proveedor', { userId, providerId, materialId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // ÓRDENES DE COMPRA
  // ==========================================

  /**
   * Lista todas las órdenes de compra de un proveedor
   */
  async listPurchaseOrders(userId, providerId, options = {}) {
    try {
      logger.info('Listando órdenes de compra', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const orders = await PurchaseOrder.listByProvider(providerId, options);

      logger.info('Órdenes de compra listadas', {
        userId,
        providerId,
        count: orders.length
      });

      return orders;
    } catch (error) {
      logger.error('Error listando órdenes de compra', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene una orden de compra específica
   */
  async getPurchaseOrder(userId, providerId, orderId) {
    try {
      logger.info('Obteniendo orden de compra', { userId, providerId, orderId });

      const order = await PurchaseOrder.findById(providerId, orderId);
      
      if (!order) {
        throw ApiError.notFoundError('Orden de compra no encontrada');
      }

      logger.info('Orden de compra obtenida', { userId, providerId, orderId });

      return order;
    } catch (error) {
      logger.error('Error obteniendo orden de compra', { userId, providerId, orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea una nueva orden de compra
   */
  async createPurchaseOrder(userId, providerId, orderData) {
    try {
      logger.info('Creando orden de compra', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Generar número de orden
      const orderNumber = await PurchaseOrder.generateOrderNumber();

      // Validar items
      if (!orderData.items || orderData.items.length === 0) {
        throw ApiError.badRequestError('La orden debe contener al menos un item');
      }

      // Calcular subtotal de cada item
      const items = orderData.items.map(item => {
        if (!item.quantity || item.quantity <= 0) {
          throw ApiError.badRequestError('La cantidad debe ser mayor a 0');
        }
        if (!item.unitPrice || item.unitPrice < 0) {
          throw ApiError.badRequestError('El precio unitario no puede ser negativo');
        }
        
        return {
          ...item,
          subtotal: item.quantity * item.unitPrice
        };
      });

      // Calcular subtotal total de items
      const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

      // Aplicar descuento
      const discount = orderData.discount || 0;
      const discountType = orderData.discountType || 'amount';
      
      // Validar descuento
      if (discountType === 'percentage' && (discount < 0 || discount > 100)) {
        throw ApiError.badRequestError('El descuento porcentual debe estar entre 0 y 100');
      }
      if (discountType === 'amount' && (discount < 0 || discount > itemsSubtotal)) {
        throw ApiError.badRequestError('El descuento en monto no puede ser negativo ni mayor al subtotal');
      }

      const discountAmount = discountType === 'percentage' 
        ? itemsSubtotal * (discount / 100)
        : discount;

      const subtotalAfterDiscount = Math.max(0, itemsSubtotal - discountAmount);

      // Calcular IVA
      const taxPercentage = orderData.tax || 0;
      const taxAmount = subtotalAfterDiscount * (taxPercentage / 100);

      // Total final
      const total = subtotalAfterDiscount + taxAmount;

      const order = new PurchaseOrder({
        ...orderData,
        items,
        orderNumber,
        providerId,
        providerName: provider.name,
        subtotal: itemsSubtotal,
        discount,
        discountType,
        tax: taxAmount,
        total,
        status: orderData.status || 'draft',
        createdBy: userId,
        createdByName: orderData.createdByName || userId
      });

      await order.save();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'order_created',
        `Orden de compra ${orderNumber} creada`,
        {
          entityType: 'order',
          entityId: order.id,
          createdBy: userId,
          createdByName: orderData.createdByName || userId,
          details: {
            orderNumber,
            total,
            itemsCount: orderData.items.length
          }
        }
      );

      logger.info('Orden de compra creada', { userId, providerId, orderId: order.id, orderNumber });

      return order;
    } catch (error) {
      logger.error('Error creando orden de compra', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza una orden de compra
   */
  async updatePurchaseOrder(userId, providerId, orderId, updates) {
    try {
      logger.info('Actualizando orden de compra', { userId, providerId, orderId });

      const order = await PurchaseOrder.findById(providerId, orderId);
      
      if (!order) {
        throw ApiError.notFoundError('Orden de compra no encontrada');
      }

      // VALIDACIÓN CRÍTICA: Solo se puede editar si está en draft
      if (order.status !== 'draft' && !updates.status) {
        throw ApiError.badRequestError('No se puede editar una orden que ya fue enviada. Solo se puede cambiar el estado.');
      }

      const oldStatus = order.status;

      // Si se modifican items, discount o tax, recalcular totales
      if (updates.items || updates.discount !== undefined || updates.discountType || updates.tax !== undefined) {
        // Usar items actualizados o existentes
        const items = updates.items || order.items;
        
        // Recalcular subtotal de items
        const processedItems = items.map(item => ({
          ...item,
          subtotal: item.quantity * item.unitPrice
        }));

        const itemsSubtotal = processedItems.reduce((sum, item) => sum + item.subtotal, 0);

        // Aplicar descuento
        const discount = updates.discount !== undefined ? updates.discount : order.discount;
        const discountType = updates.discountType || order.discountType;
        
        // Validar descuento
        if (discountType === 'percentage' && (discount < 0 || discount > 100)) {
          throw ApiError.badRequestError('El descuento porcentual debe estar entre 0 y 100');
        }
        if (discountType === 'amount' && (discount < 0 || discount > itemsSubtotal)) {
          throw ApiError.badRequestError('El descuento en monto no puede ser negativo ni mayor al subtotal');
        }

        const discountAmount = discountType === 'percentage' 
          ? itemsSubtotal * (discount / 100)
          : discount;

        const subtotalAfterDiscount = Math.max(0, itemsSubtotal - discountAmount);

        // Calcular IVA
        const taxPercentage = updates.tax !== undefined ? updates.tax : order.tax;
        const taxAmount = subtotalAfterDiscount * (taxPercentage / 100);

        // Total final
        const total = subtotalAfterDiscount + taxAmount;

        // Actualizar campos calculados
        updates.items = processedItems;
        updates.subtotal = itemsSubtotal;
        updates.discount = discount;
        updates.discountType = discountType;
        updates.tax = taxAmount;
        updates.total = total;
      }

      // Si se cambia el status, actualizar campos de fecha correspondientes
      if (updates.status && updates.status !== oldStatus) {
        const now = new Date();
        
        switch (updates.status) {
          case 'sent':
            updates.sentAt = now;
            break;
          case 'accepted':
            updates.acceptedAt = now;
            if (updates.acceptedDeliveryDate) {
              updates.acceptedDeliveryDate = new Date(updates.acceptedDeliveryDate);
            }
            break;
          case 'rejected':
            updates.rejectedAt = now;
            break;
          case 'delivered':
            updates.deliveredAt = now;
            break;
          case 'cancelled':
            updates.cancelledAt = now;
            break;
        }

        // Registrar actividad de cambio de status
        const statusActivityTypes = {
          'sent': 'order_updated',
          'accepted': 'order_accepted',
          'rejected': 'order_rejected',
          'delivered': 'order_delivered',
          'cancelled': 'order_updated'
        };

        await ProviderActivity.createActivity(
          providerId,
          statusActivityTypes[updates.status] || 'order_updated',
          `Orden ${order.orderNumber} cambió a ${updates.status}`,
          {
            entityType: 'order',
            entityId: orderId,
            createdBy: userId,
            createdByName: updates.createdByName || userId,
            details: { oldStatus, newStatus: updates.status }
          }
        );
      }

      await order.update(updates);

      logger.info('Orden de compra actualizada', { userId, providerId, orderId });

      return order;
    } catch (error) {
      logger.error('Error actualizando orden de compra', { userId, providerId, orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Cambia el estado de una orden de compra con validaciones estrictas
   */
  async changeOrderStatus(userId, providerId, orderId, statusData) {
    try {
      logger.info('Cambiando estado de orden de compra', { userId, providerId, orderId, statusData });

      const order = await PurchaseOrder.findById(providerId, orderId);
      
      if (!order) {
        throw ApiError.notFoundError('Orden de compra no encontrada');
      }

      const currentStatus = order.status;
      const newStatus = statusData.status;

      // Definir transiciones válidas
      const VALID_TRANSITIONS = {
        'draft': ['sent', 'cancelled'],
        'sent': ['accepted', 'rejected', 'cancelled', 'in_transit'],
        'accepted': ['in_transit', 'cancelled'],
        'in_transit': ['delivered', 'cancelled'],
        'rejected': ['cancelled'],
        'delivered': [],
        'cancelled': []
      };

      // Validar transición
      if (!VALID_TRANSITIONS[currentStatus] || !VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
        throw ApiError.badRequestError(
          `No se puede cambiar de ${currentStatus} a ${newStatus}`,
          {
            currentStatus,
            newStatus,
            allowedTransitions: VALID_TRANSITIONS[currentStatus] || []
          }
        );
      }

      const now = new Date();
      const updates = { status: newStatus };

      // Actualizar timestamps según estado
      switch (newStatus) {
        case 'sent':
          updates.sentAt = now;
          break;
        case 'accepted':
          // acceptedDeliveryDate es REQUERIDO cuando se acepta
          if (!statusData.acceptedDeliveryDate) {
            throw ApiError.badRequestError('acceptedDeliveryDate es requerido cuando el estado es accepted');
          }
          updates.acceptedAt = now;
          updates.acceptedDeliveryDate = new Date(statusData.acceptedDeliveryDate);
          if (statusData.acceptedBy) {
            updates.acceptedBy = statusData.acceptedBy;
          }
          break;
        case 'rejected':
          updates.rejectedAt = now;
          if (statusData.reason) {
            updates.rejectionReason = statusData.reason;
          }
          break;
        case 'in_transit':
          // No requiere timestamp específico
          break;
        case 'delivered':
          updates.deliveredAt = now;
          break;
        case 'cancelled':
          updates.cancelledAt = now;
          if (statusData.reason) {
            updates.cancellationReason = statusData.reason;
          }
          break;
      }

      await order.update(updates);

      // Crear actividad de cambio de estado
      const activityDescriptions = {
        'sent': `Orden ${order.orderNumber} enviada al proveedor`,
        'accepted': `Orden ${order.orderNumber} aceptada por el proveedor`,
        'rejected': `Orden ${order.orderNumber} rechazada${statusData.reason ? ': ' + statusData.reason : ''}`,
        'in_transit': `Orden ${order.orderNumber} en tránsito`,
        'delivered': `Orden ${order.orderNumber} entregada`,
        'cancelled': `Orden ${order.orderNumber} cancelada${statusData.reason ? ': ' + statusData.reason : ''}`
      };

      await ProviderActivity.createActivity(
        providerId,
        'order_status_changed',
        activityDescriptions[newStatus] || `Orden ${order.orderNumber} cambió a ${newStatus}`,
        {
          entityType: 'order',
          entityId: orderId,
          createdBy: userId,
          createdByName: statusData.createdByName || userId,
          details: {
            orderId,
            orderNumber: order.orderNumber,
            oldStatus: currentStatus,
            newStatus: newStatus,
            reason: statusData.reason,
            acceptedDeliveryDate: statusData.acceptedDeliveryDate
          }
        }
      );

      logger.info('Estado de orden cambiado', { 
        userId, 
        providerId, 
        orderId, 
        from: currentStatus, 
        to: newStatus 
      });

      return order;
    } catch (error) {
      logger.error('Error cambiando estado de orden', { 
        userId, 
        providerId, 
        orderId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Elimina una orden de compra (solo si está en draft)
   */
  async deletePurchaseOrder(userId, providerId, orderId) {
    try {
      logger.info('Eliminando orden de compra', { userId, providerId, orderId });

      const order = await PurchaseOrder.findById(providerId, orderId);
      
      if (!order) {
        throw ApiError.notFoundError('Orden de compra no encontrada');
      }

      // Validar que esté en draft
      if (order.status !== 'draft') {
        throw ApiError.badRequestError('Solo se pueden eliminar órdenes en estado draft');
      }

      const orderNumber = order.orderNumber;
      await order.delete();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'order_updated',
        `Orden ${orderNumber} eliminada`,
        {
          entityType: 'order',
          entityId: orderId,
          createdBy: userId,
          createdByName: userId
        }
      );

      logger.info('Orden de compra eliminada', { userId, providerId, orderId });

      return true;
    } catch (error) {
      logger.error('Error eliminando orden de compra', { userId, providerId, orderId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // PAGOS
  // ==========================================

  /**
   * Lista todos los pagos de un proveedor
   */
  async listPayments(userId, providerId, options = {}) {
    try {
      logger.info('Listando pagos', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const payments = await Payment.listByProvider(providerId, options);

      logger.info('Pagos listados', {
        userId,
        providerId,
        count: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Error listando pagos', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene un pago específico
   */
  async getPayment(userId, providerId, paymentId) {
    try {
      logger.info('Obteniendo pago', { userId, providerId, paymentId });

      const payment = await Payment.findById(providerId, paymentId);
      
      if (!payment) {
        throw ApiError.notFoundError('Pago no encontrado');
      }

      logger.info('Pago obtenido', { userId, providerId, paymentId });

      return payment;
    } catch (error) {
      logger.error('Error obteniendo pago', { userId, providerId, paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo pago
   */
  async createPayment(userId, providerId, paymentData) {
    try {
      logger.info('Creando pago', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Validar amount
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw ApiError.badRequestError('El monto del pago debe ser mayor a 0');
      }

      // Validar que el pago no exceda el saldo pendiente
      const allOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const validOrders = allOrders.filter(o => 
        ['sent', 'accepted', 'in_transit', 'delivered'].includes(o.status)
      );
      const totalOrders = validOrders.reduce((sum, o) => sum + o.total, 0);
      
      const allPayments = await Payment.listByProvider(providerId, { limit: 10000 });
      const totalPayments = allPayments.reduce((sum, p) => sum + p.amount, 0);
      
      const currentBalance = totalOrders - totalPayments;
      
      if (paymentData.amount > currentBalance) {
        logger.warn('Intento de pago que excede saldo pendiente', {
          amount: paymentData.amount,
          currentBalance,
          providerId
        });
        // No bloquear, solo advertir
      }

      // Validar y normalizar attachments si se proporcionan
      if (paymentData.attachments && Array.isArray(paymentData.attachments)) {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        // Mapeo de tipos del frontend a MIME types
        const typeMapping = {
          'image': 'image/png', // Default para imágenes
          'pdf': 'application/pdf',
          'document': 'application/pdf'
        };

        const self = this; // Referencia a la instancia para usar en el map
        paymentData.attachments = paymentData.attachments.map((attachment, index) => {
          // Normalizar formato del frontend al formato esperado
          const normalized = {
            id: attachment.id || uuidv4(),
            uploadedAt: attachment.uploadedAt || new Date().toISOString(),
            // Normalizar nombre del archivo
            fileName: attachment.fileName || attachment.name || `attachment-${index + 1}`,
            // Normalizar tipo de archivo - intentar múltiples fuentes
            fileType: attachment.fileType || 
                     (attachment.data ? self.getFileTypeFromData(attachment.data) : null) ||
                     typeMapping[attachment.type] || 
                     self.getFileTypeFromFileName(attachment.fileName || attachment.name) ||
                     'image/png',
            // Calcular tamaño desde base64 si está disponible
            fileSize: attachment.fileSize || 
                     (attachment.data ? self.calculateFileSizeFromBase64(attachment.data) : 0),
            // Preservar datos base64 si existen
            data: attachment.data || null,
            // Preservar URL si existe (archivo ya subido)
            url: attachment.url || null
          };

          // Validar tamaño (solo si se puede determinar)
          if (normalized.fileSize > 0 && normalized.fileSize > maxFileSize) {
            throw ApiError.badRequestError(
              `El archivo "${normalized.fileName}" excede el tamaño máximo de 10MB`
            );
          }
          
          // Si no se pudo determinar el tamaño pero hay datos base64, validar que no sea excesivamente grande
          if (normalized.fileSize === 0 && normalized.data) {
            const base64Length = normalized.data.length;
            // Aproximadamente 13.3MB en base64 = 10MB en binario
            const maxBase64Length = 14 * 1024 * 1024;
            if (base64Length > maxBase64Length) {
              throw ApiError.badRequestError(
                `El archivo "${normalized.fileName}" parece exceder el tamaño máximo de 10MB`
              );
            }
          }

          // Validar tipo
          if (!allowedTypes.includes(normalized.fileType)) {
            throw ApiError.badRequestError(
              `El tipo de archivo "${normalized.fileType}" no está permitido. Tipos permitidos: ${allowedTypes.join(', ')}`
            );
          }

          return normalized;
        });
      }

      // Generar número de pago
      const paymentNumber = await Payment.generatePaymentNumber();

      // Si hay purchaseOrderId, obtener orderNumber
      let orderNumber = null;
      if (paymentData.purchaseOrderId) {
        const order = await PurchaseOrder.findById(providerId, paymentData.purchaseOrderId);
        if (order) {
          orderNumber = order.orderNumber;
        }
      }

      // Validar relatedOrderIds si se proporcionan
      if (paymentData.relatedOrderIds && Array.isArray(paymentData.relatedOrderIds)) {
        for (const orderId of paymentData.relatedOrderIds) {
          const order = await PurchaseOrder.findById(providerId, orderId);
          if (!order) {
            throw ApiError.notFoundError(`Orden ${orderId} no encontrada`);
          }
        }
      }

      const payment = new Payment({
        ...paymentData,
        paymentNumber,
        providerId,
        providerName: provider.name,
        orderNumber,
        createdBy: userId,
        createdByName: paymentData.createdByName || userId,
        status: paymentData.status || 'completed'
      });

      await payment.save();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'payment_created',
        `Pago ${paymentNumber} registrado por $${payment.amount}`,
        {
          entityType: 'payment',
          entityId: payment.id,
          createdBy: userId,
          createdByName: paymentData.createdByName || userId,
          details: {
            paymentNumber,
            amount: payment.amount,
            method: payment.paymentMethod
          }
        }
      );

      logger.info('Pago creado', { userId, providerId, paymentId: payment.id, paymentNumber });

      return payment;
    } catch (error) {
      logger.error('Error creando pago', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un pago
   */
  async updatePayment(userId, providerId, paymentId, updates) {
    try {
      logger.info('Actualizando pago', { userId, providerId, paymentId });

      const payment = await Payment.findById(providerId, paymentId);
      
      if (!payment) {
        throw ApiError.notFoundError('Pago no encontrado');
      }

      // Validar que el pago tenga menos de 24 horas
      const createdAt = new Date(payment.createdAt);
      const now = new Date();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      if (hoursSinceCreation > 24) {
        throw ApiError.badRequestError(
          'Solo se pueden editar pagos creados en las últimas 24 horas'
        );
      }

      // Si se actualiza el amount, validar que no se cambie si hay órdenes relacionadas
      if (updates.amount !== undefined && updates.amount !== payment.amount) {
        if (payment.relatedOrderIds && payment.relatedOrderIds.length > 0) {
          throw ApiError.badRequestError(
            'No se puede cambiar el monto de un pago que tiene órdenes relacionadas'
          );
        }
      }

      // Validar nuevos attachments si se agregan
      if (updates.attachments && Array.isArray(updates.attachments)) {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        updates.attachments.forEach(attachment => {
          if (attachment.fileSize > maxFileSize) {
            throw ApiError.badRequestError(
              `El archivo "${attachment.fileName}" excede el tamaño máximo de 10MB`
            );
          }
          if (!allowedTypes.includes(attachment.fileType)) {
            throw ApiError.badRequestError(
              `El tipo de archivo "${attachment.fileType}" no está permitido`
            );
          }
          if (!attachment.id) {
            attachment.id = uuidv4();
          }
          if (!attachment.uploadedAt) {
            attachment.uploadedAt = new Date().toISOString();
          }
        });
      }

      const oldStatus = payment.status;

      // Si se cambia el status a completed, registrar actividad
      if (updates.status && updates.status === 'completed' && oldStatus !== 'completed') {
        await ProviderActivity.createActivity(
          providerId,
          'payment_completed',
          `Pago ${payment.paymentNumber} completado`,
          {
            entityType: 'payment',
            entityId: paymentId,
            createdBy: userId,
            createdByName: updates.createdByName || userId,
            details: { amount: payment.amount }
          }
        );
      }

      await payment.update(updates);

      logger.info('Pago actualizado', { userId, providerId, paymentId });

      return payment;
    } catch (error) {
      logger.error('Error actualizando pago', { userId, providerId, paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un pago (solo si está en pending y creado hace menos de 24 horas)
   */
  async deletePayment(userId, providerId, paymentId) {
    try {
      logger.info('Eliminando pago', { userId, providerId, paymentId });

      const payment = await Payment.findById(providerId, paymentId);
      
      if (!payment) {
        throw ApiError.notFoundError('Pago no encontrado');
      }

      // Validar que el pago tenga menos de 24 horas
      const createdAt = new Date(payment.createdAt);
      const now = new Date();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      if (hoursSinceCreation > 24) {
        throw ApiError.badRequestError(
          'Solo se pueden eliminar pagos creados en las últimas 24 horas'
        );
      }

      // Validar que esté en pending
      if (payment.status !== 'pending') {
        throw ApiError.badRequestError('Solo se pueden eliminar pagos en estado pending');
      }

      // Advertir si hay órdenes relacionadas
      if (payment.relatedOrderIds && payment.relatedOrderIds.length > 0) {
        logger.warn('Eliminando pago con órdenes relacionadas', {
          paymentId,
          relatedOrderIds: payment.relatedOrderIds
        });
      }

      const paymentNumber = payment.paymentNumber;
      await payment.delete();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'payment_created',
        `Pago ${paymentNumber} eliminado`,
        {
          entityType: 'payment',
          entityId: paymentId,
          createdBy: userId,
          createdByName: userId
        }
      );

      logger.info('Pago eliminado', { userId, providerId, paymentId });

      return true;
    } catch (error) {
      logger.error('Error eliminando pago', { userId, providerId, paymentId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // DOCUMENTOS
  // ==========================================

  /**
   * Lista todos los documentos de un proveedor
   */
  async listDocuments(userId, providerId, options = {}) {
    try {
      logger.info('Listando documentos', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const documents = await ProviderDocument.listByProvider(providerId, options);

      logger.info('Documentos listados', {
        userId,
        providerId,
        count: documents.length
      });

      return documents;
    } catch (error) {
      logger.error('Error listando documentos', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo documento
   */
  async createDocument(userId, providerId, documentData) {
    try {
      logger.info('Creando documento', { userId, providerId, name: documentData.name });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const document = new ProviderDocument({
        ...documentData,
        providerId,
        uploadedBy: userId,
        uploadedByName: documentData.uploadedByName || userId
      });

      await document.save();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'document_uploaded',
        `Documento "${document.name}" subido`,
        {
          entityType: 'provider',
          entityId: providerId,
          createdBy: userId,
          createdByName: documentData.uploadedByName || userId,
          details: {
            documentType: document.type,
            documentName: document.name
          }
        }
      );

      logger.info('Documento creado', { userId, providerId, documentId: document.id });

      return document;
    } catch (error) {
      logger.error('Error creando documento', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(userId, providerId, documentId) {
    try {
      logger.info('Eliminando documento', { userId, providerId, documentId });

      const document = await ProviderDocument.findById(providerId, documentId);
      
      if (!document) {
        throw ApiError.notFoundError('Documento no encontrado');
      }

      const documentName = document.name;
      await document.delete();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'document_uploaded',
        `Documento "${documentName}" eliminado`,
        {
          entityType: 'provider',
          entityId: providerId,
          createdBy: userId,
          createdByName: userId
        }
      );

      logger.info('Documento eliminado', { userId, providerId, documentId });

      return true;
    } catch (error) {
      logger.error('Error eliminando documento', { userId, providerId, documentId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // ACTIVIDADES
  // ==========================================

  /**
   * Lista todas las actividades de un proveedor
   */
  async listActivities(userId, providerId, options = {}) {
    try {
      logger.info('Listando actividades', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const activities = await ProviderActivity.listByProvider(providerId, options);

      logger.info('Actividades listadas', {
        userId,
        providerId,
        count: activities.length
      });

      return activities;
    } catch (error) {
      logger.error('Error listando actividades', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea una actividad manualmente
   */
  async createActivity(userId, providerId, activityData) {
    try {
      logger.info('Creando actividad', { userId, providerId, type: activityData.type });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const activity = await ProviderActivity.createActivity(
        providerId,
        activityData.type,
        activityData.description,
        {
          details: activityData.details,
          entityType: activityData.entityType,
          entityId: activityData.entityId,
          createdBy: userId,
          createdByName: activityData.createdByName || userId
        }
      );

      logger.info('Actividad creada', { userId, providerId, activityId: activity.id });

      return activity;
    } catch (error) {
      logger.error('Error creando actividad', { userId, providerId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // CALIFICACIONES
  // ==========================================

  /**
   * Obtiene la calificación de un proveedor
   */
  async getRating(userId, providerId) {
    try {
      logger.info('Obteniendo calificación', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const rating = await ProviderRating.findByProvider(providerId);

      logger.info('Calificación obtenida', { userId, providerId });

      return rating;
    } catch (error) {
      logger.error('Error obteniendo calificación', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea o actualiza la calificación de un proveedor
   */
  async updateRating(userId, providerId, ratingData) {
    try {
      logger.info('Actualizando calificación', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Obtener calificación actual
      let rating = await ProviderRating.findByProvider(providerId);

      // Calcular nuevo totalReviews
      const totalReviews = (rating.totalReviews || 0) + 1;

      // Actualizar o crear
      if (rating.overall === 0 && rating.quality === 0) {
        // Primera calificación
        rating = new ProviderRating({
          providerId,
          ...ratingData,
          totalReviews
        });
      } else {
        // Actualizar calificación existente
        await rating.update({
          ...ratingData,
          totalReviews
        });
      }

      await rating.save();

      // Registrar actividad
      await ProviderActivity.createActivity(
        providerId,
        'note_added',
        `Calificación actualizada (${ratingData.overall}/5)`,
        {
          entityType: 'provider',
          entityId: providerId,
          createdBy: userId,
          createdByName: ratingData.createdByName || userId,
          details: { rating: ratingData }
        }
      );

      logger.info('Calificación actualizada', { userId, providerId });

      return rating;
    } catch (error) {
      logger.error('Error actualizando calificación', { userId, providerId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // ESTADO DE CUENTA
  // ==========================================

  /**
   * Obtiene el estado de cuenta de un proveedor
   */
  async getAccountStatement(userId, providerId, from, to) {
    try {
      logger.info('Obteniendo estado de cuenta', { userId, providerId, from, to });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Convertir fechas a Date objects y ajustar para incluir todo el día
      // Si from es solo fecha (YYYY-MM-DD), establecer inicio del día (00:00:00)
      // Si to es solo fecha (YYYY-MM-DD), establecer fin del día (23:59:59)
      let fromDate = new Date(from);
      let toDate = new Date(to);
      
      // Si la fecha viene como string YYYY-MM-DD, ajustar para incluir todo el día
      if (typeof from === 'string' && from.match(/^\d{4}-\d{2}-\d{2}$/)) {
        fromDate.setHours(0, 0, 0, 0);
      }
      
      if (typeof to === 'string' && to.match(/^\d{4}-\d{2}-\d{2}$/)) {
        toDate.setHours(23, 59, 59, 999);
      }

      // Obtener todas las órdenes y pagos del período
      const allOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const allPayments = await Payment.listByProvider(providerId, { limit: 10000 });

      // Filtrar por período y status (EXCLUIR draft y cancelled)
      const orders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const validStatuses = ['sent', 'accepted', 'in_transit', 'delivered'];
        return orderDate >= fromDate && orderDate <= toDate && validStatuses.includes(order.status);
      });

      const payments = allPayments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= fromDate && paymentDate <= toDate;
      });

      // Calcular saldo inicial (opening balance) - órdenes y pagos antes del período
      const ordersBefore = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const validStatuses = ['sent', 'accepted', 'in_transit', 'delivered'];
        return orderDate < fromDate && validStatuses.includes(order.status);
      });

      const paymentsBefore = allPayments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate < fromDate;
      });

      // Función auxiliar para validar y normalizar números
      const validateAndNormalizeNumber = (value, defaultValue = 0) => {
        if (value === null || value === undefined || value === '') {
          return defaultValue;
        }
        
        const num = typeof value === 'number' ? value : parseFloat(value);
        
        if (isNaN(num) || !isFinite(num)) {
          logger.warn(`⚠️ Valor inválido normalizado a ${defaultValue}:`, value);
          return defaultValue;
        }
        
        return Number(num.toFixed(2)); // Redondear a 2 decimales
      };

      // Calcular saldo inicial (opening balance) con validación
      const totalOrdersBefore = ordersBefore.reduce((sum, order) => {
        const amount = validateAndNormalizeNumber(order.total || order.amount, 0);
        return sum + amount;
      }, 0);
      
      const totalPaymentsBefore = paymentsBefore.reduce((sum, payment) => {
        const amount = validateAndNormalizeNumber(payment.amount, 0);
        return sum + amount;
      }, 0);
      
      const openingBalance = validateAndNormalizeNumber(totalOrdersBefore - totalPaymentsBefore, 0);

      // Calcular totales del período con validación
      const totalOrders = orders.reduce((sum, order) => {
        const amount = validateAndNormalizeNumber(order.total || order.amount, 0);
        if (amount === 0 && (order.total || order.amount)) {
          logger.warn(`⚠️ Orden ${order.id} tiene monto inválido:`, order.total || order.amount);
        }
        return sum + amount;
      }, 0);
      
      const totalPayments = payments.reduce((sum, payment) => {
        const amount = validateAndNormalizeNumber(payment.amount, 0);
        if (amount === 0 && payment.amount) {
          logger.warn(`⚠️ Pago ${payment.id} tiene monto inválido:`, payment.amount);
        }
        return sum + amount;
      }, 0);
      
      // Calcular saldo actual: openingBalance + totalOrders - totalPayments
      let currentBalance = validateAndNormalizeNumber(
        openingBalance + totalOrders - totalPayments, 
        0
      );
      
      // Validación final de currentBalance
      if (isNaN(currentBalance) || !isFinite(currentBalance)) {
        logger.error('❌ ERROR: currentBalance es NaN o infinito, usando 0');
        currentBalance = 0;
      }

      // Helper para label de método de pago
      const getPaymentMethodLabel = (method) => {
        const labels = {
          'cash': 'Efectivo',
          'transfer': 'Transferencia',
          'check': 'Cheque',
          'card': 'Tarjeta',
          'other': 'Otro'
        };
        return labels[method] || method;
      };

      // Preparar arrays de detalles con descripción y amount garantizado
      const ordersDetails = orders.map(order => {
        // Normalizar amount: usar total o amount, siempre como número válido
        const amount = validateAndNormalizeNumber(order.total || order.amount, 0);
        
        if (amount === 0 && (order.total || order.amount)) {
          logger.warn(`⚠️ Orden ${order.id} sin monto válido, usando 0`);
        }
        
        return {
          id: order.id,
          orderNumber: order.orderNumber || order.id,
          date: order.createdAt || order.date,
          amount: amount, // ✅ OBLIGATORIO: Siempre debe estar presente como número válido
          status: order.status || 'pending',
          description: `Orden ${order.orderNumber || order.id} - ${order.items?.length || 0} artículo(s)`
        };
      });

      const paymentsDetails = payments.map(payment => {
        // Normalizar amount: siempre como número válido
        const amount = validateAndNormalizeNumber(payment.amount, 0);
        
        if (amount === 0 && payment.amount) {
          logger.warn(`⚠️ Pago ${payment.id} sin monto válido, usando 0`);
        }
        
        return {
          id: payment.id,
          paymentNumber: payment.paymentNumber || payment.id,
          date: payment.paymentDate || payment.date || payment.createdAt,
          amount: amount, // ✅ OBLIGATORIO: Siempre debe estar presente como número válido
          method: payment.paymentMethod || payment.method || 'unknown',
          description: `Pago ${payment.paymentNumber || payment.id} - ${getPaymentMethodLabel(payment.paymentMethod || payment.method)}`
        };
      });

      // Ordenar cronológicamente (más antiguo primero)
      ordersDetails.sort((a, b) => new Date(a.date) - new Date(b.date));
      paymentsDetails.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calcular estadísticas adicionales con validación
      const totalPurchaseOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;
      const pendingOrders = orders.filter(o => ['draft', 'sent', 'accepted', 'in_transit'].includes(o.status)).length;

      // Calcular pagos vencidos (órdenes con más de 30 días sin pagar completamente)
      const overduePayments = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const daysSinceOrder = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
        
        // Buscar pagos asociados a esta orden
        const orderPayments = payments.filter(p => p.purchaseOrderId === order.id);
        const totalPaid = orderPayments.reduce((sum, p) => {
          return sum + validateAndNormalizeNumber(p.amount, 0);
        }, 0);
        
        const orderTotal = validateAndNormalizeNumber(order.total || order.amount, 0);
        
        return daysSinceOrder > 30 && totalPaid < orderTotal;
      }).length;

      // Calcular summary con validación
      const ordersCount = orders.length;
      const paymentsCount = payments.length;
      const averageOrderAmount = ordersCount > 0 
        ? validateAndNormalizeNumber(totalOrders / ordersCount, 0) 
        : 0;
      const averagePaymentAmount = paymentsCount > 0 
        ? validateAndNormalizeNumber(totalPayments / paymentsCount, 0) 
        : 0;

      // Formatear fechas del período (YYYY-MM-DD)
      const formatPeriodDate = (dateInput) => {
        // Si ya es un string en formato YYYY-MM-DD, retornarlo
        if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateInput;
        }
        // Si es un Date object, convertir a YYYY-MM-DD
        if (dateInput instanceof Date) {
          return dateInput.toISOString().split('T')[0];
        }
        // Si es un string ISO, extraer solo la fecha
        if (typeof dateInput === 'string') {
          return dateInput.split('T')[0];
        }
        // Fallback: usar fecha actual
        return new Date().toISOString().split('T')[0];
      };

      // Estructura de respuesta corregida: totals al nivel superior
      const accountStatement = {
        providerId: provider.id,
        providerName: provider.name,
        period: {
          from: formatPeriodDate(from),
          to: formatPeriodDate(to)
        },
        // ✅ Saldos al nivel superior - SIEMPRE números válidos, nunca NaN/null/undefined
        openingBalance: validateAndNormalizeNumber(openingBalance, 0),
        totalOrders: validateAndNormalizeNumber(totalOrders, 0),
        totalPayments: validateAndNormalizeNumber(totalPayments, 0),
        currentBalance: validateAndNormalizeNumber(currentBalance, 0),
        // ✅ Detalles - Cada orden y pago DEBE incluir amount
        orders: ordersDetails,
        payments: paymentsDetails,
        // Estadísticas adicionales
        summary: {
          totalPurchaseOrders: ordersCount,
          completedOrders,
          pendingOrders,
          overduePayments,
          ordersCount,
          paymentsCount,
          averageOrderAmount: validateAndNormalizeNumber(averageOrderAmount, 0),
          averagePaymentAmount: validateAndNormalizeNumber(averagePaymentAmount, 0)
        }
      };
      
      // Validación final antes de retornar
      if (isNaN(accountStatement.currentBalance) || !isFinite(accountStatement.currentBalance)) {
        logger.error('❌ ERROR CRÍTICO: currentBalance es NaN después de todas las validaciones');
        accountStatement.currentBalance = 0;
      }
      
      // Validar que todas las órdenes tengan amount
      const ordersWithoutAmount = accountStatement.orders.filter(o => o.amount === undefined || o.amount === null);
      if (ordersWithoutAmount.length > 0) {
        logger.error('❌ ERROR: Algunas órdenes no tienen amount válido:', ordersWithoutAmount.map(o => o.id));
      }
      
      // Validar que todos los pagos tengan amount
      const paymentsWithoutAmount = accountStatement.payments.filter(p => p.amount === undefined || p.amount === null);
      if (paymentsWithoutAmount.length > 0) {
        logger.error('❌ ERROR: Algunos pagos no tienen amount válido:', paymentsWithoutAmount.map(p => p.id));
      }

      logger.info('Estado de cuenta obtenido', { userId, providerId });

      return accountStatement;
    } catch (error) {
      logger.error('Error obteniendo estado de cuenta', { userId, providerId, error: error.message });
      throw error;
    }
  }

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================

  /**
   * Obtiene estadísticas y KPIs del proveedor
   */
  async getProviderStatistics(userId, providerId, period = 'all') {
    try {
      logger.info('Obteniendo estadísticas del proveedor', { userId, providerId, period });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Calcular fechas según período
      const now = new Date();
      let dateFrom = null;

      if (period !== 'all') {
        switch (period) {
          case 'week':
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            dateFrom = new Date(now.getFullYear(), quarter * 3, 1);
            break;
          case 'year':
            dateFrom = new Date(now.getFullYear(), 0, 1);
            break;
        }
      }

      // Obtener todas las órdenes y pagos
      const allOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const allPayments = await Payment.listByProvider(providerId, { limit: 10000 });

      // Filtrar por período si aplica
      const orders = dateFrom 
        ? allOrders.filter(o => new Date(o.createdAt) >= dateFrom)
        : allOrders;
      
      const payments = dateFrom
        ? allPayments.filter(p => new Date(p.paymentDate) >= dateFrom)
        : allPayments;

      // Calcular estadísticas de órdenes
      const ordersByStatus = {
        draft: orders.filter(o => o.status === 'draft').length,
        sent: orders.filter(o => o.status === 'sent').length,
        accepted: orders.filter(o => o.status === 'accepted').length,
        rejected: orders.filter(o => o.status === 'rejected').length,
        in_transit: orders.filter(o => o.status === 'in_transit').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length
      };

      const validOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'draft');
      const totalOrdersAmount = validOrders.reduce((sum, o) => sum + o.total, 0);
      const averageOrderAmount = validOrders.length > 0 ? totalOrdersAmount / validOrders.length : 0;

      // Última orden
      const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const lastOrder = sortedOrders[0];

      // Calcular estadísticas de pagos
      const paymentsByMethod = {
        cash: payments.filter(p => p.paymentMethod === 'cash').length,
        transfer: payments.filter(p => p.paymentMethod === 'transfer').length,
        check: payments.filter(p => p.paymentMethod === 'check').length,
        card: payments.filter(p => p.paymentMethod === 'card').length,
        other: payments.filter(p => p.paymentMethod === 'other').length
      };

      const totalPaymentsAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const averagePaymentAmount = payments.length > 0 ? totalPaymentsAmount / payments.length : 0;

      // Último pago
      const sortedPayments = [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      const lastPayment = sortedPayments[0];

      // Calcular performance (solo para órdenes delivered)
      const deliveredOrders = orders.filter(o => o.status === 'delivered');
      let averageDeliveryTime = null;
      let onTimeDeliveryRate = null;

      if (deliveredOrders.length > 0) {
        // Tiempo promedio de entrega (desde acceptedAt hasta deliveredAt)
        const deliveryTimes = deliveredOrders
          .filter(o => o.acceptedAt && o.deliveredAt)
          .map(o => {
            const accepted = new Date(o.acceptedAt);
            const delivered = new Date(o.deliveredAt);
            return (delivered - accepted) / (1000 * 60 * 60 * 24); // Días
          });

        if (deliveryTimes.length > 0) {
          averageDeliveryTime = deliveryTimes.reduce((sum, t) => sum + t, 0) / deliveryTimes.length;
        }

        // Tasa de entregas a tiempo
        const onTimeDeliveries = deliveredOrders.filter(o => {
          if (!o.expectedDeliveryDate || !o.deliveredAt) return false;
          const expected = new Date(o.expectedDeliveryDate);
          const delivered = new Date(o.deliveredAt);
          return delivered <= expected;
        }).length;

        onTimeDeliveryRate = (onTimeDeliveries / deliveredOrders.length) * 100;
      }

      // Tasa de cancelación
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const cancellationRate = orders.length > 0 ? (cancelledOrders / orders.length) * 100 : 0;

      // Calcular saldo
      const currentBalance = totalOrdersAmount - totalPaymentsAmount;
      const pendingOrders = orders
        .filter(o => ['sent', 'accepted', 'in_transit'].includes(o.status))
        .reduce((sum, o) => sum + o.total, 0);

      // Obtener materiales
      const materials = await ProviderMaterial.listByProvider(providerId, { limit: 10000 });
      const activeMaterials = materials.filter(m => m.isActive);
      const totalMaterials = materials.length;
      const averageMaterialPrice = activeMaterials.length > 0
        ? activeMaterials.reduce((sum, m) => sum + m.unitPrice, 0) / activeMaterials.length
        : 0;

      const statistics = {
        providerId: provider.id,
        providerName: provider.name,
        period,
        orders: {
          total: orders.length,
          byStatus: ordersByStatus,
          totalAmount: totalOrdersAmount,
          averageAmount: averageOrderAmount,
          lastOrderDate: lastOrder ? lastOrder.createdAt : null,
          lastOrderNumber: lastOrder ? lastOrder.orderNumber : null
        },
        payments: {
          total: payments.length,
          totalAmount: totalPaymentsAmount,
          averageAmount: averagePaymentAmount,
          byMethod: paymentsByMethod,
          lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
          lastPaymentNumber: lastPayment ? lastPayment.paymentNumber : null
        },
        performance: {
          averageDeliveryTime,
          onTimeDeliveryRate,
          cancellationRate,
          paymentOnTimeRate: null // Opcional, se puede implementar con términos de pago
        },
        balance: {
          current: currentBalance,
          pendingOrders,
          overdueAmount: null // Opcional
        },
        materials: {
          total: totalMaterials,
          active: activeMaterials.length,
          averagePrice: averageMaterialPrice
        }
      };

      logger.info('Estadísticas del proveedor obtenidas', { userId, providerId });

      return statistics;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del proveedor', { 
        userId, 
        providerId, 
        error: error.message 
      });
      throw error;
    }
  }

  // ==========================================
  // ALERTAS
  // ==========================================

  /**
   * Obtiene alertas y recordatorios del proveedor
   */
  async getProviderAlerts(userId, providerId) {
    try {
      logger.info('Obteniendo alertas del proveedor', { userId, providerId });

      // Verificar que el proveedor exista
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const alerts = [];
      const now = new Date();

      // 1. Obtener órdenes activas
      const allOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const activeOrders = allOrders.filter(o => 
        ['sent', 'accepted', 'in_transit'].includes(o.status)
      );

      // Alertas de órdenes vencidas y próximas
      activeOrders.forEach(order => {
        if (order.expectedDeliveryDate) {
          const expectedDate = new Date(order.expectedDeliveryDate);
          const daysDiff = Math.floor((expectedDate - now) / (1000 * 60 * 60 * 24));

          if (daysDiff < 0) {
            // Orden vencida
            const daysOverdue = Math.abs(daysDiff);
            alerts.push({
              id: `alert-overdue-${order.id}`,
              type: 'overdue_order',
              severity: daysOverdue > 7 ? 'error' : 'warning',
              title: 'Orden vencida',
              description: `La orden ${order.orderNumber} tenía fecha de entrega el ${order.expectedDeliveryDate.toISOString().split('T')[0]} y está ${daysOverdue} día(s) vencida`,
              relatedId: order.id,
              actionUrl: `/providers/${providerId}/orders/${order.id}`,
              createdAt: now.toISOString()
            });
          } else if (daysDiff <= 3) {
            // Próxima a vencer (en próximos 3 días)
            alerts.push({
              id: `alert-upcoming-${order.id}`,
              type: 'upcoming_delivery',
              severity: 'info',
              title: 'Entrega próxima',
              description: `La orden ${order.orderNumber} tiene entrega programada para el ${order.expectedDeliveryDate.toISOString().split('T')[0]}`,
              relatedId: order.id,
              actionUrl: `/providers/${providerId}/orders/${order.id}`,
              createdAt: now.toISOString()
            });
          }
        }
      });

      // 2. Alertas de pagos pendientes
      const allPayments = await Payment.listByProvider(providerId, { limit: 10000 });
      const validOrders = allOrders.filter(o => 
        ['sent', 'accepted', 'in_transit', 'delivered'].includes(o.status)
      );
      
      const totalOrdersAmount = validOrders.reduce((sum, o) => sum + o.total, 0);
      const totalPaymentsAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const currentBalance = totalOrdersAmount - totalPaymentsAmount;

      if (currentBalance > 0) {
        // Verificar si hay pagos recientes (últimos 30 días)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentPayments = allPayments.filter(p => 
          new Date(p.paymentDate) >= thirtyDaysAgo
        );

        if (recentPayments.length === 0) {
          alerts.push({
            id: 'alert-pending-payment',
            type: 'pending_payment',
            severity: 'warning',
            title: 'Pago pendiente',
            description: `Saldo pendiente de $${currentBalance.toFixed(2)} sin pagos recientes`,
            relatedId: providerId,
            actionUrl: `/providers/${providerId}/payments`,
            createdAt: now.toISOString()
          });
        }
      }

      // 3. Alertas de calificación baja
      const rating = await ProviderRating.findByProvider(providerId);
      if (rating && rating.overall > 0 && rating.overall < 3) {
        alerts.push({
          id: 'alert-low-rating',
          type: 'low_rating',
          severity: 'warning',
          title: 'Calificación baja',
          description: `El proveedor tiene una calificación de ${rating.overall}/5 estrellas`,
          relatedId: providerId,
          actionUrl: `/providers/${providerId}/rating`,
          createdAt: now.toISOString()
        });
      }

      // 4. Alertas de proveedor inactivo
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const recentOrders = allOrders.filter(o => new Date(o.createdAt) >= ninetyDaysAgo);
      
      if (recentOrders.length === 0) {
        alerts.push({
          id: 'alert-inactive',
          type: 'inactive',
          severity: 'info',
          title: 'Proveedor inactivo',
          description: 'No se han creado órdenes en los últimos 90 días',
          relatedId: providerId,
          actionUrl: `/providers/${providerId}`,
          createdAt: now.toISOString()
        });
      }

      // Ordenar por severidad (error > warning > info)
      alerts.sort((a, b) => {
        const severityOrder = { error: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      logger.info('Alertas del proveedor obtenidas', { 
        userId, 
        providerId, 
        alertsCount: alerts.length 
      });

      return { alerts };
    } catch (error) {
      logger.error('Error obteniendo alertas del proveedor', { 
        userId, 
        providerId, 
        error: error.message 
      });
      throw error;
    }
  }

  // ==========================================
  // ENVÍO DE EMAILS
  // ==========================================

  /**
   * Envía orden de compra por email
   */
  async sendOrderEmail(userId, providerId, orderId, emailData) {
    try {
      logger.info('Enviando orden por email', { userId, providerId, orderId });

      // Obtener orden
      const order = await PurchaseOrder.findById(providerId, orderId);
      if (!order) {
        throw ApiError.notFoundError('Orden de compra no encontrada');
      }

      // Obtener proveedor
      const provider = await Provider.findById(userId, providerId);
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Determinar email destinatario
      const toEmail = emailData.to || provider.email;
      if (!toEmail) {
        throw ApiError.badRequestError(
          'No se puede enviar email: el proveedor no tiene email configurado y no se proporcionó destinatario'
        );
      }

      // Generar subject
      const subject = emailData.subject || `Orden de Compra ${order.orderNumber}`;

      // Generar PDF
      logger.info('Generando PDF de orden', { orderId, orderNumber: order.orderNumber });
      
      const PDFService = require('./PDFService');
      const pdfBuffer = await PDFService.generatePurchaseOrderPDF(order, provider);

      // Enviar email
      logger.info('Enviando email con PDF adjunto', {
        to: toEmail,
        subject,
        orderId,
        orderNumber: order.orderNumber
      });

      const EmailService = require('./EmailService');
      await EmailService.sendPurchaseOrderEmail({
        to: toEmail,
        subject,
        order,
        provider,
        message: emailData.message,
        pdfBuffer
      });

      // Actualizar estado a 'sent' si está en draft
      if (order.status === 'draft') {
        await this.changeOrderStatus(userId, providerId, orderId, {
          status: 'sent',
          createdByName: emailData.createdByName || userId
        });
      }

      // Crear actividad
      await ProviderActivity.createActivity(
        providerId,
        'order_sent',
        `Orden ${order.orderNumber} enviada por correo electrónico a ${toEmail}`,
        {
          entityType: 'order',
          entityId: orderId,
          createdBy: userId,
          createdByName: emailData.createdByName || userId,
          details: {
            orderId,
            orderNumber: order.orderNumber,
            email: toEmail
          }
        }
      );

      const result = {
        sentTo: toEmail,
        sentAt: new Date().toISOString(),
        orderNumber: order.orderNumber
      };

      logger.info('Orden enviada por email', { userId, providerId, orderId, sentTo: toEmail });

      return result;
    } catch (error) {
      logger.error('Error enviando orden por email', { 
        userId, 
        providerId, 
        orderId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Obtiene el tipo MIME de un archivo desde su data URL base64
   */
  getFileTypeFromData(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return null;
    }

    // Extraer el tipo MIME del data URL (data:image/png;base64,...)
    const match = dataUrl.match(/^data:([^;]+);/);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * Calcula el tamaño de un archivo desde su data URL base64
   */
  calculateFileSizeFromBase64(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return 0;
    }

    try {
      // Remover el prefijo data:type;base64, si existe
      const base64Data = dataUrl.includes(',') 
        ? dataUrl.split(',')[1] 
        : dataUrl;
      
      // Calcular tamaño aproximado: base64 usa ~4/3 del tamaño original
      // Pero aquí calculamos el tamaño del string base64
      const sizeInBytes = (base64Data.length * 3) / 4;
      
      // Ajustar por padding si existe
      if (base64Data.endsWith('==')) {
        return sizeInBytes - 2;
      } else if (base64Data.endsWith('=')) {
        return sizeInBytes - 1;
      }
      
      return Math.ceil(sizeInBytes);
    } catch (error) {
      logger.warn('Error calculando tamaño desde base64', { error: error.message });
      return 0;
    }
  }

  /**
   * Obtiene el tipo MIME de un archivo desde su nombre
   */
  getFileTypeFromFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
      return null;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    return mimeTypes[extension] || null;
  }
}

module.exports = ProviderService;

