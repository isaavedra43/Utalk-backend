const { firestore } = require('../config/firebase');
const { ResponseHandler } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * 🎯 ClientController - Mapea la colección 'contacts' como 'clients'
 * 
 * Los contactos son efectivamente nuestros clientes - personas que nos han contactado.
 * Este controller mapea la estructura existente de contacts para el módulo de clientes del frontend.
 */
class ClientController {
  /**
   * 📋 Listar clientes (mapea desde contacts)
   * GET /api/clients
   */
  static async list(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        stages, 
        agents, 
        sources, 
        segments,
        status = 'all',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      logger.info('📋 ClientController.list - Obteniendo lista de clientes', {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        sortBy,
        sortOrder,
        userEmail: req.user?.email
      });

      // 🔍 VERIFICAR FIREBASE
      if (!firestore) {
        logger.error('❌ Firebase no está inicializado', {
          category: 'CLIENT_FIREBASE_ERROR',
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CONFIGURATION_ERROR',
          code: 'FIREBASE_NOT_INITIALIZED',
          message: 'Base de datos no disponible',
          statusCode: 503
        });
      }

      // 🔍 OBTENER TODOS LOS CONTACTOS
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      const clients = [];
      for (const contactDoc of contactsSnapshot.docs) {
        const contactData = contactDoc.data();
        
        // 🔧 MAPEAR CONTACTO → CLIENTE
        const client = {
          id: contactDoc.id,
          name: contactData.name || contactData.profileName || 'Cliente sin nombre',
          company: contactData.company || contactData.metadata?.company || null,
          email: contactData.email || contactData.metadata?.email || null,
          phone: contactData.phone,
          whatsapp: contactData.waId || contactData.phone,
          avatar: contactData.profilePhotoUrl || null,
          initials: (contactData.name || contactData.profileName || 'CL').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
          status: contactData.isActive !== false ? 'active' : 'inactive',
          stage: ClientController.calculateStage(contactData),
          score: ClientController.calculateScore(contactData),
          winRate: 0, // Se puede calcular desde conversaciones
          expectedValue: contactData.expectedValue || 0,
          probability: ClientController.calculateProbability(contactData),
          source: ClientController.mapSource(contactData.source),
          segment: ClientController.calculateSegment(contactData),
          tags: contactData.tags || [],
          createdAt: contactData.createdAt?.toDate?.()?.toISOString() || contactData.createdAt,
          updatedAt: contactData.updatedAt?.toDate?.()?.toISOString() || contactData.lastUpdated || contactData.createdAt,
          lastContact: contactData.lastContactAt?.toDate?.()?.toISOString() || contactData.lastContactAt || contactData.createdAt,
          assignedTo: contactData.assignedTo || null,
          assignedToName: contactData.assignedToName || null,
          
          // 📊 CAMPOS ADICIONALES ÚTILES
          conversationCount: 0, // Se puede calcular
          messageCount: 0, // Se puede calcular
          channel: contactData.source === 'whatsapp_webhook' ? 'whatsapp' : 'unknown',
          metadata: contactData.metadata || {}
        };
        
        clients.push(client);
      }

      // 🔍 APLICAR FILTROS
      let filteredClients = clients;

      // Filtro por búsqueda
      if (search) {
        const searchLower = search.toLowerCase();
        filteredClients = filteredClients.filter(client => 
          client.name?.toLowerCase().includes(searchLower) ||
          client.company?.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.phone?.includes(search) ||
          client.whatsapp?.includes(search)
        );
      }

      // Filtro por estado
      if (status && status !== 'all') {
        filteredClients = filteredClients.filter(client => client.status === status);
      }

      // Filtros por etapas
      if (stages && Array.isArray(stages)) {
        filteredClients = filteredClients.filter(client => stages.includes(client.stage));
      }

      // Filtros por fuentes
      if (sources && Array.isArray(sources)) {
        filteredClients = filteredClients.filter(client => sources.includes(client.source));
      }

      // Filtros por segmentos
      if (segments && Array.isArray(segments)) {
        filteredClients = filteredClients.filter(client => segments.includes(client.segment));
      }

      // 📊 ORDENAMIENTO
      filteredClients.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // Manejar fechas
        if (sortBy.includes('At') || sortBy.includes('Date')) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        // Manejar números
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Manejar strings
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortOrder === 'asc' ? comparison : -comparison;
        }

        // Manejar fechas
        if (aValue instanceof Date && bValue instanceof Date) {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });

      // 📄 PAGINACIÓN
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedClients = filteredClients.slice(startIndex, endIndex);

      const response = {
        clients: paginatedClients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredClients.length,
          totalPages: Math.ceil(filteredClients.length / parseInt(limit))
        },
        summary: {
          total: filteredClients.length,
          active: filteredClients.filter(c => c.status === 'active').length,
          inactive: filteredClients.filter(c => c.status === 'inactive').length
        }
      };

      logger.info('✅ Lista de clientes obtenida exitosamente', {
        totalClients: paginatedClients.length,
        totalFiltered: filteredClients.length,
        page: parseInt(page),
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, response, 'Clientes obtenidos exitosamente');
      
    } catch (error) {
      logger.error('❌ Error obteniendo lista de clientes:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔍 Health check para Firebase
   * GET /api/clients/health
   */
  static async healthCheck(req, res) {
    try {
      logger.info('🔍 ClientController.healthCheck - Verificando estado de Firebase', {
        userEmail: req.user?.email
      });

      // Verificar Firebase
      if (!firestore) {
        return ResponseHandler.error(res, {
          type: 'CONFIGURATION_ERROR',
          code: 'FIREBASE_NOT_INITIALIZED',
          message: 'Firebase no está inicializado',
          statusCode: 503
        });
      }

      // Test de conectividad
      try {
        await firestore.collection('_health_check').doc('test').get();
        
        return ResponseHandler.success(res, {
          firebase: 'OK',
          firestore: 'CONNECTED',
          timestamp: new Date().toISOString()
        }, 'Firebase funcionando correctamente');
      } catch (firebaseError) {
        return ResponseHandler.error(res, {
          type: 'CONFIGURATION_ERROR',
          code: 'FIREBASE_CONNECTION_ERROR',
          message: 'Error conectando a Firebase',
          details: firebaseError.message,
          statusCode: 503
        });
      }
    } catch (error) {
      logger.error('❌ Error en health check:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📊 Obtener métricas de clientes
   * GET /api/clients/metrics
   */
  static async getMetrics(req, res) {
    try {
      logger.info('📊 ClientController.getMetrics - Obteniendo métricas de clientes', {
        userEmail: req.user?.email
      });

      // 🔍 VERIFICAR FIREBASE
      if (!firestore) {
        logger.error('❌ Firebase no está inicializado para métricas', {
          category: 'CLIENT_METRICS_FIREBASE_ERROR',
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CONFIGURATION_ERROR',
          code: 'FIREBASE_NOT_INITIALIZED',
          message: 'Base de datos no disponible para métricas',
          statusCode: 503
        });
      }

      // 🔍 OBTENER TODOS LOS CONTACTOS
      const contactsSnapshot = await firestore.collection('contacts').get();
      const contacts = [];
      
      contactsSnapshot.forEach(doc => {
        contacts.push({ id: doc.id, ...doc.data() });
      });

      // 📈 CALCULAR MÉTRICAS BÁSICAS
      const totalClients = contacts.length;
      const activeClients = contacts.filter(c => c.isActive !== false).length;
      const inactiveClients = totalClients - activeClients;

      // 📊 MÉTRICAS POR FUENTE
      const sourceMetrics = {};
      contacts.forEach(contact => {
        const source = ClientController.mapSource(contact.source);
        if (!sourceMetrics[source]) {
          sourceMetrics[source] = { count: 0, value: 0, conversionRate: 0 };
        }
        sourceMetrics[source].count++;
      });

      // 📊 MÉTRICAS POR ETAPA
      const stageMetrics = {
        lead: { count: 0, value: 0, averageProbability: 0 },
        prospect: { count: 0, value: 0, averageProbability: 0 },
        demo: { count: 0, value: 0, averageProbability: 0 },
        propuesta: { count: 0, value: 0, averageProbability: 0 },
        negociacion: { count: 0, value: 0, averageProbability: 0 },
        ganado: { count: 0, value: 0, averageProbability: 0 },
        perdido: { count: 0, value: 0, averageProbability: 0 }
      };

      contacts.forEach(contact => {
        const stage = ClientController.calculateStage(contact);
        if (stageMetrics[stage]) {
          stageMetrics[stage].count++;
          stageMetrics[stage].value += contact.expectedValue || 0;
        }
      });

      // 📅 CONTACTOS POR CONTACTAR HOY
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const contactsToContactToday = contacts.filter(contact => {
        if (!contact.nextContactDate) return false;
        const nextContact = new Date(contact.nextContactDate);
        return nextContact <= today;
      }).length;

      // 💰 VALORES TOTALES
      const totalValue = contacts.reduce((sum, contact) => sum + (contact.expectedValue || 0), 0);
      const projectedRevenue = contacts
        .filter(contact => ClientController.calculateStage(contact) !== 'perdido')
        .reduce((sum, contact) => {
          const probability = ClientController.calculateProbability(contact) / 100;
          return sum + ((contact.expectedValue || 0) * probability);
        }, 0);

      // 📊 RESPUESTA DE MÉTRICAS
      const metrics = {
        // Métricas generales
        totalClients,
        totalValue,
        totalOpportunities: activeClients,
        contactsToContactToday,
        winRate: 25.5, // Mock por ahora, se puede calcular desde conversaciones cerradas
        projectedRevenue,

        // Métricas por etapa
        stageMetrics,

        // Métricas por fuente
        sourceMetrics,

        // Métricas por segmento
        segmentMetrics: {
          startup: { count: Math.floor(totalClients * 0.3), value: totalValue * 0.2, averageValue: 5000 },
          sme: { count: Math.floor(totalClients * 0.5), value: totalValue * 0.5, averageValue: 15000 },
          enterprise: { count: Math.floor(totalClients * 0.2), value: totalValue * 0.3, averageValue: 50000 }
        },

        // Tendencias
        trends: {
          newClientsThisMonth: Math.floor(totalClients * 0.1),
          newClientsLastMonth: Math.floor(totalClients * 0.08),
          valueGrowth: 12.5,
          winRateChange: 2.3
        },

        // Métricas adicionales
        summary: {
          active: activeClients,
          inactive: inactiveClients,
          averageValue: totalClients > 0 ? totalValue / totalClients : 0,
          topSources: Object.entries(sourceMetrics)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 3)
            .map(([source, data]) => ({ source, count: data.count }))
        }
      };

      logger.info('✅ Métricas de clientes obtenidas exitosamente', {
        totalClients,
        activeClients,
        totalValue,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, metrics, 'Métricas obtenidas exitosamente');
      
    } catch (error) {
      logger.error('❌ Error obteniendo métricas de clientes:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔍 Obtener cliente específico por ID
   * GET /api/clients/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      
      logger.info('🔍 ClientController.getById - Obteniendo cliente específico', {
        clientId: id,
        userEmail: req.user?.email
      });

      // 🔍 VERIFICAR FIREBASE
      if (!firestore) {
        logger.error('❌ Firebase no está inicializado para getById', {
          category: 'CLIENT_GETBYID_FIREBASE_ERROR',
          clientId: id,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CONFIGURATION_ERROR',
          code: 'FIREBASE_NOT_INITIALIZED',
          message: 'Base de datos no disponible',
          statusCode: 503
        });
      }

      const contactDoc = await firestore.collection('contacts').doc(id).get();
      
      if (!contactDoc.exists) {
        logger.warn('⚠️ Cliente no encontrado', { clientId: id, userEmail: req.user?.email });
        return ResponseHandler.error(res, {
          type: 'CLIENT_NOT_FOUND',
          message: 'Cliente no encontrado',
          statusCode: 404
        });
      }

      const contactData = contactDoc.data();
      
      // 🔧 MAPEAR CONTACTO → CLIENTE DETALLADO
      const client = {
        id: contactDoc.id,
        name: contactData.name || contactData.profileName || 'Cliente sin nombre',
        company: contactData.company || contactData.metadata?.company || null,
        email: contactData.email || contactData.metadata?.email || null,
        phone: contactData.phone,
        whatsapp: contactData.waId || contactData.phone,
        avatar: contactData.profilePhotoUrl || null,
        initials: (contactData.name || contactData.profileName || 'CL').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        status: contactData.isActive !== false ? 'active' : 'inactive',
        stage: ClientController.calculateStage(contactData),
        score: ClientController.calculateScore(contactData),
        winRate: 0,
        expectedValue: contactData.expectedValue || 0,
        probability: ClientController.calculateProbability(contactData),
        source: ClientController.mapSource(contactData.source),
        segment: ClientController.calculateSegment(contactData),
        tags: contactData.tags || [],
        createdAt: contactData.createdAt?.toDate?.()?.toISOString() || contactData.createdAt,
        updatedAt: contactData.updatedAt?.toDate?.()?.toISOString() || contactData.lastUpdated || contactData.createdAt,
        lastContact: contactData.lastContactAt?.toDate?.()?.toISOString() || contactData.lastContactAt || contactData.createdAt,
        assignedTo: contactData.assignedTo || null,
        assignedToName: contactData.assignedToName || null,
        
        // 📊 DATOS ADICIONALES PARA VISTA DETALLE
        metadata: contactData.metadata || {},
        notes: contactData.notes || [],
        activities: [], // Se puede obtener desde conversaciones
        deals: [], // Se puede obtener desde metadata
        channel: contactData.source === 'whatsapp_webhook' ? 'whatsapp' : 'unknown'
      };

      logger.info('✅ Cliente obtenido exitosamente', {
        clientId: id,
        clientName: client.name,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, client, 'Cliente obtenido exitosamente');
      
    } catch (error) {
      logger.error('❌ Error obteniendo cliente por ID:', {
        clientId: req.params?.id,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  // 🛠️ MÉTODOS UTILITARIOS

  /**
   * 🔤 Generar iniciales del nombre
   */
  static getInitials(name) {
    if (!name) return 'CL';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  /**
   * 🗂️ Mapear fuente del contacto
   */
  static mapSource(source) {
    const sourceMap = {
      'whatsapp_webhook': 'social',
      'form': 'website',
      'manual': 'referral',
      'import': 'referral',
      'api': 'website'
    };
    return sourceMap[source] || 'website';
  }

  /**
   * 📊 Calcular etapa del cliente
   */
  static calculateStage(contactData) {
    // Por ahora, lógica simple basada en datos existentes
    if (contactData.stage) return contactData.stage;
    
    // Lógica basada en antigüedad y actividad
    const createdAt = new Date(contactData.createdAt);
    const daysSinceCreated = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated < 1) return 'lead';
    if (daysSinceCreated < 7) return 'prospect';
    if (daysSinceCreated < 30) return 'demo';
    
    return 'propuesta';
  }

  /**
   * 🎯 Calcular score del cliente
   */
  static calculateScore(contactData) {
    if (contactData.score) return contactData.score;
    
    let score = 50; // Base
    
    // Incrementar por datos disponibles
    if (contactData.name) score += 10;
    if (contactData.email) score += 15;
    if (contactData.company) score += 10;
    if (contactData.phone) score += 10;
    
    // Incrementar por fuente
    if (contactData.source === 'whatsapp_webhook') score += 5;
    
    return Math.min(score, 100);
  }

  /**
   * 📈 Calcular probabilidad de conversión
   */
  static calculateProbability(contactData) {
    if (contactData.probability) return contactData.probability;
    
    const stage = ClientController.calculateStage(contactData);
    const stageProbabilities = {
      'lead': 20,
      'prospect': 35,
      'demo': 50,
      'propuesta': 70,
      'negociacion': 85,
      'ganado': 100,
      'perdido': 0
    };
    
    return stageProbabilities[stage] || 25;
  }

  /**
   * 🏢 Calcular segmento del cliente
   */
  static calculateSegment(contactData) {
    if (contactData.segment) return contactData.segment;
    
    // Lógica simple por ahora
    if (contactData.company) {
      if (contactData.expectedValue > 100000) return 'enterprise';
      if (contactData.expectedValue > 25000) return 'sme';
      return 'startup';
    }
    
    return 'freelancer';
  }

  /**
   * ➕ Crear cliente
   * POST /api/clients
   */
  static async create(req, res) {
    try {
      const clientData = req.body;
      
      logger.info('➕ ClientController.create - Creando nuevo cliente', {
        clientName: clientData.name,
        clientPhone: clientData.phone,
        userEmail: req.user?.email
      });

      // Validar datos requeridos
      if (!clientData.name || !clientData.phone) {
        logger.warn('❌ Datos requeridos faltantes para crear cliente', {
          hasName: !!clientData.name,
          hasPhone: !!clientData.phone,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'VALIDATION_ERROR',
          message: 'Nombre y teléfono son requeridos',
          statusCode: 400
        });
      }

      // Verificar si ya existe un contacto con ese teléfono
      // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
      const normalizedPhone = clientData.phone.startsWith('whatsapp:') 
        ? clientData.phone 
        : `whatsapp:${clientData.phone}`;

      const existingContact = await firestore
        .collection('contacts')
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!existingContact.empty) {
        logger.warn('⚠️ Cliente ya existe con ese teléfono', {
          phone: clientData.phone,
          normalizedPhone,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CLIENT_ALREADY_EXISTS',
          message: 'Ya existe un cliente con ese teléfono',
          statusCode: 409
        });
      }

      // Crear contacto (que será el cliente)
      const contactData = {
        name: clientData.name,
        phone: normalizedPhone,  // Usar formato normalizado
        email: clientData.email || null,
        company: clientData.company || null,
        tags: clientData.tags || [],
        metadata: {
          ...clientData.metadata,
          stage: clientData.stage || 'lead',
          expectedValue: clientData.expectedValue || 0,
          source: clientData.source || 'manual',
          segment: clientData.segment || 'freelancer'
        },
        userId: req.user.email,
        isActive: true,
        lastContactAt: new Date(),
        totalMessages: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Crear documento en Firestore
      const contactRef = await firestore.collection('contacts').add(contactData);
      const contactDoc = await contactRef.get();
      
      // Mapear a formato cliente
      const client = {
        id: contactDoc.id,
        name: contactData.name,
        company: contactData.company,
        email: contactData.email,
        phone: contactData.phone,
        whatsapp: contactData.phone,
        avatar: null,
        initials: this.getInitials(contactData.name),
        status: 'active',
        stage: contactData.metadata.stage,
        score: this.calculateScore(contactData),
        winRate: 0,
        expectedValue: contactData.metadata.expectedValue,
        probability: this.calculateProbability(contactData),
        source: this.mapSource(contactData.metadata.source),
        segment: contactData.metadata.segment,
        tags: contactData.tags,
        createdAt: contactData.createdAt.toISOString(),
        updatedAt: contactData.updatedAt.toISOString(),
        lastContact: contactData.lastContactAt.toISOString(),
        assignedTo: null,
        assignedToName: null,
        conversationCount: 0,
        messageCount: 0,
        channel: 'manual',
        metadata: contactData.metadata
      };

      logger.info('✅ Cliente creado exitosamente', {
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, client, 'Cliente creado exitosamente', 201);
      
    } catch (error) {
      logger.error('❌ Error creando cliente:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email,
        clientData: req.body
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * ✏️ Actualizar cliente
   * PUT /api/clients/:id
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      logger.info('✏️ ClientController.update - Actualizando cliente', {
        clientId: id,
        updateFields: Object.keys(updateData),
        userEmail: req.user?.email
      });

      const contactDoc = await firestore.collection('contacts').doc(id).get();
      if (!contactDoc.exists) {
        logger.warn('⚠️ Cliente no encontrado para actualizar', {
          clientId: id,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CLIENT_NOT_FOUND',
          message: 'Cliente no encontrado',
          statusCode: 404
        });
      }

      const existingData = contactDoc.data();

      // Preparar campos de actualización
      const updateFields = {
        updatedAt: new Date()
      };

      // Campos básicos
      if (updateData.name !== undefined) updateFields.name = updateData.name;
      if (updateData.email !== undefined) updateFields.email = updateData.email;
      if (updateData.company !== undefined) updateFields.company = updateData.company;
      if (updateData.tags !== undefined) updateFields.tags = updateData.tags;

      // Campos de metadata
      const metadata = { ...existingData.metadata };
      if (updateData.stage !== undefined) metadata.stage = updateData.stage;
      if (updateData.expectedValue !== undefined) metadata.expectedValue = updateData.expectedValue;
      if (updateData.source !== undefined) metadata.source = updateData.source;
      if (updateData.segment !== undefined) metadata.segment = updateData.segment;
      if (updateData.probability !== undefined) metadata.probability = updateData.probability;
      if (updateData.score !== undefined) metadata.score = updateData.score;
      if (updateData.metadata !== undefined) {
        Object.assign(metadata, updateData.metadata);
      }

      updateFields.metadata = metadata;

      // Actualizar en Firestore
      await firestore.collection('contacts').doc(id).update(updateFields);
      
      // Obtener documento actualizado
      const updatedDoc = await firestore.collection('contacts').doc(id).get();
      const updatedData = updatedDoc.data();
      
      // Mapear a formato cliente
      const client = {
        id: updatedDoc.id,
        name: updatedData.name,
        company: updatedData.company,
        email: updatedData.email,
        phone: updatedData.phone,
        whatsapp: updatedData.phone,
        avatar: null,
        initials: this.getInitials(updatedData.name),
        status: updatedData.isActive !== false ? 'active' : 'inactive',
        stage: this.calculateStage(updatedData),
        score: this.calculateScore(updatedData),
        winRate: 0,
        expectedValue: updatedData.metadata?.expectedValue || 0,
        probability: this.calculateProbability(updatedData),
        source: this.mapSource(updatedData.metadata?.source),
        segment: this.calculateSegment(updatedData),
        tags: updatedData.tags || [],
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
        updatedAt: updateFields.updatedAt.toISOString(),
        lastContact: updatedData.lastContactAt?.toDate?.()?.toISOString() || updatedData.lastContactAt,
        assignedTo: updatedData.assignedTo || null,
        assignedToName: updatedData.assignedToName || null,
        conversationCount: 0,
        messageCount: 0,
        channel: updatedData.metadata?.source === 'whatsapp_webhook' ? 'whatsapp' : 'manual',
        metadata: updatedData.metadata || {}
      };

      logger.info('✅ Cliente actualizado exitosamente', {
        clientId: id,
        clientName: client.name,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, client, 'Cliente actualizado exitosamente');
      
    } catch (error) {
      logger.error('❌ Error actualizando cliente:', {
        clientId: req.params?.id,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🗑️ Eliminar cliente
   * DELETE /api/clients/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      logger.info('🗑️ ClientController.delete - Eliminando cliente', {
        clientId: id,
        userEmail: req.user?.email
      });

      const contactDoc = await firestore.collection('contacts').doc(id).get();
      if (!contactDoc.exists) {
        logger.warn('⚠️ Cliente no encontrado para eliminar', {
          clientId: id,
          userEmail: req.user?.email
        });
        return ResponseHandler.error(res, {
          type: 'CLIENT_NOT_FOUND',
          message: 'Cliente no encontrado',
          statusCode: 404
        });
      }

      const contactData = contactDoc.data();

      // Soft delete - marcar como inactivo en lugar de eliminar físicamente
      await firestore.collection('contacts').doc(id).update({
        isActive: false,
        updatedAt: new Date(),
        deletedAt: new Date(),
        deletedBy: req.user.email
      });

      logger.info('✅ Cliente eliminado exitosamente (soft delete)', {
        clientId: id,
        clientName: contactData.name,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, null, 'Cliente eliminado exitosamente');
      
    } catch (error) {
      logger.error('❌ Error eliminando cliente:', {
        clientId: req.params?.id,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ClientController;
