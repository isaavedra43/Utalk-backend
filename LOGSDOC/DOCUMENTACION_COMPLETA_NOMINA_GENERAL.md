# DOCUMENTACIÓN COMPLETA - MÓDULO DE NÓMINA GENERAL
## Integración con Nóminas Individuales y Lógica Completa del Sistema

---

## 📋 ÍNDICE
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Flujo de Trabajo Completo](#flujo-de-trabajo-completo)
4. [Lógica de Nómina Individual (Ya Implementada)](#lógica-de-nómina-individual)
5. [Lógica de Nómina General (A Implementar)](#lógica-de-nómina-general)
6. [Integración entre Nóminas](#integración-entre-nóminas)
7. [APIs y Endpoints Requeridos](#apis-y-endpoints-requeridos)
8. [Estructura de Datos](#estructura-de-datos)
9. [Casos de Uso Detallados](#casos-de-uso-detallados)
10. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)

---

## 🎯 RESUMEN EJECUTIVO

El sistema de nóminas está compuesto por **DOS MÓDULOS PRINCIPALES** que trabajan de forma **INTEGRADA**:

### 1. **NÓMINA INDIVIDUAL** (✅ YA IMPLEMENTADA Y FUNCIONAL)
- Permite gestionar la nómina de un empleado específico
- Incluye configuración personalizada por empleado
- Maneja extras, deducciones, horas extra, bonos, préstamos
- Genera recibos de pago individuales en PDF
- Controla el estado de pago de cada extra/movimiento

### 2. **NÓMINA GENERAL** (🔄 A IMPLEMENTAR POR EL BACKEND)
- Gestiona la nómina de TODA LA PLANTILLA en un período específico
- Proceso de 4 pasos: Selección → Simulación → Ajustes → Cierre
- **CREA AUTOMÁTICAMENTE** las nóminas individuales de todos los empleados
- Mantiene la **SINCRONIZACIÓN BIDIRECCIONAL** con nóminas individuales
- Permite aprobaciones masivas y gestión centralizada

### 🔗 **INTEGRACIÓN CLAVE**: 
Cuando se genera una nómina general, **AUTOMÁTICAMENTE** se crean/actualizan las nóminas individuales correspondientes de cada empleado incluido, manteniendo la **TRAZABILIDAD COMPLETA** entre ambos sistemas.

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Relación entre Módulos

```
NÓMINA GENERAL (Plantilla Completa)
    ↓
    ├── EMPLEADO 1 → Nómina Individual
    ├── EMPLEADO 2 → Nómina Individual  
    ├── EMPLEADO 3 → Nómina Individual
    └── EMPLEADO N → Nómina Individual
```

### Principios Fundamentales

1. **UNA SOLA FUENTE DE VERDAD**: La nómina general es la fuente principal
2. **SINCRONIZACIÓN AUTOMÁTICA**: Cambios en general se reflejan en individuales
3. **TRAZABILIDAD COMPLETA**: Cada nómina individual sabe a qué general pertenece
4. **NO DUPLICACIÓN**: Los datos se comparten, no se duplican
5. **INTEGRIDAD REFERENCIAL**: Las nóminas individuales dependen de la general

---

## 🔄 FLUJO DE TRABAJO COMPLETO

### FASE 1: SELECCIÓN DE PERÍODO
**Frontend Actual**: Formulario de selección de período y empleados
**Backend Requerido**: 
- Validar que no exista nómina general para el período
- Obtener lista de empleados activos
- Validar configuraciones de nómina individual de cada empleado
- Crear registro inicial de nómina general en estado "draft"

### FASE 2: SIMULACIÓN
**Frontend Actual**: Muestra cálculos estimados por empleado
**Backend Requerido**:
- Calcular salarios base según configuración individual
- Incluir horas extra pendientes de cada empleado
- Aplicar bonos y deducciones pendientes
- Calcular impuestos y deducciones automáticas
- Generar resumen financiero total
- **NO CREAR** nóminas individuales aún (solo simulación)

### FASE 3: AJUSTES Y APROBACIÓN
**Frontend Actual**: Permite modificar datos antes de aprobar
**Backend Requerido**:
- Permitir ajustes manuales por empleado
- Recalcular totales cuando hay cambios
- Validar que todos los empleados tengan estado "aprobado"
- Marcar nómina general como "approved"

### FASE 4: CIERRE Y GENERACIÓN
**Frontend Actual**: Botón "Cerrar Nómina" y confirmación
**Backend Requerido**:
- **CREAR AUTOMÁTICAMENTE** todas las nóminas individuales
- Marcar extras/movimientos como "pagados" en nóminas individuales
- Generar números de folio únicos
- Cambiar estado a "closed"
- Enviar notificaciones a empleados

---

## 📊 LÓGICA DE NÓMINA INDIVIDUAL (YA IMPLEMENTADA)

### Funcionalidades Actuales

#### 1. **Configuración de Empleado**
```typescript
interface PayrollConfig {
  employeeId: string;
  baseSalary: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  paymentMethod: 'bank_transfer' | 'cash' | 'check';
  workingDays: string;
  workingHours: string;
  overtimeRate: number;
  benefits: {
    healthInsurance: boolean;
    lifeInsurance: boolean;
    foodVouchers: boolean;
  };
  deductions: {
    tax: number;
    socialSecurity: number;
    other: number;
  };
}
```

#### 2. **Gestión de Períodos**
- Crear períodos de nómina individuales
- Calcular salarios según configuración
- Incluir extras pendientes (horas extra, bonos, préstamos, ausencias)
- Generar recibos de pago en PDF

#### 3. **Control de Extras/Movimientos**
```typescript
interface MovementRecord {
  id: string;
  employeeId: string;
  type: 'overtime' | 'absence' | 'bonus' | 'deduction' | 'loan' | 'damage';
  date: string;
  amount: number;
  calculatedAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  
  // ESTADO DE PAGO (CLAVE PARA INTEGRACIÓN)
  paymentStatus: 'unpaid' | 'paid';
  payrollId?: string; // ID de la nómina donde se pagó
  payrollPeriod?: string; // Período de la nómina
  paidAt?: string;
  paidBy?: string;
}
```

#### 4. **Cálculo de Totales**
```typescript
const calculatePayrollTotals = () => {
  const totalPerceptions = periodDetails
    .filter(detail => detail.type === 'perception')
    .reduce((sum, detail) => sum + detail.amount, 0);

  const totalDeductions = periodDetails
    .filter(detail => detail.type === 'deduction')
    .reduce((sum, detail) => sum + detail.amount, 0);

  const netSalary = totalPerceptions - totalDeductions;
  
  return { totalPerceptions, totalDeductions, netSalary };
};
```

---

## 🏢 LÓGICA DE NÓMINA GENERAL (A IMPLEMENTAR)

### Estructura Principal

#### 1. **Modelo de Nómina General**
```typescript
interface GeneralPayroll {
  id: string;
  period: {
    startDate: string;
    endDate: string;
    frequency: 'weekly' | 'biweekly' | 'monthly';
  };
  status: 'draft' | 'calculated' | 'approved' | 'closed';
  employees: GeneralPayrollEmployee[];
  totals: {
    totalEmployees: number;
    totalGrossSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    totalOvertime: number;
    totalBonuses: number;
  };
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  closedBy?: string;
  closedAt?: string;
  folio: string; // Número único de nómina
}

interface GeneralPayrollEmployee {
  employeeId: string;
  employee: {
    id: string;
    name: string;
    position: string;
    department: string;
  };
  baseSalary: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  status: 'pending' | 'approved' | 'paid';
  individualPayrollId?: string; // Referencia a nómina individual
  adjustments: PayrollAdjustment[];
}

interface PayrollAdjustment {
  id: string;
  type: 'bonus' | 'deduction' | 'overtime_adjustment';
  concept: string;
  amount: number;
  reason: string;
  appliedBy: string;
  appliedAt: string;
}
```

### Proceso de Generación

#### PASO 1: Selección de Período
**Endpoint**: `POST /api/payroll/general/create`
```typescript
interface CreateGeneralPayrollRequest {
  startDate: string;
  endDate: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  includeEmployees: string[]; // IDs de empleados a incluir
}

// Lógica del Backend:
async function createGeneralPayroll(data: CreateGeneralPayrollRequest) {
  // 1. Validar que no exista nómina general para el período
  const existingPayroll = await checkExistingPayroll(data.startDate, data.endDate);
  if (existingPayroll) {
    throw new Error('Ya existe una nómina general para este período');
  }
  
  // 2. Validar empleados activos
  const activeEmployees = await getActiveEmployees(data.includeEmployees);
  
  // 3. Validar configuraciones de nómina individual
  for (const employeeId of activeEmployees) {
    const config = await getEmployeePayrollConfig(employeeId);
    if (!config) {
      throw new Error(`Empleado ${employeeId} no tiene configuración de nómina`);
    }
  }
  
  // 4. Crear registro inicial
  const generalPayroll = await GeneralPayroll.create({
    ...data,
    status: 'draft',
    employees: activeEmployees.map(emp => ({
      employeeId: emp.id,
      employee: emp,
      status: 'pending'
    }))
  });
  
  return generalPayroll;
}
```

#### PASO 2: Simulación de Cálculos
**Endpoint**: `POST /api/payroll/general/{id}/simulate`
```typescript
async function simulateGeneralPayroll(payrollId: string) {
  const generalPayroll = await GeneralPayroll.findById(payrollId);
  
  const simulatedEmployees = [];
  
  for (const employee of generalPayroll.employees) {
    // 1. Obtener configuración individual
    const config = await getEmployeePayrollConfig(employee.employeeId);
    
    // 2. Calcular salario base según frecuencia
    const baseSalary = calculateBaseSalary(config.baseSalary, config.frequency, generalPayroll.period);
    
    // 3. Obtener extras pendientes
    const pendingExtras = await getPendingExtras(employee.employeeId, generalPayroll.period);
    
    // 4. Calcular percepciones
    const overtime = pendingExtras.filter(e => e.type === 'overtime').reduce((sum, e) => sum + e.calculatedAmount, 0);
    const bonuses = pendingExtras.filter(e => e.type === 'bonus').reduce((sum, e) => sum + e.calculatedAmount, 0);
    
    // 5. Calcular deducciones
    const absences = pendingExtras.filter(e => e.type === 'absence').reduce((sum, e) => sum + e.calculatedAmount, 0);
    const loans = pendingExtras.filter(e => e.type === 'loan').reduce((sum, e) => sum + e.calculatedAmount, 0);
    const taxes = calculateTaxes(baseSalary + overtime + bonuses);
    
    const totalDeductions = absences + loans + taxes + config.deductions.socialSecurity;
    const grossSalary = baseSalary + overtime + bonuses;
    const netSalary = grossSalary - totalDeductions;
    
    simulatedEmployees.push({
      ...employee,
      baseSalary,
      overtime,
      bonuses,
      deductions: totalDeductions,
      grossSalary,
      netSalary,
      pendingExtras
    });
  }
  
  // Actualizar nómina general con simulación
  generalPayroll.employees = simulatedEmployees;
  generalPayroll.status = 'calculated';
  generalPayroll.totals = calculateGeneralTotals(simulatedEmployees);
  
  await generalPayroll.save();
  return generalPayroll;
}
```

#### PASO 3: Ajustes y Aprobación
**Endpoint**: `PUT /api/payroll/general/{id}/employee/{employeeId}/adjust`
```typescript
interface PayrollAdjustmentRequest {
  type: 'bonus' | 'deduction' | 'overtime_adjustment';
  concept: string;
  amount: number;
  reason: string;
}

async function applyPayrollAdjustment(payrollId: string, employeeId: string, adjustment: PayrollAdjustmentRequest) {
  const generalPayroll = await GeneralPayroll.findById(payrollId);
  const employee = generalPayroll.employees.find(e => e.employeeId === employeeId);
  
  // Aplicar ajuste
  employee.adjustments.push({
    ...adjustment,
    id: generateId(),
    appliedBy: getCurrentUser(),
    appliedAt: new Date().toISOString()
  });
  
  // Recalcular totales del empleado
  if (adjustment.type === 'bonus') {
    employee.bonuses += adjustment.amount;
    employee.grossSalary += adjustment.amount;
    employee.netSalary += adjustment.amount;
  } else if (adjustment.type === 'deduction') {
    employee.deductions += adjustment.amount;
    employee.netSalary -= adjustment.amount;
  }
  
  // Recalcular totales generales
  generalPayroll.totals = calculateGeneralTotals(generalPayroll.employees);
  
  await generalPayroll.save();
  return generalPayroll;
}
```

#### PASO 4: Cierre y Generación de Nóminas Individuales
**Endpoint**: `POST /api/payroll/general/{id}/close`
```typescript
async function closeGeneralPayroll(payrollId: string) {
  const generalPayroll = await GeneralPayroll.findById(payrollId);
  
  if (generalPayroll.status !== 'approved') {
    throw new Error('La nómina general debe estar aprobada para cerrar');
  }
  
  const individualPayrolls = [];
  
  // CREAR NÓMINAS INDIVIDUALES PARA CADA EMPLEADO
  for (const employee of generalPayroll.employees) {
    // 1. Crear período individual
    const individualPayroll = await createIndividualPayrollFromGeneral({
      employeeId: employee.employeeId,
      generalPayrollId: payrollId,
      period: generalPayroll.period,
      calculations: {
        baseSalary: employee.baseSalary,
        overtime: employee.overtime,
        bonuses: employee.bonuses,
        deductions: employee.deductions,
        grossSalary: employee.grossSalary,
        netSalary: employee.netSalary
      },
      adjustments: employee.adjustments
    });
    
    // 2. Marcar extras como pagados
    await markExtrasAsPaid(employee.employeeId, generalPayroll.period, individualPayroll.id);
    
    // 3. Actualizar referencia en nómina general
    employee.individualPayrollId = individualPayroll.id;
    employee.status = 'paid';
    
    individualPayrolls.push(individualPayroll);
  }
  
  // Actualizar estado de nómina general
  generalPayroll.status = 'closed';
  generalPayroll.closedBy = getCurrentUser();
  generalPayroll.closedAt = new Date().toISOString();
  generalPayroll.folio = generatePayrollFolio();
  
  await generalPayroll.save();
  
  // Enviar notificaciones
  await sendPayrollNotifications(individualPayrolls);
  
  return {
    generalPayroll,
    individualPayrolls
  };
}

async function createIndividualPayrollFromGeneral(data) {
  // Crear configuración si no existe
  let config = await getEmployeePayrollConfig(data.employeeId);
  if (!config) {
    config = await createDefaultPayrollConfig(data.employeeId);
  }
  
  // Crear período de nómina individual
  const payrollPeriod = await PayrollPeriod.create({
    employeeId: data.employeeId,
    configId: config.id,
    periodStart: data.period.startDate,
    periodEnd: data.period.endDate,
    frequency: data.period.frequency,
    baseSalary: data.calculations.baseSalary,
    grossSalary: data.calculations.grossSalary,
    totalDeductions: data.calculations.deductions,
    netSalary: data.calculations.netSalary,
    status: 'approved',
    // REFERENCIA A NÓMINA GENERAL
    generalPayrollId: data.generalPayrollId,
    createdBy: 'system_general_payroll',
    approvedBy: getCurrentUser(),
    approvedAt: new Date().toISOString()
  });
  
  // Crear detalles de percepciones y deducciones
  const details = [];
  
  // Salario base
  details.push({
    payrollId: payrollPeriod.id,
    employeeId: data.employeeId,
    type: 'perception',
    concept: 'Salario Base',
    amount: data.calculations.baseSalary,
    description: `Salario base para período ${data.period.startDate} - ${data.period.endDate}`
  });
  
  // Horas extra
  if (data.calculations.overtime > 0) {
    details.push({
      payrollId: payrollPeriod.id,
      employeeId: data.employeeId,
      type: 'perception',
      concept: 'Horas Extra',
      amount: data.calculations.overtime,
      description: 'Horas extra del período'
    });
  }
  
  // Bonos
  if (data.calculations.bonuses > 0) {
    details.push({
      payrollId: payrollPeriod.id,
      employeeId: data.employeeId,
      type: 'perception',
      concept: 'Bonos',
      amount: data.calculations.bonuses,
      description: 'Bonos del período'
    });
  }
  
  // Deducciones
  if (data.calculations.deductions > 0) {
    details.push({
      payrollId: payrollPeriod.id,
      employeeId: data.employeeId,
      type: 'deduction',
      concept: 'Deducciones',
      amount: data.calculations.deductions,
      description: 'Deducciones del período'
    });
  }
  
  // Ajustes aplicados en nómina general
  for (const adjustment of data.adjustments) {
    details.push({
      payrollId: payrollPeriod.id,
      employeeId: data.employeeId,
      type: adjustment.type === 'bonus' ? 'perception' : 'deduction',
      concept: adjustment.concept,
      amount: adjustment.amount,
      description: `Ajuste aplicado en nómina general: ${adjustment.reason}`
    });
  }
  
  await PayrollDetail.bulkCreate(details);
  
  return payrollPeriod;
}

async function markExtrasAsPaid(employeeId: string, period: any, payrollId: string) {
  const pendingExtras = await MovementRecord.findAll({
    where: {
      employeeId,
      date: {
        [Op.between]: [period.startDate, period.endDate]
      },
      paymentStatus: 'unpaid'
    }
  });
  
  for (const extra of pendingExtras) {
    extra.paymentStatus = 'paid';
    extra.payrollId = payrollId;
    extra.payrollPeriod = `${period.startDate} - ${period.endDate}`;
    extra.paidAt = new Date().toISOString();
    extra.paidBy = getCurrentUser();
    await extra.save();
  }
}
```

---

## 🔗 INTEGRACIÓN ENTRE NÓMINAS

### Sincronización Bidireccional

#### 1. **De General a Individual** (Automática)
- Al cerrar nómina general → Se crean nóminas individuales
- Al aplicar ajustes en general → Se reflejan en individual
- Al aprobar general → Se aprueban individuales

#### 2. **De Individual a General** (Consulta)
- Las nóminas individuales mantienen referencia `generalPayrollId`
- Permiten rastrear origen de cada nómina individual
- Facilitan auditorías y reportes consolidados

### Casos de Consistencia

#### ✅ **CASOS PERMITIDOS**:
1. Crear nómina general → Genera individuales automáticamente
2. Consultar nómina individual → Mostrar referencia a general
3. Modificar nómina general (antes de cerrar) → Recalcular simulación
4. Cerrar nómina general → Finalizar individuales

#### ❌ **CASOS NO PERMITIDOS**:
1. Modificar nómina individual que viene de general
2. Eliminar nómina individual que tiene `generalPayrollId`
3. Crear nómina individual para período que ya tiene general cerrada
4. Modificar nómina general después de cerrada

### Validaciones de Integridad

```typescript
// Validar antes de crear nómina individual
async function validateIndividualPayrollCreation(employeeId: string, period: any) {
  const existingGeneral = await GeneralPayroll.findOne({
    where: {
      startDate: period.startDate,
      endDate: period.endDate,
      status: ['approved', 'closed'],
      employees: {
        [Op.contains]: [{ employeeId }]
      }
    }
  });
  
  if (existingGeneral) {
    throw new Error('No se puede crear nómina individual. Ya existe nómina general para este período y empleado');
  }
}

// Validar antes de modificar nómina individual
async function validateIndividualPayrollModification(payrollId: string) {
  const payroll = await PayrollPeriod.findById(payrollId);
  
  if (payroll.generalPayrollId) {
    throw new Error('No se puede modificar nómina individual que proviene de nómina general');
  }
}
```

---

## 🔌 APIS Y ENDPOINTS REQUERIDOS

### Nómina General

#### Gestión Principal
```typescript
// Crear nómina general
POST /api/payroll/general
Body: {
  startDate: string,
  endDate: string,
  frequency: string,
  includeEmployees: string[]
}

// Obtener nóminas generales
GET /api/payroll/general
Query: ?status=all&limit=10&offset=0

// Obtener nómina general específica
GET /api/payroll/general/{id}

// Simular cálculos
POST /api/payroll/general/{id}/simulate

// Aprobar nómina general
POST /api/payroll/general/{id}/approve

// Cerrar nómina general (generar individuales)
POST /api/payroll/general/{id}/close
```

#### Gestión de Empleados
```typescript
// Obtener empleados disponibles para nómina
GET /api/payroll/general/available-employees
Query: ?startDate=2024-01-01&endDate=2024-01-07

// Aplicar ajuste a empleado
PUT /api/payroll/general/{id}/employee/{employeeId}/adjust
Body: {
  type: 'bonus' | 'deduction',
  concept: string,
  amount: number,
  reason: string
}

// Aprobar empleado específico
POST /api/payroll/general/{id}/employee/{employeeId}/approve

// Marcar empleado como pagado
POST /api/payroll/general/{id}/employee/{employeeId}/mark-paid
```

#### Reportes y Exportación
```typescript
// Exportar nómina general
GET /api/payroll/general/{id}/export
Query: ?format=excel|pdf

// Obtener comprobantes de empleados
GET /api/payroll/general/{id}/vouchers

// Descargar comprobantes masivos
GET /api/payroll/general/{id}/vouchers/download
```

### Integración con Nómina Individual

```typescript
// Obtener nóminas individuales de una general
GET /api/payroll/general/{id}/individual-payrolls

// Obtener nómina individual con referencia general
GET /api/payroll/individual/{id}
Response: {
  ...payrollData,
  generalPayrollId?: string,
  generalPayrollFolio?: string
}

// Validar disponibilidad para nómina individual
GET /api/payroll/individual/validate-availability
Query: ?employeeId=123&startDate=2024-01-01&endDate=2024-01-07
```

---

## 📊 ESTRUCTURA DE DATOS

### Base de Datos - Tablas Principales

#### 1. **general_payrolls**
```sql
CREATE TABLE general_payrolls (
  id UUID PRIMARY KEY,
  folio VARCHAR(50) UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_employees INTEGER DEFAULT 0,
  total_gross_salary DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_net_salary DECIMAL(15,2) DEFAULT 0,
  total_overtime DECIMAL(15,2) DEFAULT 0,
  total_bonuses DECIMAL(15,2) DEFAULT 0,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  closed_by VARCHAR(255),
  closed_at TIMESTAMP,
  notes TEXT
);
```

#### 2. **general_payroll_employees**
```sql
CREATE TABLE general_payroll_employees (
  id UUID PRIMARY KEY,
  general_payroll_id UUID REFERENCES general_payrolls(id),
  employee_id UUID NOT NULL,
  base_salary DECIMAL(15,2) NOT NULL,
  overtime DECIMAL(15,2) DEFAULT 0,
  bonuses DECIMAL(15,2) DEFAULT 0,
  deductions DECIMAL(15,2) DEFAULT 0,
  gross_salary DECIMAL(15,2) NOT NULL,
  net_salary DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  individual_payroll_id UUID REFERENCES payroll_periods(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. **general_payroll_adjustments**
```sql
CREATE TABLE general_payroll_adjustments (
  id UUID PRIMARY KEY,
  general_payroll_id UUID REFERENCES general_payrolls(id),
  employee_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  concept VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  applied_by VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. **Modificación a payroll_periods** (Nómina Individual)
```sql
-- Agregar columna para referenciar nómina general
ALTER TABLE payroll_periods 
ADD COLUMN general_payroll_id UUID REFERENCES general_payrolls(id);

-- Índice para mejorar consultas
CREATE INDEX idx_payroll_periods_general_id ON payroll_periods(general_payroll_id);
```

#### 5. **Modificación a movement_records** (Ya implementado)
```sql
-- Estas columnas ya existen para control de pagos
ALTER TABLE movement_records 
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN payroll_id UUID,
ADD COLUMN payroll_period VARCHAR(100),
ADD COLUMN paid_at TIMESTAMP,
ADD COLUMN paid_by VARCHAR(255);
```

---

## 🎯 CASOS DE USO DETALLADOS

### Caso de Uso 1: Generar Nómina General Semanal

**Escenario**: Generar nómina semanal para 10 empleados activos

**Flujo**:
1. **Selección**: Admin selecciona período 15-21 Enero 2024, frecuencia semanal
2. **Validación**: Sistema valida que no existe nómina general para ese período
3. **Empleados**: Sistema obtiene 10 empleados activos con configuración válida
4. **Simulación**: Sistema calcula salarios base + extras pendientes
5. **Revisión**: Admin revisa cálculos, aplica 2 ajustes (bono performance)
6. **Aprobación**: Admin aprueba nómina general
7. **Cierre**: Sistema crea automáticamente 10 nóminas individuales
8. **Notificación**: Se envían recibos de pago a empleados

**Resultado**:
- 1 nómina general cerrada
- 10 nóminas individuales creadas y aprobadas
- Todos los extras marcados como "pagados"
- Referencias cruzadas establecidas

### Caso de Uso 2: Consultar Nómina Individual Generada desde General

**Escenario**: Empleado consulta su recibo individual

**Flujo**:
1. **Acceso**: Empleado accede a su módulo de nómina individual
2. **Visualización**: Ve su nómina del período 15-21 Enero
3. **Información**: Recibo muestra origen desde nómina general
4. **Detalle**: Puede ver todas las percepciones y deducciones
5. **PDF**: Puede descargar su recibo individual
6. **Trazabilidad**: Sistema muestra que proviene de folio NOM-2024-001

**Resultado**:
- Empleado tiene acceso completo a su información
- Mantiene trazabilidad con nómina general
- No puede modificar (solo consulta)

### Caso de Uso 3: Aplicar Ajuste en Nómina General

**Escenario**: Aplicar bono de productividad antes de cerrar

**Flujo**:
1. **Identificación**: Admin identifica empleado para bono
2. **Aplicación**: Aplica ajuste de $5,000 por productividad
3. **Recálculo**: Sistema recalcula totales del empleado y generales
4. **Validación**: Admin valida nuevos totales
5. **Propagación**: Al cerrar, el ajuste se incluye en nómina individual

**Resultado**:
- Ajuste aplicado correctamente
- Totales actualizados en tiempo real
- Nómina individual incluye el ajuste con descripción

### Caso de Uso 4: Manejo de Horas Extra Pendientes

**Escenario**: Empleado tiene 15 horas extra pendientes de pago

**Flujo**:
1. **Registro**: Horas extra registradas en módulo individual (estado: unpaid)
2. **Inclusión**: Al simular nómina general, se incluyen automáticamente
3. **Cálculo**: Sistema calcula 15h × $150/h × 1.5 = $3,375
4. **Aprobación**: Admin aprueba nómina general
5. **Pago**: Al cerrar, horas extra se marcan como "paid"
6. **Referencia**: MovementRecord actualizado con payrollId y período

**Resultado**:
- Horas extra incluidas en nómina general
- Estado cambiado a "paid" automáticamente
- Trazabilidad completa de cuándo y dónde se pagaron

---

## ✅ VALIDACIONES Y REGLAS DE NEGOCIO

### Validaciones de Creación

#### Nómina General
```typescript
const validateGeneralPayrollCreation = {
  // 1. Período único
  periodUniqueness: async (startDate, endDate) => {
    const existing = await GeneralPayroll.findOne({
      where: { startDate, endDate }
    });
    if (existing) throw new Error('Ya existe nómina general para este período');
  },
  
  // 2. Empleados activos
  activeEmployees: async (employeeIds) => {
    const activeCount = await Employee.count({
      where: { id: { [Op.in]: employeeIds }, status: 'active' }
    });
    if (activeCount !== employeeIds.length) {
      throw new Error('Algunos empleados no están activos');
    }
  },
  
  // 3. Configuraciones válidas
  payrollConfigurations: async (employeeIds) => {
    for (const employeeId of employeeIds) {
      const config = await PayrollConfig.findOne({ where: { employeeId } });
      if (!config) {
        throw new Error(`Empleado ${employeeId} no tiene configuración de nómina`);
      }
    }
  },
  
  // 4. Sin nóminas individuales conflictivas
  noConflictingIndividual: async (employeeIds, startDate, endDate) => {
    const conflicting = await PayrollPeriod.findOne({
      where: {
        employeeId: { [Op.in]: employeeIds },
        periodStart: { [Op.lte]: endDate },
        periodEnd: { [Op.gte]: startDate },
        generalPayrollId: null // Solo individuales manuales
      }
    });
    if (conflicting) {
      throw new Error('Existe nómina individual manual que se superpone con el período');
    }
  }
};
```

#### Nómina Individual (Modificaciones)
```typescript
const validateIndividualPayrollCreation = {
  // 1. Sin nómina general existente
  noExistingGeneral: async (employeeId, startDate, endDate) => {
    const generalPayroll = await GeneralPayroll.findOne({
      where: {
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: endDate },
        status: ['approved', 'closed']
      },
      include: [{
        model: GeneralPayrollEmployee,
        where: { employeeId }
      }]
    });
    
    if (generalPayroll) {
      throw new Error('No se puede crear nómina individual. Ya existe nómina general para este empleado y período');
    }
  }
};
```

### Reglas de Estado

#### Estados de Nómina General
```typescript
const stateTransitions = {
  'draft': ['calculated', 'cancelled'],
  'calculated': ['approved', 'draft', 'cancelled'],
  'approved': ['closed'],
  'closed': [], // Estado final
  'cancelled': [] // Estado final
};

const validateStateTransition = (currentState, newState) => {
  if (!stateTransitions[currentState].includes(newState)) {
    throw new Error(`Transición inválida de ${currentState} a ${newState}`);
  }
};
```

#### Reglas de Modificación
```typescript
const modificationRules = {
  // Solo se puede modificar en draft y calculated
  canModify: (status) => ['draft', 'calculated'].includes(status),
  
  // Solo se puede aprobar en calculated
  canApprove: (status) => status === 'calculated',
  
  // Solo se puede cerrar en approved
  canClose: (status) => status === 'approved',
  
  // No se puede eliminar si está cerrada
  canDelete: (status) => !['closed'].includes(status)
};
```

### Validaciones de Integridad

#### Totales Consistentes
```typescript
const validateTotals = (generalPayroll) => {
  const calculatedTotals = {
    totalEmployees: generalPayroll.employees.length,
    totalGrossSalary: generalPayroll.employees.reduce((sum, emp) => sum + emp.grossSalary, 0),
    totalDeductions: generalPayroll.employees.reduce((sum, emp) => sum + emp.deductions, 0),
    totalNetSalary: generalPayroll.employees.reduce((sum, emp) => sum + emp.netSalary, 0),
    totalOvertime: generalPayroll.employees.reduce((sum, emp) => sum + emp.overtime, 0),
    totalBonuses: generalPayroll.employees.reduce((sum, emp) => sum + emp.bonuses, 0)
  };
  
  // Validar que los totales almacenados coincidan con los calculados
  Object.keys(calculatedTotals).forEach(key => {
    if (Math.abs(generalPayroll.totals[key] - calculatedTotals[key]) > 0.01) {
      throw new Error(`Total ${key} inconsistente`);
    }
  });
};
```

#### Referencias Válidas
```typescript
const validateReferences = async (generalPayroll) => {
  // Validar que todas las nóminas individuales existan
  for (const employee of generalPayroll.employees) {
    if (employee.individualPayrollId) {
      const individual = await PayrollPeriod.findById(employee.individualPayrollId);
      if (!individual) {
        throw new Error(`Nómina individual ${employee.individualPayrollId} no encontrada`);
      }
      
      // Validar que la referencia inversa sea correcta
      if (individual.generalPayrollId !== generalPayroll.id) {
        throw new Error('Referencia bidireccional inconsistente');
      }
    }
  }
};
```

---

## 🎨 CONSIDERACIONES DE FRONTEND (NO MODIFICAR)

### Componentes Existentes que NO se deben cambiar

#### 1. **PayrollModule.tsx** - Vista Principal
- Maneja navegación entre nómina general e individual
- Contiene lógica de selección de empleado
- **Backend debe adaptarse a esta estructura**

#### 2. **Flujo de 4 Pasos** - Componentes de Nómina General
- **Paso 1**: Selección de período y empleados
- **Paso 2**: Simulación y cálculos
- **Paso 3**: Ajustes y aprobación
- **Paso 4**: Cierre y confirmación
- **Backend debe proporcionar datos en el formato esperado**

#### 3. **EmployeePayrollView.tsx** - Nómina Individual
- Muestra nóminas individuales con toda la funcionalidad actual
- Debe seguir funcionando igual para nóminas manuales
- Para nóminas que vienen de general, debe mostrar referencia
- **Backend debe mantener compatibilidad total**

### Formato de Datos Esperado por Frontend

#### Nómina General - Lista
```typescript
// GET /api/payroll/general
{
  payrolls: [
    {
      id: "uuid",
      folio: "NOM-2024-001",
      period: "Enero 2024 (31/12/2023 - 30/1/2024)",
      type: "Mensual",
      status: "Cerrado",
      employees: 20,
      estimatedCost: 229783.00,
      realCost: 246488.00,
      createdBy: {
        name: "Roberto Silva",
        role: "Coordinador de Nómina"
      }
    }
  ],
  pagination: {
    total: 36,
    page: 1,
    limit: 10
  }
}
```

#### Simulación de Nómina
```typescript
// POST /api/payroll/general/{id}/simulate
{
  period: {
    startDate: "2024-01-31",
    endDate: "2024-01-30",
    frequency: "monthly"
  },
  totals: {
    totalEmployees: 5,
    grossSalary: 261400.00,
    netSalary: 207800.00,
    totalDeductions: 53600.00,
    averageSalary: 52280.00,
    totalOvertime: 12600.00,
    totalBonuses: 19500.00,
    totalTaxes: 47500.00
  },
  employees: [
    {
      id: "emp001",
      employee: {
        name: "Ana García López",
        position: "Desarrolladora Senior",
        code: "EMP001"
      },
      baseSalary: 45000.00,
      overtime: 4500.00,
      bonuses: 4000.00,
      grossSalary: 55500.00,
      deductions: 11300.00,
      netSalary: 44200.00,
      status: "calculated"
    }
  ]
}
```

#### Ajustes y Aprobación
```typescript
// GET /api/payroll/general/{id}/approval
{
  totals: {
    totalEmployees: 3,
    pending: 1,
    approved: 2,
    totalAdjustments: 3
  },
  employees: [
    {
      id: "emp001",
      employee: { name: "Ana García López", position: "Desarrolladora Senior" },
      originalSalary: 44200.00,
      adjustments: [
        {
          type: "bonus",
          concept: "Performance Bonus",
          amount: 500.00,
          reason: "Q1 2024 performance",
          appliedBy: "admin"
        }
      ],
      finalSalary: 44700.00,
      difference: 500.00,
      status: "approved",
      paymentStatus: "paid",
      paymentMethod: "bank_transfer"
    }
  ]
}
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Estructura Base (Semana 1)
1. Crear tablas de base de datos
2. Implementar modelos básicos
3. Crear endpoints de CRUD para nómina general
4. Implementar validaciones básicas

### Fase 2: Lógica de Simulación (Semana 2)
1. Implementar cálculos de salarios base
2. Integrar extras pendientes
3. Calcular deducciones e impuestos
4. Implementar endpoint de simulación

### Fase 3: Ajustes y Aprobación (Semana 3)
1. Implementar sistema de ajustes
2. Crear lógica de aprobación por empleado
3. Implementar recálculos automáticos
4. Validar estados y transiciones

### Fase 4: Integración con Individual (Semana 4)
1. Implementar creación automática de nóminas individuales
2. Establecer referencias bidireccionales
3. Implementar marcado de extras como pagados
4. Crear validaciones de integridad

### Fase 5: Testing y Ajustes (Semana 5)
1. Pruebas de integración completas
2. Validar todos los flujos de trabajo
3. Ajustar formatos de respuesta según frontend
4. Optimizar consultas y rendimiento

---

## 📝 CONCLUSIÓN

Este documento detalla **COMPLETAMENTE** la lógica requerida para implementar el módulo de nómina general con integración total a las nóminas individuales ya existentes.

### Puntos Críticos para el Backend:

1. **NO MODIFICAR** el frontend existente - adaptarse a la estructura actual
2. **CREAR AUTOMÁTICAMENTE** nóminas individuales al cerrar general
3. **MANTENER SINCRONIZACIÓN** bidireccional entre ambos módulos
4. **MARCAR EXTRAS** como pagados con referencias completas
5. **VALIDAR INTEGRIDAD** en todo momento
6. **SEGUIR FORMATOS** de datos esperados por el frontend

La implementación de esta lógica permitirá tener un sistema completo de nóminas que mantenga la flexibilidad de las nóminas individuales con la eficiencia de las nóminas generales, sin duplicar datos y manteniendo trazabilidad completa.

**El resultado final será un sistema robusto que permite gestionar nóminas tanto de forma individual como masiva, con total integración y consistencia de datos.**
