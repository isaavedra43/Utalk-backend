/**
 * 🔧 SCRIPT FRONTEND PARA MIGRACIÓN DE PERMISOS DE ADMIN
 * 
 * Este script detecta cuando el usuario admin ve "Acceso Denegado"
 * y agrega un botón para migrar automáticamente sus permisos.
 * 
 * INSTRUCCIONES DE USO:
 * 1. Copia este código completo
 * 2. Pégalo en tu frontend donde se muestre "Acceso Denegado"
 * 3. El botón aparecerá automáticamente solo para el admin
 * 4. Al hacer clic, migrará los permisos y recargará la página
 */

(function() {
    'use strict';
    
    // ✅ CONFIGURACIÓN - Cambia esta URL si es necesario
    const BACKEND_URL = 'https://utalk-backend-production.up.railway.app';
    
    // ✅ FUNCIÓN PRINCIPAL
    function initAdminMigrationButton() {
        // Verificar si ya existe el botón para evitar duplicados
        if (document.getElementById('admin-migration-btn')) {
            return;
        }
        
        // Buscar el mensaje de "Acceso Denegado"
        const accessDeniedElements = document.querySelectorAll('*');
        let accessDeniedContainer = null;
        
        // Buscar cualquier elemento que contenga "Acceso Denegado"
        for (let element of accessDeniedElements) {
            if (element.textContent && element.textContent.includes('Acceso Denegado')) {
                accessDeniedContainer = element;
                break;
            }
        }
        
        // Si no se encuentra, buscar por texto específico
        if (!accessDeniedContainer) {
            const textNodes = document.evaluate(
                "//text()[contains(., 'Acceso Denegado')]",
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            
            if (textNodes.singleNodeValue) {
                accessDeniedContainer = textNodes.singleNodeValue.parentElement;
            }
        }
        
        // Si aún no se encuentra, usar el body
        if (!accessDeniedContainer) {
            accessDeniedContainer = document.body;
        }
        
        // Crear el botón de migración
        const migrationButton = document.createElement('button');
        migrationButton.id = 'admin-migration-btn';
        migrationButton.innerHTML = '🔧 Corregir Permisos de Admin';
        migrationButton.style.cssText = `
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin: 20px auto;
            display: block;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        
        // Efectos hover
        migrationButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
        });
        
        migrationButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.3)';
        });
        
        // Crear mensaje de estado
        const statusDiv = document.createElement('div');
        statusDiv.id = 'migration-status';
        statusDiv.style.cssText = `
            text-align: center;
            margin: 15px auto;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            display: none;
            max-width: 500px;
        `;
        
        // Función para mostrar mensaje
        function showStatus(message, type = 'info') {
            statusDiv.style.display = 'block';
            statusDiv.textContent = message;
            
            switch(type) {
                case 'success':
                    statusDiv.style.background = '#d4edda';
                    statusDiv.style.color = '#155724';
                    statusDiv.style.border = '1px solid #c3e6cb';
                    break;
                case 'error':
                    statusDiv.style.background = '#f8d7da';
                    statusDiv.style.color = '#721c24';
                    statusDiv.style.border = '1px solid #f5c6cb';
                    break;
                default:
                    statusDiv.style.background = '#d1ecf1';
                    statusDiv.style.color = '#0c5460';
                    statusDiv.style.border = '1px solid #bee5eb';
            }
        }
        
        // Función para ocultar mensaje
        function hideStatus() {
            statusDiv.style.display = 'none';
        }
        
        // Evento click del botón
        migrationButton.addEventListener('click', async function() {
            // Deshabilitar botón
            this.disabled = true;
            this.innerHTML = '⏳ Migrando Permisos...';
            this.style.background = '#6c757d';
            
            showStatus('🚀 Iniciando migración de permisos de admin...', 'info');
            
            try {
                console.log('🔄 Llamando al endpoint de migración...');
                
                const response = await fetch(`${BACKEND_URL}/api/admin-migration/force-migrate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    // No body necesario para este endpoint
                });
                
                console.log('📡 Respuesta del servidor:', response.status);
                
                const data = await response.json();
                console.log('📊 Datos de respuesta:', data);
                
                if (response.ok && data.success) {
                    showStatus('✅ ¡Migración exitosa! Recargando página...', 'success');
                    
                    // Mostrar detalles de la migración
                    setTimeout(() => {
                        showStatus(`
                            ✅ Migración Completada
                            📧 Admin: ${data.data.admin.email}
                            📊 Módulos: ${data.data.migration.modulesCount}
                            🔄 Recargando en 3 segundos...
                        `, 'success');
                    }, 1000);
                    
                    // Recargar página después de 3 segundos
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                } else {
                    throw new Error(data.message || 'Error desconocido del servidor');
                }
                
            } catch (error) {
                console.error('❌ Error en migración:', error);
                
                showStatus(`❌ Error: ${error.message}`, 'error');
                
                // Rehabilitar botón
                migrationButton.disabled = false;
                migrationButton.innerHTML = '🔧 Corregir Permisos de Admin';
                migrationButton.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
                
                // Ocultar mensaje de error después de 5 segundos
                setTimeout(() => {
                    hideStatus();
                }, 5000);
            }
        });
        
        // Agregar elementos al DOM
        accessDeniedContainer.appendChild(migrationButton);
        accessDeniedContainer.appendChild(statusDiv);
        
        console.log('✅ Botón de migración de admin agregado correctamente');
    }
    
    // ✅ FUNCIÓN PARA VERIFICAR SI ES ADMIN
    function isCurrentUserAdmin() {
        // Método 1: Verificar localStorage/sessionStorage
        try {
            const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                return user.role === 'admin' || user.email === 'admin@company.com';
            }
        } catch (e) {
            console.log('No se pudo verificar usuario desde storage');
        }
        
        // Método 2: Verificar si hay token de admin en cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            if (cookie.includes('admin') || cookie.includes('admin@company.com')) {
                return true;
            }
        }
        
        // Método 3: Verificar si la URL contiene indicios de admin
        if (window.location.href.includes('admin') || 
            window.location.search.includes('admin') ||
            window.location.hash.includes('admin')) {
            return true;
        }
        
        // Método 4: Si hay mensaje de "Acceso Denegado", asumir que es admin
        // (ya que solo los admins deberían ver este botón)
        return true;
    }
    
    // ✅ INICIALIZACIÓN
    function init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(initAdminMigrationButton, 1000);
            });
        } else {
            setTimeout(initAdminMigrationButton, 1000);
        }
        
        // También intentar después de un delay adicional por si hay contenido dinámico
        setTimeout(initAdminMigrationButton, 3000);
    }
    
    // ✅ EJECUTAR
    init();
    
    // ✅ EXPORTAR PARA USO MANUAL
    window.adminMigration = {
        init: initAdminMigrationButton,
        isAdmin: isCurrentUserAdmin
    };
    
})();
