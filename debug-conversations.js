/**
 * 🔍 SCRIPT DE DIAGNÓSTICO - PROBLEMA DE CONVERSACIONES VACÍAS
 * 
 * Este script analiza el problema donde el frontend muestra conversaciones vacías
 * a pesar de que existen en Firestore y el usuario está en participants.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('./src/config/firebase');
const Conversation = require('./src/models/Conversation');
const User = require('./src/models/User');

class ConversationDebugger {
  constructor() {
    this.testUserEmail = 'admin@company.com'; // Usuario de prueba
  }

  /**
   * 🚀 Ejecutar diagnóstico completo
   */
  async runDiagnostic() {
    console.log('🔍 INICIANDO DIAGNÓSTICO DE CONVERSACIONES');
    console.log('=' .repeat(60));

    try {
      // 1. Verificar si el usuario existe
      await this.checkUserExists();
      
      // 2. Obtener TODAS las conversaciones
      await this.getAllConversations();
      
      // 3. Verificar conversaciones donde el usuario está en participants
      await this.checkUserInParticipants();
      
      // 4. Verificar conversaciones asignadas al usuario
      await this.checkUserAssigned();
      
      // 5. Probar el método list actual
      await this.testCurrentListMethod();
      
      // 6. Probar método list corregido
      await this.testFixedListMethod();
      
    } catch (error) {
      console.error('❌ Error en diagnóstico:', error.message);
    }
  }

  /**
   * 👤 Verificar si el usuario existe
   */
  async checkUserExists() {
    console.log('\n👤 VERIFICANDO USUARIO...');
    
    try {
      const user = await User.getByEmail(this.testUserEmail);
      if (user) {
        console.log('✅ Usuario encontrado:', {
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive
        });
      } else {
        console.log('❌ Usuario NO encontrado:', this.testUserEmail);
      }
    } catch (error) {
      console.log('❌ Error verificando usuario:', error.message);
    }
  }

  /**
   * 📊 Obtener todas las conversaciones
   */
  async getAllConversations() {
    console.log('\n📊 OBTENIENDO TODAS LAS CONVERSACIONES...');
    
    try {
      const snapshot = await firestore.collection('conversations').get();
      
      console.log(`📈 Total de conversaciones en Firestore: ${snapshot.size}`);
      
      if (snapshot.empty) {
        console.log('❌ No hay conversaciones en la base de datos');
        return;
      }

      // Mostrar estructura de las primeras 3 conversaciones
      let count = 0;
      for (const doc of snapshot.docs) {
        if (count >= 3) break;
        
        const data = doc.data();
        console.log(`\n📋 Conversación ${count + 1}:`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Customer Phone: ${data.customerPhone}`);
        console.log(`   Participants: ${JSON.stringify(data.participants)}`);
        console.log(`   Assigned To: ${data.assignedTo || 'null'}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Created At: ${data.createdAt?.toDate?.() || data.createdAt}`);
        
        count++;
      }
      
    } catch (error) {
      console.log('❌ Error obteniendo conversaciones:', error.message);
    }
  }

  /**
   * 🔍 Verificar conversaciones donde el usuario está en participants
   */
  async checkUserInParticipants() {
    console.log('\n🔍 VERIFICANDO USUARIO EN PARTICIPANTS...');
    
    try {
      const snapshot = await firestore.collection('conversations').get();
      
      const conversationsWithUser = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const participants = data.participants || [];
        
        if (participants.includes(this.testUserEmail)) {
          conversationsWithUser.push({
            id: doc.id,
            customerPhone: data.customerPhone,
            participants: participants,
            assignedTo: data.assignedTo,
            status: data.status
          });
        }
      }
      
      console.log(`📊 Conversaciones donde ${this.testUserEmail} está en participants: ${conversationsWithUser.length}`);
      
      if (conversationsWithUser.length > 0) {
        console.log('📋 Detalles:');
        conversationsWithUser.forEach((conv, index) => {
          console.log(`   ${index + 1}. ID: ${conv.id}`);
          console.log(`      Customer: ${conv.customerPhone}`);
          console.log(`      Assigned To: ${conv.assignedTo || 'null'}`);
          console.log(`      Status: ${conv.status}`);
        });
      } else {
        console.log('❌ El usuario NO está en participants de ninguna conversación');
      }
      
    } catch (error) {
      console.log('❌ Error verificando participants:', error.message);
    }
  }

  /**
   * 👤 Verificar conversaciones asignadas al usuario
   */
  async checkUserAssigned() {
    console.log('\n👤 VERIFICANDO CONVERSACIONES ASIGNADAS...');
    
    try {
      const snapshot = await firestore.collection('conversations')
        .where('assignedTo', '==', this.testUserEmail)
        .get();
      
      console.log(`📊 Conversaciones asignadas a ${this.testUserEmail}: ${snapshot.size}`);
      
      if (!snapshot.empty) {
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   ${index + 1}. ID: ${doc.id}`);
          console.log(`      Customer: ${data.customerPhone}`);
          console.log(`      Status: ${data.status}`);
        });
      } else {
        console.log('❌ No hay conversaciones asignadas al usuario');
      }
      
    } catch (error) {
      console.log('❌ Error verificando asignaciones:', error.message);
    }
  }

  /**
   * 🧪 Probar el método list actual (problemático)
   */
  async testCurrentListMethod() {
    console.log('\n🧪 PROBANDO MÉTODO LIST ACTUAL (PROBLEMÁTICO)...');
    
    try {
      // Simular la llamada actual del controlador
      const result = await Conversation.list({
        limit: 20,
        assignedTo: this.testUserEmail, // Solo busca por assignedTo
        status: null,
        sortBy: 'lastMessageAt',
        sortOrder: 'desc'
      });
      
      console.log(`📊 Resultado del método list actual: ${result.length} conversaciones`);
      
      if (result.length > 0) {
        result.forEach((conv, index) => {
          console.log(`   ${index + 1}. ID: ${conv.id}`);
          console.log(`      Customer: ${conv.customerPhone}`);
          console.log(`      Assigned To: ${conv.assignedTo}`);
        });
      } else {
        console.log('❌ Método list actual NO encuentra conversaciones');
      }
      
    } catch (error) {
      console.log('❌ Error en método list actual:', error.message);
    }
  }

  /**
   * 🧪 Probar método list corregido (con filtro participants)
   */
  async testFixedListMethod() {
    console.log('\n🧪 PROBANDO MÉTODO LIST CORREGIDO...');
    
    try {
      // Simular la llamada corregida que incluye participants
      const result = await this.fixedListMethod({
        limit: 20,
        userEmail: this.testUserEmail,
        status: null,
        sortBy: 'lastMessageAt',
        sortOrder: 'desc'
      });
      
      console.log(`📊 Resultado del método list corregido: ${result.length} conversaciones`);
      
      if (result.length > 0) {
        result.forEach((conv, index) => {
          console.log(`   ${index + 1}. ID: ${conv.id}`);
          console.log(`      Customer: ${conv.customerPhone}`);
          console.log(`      Participants: ${conv.participants.join(', ')}`);
          console.log(`      Assigned To: ${conv.assignedTo || 'null'}`);
        });
      } else {
        console.log('❌ Método list corregido tampoco encuentra conversaciones');
      }
      
    } catch (error) {
      console.log('❌ Error en método list corregido:', error.message);
    }
  }

  /**
   * 🔧 Método list corregido que incluye filtro por participants
   */
  async fixedListMethod(options = {}) {
    const {
      limit = 20,
      userEmail = null,
      status = null,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc'
    } = options;

    console.log('🔧 Ejecutando método list corregido con filtro participants');
    console.log('   Filtros:', { userEmail, status, sortBy, sortOrder });

    let query = firestore.collection('conversations');

    // 🔧 FILTRO CORREGIDO: Buscar por participants O assignedTo
    if (userEmail) {
      // Buscar conversaciones donde el usuario esté en participants O sea el assignedTo
      query = query.where('participants', 'array-contains', userEmail);
      console.log(`   Aplicando filtro: participants contiene "${userEmail}"`);
    }

    if (status) {
      query = query.where('status', '==', status);
      console.log(`   Aplicando filtro: status = "${status}"`);
    }

    // Ordenamiento
    query = query.orderBy(sortBy, sortOrder);
    query = query.limit(limit);

    const snapshot = await query.get();
    
    console.log(`   Resultado: ${snapshot.size} conversaciones encontradas`);

    const conversations = [];
    for (const doc of snapshot.docs) {
      try {
        const conversation = new Conversation({ id: doc.id, ...doc.data() });
        conversations.push(conversation);
      } catch (error) {
        console.log(`   Error procesando conversación ${doc.id}:`, error.message);
      }
    }

    return conversations;
  }
}

// Ejecutar diagnóstico
if (require.main === module) {
  const conversationDebugger = new ConversationDebugger();
  conversationDebugger.runDiagnostic().catch(console.error);
}

module.exports = ConversationDebugger; 