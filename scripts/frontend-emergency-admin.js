/**
 * 🚨 SCRIPT FRONTEND DE EMERGENCIA PARA ADMIN
 * 
 * Este script usa el endpoint de emergencia para arreglar
 * los permisos del admin de forma inmediata.
 */

(function() {
    'use strict';
    
    // ✅ CONFIGURACIÓN - URL del endpoint de emergencia
    const BACKEND_URL = 'https://utalk-backend-production.up.railway.app';
    
    // ✅ FUNCIÓN PRINCIPAL
    function addEmergencyAdminButton() {
        // Evitar duplicados
        if (document.getElementById('emergency-admin-btn')) {
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
        
        // Crear el botón de emergencia
        const emergencyButton = document.createElement('button');
        emergencyButton.id = 'emergency-admin-btn';
        emergencyButton.innerHTML = '🚨 EMERGENCIA: Arreglar Admin';
        emergencyButton.style.cssText = `
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 20px 40px;
            border-radius: 15px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            margin: 30px auto;
            display: block;
            box-shadow: 0 6px 25px rgba(231, 76, 60, 0.5);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 2px;
            min-width: 300px;
            animation: pulse 2s infinite;
        `;
        
        // Agregar animación CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        // Efectos hover
        emergencyButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.1)';
            this.style.boxShadow = '0 8px 30px rgba(231, 76, 60, 0.7)';
        });
        
        emergencyButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 6px 25px rgba(231, 76, 60, 0.5)';
        });
        
        // Crear mensaje de estado
        const statusDiv = document.createElement('div');
        statusDiv.id = 'emergency-admin-status';
        statusDiv.style.cssText = `
            text-align: center;
            margin: 20px auto;
            padding: 20px;
            border-radius: 10px;
            font-weight: bold;
            display: none;
            max-width: 700px;
            line-height: 1.6;
            font-size: 16px;
        `;
        
        // Función para mostrar mensaje
        function showStatus(message, type = 'info') {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = message;
            
            switch(type) {
                case 'success':
                    statusDiv.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '3px solid #27ae60';
                    break;
                case 'error':
                    statusDiv.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '3px solid #e74c3c';
                    break;
                default:
                    statusDiv.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
                    statusDiv.style.color = 'white';
                    statusDiv.style.border = '3px solid #3498db';
            }
        }
        
        // Evento click del botón
        emergencyButton.addEventListener('click', async function() {
            // Deshabilitar botón
            this.disabled = true;
            this.innerHTML = '⏳ ARREGLANDO...';
            this.style.background = '#7f8c8d';
            this.style.animation = 'none';
            
            showStatus('🚨 INICIANDO ARREGLO DE EMERGENCIA...', 'info');
            
            try {
                console.log('🚨 Llamando al endpoint de emergencia...');
                
                const response = await fetch(`${BACKEND_URL}/emergency-admin`, {
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
                    throw new Error('El servidor no devolvió JSON válido. Status: ' + response.status);
                }
                
                const data = await response.json();
                console.log('📊 Datos de respuesta:', data);
                
                if (response.ok && data.success) {
                    showStatus(`
                        <h2>✅ ¡ARREGLO DE EMERGENCIA EXITOSO!</h2>
                        <p><strong>Admin:</strong> ${data.data.admin.email}</p>
                        <p><strong>Módulos configurados:</strong> ${data.data.migration.modulesCount}</p>
                        <p><strong>Permisos legacy:</strong> ${data.data.migration.legacyPermissionsCount}</p>
                        <p><strong>Módulos accesibles:</strong> ${data.data.permissions.accessibleModules.join(', ')}</p>
                        <hr>
                        <p><strong>🎉 ¡RECARGANDO PÁGINA EN 3 SEGUNDOS...</strong></p>
                        <p>Después del recarga, tendrás acceso completo a todos los módulos.</p>
                    `, 'success');
                    
                    // Recargar página después de 3 segundos
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                } else {
                    throw new Error(data.message || 'Error del servidor');
                }
                
            } catch (error) {
                console.error('❌ Error en arreglo de emergencia:', error);
                
                showStatus(`
                    <h3>❌ ERROR EN ARREGLO DE EMERGENCIA</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Posibles causas:</strong></p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>El servidor no está funcionando</li>
                        <li>El endpoint no está registrado</li>
                        <li>Problemas de conectividad</li>
                    </ul>
                    <p><strong>Recomendación:</strong> Contacta al administrador del sistema.</p>
                `, 'error');
                
                // Rehabilitar botón
                emergencyButton.disabled = false;
                emergencyButton.innerHTML = '🚨 EMERGENCIA: Arreglar Admin';
                emergencyButton.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                emergencyButton.style.animation = 'pulse 2s infinite';
                
                // Ocultar mensaje de error después de 10 segundos
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 10000);
            }
        });
        
        // Agregar elementos al DOM
        accessDeniedContainer.appendChild(emergencyButton);
        accessDeniedContainer.appendChild(statusDiv);
        
        console.log('✅ Botón de emergencia para admin agregado correctamente');
    }
    
    // ✅ INICIALIZACIÓN
    function init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(addEmergencyAdminButton, 1000);
            });
        } else {
            setTimeout(addEmergencyAdminButton, 1000);
        }
        
        // También intentar después de delays adicionales por contenido dinámico
        setTimeout(addEmergencyAdminButton, 3000);
        setTimeout(addEmergencyAdminButton, 5000);
        setTimeout(addEmergencyAdminButton, 8000);
    }
    
    // ✅ EJECUTAR
    init();
    
    // ✅ EXPORTAR PARA USO MANUAL
    window.emergencyAdmin = {
        init: addEmergencyAdminButton
    };
    
})();
