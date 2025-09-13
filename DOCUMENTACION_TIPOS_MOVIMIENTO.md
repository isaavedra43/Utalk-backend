# 📋 DOCUMENTACIÓN COMPLETA - TIPOS DE MOVIMIENTO

## 🎯 TIPOS DE MOVIMIENTO SOPORTADOS

### **1. PRÉSTAMO (loan)**
- **Descripción:** Préstamos a empleados con cuotas
- **Archivos:** ✅ Requeridos (pagaré, identificación)
- **Campos específicos:**
  - `totalAmount` (number): Monto total del préstamo
  - `totalInstallments` (number): Número de cuotas
- **Validaciones:**
  - Monto total > 0
  - Número de cuotas > 0
  - Justificación requerida
  - Documentos requeridos

### **2. HORAS EXTRA (overtime)**
- **Descripción:** Horas trabajadas fuera del horario normal
- **Archivos:** ❌ No requeridos
- **Campos específicos:**
  - `hours` (number): Horas trabajadas
  - `hourlyRate` (number): Tarifa por hora
- **Validaciones:**
  - Horas > 0 y ≤ 12 por día
  - Tarifa por hora > 0
  - Razón requerida

### **3. FALTA (absence)**
- **Descripción:** Ausencias del empleado
- **Archivos:** ✅ Opcionales (justificante médico)
- **Campos específicos:**
  - `absenceType` (string): Tipo de ausencia
    - `sick_leave`: Incapacidad médica
    - `personal_leave`: Permiso personal
    - `vacation`: Vacaciones
    - `emergency`: Emergencia
    - `medical_appointment`: Cita médica
    - `other`: Otro
- **Validaciones:**
  - Duración > 0
  - Razón requerida
  - Justificante médico para incapacidades

### **4. BONO (bonus)**
- **Descripción:** Bonos por desempeño o logros
- **Archivos:** ❌ No requeridos
- **Campos específicos:**
  - `amount` (number): Monto del bono
  - `bonusType` (string): Tipo de bono
    - `performance`: Por desempeño
    - `attendance`: Por asistencia
    - `special`: Especial
    - `holiday`: Festivo
- **Validaciones:**
  - Monto > 0
  - Tipo de bono requerido
  - Razón requerida

### **5. DEDUCCIÓN (deduction)**
- **Descripción:** Deducciones del salario
- **Archivos:** ✅ Opcionales (documentos de respaldo)
- **Campos específicos:**
  - `amount` (number): Monto a deducir
  - `deductionType` (string): Tipo de deducción
    - `voluntary`: Voluntaria
    - `disciplinary`: Disciplinaria
    - `equipment`: Equipo
    - `other`: Otro
- **Validaciones:**
  - Monto > 0
  - Tipo de deducción requerido
  - Razón requerida

### **6. DESCUENTO (discount)**
- **Descripción:** Descuentos por pago anticipado o lealtad
- **Archivos:** ✅ Requeridos (documentos de respaldo)
- **Campos específicos:**
  - `amount` (number): Monto del descuento
  - `discountType` (string): Tipo de descuento
    - `early_payment`: Pago anticipado
    - `loyalty`: Lealtad
    - `volume`: Volumen
    - `special`: Especial
    - `other`: Otro
- **Validaciones:**
  - Monto > 0
  - Tipo de descuento requerido
  - Razón requerida
  - Documentos de respaldo requeridos

### **7. DAÑO/ROTURA (damage)**
- **Descripción:** Daños a equipos o propiedad de la empresa
- **Archivos:** ✅ Requeridos (evidencia fotográfica)
- **Campos específicos:**
  - `amount` (number): Monto del daño
  - `damageType` (string): Tipo de daño
    - `equipment`: Equipo
    - `property`: Propiedad
    - `vehicle`: Vehículo
    - `other`: Otro
- **Validaciones:**
  - Monto > 0
  - Justificación requerida
  - Evidencia fotográfica requerida

---

## 📊 CAMPOS COMUNES

Todos los tipos de movimiento incluyen estos campos:

### **Campos Básicos:**
- `type` (string): Tipo de movimiento
- `date` (string): Fecha en formato YYYY-MM-DD
- `description` (string): Descripción detallada
- `reason` (string): Razón del movimiento
- `location` (string): Ubicación (default: "office")
- `justification` (string): Justificación adicional
- `attachments` (array): IDs de archivos adjuntos

### **Campos de Estado:**
- `status` (string): Estado del movimiento
  - `pending`: Pendiente
  - `approved`: Aprobado
  - `rejected`: Rechazado
  - `active`: Activo
  - `completed`: Completado
  - `cancelled`: Cancelado

---

## 🔄 IMPACTO EN NÓMINA

### **Movimientos que SUMAN:**
- `overtime`: Horas extra
- `bonus`: Bonos

### **Movimientos que RESTAN:**
- `absence`: Ausencias
- `deduction`: Deducciones
- `discount`: Descuentos
- `loan`: Préstamos
- `damage`: Daños

---

## 📝 EJEMPLOS DE USO

### **Ejemplo 1: Préstamo**
```json
{
  "type": "loan",
  "date": "2025-09-13",
  "description": "Préstamo para gastos médicos",
  "reason": "Emergencia médica familiar",
  "location": "office",
  "justification": "Gastos médicos urgentes",
  "totalAmount": 5000,
  "totalInstallments": 10,
  "attachments": ["file-id-1", "file-id-2"]
}
```

### **Ejemplo 2: Horas Extra**
```json
{
  "type": "overtime",
  "date": "2025-09-13",
  "description": "Horas extra para proyecto urgente",
  "reason": "Proyecto con deadline ajustado",
  "location": "office",
  "hours": 3.5,
  "hourlyRate": 25.50
}
```

### **Ejemplo 3: Descuento**
```json
{
  "type": "discount",
  "date": "2025-09-13",
  "description": "Descuento por pago anticipado",
  "reason": "Pago anticipado de préstamo",
  "location": "office",
  "amount": 100,
  "discountType": "early_payment",
  "attachments": ["file-id-1"]
}
```

### **Ejemplo 4: Daño/Rotura**
```json
{
  "type": "damage",
  "date": "2025-09-13",
  "description": "Daño a laptop corporativa",
  "reason": "Accidente en oficina",
  "location": "office",
  "justification": "Laptop dañada por caída accidental",
  "amount": 1500,
  "damageType": "equipment",
  "attachments": ["file-id-1", "file-id-2"]
}
```

---

## ✅ ESTADO DE IMPLEMENTACIÓN

| Tipo | Validación | Archivos | Cálculo | Estado |
|------|------------|----------|---------|---------|
| **Préstamo** | ✅ | ✅ | ✅ | 100% |
| **Horas Extra** | ✅ | ✅ | ✅ | 100% |
| **Falta** | ✅ | ✅ | ✅ | 100% |
| **Bono** | ✅ | ✅ | ✅ | 100% |
| **Deducción** | ✅ | ✅ | ✅ | 100% |
| **Descuento** | ✅ | ✅ | ✅ | 100% |
| **Daño/Rotura** | ✅ | ✅ | ✅ | 100% |

---

## 🎯 CONCLUSIÓN

**TODOS LOS TIPOS DE MOVIMIENTO ESTÁN COMPLETAMENTE IMPLEMENTADOS** con validaciones específicas, soporte para archivos y cálculos automáticos. El sistema está listo para manejar cualquier tipo de movimiento de nómina.
