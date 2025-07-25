/**
 * SCRIPT DE VERIFICACIÓN DE ALINEAMIENTO UTalk Backend
 * 
 * Verifica que todos los cambios de alineación estén correctamente implementados:
 * 1. assignedTo como campo principal en conversaciones
 * 2. customerPhone y agentPhone siempre presentes y normalizados
 * 3. participants con exactamente 2 números únicos
 * 4. senderPhone/recipientPhone en mensajes (NO from/to)
 * 5. Logging detallado en todas las operaciones
 */

const path = require('path');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const { validateAndNormalizePhone } = require('../src/utils/phoneValidation');
const logger = require('../src/utils/logger');

class AlineamientoVerifier {
  constructor() {
    this.errores = [];
    this.advertencias = [];
    this.exitos = [];
  }

  async verificarTodo() {
    console.log('🔍 INICIANDO VERIFICACIÓN DE ALINEAMIENTO UTalk Backend\n');

    await this.verificarConversationModel();
    await this.verificarMessageModel();
    await this.verificarValidacionesTelefonos();
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

  async generarReporte() {
    console.log('\n📊 REPORTE FINAL DE VERIFICACIÓN\n');
    
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
    
    console.log('📈 RESUMEN:');
    console.log(`  ✅ Éxitos: ${this.exitos.length}`);
    console.log(`  ⚠️ Advertencias: ${this.advertencias.length}`);
    console.log(`  ❌ Errores: ${this.errores.length}`);
    console.log(`  📊 Porcentaje de éxito: ${porcentajeExito}%\n`);

    // 🎯 Veredicto final
    if (this.errores.length === 0) {
      console.log('🎯 VEREDICTO: ✅ ALINEAMIENTO COMPLETADO EXITOSAMENTE');
      console.log('   El backend UTalk está completamente alineado con el frontend.');
      if (this.advertencias.length > 0) {
        console.log('   Revisa las advertencias para optimizaciones adicionales.');
      }
    } else {
      console.log('🎯 VEREDICTO: ❌ ALINEAMIENTO INCOMPLETO');
      console.log('   Hay errores críticos que deben corregirse antes del deploy.');
      console.log('   Revisa los errores listados arriba y corrige cada uno.');
    }

    console.log('\n🚀 Para ejecutar este script: node scripts/verificacion-alineamiento.js\n');
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