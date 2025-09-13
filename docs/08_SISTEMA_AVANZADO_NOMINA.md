# 🚀 Sistema Avanzado de Nómina

## 📋 Resumen

Se ha implementado un **sistema completo de nómina avanzada** con las siguientes características principales:

- ✅ **Impuestos opcionales** configurables (ISR, IMSS, IVA, etc.)
- ✅ **Integración completa** con sistema de Extras
- ✅ **Control de duplicados** automático
- ✅ **Tracking completo** de aplicaciones a nómina
- ✅ **Configuración dual** (global y por empleado)
- ✅ **Análisis avanzado** y reportes detallados

---

## 🎯 Funcionalidades Implementadas

### 1. 📊 **IMPUESTOS OPCIONALES**

#### Características:
- **Configuración Global**: Impuestos aplicables a toda la empresa
- **Configuración Individual**: Override por empleado específico
- **Impuestos Predefinidos**: ISR, IMSS, IVA, INFONAVIT
- **Impuestos Personalizados**: Crear impuestos específicos
- **Cálculo Progresivo**: Soporte para ISR con tramos

#### Tipos de Impuestos:
```javascript
// Porcentaje fijo
{ type: 'percentage', value: 16 } // IVA 16%

// Monto fijo
{ type: 'fixed', value: 500 } // Cuota fija $500

// Progresivo (ISR)
{ type: 'progressive', brackets: [...] } // Tramos de ISR
```

#### Configuración por Empleado:
```javascript
{
  useGlobalDefaults: false, // Usar configuración personalizada
  enabledTaxes: ['ISR', 'IMSS'], // Solo estos impuestos
  customTaxes: [...], // Impuestos personalizados
  taxOverrides: { // Override valores globales
    'ISR': { value: 15 } // ISR personalizado 15%
  }
}
```

### 2. 🔗 **INTEGRACIÓN CON EXTRAS**

#### Control de Duplicados:
- **Detección Automática**: Identifica movimientos duplicados
- **Campos de Verificación**: Tipo, monto, fecha, empleado
- **Marcado Automático**: Los duplicados se marcan y cancelan
- **Prevención**: Evita aplicar el mismo movimiento dos veces

#### Tracking de Aplicaciones:
```javascript
// Historial completo de cada movimiento
payrollHistory: [
  {
    payrollId: 'payroll_123',
    payrollPeriod: '2025-09-07 - 2025-09-13',
    appliedAt: '2025-09-13T12:00:00.000Z',
    amount: 312.50,
    status: 'applied',
    notes: 'Aplicado automáticamente a nómina semanal'
  }
]
```

#### Estados de Movimientos:
- **`pending`**: Listo para aplicar
- **`applied`**: Ya aplicado a nómina
- **`duplicate`**: Marcado como duplicado
- **`cancelled`**: Cancelado por alguna razón

### 3. 📈 **ANÁLISIS AVANZADO**

#### Vista Previa de Nómina:
- Cálculo sin generar nómina real
- Muestra impacto de todos los movimientos
- Incluye impuestos opcionales configurados
- Permite validar antes de generar

#### Resumen de Impacto:
```javascript
{
  totalMovements: 5,
  perceptions: 1250.00, // Horas extra + bonos
  deductions: 750.00,   // Préstamos + descuentos
  netImpact: 500.00,    // Impacto neto positivo
  byType: {
    'overtime': 312.50,
    'bonus': 937.50,
    'loan': -500.00,
    'discount': -250.00
  },
  duplicatesFound: 0,
  readyToApply: 5
}
```

---

## 🏗️ Arquitectura del Sistema

### Modelos Principales:

#### 1. **TaxConfig** - Configuración de Impuestos
```javascript
{
  name: 'ISR',
  displayName: 'Impuesto Sobre la Renta',
  type: 'progressive',
  category: 'federal',
  isOptional: true,
  scope: 'global', // o 'employee'
  brackets: [...] // Para cálculo progresivo
}
```

#### 2. **PayrollConfig** - Configuración Mejorada
```javascript
{
  // Configuración existente...
  taxSettings: {
    useGlobalDefaults: true,
    enabledTaxes: ['ISR', 'IMSS'],
    customTaxes: [...],
    taxOverrides: {...}
  },
  extrasIntegration: {
    autoApplyExtras: true,
    requireApproval: false,
    trackDuplicates: true,
    markAsApplied: true
  }
}
```

#### 3. **PayrollMovement** - Movimientos Mejorados
```javascript
{
  // Campos existentes...
  payrollHistory: [...], // Historial de aplicaciones
  isDuplicate: false,
  originalMovementId: null,
  preventDuplication: true,
  applicationSource: 'automatic'
}
```

### Servicios:

#### **EnhancedPayrollService**
- `generateAdvancedPayroll()` - Generación con todas las funcionalidades
- `previewPayroll()` - Vista previa sin generar
- `calculateDeductions()` - Cálculo con impuestos opcionales
- `checkForDuplicateMovements()` - Detección de duplicados
- `markMovementsAsApplied()` - Tracking de aplicaciones

---

## 🌐 API Endpoints

### Configuración de Impuestos:

```http
# Configuraciones Globales
GET    /api/tax-config/global
POST   /api/tax-config/global
POST   /api/tax-config/create-defaults

# Configuraciones por Empleado
GET    /api/tax-config/employee/:employeeId
POST   /api/tax-config/employee/:employeeId
GET    /api/tax-config/effective/:employeeId
PUT    /api/tax-config/employee/:employeeId/settings

# Operaciones Generales
PUT    /api/tax-config/:configId
DELETE /api/tax-config/:configId
POST   /api/tax-config/preview/:employeeId
```

### Nómina Avanzada:

```http
# Generación Avanzada
POST   /api/payroll/generate-advanced/:employeeId
POST   /api/payroll/preview/:employeeId

# Análisis y Reportes
GET    /api/payroll/:payrollId/summary-with-extras
GET    /api/payroll/extras-impact/:employeeId
GET    /api/payroll/check-duplicates/:employeeId

# Gestión de Movimientos
PUT    /api/payroll/mark-movements-applied
```

---

## 📊 Ejemplos de Uso

### 1. Configurar Impuestos Opcionales:

```javascript
// Configuración global - ISR opcional
POST /api/tax-config/global
{
  "name": "ISR",
  "displayName": "Impuesto Sobre la Renta",
  "type": "progressive",
  "category": "federal",
  "isOptional": true,
  "brackets": [
    { "lower": 0, "upper": 8952.49, "rate": 0 },
    { "lower": 8952.49, "upper": 75984.55, "rate": 10.67 }
  ]
}

// Configuración por empleado - Solo IMSS
PUT /api/tax-config/employee/emp123/settings
{
  "taxSettings": {
    "useGlobalDefaults": false,
    "enabledTaxes": ["IMSS"],
    "taxOverrides": {
      "IMSS": { "value": 10.5 }
    }
  }
}
```

### 2. Generar Nómina Avanzada:

```javascript
POST /api/payroll/generate-advanced/emp123
{
  "periodDate": "2025-09-13",
  "forceRegenerate": false,
  "ignoreDuplicates": false
}

// Respuesta:
{
  "success": true,
  "data": {
    "payroll": {...},
    "details": [...],
    "summary": {
      "grossSalary": 12500.00,
      "totalDeductions": 4003.52,
      "netSalary": 8496.48,
      "extrasApplied": 3,
      "taxesApplied": 2,
      "duplicatesFound": 0
    }
  }
}
```

### 3. Vista Previa de Nómina:

```javascript
POST /api/payroll/preview/emp123
{
  "periodDate": "2025-09-13"
}

// Respuesta:
{
  "success": true,
  "data": {
    "employee": {
      "id": "emp123",
      "name": "Juan Pérez"
    },
    "period": {
      "startDate": "2025-09-07",
      "endDate": "2025-09-13",
      "frequency": "weekly"
    },
    "preview": {
      "grossSalary": 12500.00,
      "totalDeductions": 4003.52,
      "netSalary": 8496.48,
      "perceptions": {
        "baseSalary": 12500.00,
        "extras": 312.50,
        "details": [...]
      },
      "deductions": {
        "taxes": [
          {
            "name": "IMSS",
            "amount": 1312.50,
            "rate": 10.5
          }
        ],
        "extras": 0,
        "details": [...]
      }
    }
  }
}
```

---

## 🔧 Configuración e Instalación

### 1. Ejecutar Script de Configuración:

```bash
node scripts/setup-advanced-payroll.js
```

### 2. Crear Índices en Firestore:

Los siguientes índices son necesarios en Firebase Console:

```javascript
// payrollConfigs
{
  fields: [
    { field: 'employeeId', order: 'ASCENDING' },
    { field: 'isActive', order: 'ASCENDING' },
    { field: 'startDate', order: 'DESCENDING' }
  ]
}

// Collection Group: movements
{
  fields: [
    { field: 'employeeId', order: 'ASCENDING' },
    { field: 'date', order: 'ASCENDING' },
    { field: 'appliedToPayroll', order: 'ASCENDING' },
    { field: 'status', order: 'ASCENDING' }
  ]
}
```

### 3. Configurar Impuestos por Defecto:

```javascript
POST /api/tax-config/create-defaults
{
  "companyId": "default"
}
```

---

## 📈 Flujo de Trabajo Completo

### 1. **Configuración Inicial**:
1. Ejecutar script de configuración
2. Crear índices de Firestore
3. Configurar impuestos globales
4. Configurar empleados específicos

### 2. **Operación Diaria**:
1. Registrar movimientos en Extras
2. Generar vista previa de nómina
3. Verificar duplicados
4. Generar nómina avanzada
5. Revisar tracking de aplicaciones

### 3. **Análisis y Reportes**:
1. Revisar impacto de extras
2. Analizar deducciones aplicadas
3. Verificar historial de movimientos
4. Generar reportes personalizados

---

## 🎯 Beneficios del Sistema

### Para el Usuario:
- ✅ **Control Total**: Configuración flexible de impuestos
- ✅ **Transparencia**: Tracking completo de movimientos
- ✅ **Prevención de Errores**: Control automático de duplicados
- ✅ **Análisis Detallado**: Reportes y vistas previas

### Para la Empresa:
- ✅ **Cumplimiento Legal**: Configuración correcta de impuestos
- ✅ **Control de Costos**: Seguimiento preciso de extras
- ✅ **Auditoría Completa**: Historial detallado de todas las operaciones
- ✅ **Escalabilidad**: Sistema adaptable a diferentes necesidades

### Para el Sistema:
- ✅ **Integridad de Datos**: Prevención de duplicados y errores
- ✅ **Trazabilidad**: Registro completo de todas las operaciones
- ✅ **Flexibilidad**: Configuración adaptable por empleado
- ✅ **Mantenibilidad**: Código modular y bien estructurado

---

## 🚨 Consideraciones Importantes

### Seguridad:
- Todos los endpoints requieren autenticación
- Roles específicos para cada operación
- Validación completa de datos de entrada
- Logs detallados de todas las operaciones

### Performance:
- Índices optimizados para consultas frecuentes
- Cálculos eficientes de impuestos
- Caching de configuraciones globales
- Paginación en listados grandes

### Mantenimiento:
- Logs detallados para debugging
- Validación exhaustiva de datos
- Manejo de errores robusto
- Documentación completa del código

---

## 📞 Soporte y Documentación

Para más información sobre el sistema avanzado de nómina:

1. **Documentación Técnica**: Ver código fuente con comentarios detallados
2. **Scripts de Configuración**: `scripts/setup-advanced-payroll.js`
3. **Ejemplos de Uso**: Tests unitarios en `tests/`
4. **Logs del Sistema**: Revisar logs de aplicación para debugging

¡El sistema está completamente implementado y listo para usar! 🎉
