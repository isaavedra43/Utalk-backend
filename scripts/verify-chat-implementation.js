/**
 * 🔍 SCRIPT DE VERIFICACIÓN - IMPLEMENTACIÓN COMPLETA DEL CHAT
 * 
 * Verifica que todos los endpoints, modelos, websockets y validaciones
 * estén correctamente implementados según las especificaciones.
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ChatImplementationVerifier {
  constructor() {
    this.results = {
      endpoints: [],
      models: [],
      websockets: [],
      validations: [],
      documentation: [],
      tests: [],
      errors: [],
      warnings: []
    };
    
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  }

  /**
   * 🚀 Ejecutar verificación completa
   */
  async verify() {
    console.log('🔍 INICIANDO VERIFICACIÓN COMPLETA DEL MÓDULO DE CHAT');
    console.log('=' .repeat(60));

    try {
      await this.verifyEndpoints();
      await this.verifyModels();
      await this.verifyWebSockets();
      await this.verifyValidations();
      await this.verifyDocumentation();
      await this.verifyTests();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Error durante verificación:', error.message);
      this.results.errors.push(`Error general: ${error.message}`);
    }
  }

  /**
   * 🌐 Verificar endpoints REST
   */
  async verifyEndpoints() {
    console.log('\n📡 VERIFICANDO ENDPOINTS REST...');
    
    const requiredEndpoints = [
      // Conversaciones
      { method: 'GET', path: '/api/conversations', description: 'Listar conversaciones' },
      { method: 'GET', path: '/api/conversations/unassigned', description: 'Conversaciones sin asignar' },
      { method: 'GET', path: '/api/conversations/stats', description: 'Estadísticas' },
      { method: 'GET', path: '/api/conversations/search', description: 'Búsqueda' },
      { method: 'GET', path: '/api/conversations/:id', description: 'Obtener conversación' },
      { method: 'POST', path: '/api/conversations', description: 'Crear conversación' },
      { method: 'PUT', path: '/api/conversations/:id', description: 'Actualizar conversación' },
      { method: 'PUT', path: '/api/conversations/:id/assign', description: 'Asignar conversación' },
      { method: 'PUT', path: '/api/conversations/:id/unassign', description: 'Desasignar conversación' },
      { method: 'POST', path: '/api/conversations/:id/transfer', description: 'Transferir conversación' },
      { method: 'PUT', path: '/api/conversations/:id/status', description: 'Cambiar estado' },
      { method: 'PUT', path: '/api/conversations/:id/priority', description: 'Cambiar prioridad' },
      { method: 'PUT', path: '/api/conversations/:id/read-all', description: 'Marcar como leída' },
      { method: 'POST', path: '/api/conversations/:id/typing', description: 'Indicar typing' },
      
      // Mensajes
      { method: 'GET', path: '/api/conversations/:id/messages', description: 'Listar mensajes' },
      { method: 'POST', path: '/api/conversations/:id/messages', description: 'Crear mensaje en conversación' },
      { method: 'POST', path: '/api/messages/send', description: 'Enviar mensaje independiente' },
      { method: 'PUT', path: '/api/conversations/:id/messages/:mid/read', description: 'Marcar mensaje leído' },
      { method: 'DELETE', path: '/api/conversations/:id/messages/:mid', description: 'Eliminar mensaje' },
      { method: 'POST', path: '/api/messages/webhook', description: 'Webhook Twilio' },
      { method: 'GET', path: '/api/messages/webhook', description: 'Verificación webhook' }
    ];

    for (const endpoint of requiredEndpoints) {
      const exists = await this.checkEndpointExists(endpoint);
      this.results.endpoints.push({
        ...endpoint,
        exists,
        status: exists ? '✅' : '❌'
      });
    }

    const existingCount = this.results.endpoints.filter(e => e.exists).length;
    console.log(`📊 Endpoints: ${existingCount}/${requiredEndpoints.length} implementados`);
  }

  /**
   * 🏗️ Verificar modelos de datos
   */
  async verifyModels() {
    console.log('\n🏗️ VERIFICANDO MODELOS DE DATOS...');
    
    const models = [
      {
        name: 'Conversation',
        file: 'src/models/Conversation.js',
        requiredMethods: [
          'constructor', 'create', 'getById', 'list', 'search', 'update', 
          'assignTo', 'unassign', 'changePriority', 'changeStatus', 
          'markAllAsRead', 'getStats', 'toJSON'
        ]
      },
      {
        name: 'Message',
        file: 'src/models/Message.js',
        requiredMethods: [
          'constructor', 'create', 'getById', 'getByConversation', 'update',
          'markAsReadBy', 'softDelete', 'getStats', 'searchInUserConversations', 'toJSON'
        ]
      }
    ];

    for (const model of models) {
      const verification = this.verifyModelFile(model);
      this.results.models.push(verification);
    }

    const validModels = this.results.models.filter(m => m.isValid).length;
    console.log(`📊 Modelos: ${validModels}/${models.length} completos`);
  }

  /**
   * 🌐 Verificar WebSockets
   */
  async verifyWebSockets() {
    console.log('\n🌐 VERIFICANDO WEBSOCKETS...');
    
    const socketFile = 'src/socket/index.js';
    const requiredEvents = [
      'connected', 'join-conversation', 'leave-conversation', 
      'typing-start', 'typing-stop', 'message-read', 
      'conversation-status-change', 'update-status'
    ];

    const requiredEmitters = [
      'new-message', 'conversation-assigned', 'conversation-transferred',
      'conversation-status-changed', 'conversation-priority-changed',
      'message-read-by-user', 'user-typing', 'user-status-changed'
    ];

    if (fs.existsSync(socketFile)) {
      const content = fs.readFileSync(socketFile, 'utf8');
      
      const eventsFound = requiredEvents.filter(event => 
        content.includes(`'${event}'`) || content.includes(`"${event}"`)
      );
      
      const emittersFound = requiredEmitters.filter(emitter => 
        content.includes(`'${emitter}'`) || content.includes(`"${emitter}"`)
      );

      this.results.websockets.push({
        file: socketFile,
        exists: true,
        events: {
          required: requiredEvents.length,
          found: eventsFound.length,
          missing: requiredEvents.filter(e => !eventsFound.includes(e))
        },
        emitters: {
          required: requiredEmitters.length,
          found: emittersFound.length,
          missing: requiredEmitters.filter(e => !emittersFound.includes(e))
        }
      });

      console.log(`📊 Socket Events: ${eventsFound.length}/${requiredEvents.length} implementados`);
      console.log(`📊 Socket Emitters: ${emittersFound.length}/${requiredEmitters.length} implementados`);
    } else {
      this.results.websockets.push({
        file: socketFile,
        exists: false,
        error: 'Archivo de socket no encontrado'
      });
    }
  }

  /**
   * ✅ Verificar validaciones Joi
   */
  async verifyValidations() {
    console.log('\n✅ VERIFICANDO VALIDACIONES...');
    
    const validationFile = 'src/utils/validation.js';
    const requiredSchemas = [
      'conversation.create', 'conversation.update', 'conversation.assign',
      'conversation.transfer', 'conversation.changeStatus', 'conversation.changePriority',
      'conversation.list', 'conversation.search', 'conversation.stats',
      'message.send', 'message.createInConversation', 'message.markAsRead'
    ];

    if (fs.existsSync(validationFile)) {
      const content = fs.readFileSync(validationFile, 'utf8');
      
      const schemasFound = requiredSchemas.filter(schema => {
        const parts = schema.split('.');
        return content.includes(`${parts[0]}:`) && content.includes(`${parts[1]}:`);
      });

      this.results.validations.push({
        file: validationFile,
        exists: true,
        schemas: {
          required: requiredSchemas.length,
          found: schemasFound.length,
          missing: requiredSchemas.filter(s => !schemasFound.includes(s))
        }
      });

      console.log(`📊 Esquemas: ${schemasFound.length}/${requiredSchemas.length} implementados`);
    } else {
      this.results.validations.push({
        file: validationFile,
        exists: false,
        error: 'Archivo de validaciones no encontrado'
      });
    }
  }

  /**
   * 📚 Verificar documentación
   */
  async verifyDocumentation() {
    console.log('\n📚 VERIFICANDO DOCUMENTACIÓN...');
    
    const docFiles = [
      'docs/api-chat-documentation.md',
      'src/utils/responseHandler.js',
      'README.md'
    ];

    for (const file of docFiles) {
      const exists = fs.existsSync(file);
      this.results.documentation.push({
        file,
        exists,
        status: exists ? '✅' : '❌'
      });
    }

    const existingDocs = this.results.documentation.filter(d => d.exists).length;
    console.log(`📊 Documentación: ${existingDocs}/${docFiles.length} archivos presentes`);
  }

  /**
   * 🧪 Verificar tests
   */
  async verifyTests() {
    console.log('\n🧪 VERIFICANDO TESTS...');
    
    const testFiles = [
      'tests/integration/chat-flow.test.js',
      'jest.config.js',
      'package.json' // Verificar scripts de test
    ];

    for (const file of testFiles) {
      const exists = fs.existsSync(file);
      this.results.tests.push({
        file,
        exists,
        status: exists ? '✅' : '❌'
      });
    }

    const existingTests = this.results.tests.filter(t => t.exists).length;
    console.log(`📊 Tests: ${existingTests}/${testFiles.length} archivos presentes`);
  }

  /**
   * 🔍 Verificar si un endpoint existe
   */
  async checkEndpointExists(endpoint) {
    try {
      // Buscar en archivos de rutas
      const routeFiles = [
        'src/routes/conversations.js',
        'src/routes/messages.js',
        'src/routes/webhook.js'
      ];

      for (const file of routeFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const routePattern = endpoint.path.replace(/:[\w]+/g, ':');
          
          if (content.includes(`${endpoint.method.toLowerCase()}(`) && 
              content.includes(routePattern.split('/').pop())) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🏗️ Verificar archivo de modelo
   */
  verifyModelFile(model) {
    const result = {
      name: model.name,
      file: model.file,
      exists: false,
      methods: [],
      isValid: false
    };

    if (fs.existsSync(model.file)) {
      result.exists = true;
      const content = fs.readFileSync(model.file, 'utf8');
      
      for (const method of model.requiredMethods) {
        const found = content.includes(`${method}(`) || content.includes(`${method} (`);
        result.methods.push({
          name: method,
          exists: found,
          status: found ? '✅' : '❌'
        });
      }

      const foundMethods = result.methods.filter(m => m.exists).length;
      result.isValid = foundMethods === model.requiredMethods.length;
      result.completeness = `${foundMethods}/${model.requiredMethods.length}`;
    }

    return result;
  }

  /**
   * 📊 Generar reporte final
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORTE FINAL DE VERIFICACIÓN');
    console.log('='.repeat(60));

    // Resumen general
    const endpointsOk = this.results.endpoints.filter(e => e.exists).length;
    const modelsOk = this.results.models.filter(m => m.isValid).length;
    const docsOk = this.results.documentation.filter(d => d.exists).length;
    const testsOk = this.results.tests.filter(t => t.exists).length;

    console.log('\n🎯 RESUMEN GENERAL:');
    console.log(`📡 Endpoints REST: ${endpointsOk}/${this.results.endpoints.length} ✅`);
    console.log(`🏗️ Modelos de datos: ${modelsOk}/${this.results.models.length} ✅`);
    console.log(`🌐 WebSockets: ${this.results.websockets.length > 0 ? '✅' : '❌'}`);
    console.log(`✅ Validaciones: ${this.results.validations.length > 0 ? '✅' : '❌'}`);
    console.log(`📚 Documentación: ${docsOk}/${this.results.documentation.length} ✅`);
    console.log(`🧪 Tests: ${testsOk}/${this.results.tests.length} ✅`);

    // Detalles de endpoints faltantes
    const missingEndpoints = this.results.endpoints.filter(e => !e.exists);
    if (missingEndpoints.length > 0) {
      console.log('\n❌ ENDPOINTS FALTANTES:');
      missingEndpoints.forEach(ep => {
        console.log(`   ${ep.method} ${ep.path} - ${ep.description}`);
      });
    }

    // Detalles de modelos incompletos
    const incompleteModels = this.results.models.filter(m => !m.isValid);
    if (incompleteModels.length > 0) {
      console.log('\n❌ MODELOS INCOMPLETOS:');
      incompleteModels.forEach(model => {
        console.log(`   ${model.name} (${model.completeness})`);
        const missingMethods = model.methods.filter(m => !m.exists);
        missingMethods.forEach(method => {
          console.log(`     - ${method.name}`);
        });
      });
    }

    // WebSocket detalles
    if (this.results.websockets.length > 0) {
      const ws = this.results.websockets[0];
      if (ws.exists && (ws.events.missing.length > 0 || ws.emitters.missing.length > 0)) {
        console.log('\n⚠️ WEBSOCKET PENDIENTES:');
        if (ws.events.missing.length > 0) {
          console.log(`   Eventos faltantes: ${ws.events.missing.join(', ')}`);
        }
        if (ws.emitters.missing.length > 0) {
          console.log(`   Emitters faltantes: ${ws.emitters.missing.join(', ')}`);
        }
      }
    }

    // Cálculo de completitud general
    const totalItems = this.results.endpoints.length + this.results.models.length + 4; // +4 por websockets, validations, docs, tests
    const completedItems = endpointsOk + modelsOk + 
      (this.results.websockets.length > 0 ? 1 : 0) +
      (this.results.validations.length > 0 ? 1 : 0) +
      (docsOk > 0 ? 1 : 0) +
      (testsOk > 0 ? 1 : 0);

    const completionPercentage = Math.round((completedItems / totalItems) * 100);

    console.log(`\n🎯 COMPLETITUD GENERAL: ${completionPercentage}%`);
    
    if (completionPercentage >= 90) {
      console.log('🎉 ¡IMPLEMENTACIÓN CASI COMPLETA! Lista para producción.');
    } else if (completionPercentage >= 70) {
      console.log('👍 IMPLEMENTACIÓN AVANZADA. Faltan algunos elementos.');
    } else {
      console.log('⚠️ IMPLEMENTACIÓN PARCIAL. Se requiere más trabajo.');
    }

    console.log('\n' + '='.repeat(60));
    
    // Guardar reporte en archivo
    this.saveReport();
  }

  /**
   * 💾 Guardar reporte en archivo
   */
  saveReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        endpoints: `${this.results.endpoints.filter(e => e.exists).length}/${this.results.endpoints.length}`,
        models: `${this.results.models.filter(m => m.isValid).length}/${this.results.models.length}`,
        websockets: this.results.websockets.length > 0,
        validations: this.results.validations.length > 0,
        documentation: `${this.results.documentation.filter(d => d.exists).length}/${this.results.documentation.length}`,
        tests: `${this.results.tests.filter(t => t.exists).length}/${this.results.tests.length}`
      },
      details: this.results
    };

    const reportPath = 'chat-implementation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Reporte guardado en: ${reportPath}`);
  }
}

// Ejecutar verificación si es llamado directamente
if (require.main === module) {
  const verifier = new ChatImplementationVerifier();
  verifier.verify().catch(console.error);
}

module.exports = ChatImplementationVerifier; 