/**
 * 🧪 PRUEBA DE SERIALIZACIÓN DE CONTACTO
 * 
 * Este script prueba que el objeto Contact se serialice correctamente
 * para Firestore sin errores de prototipos personalizados
 */

const Contact = require('../src/models/Contact');
const { prepareForFirestore } = require('../src/utils/firestore');

async function testContactSerialization() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando serialización de Contact...' });
  
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

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Datos de contacto de prueba:', contactData });

    // Crear instancia de Contact
    const contact = new Contact(contactData);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Instancia de Contact creada' });

    // Probar método toJSON()
    const contactJSON = contact.toJSON();
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Contact.toJSON() ejecutado correctamente');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Resultado:', JSON.stringify(contactJSON, null, 2));

    // Probar prepareForFirestore
    const firestoreData = prepareForFirestore(contactJSON);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ prepareForFirestore ejecutado correctamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Datos para Firestore:', JSON.stringify(firestoreData, null, 2));

    // Verificar que no hay métodos o prototipos personalizados
    const hasCustomPrototype = Object.getPrototypeOf(firestoreData) !== Object.prototype;
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 ¿Tiene prototipo personalizado?', hasCustomPrototype });

    // Verificar que todas las propiedades son serializables
    const isSerializable = (() => {
      try {
        JSON.stringify(firestoreData);
        return true;
      } catch (error) {
        logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error serializando:', error.message);
        return false;
      }
    })();

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 ¿Es serializable?', isSerializable });

    if (isSerializable && !hasCustomPrototype) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 ¡Prueba exitosa! El contacto se serializa correctamente para Firestore' });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Problema detectado en la serialización' });
    }

  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en la prueba:', error.message);
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: 'Stack:', error.stack);
  }
}

// Ejecutar la prueba
testContactSerialization(); 