/**
 * 🔧 SCRIPT FRONTEND CORREGIDO PARA ARREGLAR PERMISOS DE ADMIN
 * 
 * Este script detecta "Acceso Denegado" y agrega un botón para arreglar
 * los permisos del admin usando el endpoint corregido.
 * 
 * INSTRUCCIONES:
 * 1. Copia este código completo
 * 2. Pégalo en tu frontend donde se muestre "Acceso Denegado"
 * 3. El botón aparecerá automáticamente
 * 4. Al hacer clic, arreglará los permisos y recargará la página
 */

(function() {
    'use strict';
    
    // ✅ CONFIGURACIÓN - URL del endpoint corregido
    const BACKEND_URL = 'https://utalk-backend-production.up.railway.app';
    
    // ✅ FUNCIÓN PRINCIPAL
    function addAdminFixButton() {
        // Evitar duplicados
        if (document.getElementById('admin-fix-btn')) {
            return;
        }
        
        // Buscar el mensaje de "Acceso Denegado"
        let accessDeniedContainer = null;
        
        // Buscar cualquier elemento que contenga "Acceso Denegado"
        const allElements = document.querySelectorAll('*');
        for (let element of allElements) {
            if (element.textContent && element.textContent.includes('Acceso Denegado')) {
                accessDeniedContainer = element;
                break;
            }
        }
        
        // Si no se encuentra, usar el body
        if (!accessDeniedContainer) {
            accessDeniedContainer = document.body;
        }
        
        // Crear el botón de arreglo
        const fixButton = document.createElement('button');
        fixButton.id = 'admin-fix-btn';
        fixButton.innerHTML = '🔧 Arreglar Permisos de Admin';
        fixButton.style.cssText = `
            background: linear-gradient(135deg, #ff4757, #ff3838);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin: 20px auto;
            display: block;
            box-shadow: 0 4px 20px rgba(255, 71, 87, 0.4);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            min-width: 250px;
        `;
        
        // Efectos hover
        fixButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 6px 25px rgba(255, 71, 87, 0.6)';
        });
        
        fixButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 20px rgba(255, 71, 87, 0.4)';
        });
        
        // Crear mensaje de estado
        const statusDiv = document.createElement('div');
        statusDiv.id = 'admin-fix-status';
        statusDiv.style.cssText = `
            text-align: center;
            margin: 15px auto;
            padding: 15px;
            border-radius: 8px;
            font-weight: bold;
            display: none;
            max-width: 600px;
            line-height: 1.5;
        `;
        
        // Función para mostrar mensaje
        function showStatus(message, type = 'info') {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = message;
            
            switch(type) {
                case 'success':
                    statusDiv.style.background = 'linear-gradient(135deg, #00b894, #00a085)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '2px solid #00b894';
                    break;
                case 'error':
                    statusDiv.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '2px solid #ff6b6b';
                    break;
                default:
                    statusDiv.style.background = 'linear-gradient(135deg, #74b9ff, #0984e3)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '2px solid #74b9ff';
            }
        }
        
        // Evento click del botón
        fixButton.addEventListener('click', async function() {
            // Deshabilitar botón
            this.disabled = true;
            this.innerHTML = '⏳ Arreglando Permisos...';
            this.style.background = '#6c757d';
            
            showStatus('🚀 Iniciando arreglo de permisos de admin...', 'info');
            
            try {
                console.log('🔄 Llamando al endpoint de arreglo...');
                
                const response = await fetch(`${BACKEND_URL}/api/admin-fix`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                console.log('📡 Respuesta del servidor:', response.status);
                
                // Verificar si la respuesta es JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('El servidor no devolvió JSON válido');
                }
                
                const data = await response.json();
                console.log('📊 Datos de respuesta:', data);
                
                if (response.ok && data.success) {
                    showStatus(`
                        <h3>✅ ¡Permisos Arreglados Exitosamente!</h3>
                        <p><strong>Admin:</strong> ${data.data.admin.email}</p>
                        <p><strong>Módulos configurados:</strong> ${data.data.migration.modulesCount}</p>
                        <p><strong>Permisos legacy:</strong> ${data.data.migration.legacyPermissionsCount}</p>
                        <p><strong>Módulos accesibles:</strong> ${data.data.permissions.accessibleModules.join(', ')}</p>
                        <hr>
                        <p><strong>🎉 ¡Recargando página en 3 segundos...</strong></p>
                    `, 'success');
                    
                    // Recargar página después de 3 segundos
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                } else {
                    throw new Error(data.message || 'Error del servidor');
                }
                
            } catch (error) {
                console.error('❌ Error en arreglo de permisos:', error);
                
                showStatus(`
                    <h3>❌ Error al Arreglar Permisos</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Solución:</strong> Verifica que el servidor esté funcionando correctamente.</p>
                `, 'error');
                
                // Rehabilitar botón
                fixButton.disabled = false;
                fixButton.innerHTML = '🔧 Arreglar Permisos de Admin';
                fixButton.style.background = 'linear-gradient(135deg, #ff4757, #ff3838)';
                
                // Ocultar mensaje de error después de 8 segundos
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 8000);
            }
        });
        
        // Agregar elementos al DOM
        accessDeniedContainer.appendChild(fixButton);
        accessDeniedContainer.appendChild(statusDiv);
        
        console.log('✅ Botón de arreglo de permisos de admin agregado correctamente');
    }
    
    // ✅ INICIALIZACIÓN
    function init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(addAdminFixButton, 1000);
            });
        } else {
            setTimeout(addAdminFixButton, 1000);
        }
        
        // También intentar después de delays adicionales por contenido dinámico
        setTimeout(addAdminFixButton, 3000);
        setTimeout(addAdminFixButton, 5000);
    }
    
    // ✅ EJECUTAR
    init();
    
    // ✅ EXPORTAR PARA USO MANUAL
    window.adminFix = {
        init: addAdminFixButton
    };
    
})();
