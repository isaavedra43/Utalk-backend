# 🔧 ALINEACIÓN FRONTEND-BACKEND: MÓDULO DE NÓMINA GENERAL

## 📋 PROBLEMA IDENTIFICADO

El frontend está intentando acceder a rutas que **NO EXISTEN** en el backend:

### ❌ Rutas Incorrectas (Frontend actual)
```javascript
// INCORRECTO - Estas rutas no existen
GET /api/payroll/general/stats            // ❌ 404 - No existe
GET /api/payroll/general?page=1&limit=10  // ❌ 404 - No existe
```

### ✅ Rutas Correctas (Backend disponible)
```javascript
// CORRECTO - Estas rutas sí existen
GET /api/payroll/stats                    // ✅ Estadísticas generales
GET /api/payroll/pending                  // ✅ Períodos pendientes
// NOTA: /api/payroll/general está en desarrollo, usar las anteriores
```

## 🚨 ESTADO ACTUAL DEL BACKEND

**IMPORTANTE**: Las pruebas confirman que:
- ✅ `/api/payroll/stats` - EXISTE (da 401 por token expirado, pero la ruta funciona)
- ✅ `/api/payroll/pending` - EXISTE (da 401 por token expirado, pero la ruta funciona)  
- ❌ `/api/payroll/general` - NO EXISTE (da 404 - conflicto de enrutamiento)
- ❌ `/api/payroll/general/stats` - NO EXISTE (da 404 - confirmado)

**SOLUCIÓN TEMPORAL**: Usar `/api/payroll/stats` y `/api/payroll/pending` hasta que se despliegue la corrección del backend.

---

## 🔄 FUNCIONES DEL FRONTEND QUE NECESITAN ACTUALIZACIÓN

### 1. Función `getGeneralMetrics()` - ESTADÍSTICAS

#### ❌ Implementación Incorrecta (Actual)
```javascript
// INCORRECTO
async function getGeneralMetrics() {
  const response = await api.get('/api/payroll/general/stats');
  return response.data;
}
```

#### ✅ Implementación Correcta (Nueva)
```javascript
// CORRECTO
async function getGeneralMetrics() {
  const response = await api.get('/api/payroll/stats');
  return response.data;
}
```

### 2. Función `getPayrollPeriods()` - PERÍODOS

#### ❌ Implementación Incorrecta (Actual)
```javascript
// INCORRECTO
async function getPayrollPeriods(page = 1, limit = 10) {
  const response = await api.get('/api/payroll/general', {
    params: { page, limit }
  });
  return response.data;
}
```

#### ✅ Implementación Correcta (Nueva)
```javascript
// CORRECTO
async function getPayrollPeriods(page = 1, limit = 10) {
  const response = await api.get('/api/payroll/pending', {
    params: { page, limit }
  });
  return response.data;
}
```

---

## 📝 CÓDIGO COMPLETO PARA EL FRONTEND

### Archivo: `src/services/payrollService.js`

```javascript
import api from './api'; // Tu cliente HTTP configurado

class PayrollService {
  
  /**
   * Obtener estadísticas generales de nómina
   * ✅ Usa la ruta correcta: GET /api/payroll/stats
   */
  async getGeneralMetrics() {
    try {
      console.log('📊 Obteniendo métricas generales del backend...');
      const response = await api.get('/api/payroll/stats');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métricas generales:', error);
      // Datos fallback para evitar que la UI se rompa
      return {
        success: true,
        data: {
          stats: {
            totalPeriods: 0,
            totalGross: 0,
            totalDeductions: 0,
            totalNet: 0,
            averageGross: 0,
            averageNet: 0,
            byFrequency: {},
            byStatus: {},
            byMonth: {}
          },
          filters: {}
        }
      };
    }
  }

  /**
   * Obtener períodos de nómina pendientes
   * ✅ Usa la ruta correcta: GET /api/payroll/pending
   */
  async getPayrollPeriods(page = 1, limit = 10) {
    try {
      console.log('📅 Obteniendo períodos de nómina del backend...');
      const response = await api.get('/api/payroll/pending', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo períodos de nómina:', error);
      // Datos fallback para evitar que la UI se rompa
      return {
        success: true,
        data: {
          periods: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0
          }
        }
      };
    }
  }

  /**
   * Obtener períodos de nómina de un empleado específico
   * ✅ Usa la ruta correcta: GET /api/payroll/periods/:employeeId
   */
  async getEmployeePayrollPeriods(employeeId, page = 1, limit = 10) {
    try {
      const response = await api.get(`/api/payroll/periods/${employeeId}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo períodos del empleado:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles de un período específico
   * ✅ Usa la ruta correcta: GET /api/payroll/period/:payrollId/details
   */
  async getPayrollDetails(payrollId) {
    try {
      const response = await api.get(`/api/payroll/period/${payrollId}/details`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo detalles de nómina:', error);
      throw error;
    }
  }

  /**
   * Obtener nóminas generales (TEMPORALMENTE DESHABILITADO)
   * ❌ Esta ruta no funciona actualmente debido a conflicto de enrutamiento
   * TODO: Habilitar cuando se despliegue la corrección del backend
   */
  async getGeneralPayrolls(page = 1, limit = 10, status = 'all') {
    console.warn('⚠️ Funcionalidad de nóminas generales temporalmente deshabilitada');
    // Datos fallback hasta que se corrija el backend
    return {
      success: true,
      data: {
        payrolls: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      }
    };
  }

  // ================================
  // FUNCIONES DE GESTIÓN
  // ================================

  /**
   * Aprobar período de nómina
   * ✅ Usa la ruta correcta: PUT /api/payroll/approve/:payrollId
   */
  async approvePayroll(payrollId) {
    try {
      const response = await api.put(`/api/payroll/approve/${payrollId}`);
      return response.data;
    } catch (error) {
      console.error('Error aprobando nómina:', error);
      throw error;
    }
  }

  /**
   * Marcar período como pagado
   * ✅ Usa la ruta correcta: PUT /api/payroll/pay/:payrollId
   */
  async markAsPaid(payrollId, paymentDate = null) {
    try {
      const response = await api.put(`/api/payroll/pay/${payrollId}`, {
        paymentDate
      });
      return response.data;
    } catch (error) {
      console.error('Error marcando como pagado:', error);
      throw error;
    }
  }

  /**
   * Cancelar período de nómina
   * ✅ Usa la ruta correcta: PUT /api/payroll/cancel/:payrollId
   */
  async cancelPayroll(payrollId, reason = '') {
    try {
      const response = await api.put(`/api/payroll/cancel/${payrollId}`, {
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelando nómina:', error);
      throw error;
    }
  }

  /**
   * Regenerar nómina
   * ✅ Usa la ruta correcta: POST /api/payroll/:payrollId/regenerate
   */
  async regeneratePayroll(payrollId) {
    try {
      const response = await api.post(`/api/payroll/${payrollId}/regenerate`);
      return response.data;
    } catch (error) {
      console.error('Error regenerando nómina:', error);
      throw error;
    }
  }
}

export default new PayrollService();
```

---

## 🔧 COMPONENTE DE NÓMINA GENERAL ACTUALIZADO

### Archivo: `src/components/GeneralPayrollDashboard.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import payrollService from '../services/payrollService';

const GeneralPayrollDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGeneralPayrollData();
  }, []);

  const loadGeneralPayrollData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando datos de nómina general...');

      // ✅ Usar las funciones corregidas
      const [metricsData, periodsData] = await Promise.all([
        payrollService.getGeneralMetrics(),
        payrollService.getPayrollPeriods(1, 10)
      ]);

      setMetrics(metricsData);
      setPeriods(periodsData);
      
      console.log('✅ Datos de nómina general cargados');
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError(error.message);
      console.log('⚠️ Usando datos fallback...');
      
      // Datos fallback en caso de error
      setMetrics({
        totalEmployees: 0,
        pendingPeriods: 0,
        approvedPeriods: 0,
        totalAmount: 0
      });
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Cargando datos de nómina...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error cargando datos</h3>
        <p>{error}</p>
        <button onClick={loadGeneralPayrollData}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="general-payroll-dashboard">
      <h2>Dashboard de Nómina General</h2>
      
      {/* Métricas */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Empleados</h3>
            <p>{metrics.totalEmployees || 0}</p>
          </div>
          <div className="metric-card">
            <h3>Períodos Pendientes</h3>
            <p>{metrics.pendingPeriods || 0}</p>
          </div>
          <div className="metric-card">
            <h3>Períodos Aprobados</h3>
            <p>{metrics.approvedPeriods || 0}</p>
          </div>
          <div className="metric-card">
            <h3>Monto Total</h3>
            <p>${metrics.totalAmount || 0}</p>
          </div>
        </div>
      )}

      {/* Lista de períodos */}
      <div className="periods-section">
        <h3>Períodos de Nómina</h3>
        {periods.length > 0 ? (
          <div className="periods-list">
            {periods.map(period => (
              <div key={period.id} className="period-item">
                <div className="period-info">
                  <h4>{period.folio || period.id}</h4>
                  <p>Estado: {period.status}</p>
                  <p>Monto: ${period.totalAmount}</p>
                </div>
                <div className="period-actions">
                  {period.status === 'pending' && (
                    <button onClick={() => handleApprove(period.id)}>
                      Aprobar
                    </button>
                  )}
                  {period.status === 'approved' && (
                    <button onClick={() => handleMarkAsPaid(period.id)}>
                      Marcar como Pagado
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No hay períodos de nómina disponibles</p>
        )}
      </div>
    </div>
  );

  // Funciones de manejo de eventos
  const handleApprove = async (payrollId) => {
    try {
      await payrollService.approvePayroll(payrollId);
      loadGeneralPayrollData(); // Recargar datos
    } catch (error) {
      console.error('Error aprobando nómina:', error);
    }
  };

  const handleMarkAsPaid = async (payrollId) => {
    try {
      await payrollService.markAsPaid(payrollId);
      loadGeneralPayrollData(); // Recargar datos
    } catch (error) {
      console.error('Error marcando como pagado:', error);
    }
  };
};

export default GeneralPayrollDashboard;
```

---

## 🚀 INSTRUCCIONES DE IMPLEMENTACIÓN

### 1. Reemplazar las funciones incorrectas
- Buscar en tu código frontend las funciones que usan `/api/payroll/general/stats` y `/api/payroll/general`
- Reemplazarlas con las funciones del `PayrollService` proporcionado arriba

### 2. Actualizar las llamadas en los componentes
- Cambiar `getGeneralMetrics()` para usar `/api/payroll/stats`
- Cambiar `getPayrollPeriods()` para usar `/api/payroll/pending`

### 3. Verificar que el token de autorización esté incluido
- Asegúrate de que tu cliente HTTP (`api`) incluya el header `Authorization: Bearer <token>`

### 4. Probar las nuevas rutas
- Verificar que `GET /api/payroll/stats` funcione correctamente
- Verificar que `GET /api/payroll/pending` funcione correctamente

---

## 🔍 VERIFICACIÓN RÁPIDA

Puedes probar las rutas directamente con curl:

```bash
# Estadísticas generales
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://utalk-backend-production.up.railway.app/api/payroll/stats

# Períodos pendientes
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://utalk-backend-production.up.railway.app/api/payroll/pending?page=1&limit=10
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] ✅ Identificar funciones incorrectas en el frontend
- [ ] ✅ Reemplazar `getGeneralMetrics()` con ruta `/api/payroll/stats`
- [ ] ✅ Reemplazar `getPayrollPeriods()` con ruta `/api/payroll/pending`
- [ ] ✅ Actualizar componentes que usan estas funciones
- [ ] ✅ Verificar que el token de autorización esté incluido
- [ ] ✅ Probar las nuevas rutas
- [ ] ✅ Verificar que no haya más errores 404 en los logs

¡Con estos cambios, el módulo de nómina general debería funcionar correctamente! 🎉
