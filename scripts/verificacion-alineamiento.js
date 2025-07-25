/**
 * SCRIPT DE VERIFICACIÓN DE ALINEAMIENTO UTalk Backend
 * 
 * Verifica que todos los cambios de alineación estén correctamente implementados:
 * 1. assignedTo como campo principal en conversaciones
 * 2. customerPhone y agentPhone siempre presentes y normalizados
 * 3. participants con exactamente 2 números únicos
 * 4. senderPhone/recipientPhone en mensajes (NO from/to)
 * 5. Logging detallado en todas las operaciones
 * 6. ✅ NUEVO: Manejo seguro de fechas para evitar errores "toISOString is not a function"
 */

const path = require('path');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const { validateAndNormalizePhone } = require('../src/utils/phoneValidation');
const { safeISOString, isValidDate } = require('../src/utils/dateHelpers');
const logger = require('../src/utils/logger');

class AlineamientoVerifier {
  constructor() {
    this.errores = [];
    this.advertencias = [];
    this.exitos = [];
  }

  async verificarTodo() {
    console.log('🔍 INICIANDO VERIFICACIÓN COMPLETA DE ALINEAMIENTO UTalk Backend\n');

    await this.verificarConversationModel();
    await this.verificarMessageModel();
    await this.verificarValidacionesTelefonos();
    await this.verificarManejoDeFechas(); // ✅ NUEVO
    await this.verificarCasosExtremos(); // ✅ NUEVO
    await this.generarReporte();
  }

  async verificarConversationModel() {
    console.log('📋 Verificando modelo Conversation...');
    
    try {
      // ✅ Crear conversación de prueba con datos válidos
      const testData = {
        id: 'conv_1234567890_1987654321', // ✅ Formato válido para isValidConversationId
        participants: ['+1234567890', '+1987654321'],
        customerPhone: '+1234567890',
        agentPhone: '+1987654321',
        assignedTo: 'agent_123',
        status: 'open',
        contact: {
          name: 'Cliente Test',
          phone: '+1234567890'
        }
      };

      const conversation = new Conversation(testData);
      const serialized = conversation.toJSON();

      // ✅ Verificar campo assignedTo es principal
      if (serialized.assignedTo && serialized.assignedTo.id === 'agent_123') {
        this.exitos.push('✅ assignedTo es el campo principal en Conversation.toJSON()');
      } else {
        this.errores.push('❌ assignedTo NO es el campo principal en Conversation.toJSON()');
      }

      // ✅ Verificar assignedAgent existe para compatibilidad
      if (serialized.assignedAgent === 'agent_123') {
        this.exitos.push('✅ assignedAgent existe para compatibilidad');
      } else {
        this.advertencias.push('⚠️ assignedAgent podría faltar para compatibilidad');
      }

      // ✅ Verificar customerPhone y agentPhone normalizados
      if (serialized.customerPhone === '+1234567890' && serialized.agentPhone === '+1987654321') {
        this.exitos.push('✅ customerPhone y agentPhone están presentes y normalizados');
      } else {
        this.errores.push('❌ customerPhone o agentPhone faltantes o mal normalizados');
      }

      // ✅ Verificar participants array de 2 únicos
      if (Array.isArray(serialized.participants) && serialized.participants.length === 2) {
        this.exitos.push('✅ participants es array de exactamente 2 elementos');
      } else {
        this.errores.push('❌ participants NO es array de 2 elementos únicos');
      }

      // ✅ Verificar que NO devuelve from/to
      if (!serialized.hasOwnProperty('from') && !serialized.hasOwnProperty('to')) {
        this.exitos.push('✅ Conversation.toJSON() NO incluye campos from/to obsoletos');
      } else {
        this.advertencias.push('⚠️ Conversation.toJSON() incluye campos from/to (deberían eliminarse)');
      }

      // ✅ NUEVO: Verificar fechas seguras
      if (typeof serialized.createdAt === 'string' || serialized.createdAt === null) {
        this.exitos.push('✅ Conversation.createdAt se serializa como string ISO o null');
      } else {
        this.errores.push('❌ Conversation.createdAt NO es string ISO ni null');
      }

      if (typeof serialized.updatedAt === 'string' || serialized.updatedAt === null) {
        this.exitos.push('✅ Conversation.updatedAt se serializa como string ISO o null');
      } else {
        this.errores.push('❌ Conversation.updatedAt NO es string ISO ni null');
      }

    } catch (error) {
      this.errores.push(`❌ Error verificando Conversation: ${error.message}`);
    }
  }

  async verificarMessageModel() {
    console.log('📨 Verificando modelo Message...');
    
    try {
      // ✅ Crear mensaje de prueba con conversationId válido (formato: conv_phone1_phone2)
      const testData = {
        id: 'test_msg_123',
        conversationId: 'conv_1234567890_1987654321', // ✅ Formato válido para isValidConversationId
        senderPhone: '+1234567890',
        recipientPhone: '+1987654321',
        content: 'Mensaje de prueba',
        type: 'text',
        direction: 'inbound',
        status: 'received'
      };

      const message = new Message(testData);
      const serialized = message.toJSON();

      // ✅ Verificar que usa senderPhone/recipientPhone
      if (serialized.senderPhone === '+1234567890' && serialized.recipientPhone === '+1987654321') {
        this.exitos.push('✅ Message.toJSON() usa senderPhone/recipientPhone correctamente');
      } else {
        this.errores.push('❌ Message.toJSON() NO usa senderPhone/recipientPhone correctamente');
      }

      // ✅ Verificar que NO devuelve from/to
      if (!serialized.hasOwnProperty('from') && !serialized.hasOwnProperty('to')) {
        this.exitos.push('✅ Message.toJSON() NO incluye campos from/to obsoletos');
      } else {
        this.errores.push('❌ Message.toJSON() incluye campos from/to (DEBEN eliminarse para frontend)');
      }

      // ✅ Verificar campos obligatorios
      const camposObligatorios = ['id', 'conversationId', 'senderPhone', 'recipientPhone', 'direction', 'type', 'status'];
      const camposFaltantes = camposObligatorios.filter(campo => !serialized.hasOwnProperty(campo));
      
      if (camposFaltantes.length === 0) {
        this.exitos.push('✅ Message.toJSON() incluye todos los campos obligatorios');
      } else {
        this.errores.push(`❌ Message.toJSON() faltan campos: ${camposFaltantes.join(', ')}`);
      }

      // ✅ NUEVO: Verificar fechas seguras en mensajes
      if (typeof serialized.timestamp === 'string' || serialized.timestamp === null) {
        this.exitos.push('✅ Message.timestamp se serializa como string ISO o null');
      } else {
        this.errores.push('❌ Message.timestamp NO es string ISO ni null');
      }

      if (typeof serialized.createdAt === 'string' || serialized.createdAt === null) {
        this.exitos.push('✅ Message.createdAt se serializa como string ISO o null');
      } else {
        this.errores.push('❌ Message.createdAt NO es string ISO ni null');
      }

    } catch (error) {
      this.errores.push(`❌ Error verificando Message: ${error.message}`);
    }
  }

  async verificarValidacionesTelefonos() {
    console.log('📞 Verificando validaciones de teléfonos...');
    
    try {
      // ✅ Teléfonos válidos
      const telefonosValidos = ['+1234567890', '+34123456789', '+521234567890'];
      
      for (const telefono of telefonosValidos) {
        const validation = validateAndNormalizePhone(telefono);
        if (validation.isValid && validation.normalized === telefono) {
          this.exitos.push(`✅ Teléfono ${telefono} validado correctamente`);
        } else {
          this.errores.push(`❌ Teléfono ${telefono} falló validación`);
        }
      }

      // ✅ Teléfonos inválidos (mejorar validación)
      const telefonosInvalidos = [
        { telefono: '123', razon: 'muy corto' },
        { telefono: 'invalid', razon: 'no numérico' },
        { telefono: '', razon: 'vacío' },
        { telefono: null, razon: 'null' },
        { telefono: undefined, razon: 'undefined' },
        { telefono: '+123', razon: 'muy corto con +' },
        { telefono: 'abc123def', razon: 'contiene letras' }
      ];
      
      for (const { telefono, razon } of telefonosInvalidos) {
        const validation = validateAndNormalizePhone(telefono);
        if (!validation.isValid) {
          this.exitos.push(`✅ Teléfono inválido '${telefono}' (${razon}) rechazado correctamente`);
        } else {
          this.errores.push(`❌ Teléfono inválido '${telefono}' (${razon}) NO fue rechazado - se normalizó a: ${validation.normalized}`);
        }
      }

    } catch (error) {
      this.errores.push(`❌ Error verificando validaciones: ${error.message}`);
    }
  }

  async verificarManejoDeFechas() {
    console.log('📅 Verificando manejo seguro de fechas...');
    
    try {
      // ✅ Casos de fechas que pueden causar "toISOString is not a function"
      const casosDeFecha = [
        { valor: new Date(), descripcion: 'Date válido' },
        { valor: new Date('2024-01-01'), descripcion: 'Date con string válido' },
        { valor: new Date('invalid'), descripcion: 'Date inválido' },
        { valor: '2024-01-01T10:00:00.000Z', descripcion: 'String ISO válido' },
        { valor: 'invalid-date', descripcion: 'String inválido' },
        { valor: '', descripcion: 'String vacío' },
        { valor: null, descripcion: 'null' },
        { valor: undefined, descripcion: 'undefined' },
        { valor: 1704067200000, descripcion: 'Timestamp en milisegundos' },
        { valor: 1704067200, descripcion: 'Timestamp en segundos' },
        { valor: 0, descripcion: 'Timestamp cero' },
        { valor: -1, descripcion: 'Timestamp negativo' },
        { valor: 'not-a-date', descripcion: 'String no-fecha' },
        { valor: {}, descripcion: 'Objeto vacío' },
        { valor: { seconds: 1704067200, nanoseconds: 0 }, descripcion: 'Formato Firebase serializado' },
      ];

      for (const { valor, descripcion } of casosDeFecha) {
        try {
          const resultado = safeISOString(valor, 'test_field');
          if (typeof resultado === 'string' || resultado === null) {
            this.exitos.push(`✅ safeISOString maneja correctamente: ${descripcion}`);
          } else {
            this.errores.push(`❌ safeISOString devuelve tipo incorrecto para: ${descripcion} (tipo: ${typeof resultado})`);
          }
        } catch (error) {
          this.errores.push(`❌ safeISOString lanza error para: ${descripcion} - ${error.message}`);
        }
      }

      // ✅ Verificar que isValidDate funciona correctamente
      const fechasValidas = [
        new Date(),
        '2024-01-01T10:00:00.000Z',
        1704067200000,
      ];

      for (const fecha of fechasValidas) {
        if (isValidDate(fecha)) {
          this.exitos.push(`✅ isValidDate reconoce fecha válida correctamente`);
        } else {
          this.errores.push(`❌ isValidDate NO reconoce fecha válida: ${fecha}`);
        }
      }

      const fechasInvalidas = [
        null,
        undefined,
        'invalid-date',
        {},
        'not-a-date',
      ];

      for (const fecha of fechasInvalidas) {
        if (!isValidDate(fecha)) {
          this.exitos.push(`✅ isValidDate rechaza fecha inválida correctamente`);
        } else {
          this.errores.push(`❌ isValidDate NO rechaza fecha inválida: ${fecha}`);
        }
      }

    } catch (error) {
      this.errores.push(`❌ Error verificando manejo de fechas: ${error.message}`);
    }
  }

  async verificarCasosExtremos() {
    console.log('🧪 Verificando casos extremos y edge cases...');
    
    try {
      // ✅ CASO EXTREMO 1: Conversación con fechas problemáticas
      try {
        const conversationDataWithBadDates = {
          id: 'conv_test_extreme_1',
          participants: ['+1234567890', '+1987654321'],
          customerPhone: '+1234567890',
          agentPhone: '+1987654321',
          assignedTo: 'agent_test',
          lastMessageAt: 'invalid-date-string', // ✅ Fecha inválida a propósito
          createdAt: {}, // ✅ Objeto vacío a propósito
          updatedAt: null, // ✅ null a propósito
        };

        const conversation = new Conversation(conversationDataWithBadDates);
        const serialized = conversation.toJSON();

        // Debería manejar las fechas inválidas sin lanzar error
        if (typeof serialized === 'object' && serialized.id) {
          this.exitos.push('✅ Conversation.toJSON() maneja fechas inválidas sin fallar');
        } else {
          this.errores.push('❌ Conversation.toJSON() falla con fechas inválidas');
        }
      } catch (error) {
        this.errores.push(`❌ Conversation falla con fechas extremas: ${error.message}`);
      }

      // ✅ CASO EXTREMO 2: Mensaje con fechas problemáticas
      try {
        const messageDataWithBadDates = {
          id: 'test_msg_extreme',
          conversationId: 'conv_1234567890_1987654321',
          senderPhone: '+1234567890',
          recipientPhone: '+1987654321',
          content: 'Test extremo',
          timestamp: 'not-a-timestamp', // ✅ Timestamp inválido a propósito
          createdAt: undefined, // ✅ undefined a propósito
          updatedAt: -1, // ✅ Número negativo a propósito
        };

        const message = new Message(messageDataWithBadDates);
        const serialized = message.toJSON();

        // Debería manejar las fechas inválidas sin lanzar error
        if (typeof serialized === 'object' && serialized.id) {
          this.exitos.push('✅ Message.toJSON() maneja fechas inválidas sin fallar');
        } else {
          this.errores.push('❌ Message.toJSON() falla con fechas inválidas');
        }
      } catch (error) {
        this.errores.push(`❌ Message falla con fechas extremas: ${error.message}`);
      }

      // ✅ CASO EXTREMO 3: Participants duplicados
      try {
        const conversationWithDuplicates = {
          id: 'conv_test_dups',
          participants: ['+1234567890', '+1234567890', '+1987654321'], // ✅ Duplicados a propósito
          customerPhone: '+1234567890',
          agentPhone: '+1987654321',
          assignedTo: 'agent_test',
        };

        const conversation = new Conversation(conversationWithDuplicates);
        const serialized = conversation.toJSON();

        if (serialized.participants.length === 2) {
          this.exitos.push('✅ Conversation elimina participantes duplicados correctamente');
        } else {
          this.errores.push(`❌ Conversation NO elimina duplicados: ${serialized.participants.length} participantes`);
        }
      } catch (error) {
        this.errores.push(`❌ Error manejando participantes duplicados: ${error.message}`);
      }

      // ✅ CASO EXTREMO 4: Teléfonos con prefijos de WhatsApp
      try {
        const messageWithWhatsappPrefix = {
          id: 'test_msg_whatsapp',
          conversationId: 'conv_1234567890_1987654321',
          senderPhone: 'whatsapp:+1234567890', // ✅ Prefijo WhatsApp a propósito
          recipientPhone: '+1987654321',
          content: 'Test whatsapp prefix',
        };

        const message = new Message(messageWithWhatsappPrefix);
        const serialized = message.toJSON();

        if (serialized.senderPhone === '+1234567890') {
          this.exitos.push('✅ Message normaliza prefijos WhatsApp correctamente');
        } else {
          this.errores.push(`❌ Message NO normaliza prefijos WhatsApp: ${serialized.senderPhone}`);
        }
      } catch (error) {
        this.errores.push(`❌ Error manejando prefijos WhatsApp: ${error.message}`);
      }

    } catch (error) {
      this.errores.push(`❌ Error verificando casos extremos: ${error.message}`);
    }
  }

  async generarReporte() {
    console.log('\n📊 REPORTE FINAL DE VERIFICACIÓN COMPLETA\n');
    
    // ✅ Mostrar éxitos
    if (this.exitos.length > 0) {
      console.log('🎉 ÉXITOS:');
      this.exitos.forEach(exito => console.log(`  ${exito}`));
      console.log('');
    }

    // ⚠️ Mostrar advertencias
    if (this.advertencias.length > 0) {
      console.log('⚠️ ADVERTENCIAS:');
      this.advertencias.forEach(advertencia => console.log(`  ${advertencia}`));
      console.log('');
    }

    // ❌ Mostrar errores
    if (this.errores.length > 0) {
      console.log('❌ ERRORES CRÍTICOS:');
      this.errores.forEach(error => console.log(`  ${error}`));
      console.log('');
    }

    // 📈 Resumen
    const total = this.exitos.length + this.advertencias.length + this.errores.length;
    const porcentajeExito = total > 0 ? Math.round((this.exitos.length / total) * 100) : 0;
    
    console.log('📈 RESUMEN DETALLADO:');
    console.log(`  ✅ Éxitos: ${this.exitos.length}`);
    console.log(`  ⚠️ Advertencias: ${this.advertencias.length}`);
    console.log(`  ❌ Errores: ${this.errores.length}`);
    console.log(`  📊 Porcentaje de éxito: ${porcentajeExito}%`);
    console.log(`  🧪 Casos de prueba ejecutados: ${total}\n`);

    // 🔍 Categorización de éxitos
    const exitosPorCategoria = {
      estructura: this.exitos.filter(e => e.includes('assignedTo') || e.includes('participants') || e.includes('customerPhone')).length,
      telefono: this.exitos.filter(e => e.includes('Teléfono') || e.includes('WhatsApp')).length,
      fechas: this.exitos.filter(e => e.includes('fecha') || e.includes('timestamp') || e.includes('Date') || e.includes('ISO')).length,
      serialización: this.exitos.filter(e => e.includes('toJSON') || e.includes('serializa')).length,
      extremos: this.exitos.filter(e => e.includes('extremo') || e.includes('inválid') || e.includes('duplicado')).length,
    };

    console.log('📊 ÉXITOS POR CATEGORÍA:');
    console.log(`  📋 Estructura de datos: ${exitosPorCategoria.estructura}`);
    console.log(`  📞 Validación de teléfonos: ${exitosPorCategoria.telefono}`);
    console.log(`  📅 Manejo de fechas: ${exitosPorCategoria.fechas}`);
    console.log(`  🔧 Serialización: ${exitosPorCategoria.serialización}`);
    console.log(`  🧪 Casos extremos: ${exitosPorCategoria.extremos}\n`);

    // 🎯 Veredicto final
    if (this.errores.length === 0) {
      console.log('🎯 VEREDICTO: ✅ ALINEAMIENTO COMPLETADO EXITOSAMENTE');
      console.log('   El backend UTalk está completamente alineado con el frontend.');
      console.log('   ✅ El error "toISOString is not a function" ha sido RESUELTO');
      console.log('   ✅ Todas las validaciones de estructura están IMPLEMENTADAS');
      console.log('   ✅ El manejo de fechas es ROBUSTO y seguro');
      if (this.advertencias.length > 0) {
        console.log('   ⚠️ Revisa las advertencias para optimizaciones adicionales.');
      }
    } else if (this.errores.length <= 3) {
      console.log('🎯 VEREDICTO: ⚠️ ALINEAMIENTO CASI COMPLETO');
      console.log('   Hay errores menores que deben corregirse.');
      console.log('   La mayoría de funcionalidades están correctas.');
    } else {
      console.log('🎯 VEREDICTO: ❌ ALINEAMIENTO INCOMPLETO');
      console.log('   Hay errores críticos que deben corregirse antes del deploy.');
      console.log('   Revisa los errores listados arriba y corrige cada uno.');
    }

    console.log('\n🚀 Para ejecutar este script: node scripts/verificacion-alineamiento.js');
    console.log('📝 Para deployment: Asegúrate de que el porcentaje de éxito sea 100%\n');
  }
}

// 🚀 Ejecutar verificación si el script se ejecuta directamente
if (require.main === module) {
  const verifier = new AlineamientoVerifier();
  verifier.verificarTodo().catch(error => {
    console.error('❌ Error durante verificación:', error);
    process.exit(1);
  });
}

module.exports = AlineamientoVerifier; 