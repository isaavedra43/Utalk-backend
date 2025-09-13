const { db } = require('./src/config/firebase');
const { v4: uuidv4 } = require('uuid');

async function addAttendanceRecord() {
  try {
    console.log('🔄 Agregando registro de asistencia del 12 de septiembre...');
    
    // ID del empleado Juan Pérez (del log anterior)
    const employeeId = 'ff27d31f-2cdb-4cd1-8240-9397e160311a';
    
    // Datos del registro de asistencia
    const attendanceData = {
      id: uuidv4(),
      employeeId: employeeId,
      date: '2025-09-12', // 12 de septiembre
      clockIn: '09:00:00',
      clockOut: '17:30:00',
      breakStart: '13:00:00',
      breakEnd: '14:00:00',
      totalHours: 7.5,
      regularHours: 7.5,
      overtimeHours: 0,
      breakHours: 1,
      status: 'present',
      isHoliday: false,
      isWeekend: false,
      justification: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system'
    };
    
    // Guardar en la colección de asistencia del empleado
    const docRef = db.collection('employees').doc(employeeId)
      .collection('attendance').doc(attendanceData.id);
    
    await docRef.set(attendanceData);
    
    console.log('✅ Registro de asistencia agregado exitosamente:');
    console.log('   📅 Fecha: 12 de septiembre de 2025');
    console.log('   👤 Empleado: Juan Pérez');
    console.log('   ⏰ Entrada: 09:00');
    console.log('   ⏰ Salida: 17:30');
    console.log('   ⏱️ Horas totales: 7.5 horas');
    console.log('   📊 Estado: Presente');
    console.log('   🆔 ID del registro:', attendanceData.id);
    
  } catch (error) {
    console.error('❌ Error agregando registro de asistencia:', error);
  }
}

// Ejecutar la función
addAttendanceRecord();
