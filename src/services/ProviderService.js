/**
 * 📦 SERVICIO DE PROVEEDORES
 * 
 * Maneja la lógica de negocio para proveedores de materiales.
 * 
 * @version 1.0.0
 */

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
   * Elimina un material de un proveedor
   */
  async deleteProviderMaterial(userId, providerId, materialId) {
    try {
      logger.info('Eliminando material del proveedor', { userId, providerId, materialId });

      const material = await ProviderMaterial.findById(providerId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      const materialName = material.name;
      await material.delete();

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

      // Calcular subtotal y total
      const subtotal = orderData.items.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal + (orderData.tax || 0);

      const order = new PurchaseOrder({
        ...orderData,
        orderNumber,
        providerId,
        providerName: provider.name,
        subtotal,
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

      const oldStatus = order.status;

      // Si se cambia el status, actualizar campos de fecha correspondientes
      if (updates.status && updates.status !== oldStatus) {
        const now = new Date();
        
        switch (updates.status) {
          case 'sent':
            updates.sentAt = now;
            break;
          case 'accepted':
            updates.acceptedAt = now;
            break;
          case 'delivered':
            updates.deliveredAt = now;
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
   * Elimina un pago (solo si está en pending)
   */
  async deletePayment(userId, providerId, paymentId) {
    try {
      logger.info('Eliminando pago', { userId, providerId, paymentId });

      const payment = await Payment.findById(providerId, paymentId);
      
      if (!payment) {
        throw ApiError.notFoundError('Pago no encontrado');
      }

      // Validar que esté en pending
      if (payment.status !== 'pending') {
        throw ApiError.badRequestError('Solo se pueden eliminar pagos en estado pending');
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

      // Convertir fechas a Date objects
      const fromDate = new Date(from);
      const toDate = new Date(to);

      // Obtener todas las órdenes y pagos del período
      const allOrders = await PurchaseOrder.listByProvider(providerId, { limit: 10000 });
      const allPayments = await Payment.listByProvider(providerId, { limit: 10000 });

      // Filtrar por período y status
      const orders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= fromDate && orderDate <= toDate && order.status !== 'cancelled';
      });

      const payments = allPayments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= fromDate && paymentDate <= toDate && payment.status === 'completed';
      });

      // Calcular totales
      const totalOrders = orders.reduce((sum, order) => sum + order.total, 0);
      const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const currentBalance = totalOrders - totalPayments;

      // Preparar arrays de detalles
      const ordersDetails = orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        date: order.createdAt,
        amount: order.total,
        status: order.status
      }));

      const paymentsDetails = payments.map(payment => ({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        date: payment.paymentDate,
        amount: payment.amount,
        method: payment.paymentMethod
      }));

      // Calcular estadísticas adicionales
      const totalPurchaseOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'delivered').length;
      const pendingOrders = orders.filter(o => ['draft', 'sent', 'accepted', 'in_transit'].includes(o.status)).length;

      // Calcular pagos vencidos (órdenes con más de 30 días sin pagar completamente)
      const overduePayments = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const daysSinceOrder = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
        
        // Buscar pagos asociados a esta orden
        const orderPayments = payments.filter(p => p.purchaseOrderId === order.id);
        const totalPaid = orderPayments.reduce((sum, p) => sum + p.amount, 0);
        
        return daysSinceOrder > 30 && totalPaid < order.total;
      }).length;

      const accountStatement = {
        providerId: provider.id,
        providerName: provider.name,
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        },
        openingBalance: 0, // Podría calcularse basado en períodos anteriores
        totalOrders,
        totalPayments,
        currentBalance,
        orders: ordersDetails,
        payments: paymentsDetails,
        totalPurchaseOrders,
        completedOrders,
        pendingOrders,
        overduePayments
      };

      logger.info('Estado de cuenta obtenido', { userId, providerId });

      return accountStatement;
    } catch (error) {
      logger.error('Error obteniendo estado de cuenta', { userId, providerId, error: error.message });
      throw error;
    }
  }
}

module.exports = ProviderService;

