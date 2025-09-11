const { db } = require('../src/config/firebase');
const { FirestoreHRUtils, HR_COLLECTIONS } = require('../src/config/hrFirebaseStructure');
const Employee = require('../src/models/Employee');
const VacationBalance = require('../src/models/VacationBalance');

/**
 * Script de Inicialización del Módulo de Recursos Humanos
 * Configura la estructura inicial de Firebase para el módulo HR
 */

async function initializeHRModule() {
  console.log('🚀 Iniciando configuración del módulo de Recursos Humanos...');
  
  try {
    // 1. Crear configuraciones básicas de HR
    await createHRSettings();
    
    // 2. Crear departamentos predeterminados
    await createDefaultDepartments();
    
    // 3. Crear posiciones predeterminadas
    await createDefaultPositions();
    
    // 4. Crear políticas predeterminadas
    await createDefaultPolicies();
    
    // 5. Crear empleados de ejemplo (opcional)
    if (process.argv.includes('--with-examples')) {
      await createSampleEmployees();
    }
    
    console.log('✅ Módulo de Recursos Humanos inicializado exitosamente');
    console.log('📋 Estructura de colecciones creada');
    console.log('⚙️  Configuraciones predeterminadas aplicadas');
    
    if (process.argv.includes('--with-examples')) {
      console.log('👥 Empleados de ejemplo creados');
    }
    
  } catch (error) {
    console.error('💥 Error inicializando módulo HR:', error);
    process.exit(1);
  }
}

/**
 * Crea configuraciones básicas de HR
 */
async function createHRSettings() {
  console.log('📝 Creando configuraciones básicas...');
  
  // Si no hay Firebase, solo mostrar la estructura
  if (!db) {
    console.log('📋 Estructura de configuraciones (modo simulación):');
    console.log('- Configuración general de empresa');
    console.log('- Políticas de vacaciones');
    console.log('- Configuración de nómina');
    console.log('- Políticas de asistencia');
    return;
  }
  
  const settings = {
    general: {
      companyName: 'UTalk',
      country: 'México',
      currency: 'MXN',
      workingDays: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      standardWorkHours: 8,
      timezone: 'America/Mexico_City',
      createdAt: new Date().toISOString()
    },
    
    vacation: {
      minimumDaysPerYear: 6,
      maxConsecutiveDays: 30,
      advanceNoticeDays: 7,
      carryOverLimit: 6,
      createdAt: new Date().toISOString()
    },
    
    payroll: {
      paymentFrequency: 'weekly', // weekly, biweekly, monthly
      standardDeductions: {
        ISR: 0.16,
        IMSS: 0.0725,
        INFONAVIT: 0.05,
        AFORE: 0.0625
      },
      overtimeMultiplier: 1.5,
      createdAt: new Date().toISOString()
    },
    
    attendance: {
      graceMinutes: 15,
      maxWorkHours: 12,
      breakMinutes: 60,
      clockInWindow: '06:00-10:00',
      clockOutWindow: '16:00-22:00',
      createdAt: new Date().toISOString()
    }
  };
  
  for (const [key, value] of Object.entries(settings)) {
    await db.collection('hr_settings').doc(key).set(value);
  }
  
  console.log('✅ Configuraciones básicas creadas');
}

/**
 * Crea departamentos predeterminados
 */
async function createDefaultDepartments() {
  console.log('🏢 Creando departamentos predeterminados...');
  
  // Si no hay Firebase, solo mostrar la estructura
  if (!db) {
    console.log('📋 Departamentos predeterminados (modo simulación):');
    console.log('- Marketing, Ventas, Recursos Humanos');
    console.log('- Tecnología, Finanzas, Operaciones');
    return;
  }
  
  const departments = [
    {
      id: 'marketing',
      name: 'Marketing',
      description: 'Departamento de Marketing y Comunicaciones',
      budget: 500000,
      headCount: 10,
      manager: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'ventas',
      name: 'Ventas',
      description: 'Departamento de Ventas y Desarrollo de Negocios',
      budget: 800000,
      headCount: 15,
      manager: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'recursos-humanos',
      name: 'Recursos Humanos',
      description: 'Departamento de Recursos Humanos',
      budget: 300000,
      headCount: 5,
      manager: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'tecnologia',
      name: 'Tecnología',
      description: 'Departamento de Tecnología e Innovación',
      budget: 1200000,
      headCount: 20,
      manager: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'finanzas',
      name: 'Finanzas',
      description: 'Departamento de Finanzas y Contabilidad',
      budget: 400000,
      headCount: 8,
      manager: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'operaciones',
      name: 'Operaciones',
      description: 'Departamento de Operaciones y Logística',
      budget: 600000,
      headCount: 12,
      manager: null,
      createdAt: new Date().toISOString()
    }
  ];
  
  for (const department of departments) {
    await db.collection('hr_settings').doc('departments')
      .collection('items').doc(department.id).set(department);
  }
  
  console.log('✅ Departamentos predeterminados creados');
}

/**
 * Crea posiciones predeterminadas
 */
async function createDefaultPositions() {
  console.log('💼 Creando posiciones predeterminadas...');
  
  // Si no hay Firebase, solo mostrar la estructura
  if (!db) {
    console.log('📋 Posiciones predeterminadas (modo simulación):');
    console.log('- Gerentes, Desarrolladores, Analistas, etc.');
    return;
  }
  
  const positions = [
    // Marketing
    { id: 'marketing-manager', title: 'Gerente de Marketing', department: 'Marketing', level: 'Manager', salaryRange: { min: 60000, max: 80000 } },
    { id: 'marketing-specialist', title: 'Especialista en Marketing', department: 'Marketing', level: 'Senior', salaryRange: { min: 25000, max: 40000 } },
    { id: 'content-creator', title: 'Creador de Contenido', department: 'Marketing', level: 'Mid', salaryRange: { min: 15000, max: 25000 } },
    
    // Tecnología
    { id: 'tech-director', title: 'Director de Tecnología', department: 'Tecnología', level: 'Director', salaryRange: { min: 100000, max: 150000 } },
    { id: 'senior-developer', title: 'Desarrollador Senior', department: 'Tecnología', level: 'Senior', salaryRange: { min: 35000, max: 50000 } },
    { id: 'junior-developer', title: 'Desarrollador Junior', department: 'Tecnología', level: 'Junior', salaryRange: { min: 12000, max: 18000 } },
    { id: 'devops-engineer', title: 'Ingeniero DevOps', department: 'Tecnología', level: 'Senior', salaryRange: { min: 40000, max: 60000 } },
    
    // Recursos Humanos
    { id: 'hr-director', title: 'Director de Recursos Humanos', department: 'Recursos Humanos', level: 'Director', salaryRange: { min: 80000, max: 120000 } },
    { id: 'hr-manager', title: 'Gerente de Recursos Humanos', department: 'Recursos Humanos', level: 'Manager', salaryRange: { min: 50000, max: 70000 } },
    { id: 'hr-analyst', title: 'Analista de Recursos Humanos', department: 'Recursos Humanos', level: 'Mid', salaryRange: { min: 20000, max: 30000 } },
    
    // Ventas
    { id: 'sales-director', title: 'Director de Ventas', department: 'Ventas', level: 'Director', salaryRange: { min: 80000, max: 120000 } },
    { id: 'sales-manager', title: 'Gerente de Ventas', department: 'Ventas', level: 'Manager', salaryRange: { min: 45000, max: 65000 } },
    { id: 'sales-representative', title: 'Representante de Ventas', department: 'Ventas', level: 'Mid', salaryRange: { min: 18000, max: 28000 } },
    
    // Finanzas
    { id: 'finance-director', title: 'Director de Finanzas', department: 'Finanzas', level: 'Director', salaryRange: { min: 90000, max: 130000 } },
    { id: 'accountant', title: 'Contador', department: 'Finanzas', level: 'Senior', salaryRange: { min: 30000, max: 45000 } },
    { id: 'financial-analyst', title: 'Analista Financiero', department: 'Finanzas', level: 'Mid', salaryRange: { min: 22000, max: 32000 } },
    
    // Operaciones
    { id: 'operations-manager', title: 'Gerente de Operaciones', department: 'Operaciones', level: 'Manager', salaryRange: { min: 55000, max: 75000 } },
    { id: 'operations-coordinator', title: 'Coordinador de Operaciones', department: 'Operaciones', level: 'Mid', salaryRange: { min: 20000, max: 30000 } }
  ];
  
  for (const position of positions) {
    await db.collection('hr_settings').doc('positions')
      .collection('items').doc(position.id).set({
        ...position,
        createdAt: new Date().toISOString()
      });
  }
  
  console.log('✅ Posiciones predeterminadas creadas');
}

/**
 * Crea políticas predeterminadas
 */
async function createDefaultPolicies() {
  console.log('📋 Creando políticas predeterminadas...');
  
  // Si no hay Firebase, solo mostrar la estructura
  if (!db) {
    console.log('📋 Políticas predeterminadas (modo simulación):');
    console.log('- Política de vacaciones');
    console.log('- Política de asistencia');
    console.log('- Política de documentos');
    console.log('- Política de evaluaciones');
    return;
  }
  
  const policies = {
    vacation_policy: {
      name: 'Política de Vacaciones',
      description: 'Reglas y procedimientos para solicitudes de vacaciones',
      rules: {
        minimumAdvanceNotice: 7,
        maxConsecutiveDays: 30,
        carryOverLimit: 6,
        blackoutPeriods: ['2024-12-15:2024-12-31'], // Ejemplo: periodo navideño
        approvalLevels: {
          'up_to_5_days': ['supervisor'],
          'up_to_15_days': ['supervisor', 'hr_manager'],
          'more_than_15_days': ['supervisor', 'hr_manager', 'hr_director']
        }
      },
      createdAt: new Date().toISOString()
    },
    
    attendance_policy: {
      name: 'Política de Asistencia',
      description: 'Reglas de horarios y asistencia',
      rules: {
        standardHours: '09:00-18:00',
        graceMinutes: 15,
        maxAbsences: 5,
        overtimeApproval: true,
        flexTimeEnabled: false,
        remoteWorkEnabled: true
      },
      createdAt: new Date().toISOString()
    },
    
    document_policy: {
      name: 'Política de Documentos',
      description: 'Gestión y retención de documentos de empleados',
      rules: {
        requiredDocuments: ['contract', 'identification'],
        retentionPeriods: {
          contract: '7_years',
          identification: '3_years',
          medical: '5_years',
          performance: '3_years'
        },
        confidentialityLevels: ['public', 'internal', 'confidential', 'restricted']
      },
      createdAt: new Date().toISOString()
    },
    
    evaluation_policy: {
      name: 'Política de Evaluaciones',
      description: 'Proceso de evaluación de desempeño',
      rules: {
        frequency: 'annual',
        evaluators: ['direct_supervisor', 'hr_manager'],
        scale: '1_to_5',
        objectives: {
          minimum: 3,
          maximum: 8,
          weightTotal: 100
        },
        competencies: {
          coreCompetencies: ['comunicacion', 'trabajo_equipo', 'orientacion_resultados'],
          technicalCompetencies: 'position_specific'
        }
      },
      createdAt: new Date().toISOString()
    }
  };
  
  for (const [key, policy] of Object.entries(policies)) {
    await db.collection('hr_settings').doc('policies')
      .collection('items').doc(key).set(policy);
  }
  
  console.log('✅ Políticas predeterminadas creadas');
}

/**
 * Crea empleados de ejemplo para testing
 */
async function createSampleEmployees() {
  console.log('👥 Creando empleados de ejemplo...');
  
  // Si no hay Firebase, solo mostrar la estructura
  if (!db) {
    console.log('📋 Empleados de ejemplo (modo simulación):');
    console.log('- Ana García (EMP001) - Gerente de Marketing');
    console.log('- Carlos López (EMP002) - Desarrollador Senior');
    console.log('- María Rodríguez (EMP003) - Analista de RH');
    return;
  }
  
  const sampleEmployees = [
    {
      personalInfo: {
        firstName: 'Ana',
        lastName: 'García',
        email: 'ana.garcia@empresa.com',
        phone: '+52 55 1234 5678',
        dateOfBirth: '1985-03-15',
        gender: 'F'
      },
      position: {
        title: 'Gerente de Marketing',
        department: 'Marketing',
        level: 'Senior',
        startDate: '2022-03-14'
      },
      location: {
        office: 'Oficina Principal',
        address: 'Av. Insurgentes 456, Roma Norte, Ciudad de México',
        city: 'Ciudad de México',
        state: 'CDMX',
        country: 'México',
        postalCode: '06700'
      },
      contract: {
        type: 'permanent',
        startDate: '2022-03-14',
        salary: 30000,
        currency: 'MXN'
      }
    },
    {
      personalInfo: {
        firstName: 'Carlos',
        lastName: 'López',
        email: 'carlos.lopez@empresa.com',
        phone: '+52 55 9876 5432',
        dateOfBirth: '1990-08-22',
        gender: 'M'
      },
      position: {
        title: 'Desarrollador Senior',
        department: 'Tecnología',
        level: 'Senior',
        startDate: '2021-08-19'
      },
      location: {
        office: 'Oficina Principal',
        address: 'Av. Insurgentes 456, Roma Norte, Ciudad de México',
        city: 'Ciudad de México',
        state: 'CDMX',
        country: 'México',
        postalCode: '06700'
      },
      contract: {
        type: 'permanent',
        startDate: '2021-08-19',
        salary: 40000,
        currency: 'MXN'
      }
    },
    {
      personalInfo: {
        firstName: 'María',
        lastName: 'Rodríguez',
        email: 'maria.rodriguez@empresa.com',
        phone: '+52 55 5555 1234',
        dateOfBirth: '1988-01-10',
        gender: 'F'
      },
      position: {
        title: 'Analista de Recursos Humanos',
        department: 'Recursos Humanos',
        level: 'Mid',
        startDate: '2023-01-09'
      },
      location: {
        office: 'Oficina Principal',
        address: 'Av. Insurgentes 456, Roma Norte, Ciudad de México',
        city: 'Ciudad de México',
        state: 'CDMX',
        country: 'México',
        postalCode: '06700'
      },
      contract: {
        type: 'permanent',
        startDate: '2023-01-09',
        salary: 24000,
        currency: 'MXN'
      }
    }
  ];
  
  for (const employeeData of sampleEmployees) {
    try {
      const employee = new Employee(employeeData);
      await employee.save();
      
      // Crear balance inicial de vacaciones
      await VacationBalance.getOrCreateCurrent(employee.id, employee.position.startDate);
      
      console.log(`✅ Empleado creado: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} (${employee.employeeNumber})`);
    } catch (error) {
      console.error(`Error creando empleado ${employeeData.personalInfo.firstName}:`, error.message);
    }
  }
  
  console.log('✅ Empleados de ejemplo creados');
}

/**
 * Verifica la configuración de Firebase
 */
async function verifyFirebaseConfig() {
  console.log('🔍 Verificando configuración de Firebase...');
  
  try {
    // En desarrollo, Firebase puede no estar configurado
    if (!db) {
      console.log('⚠️  Firebase no configurado - usando modo simulación');
      return true; // Permitir continuar en modo desarrollo
    }
    
    // Verificar conexión a Firestore
    await db.collection('test').add({ test: true });
    console.log('✅ Conexión a Firestore verificada');
    
    // Limpiar documento de prueba
    const testSnapshot = await db.collection('test').where('test', '==', true).get();
    testSnapshot.forEach(doc => doc.ref.delete());
    
    return true;
  } catch (error) {
    console.error('❌ Error de configuración de Firebase:', error);
    
    // En desarrollo, permitir continuar sin Firebase
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️  Continuando en modo desarrollo sin Firebase');
      return true;
    }
    
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🎯 Inicializando Módulo de Recursos Humanos para UTalk');
  console.log('================================================');
  
  // Verificar Firebase
  const firebaseOk = await verifyFirebaseConfig();
  if (!firebaseOk) {
    console.error('❌ Error: Configuración de Firebase inválida');
    process.exit(1);
  }
  
  // Inicializar módulo
  await initializeHRModule();
  
  console.log('================================================');
  console.log('🎉 ¡Módulo de Recursos Humanos listo para usar!');
  console.log('');
  console.log('📚 Próximos pasos:');
  console.log('1. Configurar roles de usuarios en el sistema');
  console.log('2. Personalizar políticas según necesidades de la empresa');
  console.log('3. Importar empleados existentes (si aplica)');
  console.log('4. Configurar integraciones con sistemas externos');
  console.log('');
  console.log('🔗 Endpoints disponibles:');
  console.log('- GET /api/employees - Lista de empleados');
  console.log('- POST /api/employees - Crear empleado');
  console.log('- GET /api/employees/:id - Perfil de empleado');
  console.log('- GET /api/employees/:id/payroll - Nómina');
  console.log('- GET /api/employees/:id/attendance - Asistencia');
  console.log('- GET /api/employees/:id/vacations - Vacaciones');
  console.log('');
  
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  initializeHRModule,
  createHRSettings,
  createDefaultDepartments,
  createDefaultPositions,
  createDefaultPolicies,
  createSampleEmployees,
  verifyFirebaseConfig
};
