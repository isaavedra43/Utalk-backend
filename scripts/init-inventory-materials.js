/**
 * 🎨 SCRIPT DE INICIALIZACIÓN DE MATERIALES
 * 
 * Crea materiales por defecto para el módulo de inventario si no existen.
 * 
 * Uso: node scripts/init-inventory-materials.js
 */

require('dotenv').config();
const { initializeFirebase } = require('../src/config/firebase');
const Material = require('../src/models/Material');

const DEFAULT_MATERIALS = [
  {
    name: 'Mármol Blanco Carrara',
    category: 'Mármol',
    description: 'Mármol blanco de alta calidad con vetas grises',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Mármol Travertino',
    category: 'Mármol',
    description: 'Mármol travertino clásico',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Granito Negro Absoluto',
    category: 'Granito',
    description: 'Granito negro intenso sin vetas',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Granito Gris',
    category: 'Granito',
    description: 'Granito gris versátil con pequeñas vetas',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Granito Rojo Imperial',
    category: 'Granito',
    description: 'Granito rojo con tonalidades imperiales',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Cuarzo Blanco',
    category: 'Cuarzo',
    description: 'Cuarzo blanco premium de alta resistencia',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Cuarzo Gris',
    category: 'Cuarzo',
    description: 'Cuarzo gris moderno',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Travertino Beige',
    category: 'Travertino',
    description: 'Travertino color beige natural',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Ónix Amarillo',
    category: 'Ónix',
    description: 'Ónix amarillo translúcido',
    unit: 'm²',
    standardWidth: 0.3
  },
  {
    name: 'Ónix Verde',
    category: 'Ónix',
    description: 'Ónix verde con vetas naturales',
    unit: 'm²',
    standardWidth: 0.3
  }
];

async function initMaterials(userEmail = 'admin@company.com') {
  try {
    console.log('🚀 Iniciando creación de materiales...');
    
    // Inicializar Firebase
    await initializeFirebase();
    console.log('✅ Firebase inicializado');
    
    // Verificar si ya existen materiales
    const existingMaterials = await Material.listByUser(userEmail, { limit: 1 });
    
    if (existingMaterials.materials.length > 0) {
      console.log(`ℹ️  Ya existen ${existingMaterials.pagination.total} materiales para ${userEmail}`);
      console.log('✅ No es necesario crear materiales por defecto');
      process.exit(0);
    }
    
    console.log(`📦 Creando ${DEFAULT_MATERIALS.length} materiales por defecto...`);
    
    let created = 0;
    for (const materialData of DEFAULT_MATERIALS) {
      const material = new Material({
        ...materialData,
        userId: userEmail,
        isActive: true,
        providerIds: []
      });
      
      await material.save();
      created++;
      console.log(`  ✅ ${created}/${DEFAULT_MATERIALS.length} - ${material.name}`);
    }
    
    console.log(`\n🎉 ${created} materiales creados exitosamente para ${userEmail}`);
    console.log('✅ Script completado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inicializando materiales:', error);
    process.exit(1);
  }
}

// Obtener email del usuario desde argumentos o usar default
const userEmail = process.argv[2] || 'admin@company.com';

console.log(`\n🎨 INICIALIZADOR DE MATERIALES - MÓDULO DE INVENTARIO`);
console.log(`👤 Usuario: ${userEmail}\n`);

initMaterials(userEmail);

