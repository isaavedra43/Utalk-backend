/**
 * 🧪 PRUEBA DE SERIALIZACIÓN DE CONTACTO
 * 
 * Este script prueba que el objeto Contact se serialice correctamente
 * para Firestore sin errores de prototipos personalizados
 */

const Contact = require('../src/models/Contact');
const { prepareForFirestore } = require('../src/utils/firestore');

async function testContactSerialization() {
  console.log('🧪 Probando serialización de Contact...');
  
  try {
    // Crear un objeto Contact de prueba
    const contactData = {
      name: 'Cliente de Prueba',
      phone: '+5214775211021',
      email: 'cliente@test.com',
      tags: ['whatsapp', 'test'],
      customFields: {
        testField: 'testValue'
      },
      userId: 'admin@company.com',
      isActive: true,
      lastContactAt: new Date().toISOString(),
      totalMessages: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('📋 Datos de contacto de prueba:', contactData);

    // Crear instancia de Contact
    const contact = new Contact(contactData);
    console.log('✅ Instancia de Contact creada');

    // Probar método toJSON()
    const contactJSON = contact.toJSON();
    console.log('✅ Contact.toJSON() ejecutado correctamente');
    console.log('📋 Resultado:', JSON.stringify(contactJSON, null, 2));

    // Probar prepareForFirestore
    const firestoreData = prepareForFirestore(contactJSON);
    console.log('✅ prepareForFirestore ejecutado correctamente');
    console.log('📋 Datos para Firestore:', JSON.stringify(firestoreData, null, 2));

    // Verificar que no hay métodos o prototipos personalizados
    const hasCustomPrototype = Object.getPrototypeOf(firestoreData) !== Object.prototype;
    console.log('🔍 ¿Tiene prototipo personalizado?', hasCustomPrototype);

    // Verificar que todas las propiedades son serializables
    const isSerializable = (() => {
      try {
        JSON.stringify(firestoreData);
        return true;
      } catch (error) {
        console.error('❌ Error serializando:', error.message);
        return false;
      }
    })();

    console.log('🔍 ¿Es serializable?', isSerializable);

    if (isSerializable && !hasCustomPrototype) {
      console.log('🎉 ¡Prueba exitosa! El contacto se serializa correctamente para Firestore');
    } else {
      console.log('❌ Problema detectado en la serialización');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar la prueba
testContactSerialization(); 