#!/usr/bin/env node

/**
 * Script para poblar la base de datos con datos de prueba
 * Uso: node scripts/seed-database.js
 */

require('dotenv').config();
const { firestore, auth, FieldValue } = require('../src/config/firebase');
const { prepareForFirestore } = require('../src/utils/firestore');

const seedData = {
  users: [
    {
      uid: 'admin-user-1',
      email: 'admin@funday.com',
      displayName: 'Administrador Principal',
      role: 'admin',
      isActive: true,
    },
    {
      uid: 'agent-user-1',
      email: 'agente1@funday.com',
      displayName: 'María García',
      role: 'agent',
      isActive: true,
    },
    {
      uid: 'agent-user-2',
      email: 'agente2@funday.com',
      displayName: 'Juan Pérez',
      role: 'agent',
      isActive: true,
    },
  ],
  contacts: [
    {
      name: 'Cliente VIP 1',
      phone: '+525512345678',
      email: 'cliente1@example.com',
      tags: ['vip', 'cliente'],
      customFields: {
        empresa: 'Tech Corp',
        cargo: 'CEO',
      },
      userId: 'agent-user-1',
      totalMessages: 15,
    },
    {
      name: 'Prospecto Interesado',
      phone: '+525587654321',
      email: 'prospecto@example.com',
      tags: ['prospecto', 'interesado'],
      customFields: {
        fuente: 'website',
        interes: 'producto-premium',
      },
      userId: 'agent-user-1',
      totalMessages: 8,
    },
    {
      name: 'Cliente Frecuente',
      phone: '+525511111111',
      email: 'frecuente@example.com',
      tags: ['cliente', 'frecuente'],
      customFields: {
        ultimaCompra: '2024-01-15',
        montoTotal: 15000,
      },
      userId: 'agent-user-2',
      totalMessages: 32,
    },
  ],
  knowledge: [
    {
      title: 'Cómo configurar WhatsApp Business',
      content: `# Configuración de WhatsApp Business

## Pasos principales:
1. Crear cuenta en Twilio
2. Configurar número de WhatsApp
3. Configurar webhook en la aplicación
4. Probar envío de mensajes

## Información importante:
- El número debe estar verificado
- Los mensajes template deben estar aprobados
- Configurar horarios de atención`,
      category: 'configuracion',
      tags: ['whatsapp', 'twilio', 'configuracion'],
      isPublic: true,
      createdBy: 'admin-user-1',
    },
    {
      title: 'Mejores prácticas para campañas',
      content: `# Mejores Prácticas para Campañas de WhatsApp

## Recomendaciones:
1. Personalizar mensajes con el nombre del contacto
2. Respetar horarios de atención
3. No enviar más de 1 mensaje por día por contacto
4. Usar templates aprobados para mensajes promocionales
5. Segmentar audiencia correctamente

## Métricas importantes:
- Tasa de entrega
- Tasa de apertura
- Tasa de respuesta
- Tasa de conversión`,
      category: 'marketing',
      tags: ['campañas', 'whatsapp', 'marketing'],
      isPublic: true,
      createdBy: 'admin-user-1',
    },
  ],
  settings: {
    id: 'global',
    companyInfo: {
      name: 'Funday',
      phone: '+525512345678',
      email: 'contacto@funday.com',
      website: 'https://funday.com',
    },
    whatsappConfig: {
      welcomeMessage: '¡Hola! 👋 Gracias por contactar a Funday. ¿En qué podemos ayudarte?',
      autoReply: true,
      businessHours: {
        enabled: true,
        timezone: 'America/Mexico_City',
        schedule: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '10:00', end: '14:00' },
          sunday: { start: null, end: null },
        },
      },
    },
    notificationSettings: {
      emailNotifications: true,
      newMessageAlert: true,
      campaignReports: true,
    },
  },
};

async function seedDatabase () {
  try {
    console.log('🌱 Iniciando población de base de datos...');

    // Crear usuarios en Firebase Auth y Firestore
    console.log('👤 Creando usuarios...');
    for (const userData of seedData.users) {
      try {
        // Crear en Firebase Auth
        await auth.createUser({
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName,
          password: 'temporal123', // Se debe cambiar en primer login
        });

        // Establecer custom claims
        await auth.setCustomUserClaims(userData.uid, { role: userData.role });

        // Crear en Firestore
        const cleanUserData = prepareForFirestore({
          ...userData,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await firestore.collection('users').doc(userData.uid).set(cleanUserData);

        console.log(`  ✅ Usuario creado: ${userData.email}`);
      } catch (error) {
        if (error.code === 'auth/uid-already-exists') {
          console.log(`  ⚠️  Usuario ya existe: ${userData.email}`);
        } else {
          throw error;
        }
      }
    }

    // Crear contactos
    console.log('📞 Creando contactos...');
    for (const contactData of seedData.contacts) {
      const docRef = firestore.collection('contacts').doc();
      const cleanContactData = prepareForFirestore({
        id: docRef.id,
        ...contactData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await docRef.set(cleanContactData);
      console.log(`  ✅ Contacto creado: ${contactData.name}`);
    }

    // Crear documentos de conocimiento
    console.log('📚 Creando base de conocimiento...');
    for (const knowledgeData of seedData.knowledge) {
      const docRef = firestore.collection('knowledge').doc();
      const cleanKnowledgeData = prepareForFirestore({
        id: docRef.id,
        ...knowledgeData,
        views: 0,
        helpful: 0,
        notHelpful: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await docRef.set(cleanKnowledgeData);
      console.log(`  ✅ Documento creado: ${knowledgeData.title}`);
    }

    // Crear configuraciones globales
    console.log('⚙️  Creando configuraciones...');
    const cleanSettingsData = prepareForFirestore({
      ...seedData.settings,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'admin-user-1',
    });
    await firestore.collection('settings').doc('global').set(cleanSettingsData);
    console.log('  ✅ Configuraciones creadas');

    console.log('🎉 ¡Base de datos poblada exitosamente!');
    console.log('\n📋 Datos creados:');
    console.log(`  - ${seedData.users.length} usuarios`);
    console.log(`  - ${seedData.contacts.length} contactos`);
    console.log(`  - ${seedData.knowledge.length} documentos de conocimiento`);
    console.log('  - 1 configuración global');

    console.log('\n🔐 Credenciales de prueba:');
    seedData.users.forEach(user => {
      console.log(`  ${user.email} / temporal123 (${user.role})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al poblar la base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedData };
