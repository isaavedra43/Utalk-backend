#!/usr/bin/env node

/**
 * 📱 SCRIPT DE PRUEBA PARA INTEGRACIÓN MÓVIL
 * 
 * Este script prueba todos los endpoints de autenticación
 * con diferentes tipos de clientes móviles para verificar
 * que la integración funciona correctamente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const https = require('https');
const http = require('http');

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'https://utalk-backend-production.up.railway.app/api/auth';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@company.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Función para hacer peticiones HTTP/HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Función para imprimir resultados
function printResult(testName, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  const color = success ? colors.green : colors.red;
  
  console.log(`${color}${status}${colors.reset} ${testName}`);
  if (details) {
    console.log(`   ${colors.cyan}${details}${colors.reset}`);
  }
}

// Función para imprimir información
function printInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// Función para imprimir error
function printError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

// Configuraciones de prueba para diferentes tipos de cliente
const clientConfigs = [
  {
    name: 'React Native iOS',
    headers: {
      'X-Device-ID': 'rn_ios_test_123',
      'X-Device-Type': 'react-native',
      'X-Platform': 'ios',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'react-native'
    }
  },
  {
    name: 'Flutter Android',
    headers: {
      'X-Device-ID': 'flutter_android_test_456',
      'X-Device-Type': 'flutter',
      'X-Platform': 'android',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'flutter'
    }
  },
  {
    name: 'Ionic Capacitor',
    headers: {
      'X-Device-ID': 'ionic_capacitor_test_789',
      'X-Device-Type': 'ionic',
      'X-Platform': 'ios',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'capacitor'
    }
  },
  {
    name: 'Expo Web',
    headers: {
      'X-Device-ID': 'expo_web_test_101',
      'X-Device-Type': 'expo',
      'X-Platform': 'web',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'expo'
    }
  },
  {
    name: 'Web Browser (Control)',
    headers: {
      'X-Device-ID': 'web_browser_test_202',
      'X-Device-Type': 'web',
      'X-Platform': 'web',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'web'
    }
  }
];

// Pruebas a ejecutar
async function runTests() {
  console.log(`${colors.bright}${colors.magenta}📱 PRUEBAS DE INTEGRACIÓN MÓVIL${colors.reset}`);
  console.log(`${colors.cyan}==========================================${colors.reset}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log('');

  let totalTests = 0;
  let passedTests = 0;

  for (const config of clientConfigs) {
    console.log(`${colors.yellow}🧪 Probando: ${config.name}${colors.reset}`);
    console.log(`${colors.cyan}------------------------------------------${colors.reset}`);

    // Test 1: Login
    totalTests++;
    try {
      const loginResponse = await makeRequest(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: config.headers,
        body: {
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        }
      });

      const loginSuccess = loginResponse.statusCode === 200 && loginResponse.data.success;
      printResult('Login', loginSuccess, 
        loginSuccess ? 
          `Access Token: ${loginResponse.data.accessToken?.substring(0, 20)}...` : 
          `Error: ${loginResponse.data.error?.message || 'Unknown error'}`
      );

      if (loginSuccess) {
        passedTests++;
        const accessToken = loginResponse.data.accessToken;
        const refreshToken = loginResponse.data.refreshToken;

        // Test 2: Validar Token
        totalTests++;
        try {
          const validateResponse = await makeRequest(`${API_BASE_URL}/validate-token`, {
            method: 'POST',
            headers: {
              ...config.headers,
              'Authorization': `Bearer ${accessToken}`
            }
          });

          const validateSuccess = validateResponse.statusCode === 200 && validateResponse.data.success;
          printResult('Validate Token', validateSuccess,
            validateSuccess ? 
              `User: ${validateResponse.data.user?.email}` : 
              `Error: ${validateResponse.data.error?.message || 'Unknown error'}`
          );

          if (validateSuccess) {
            passedTests++;
          }
        } catch (error) {
          printError(`Validate Token Error: ${error.message}`);
        }

        // Test 3: Obtener Perfil
        totalTests++;
        try {
          const profileResponse = await makeRequest(`${API_BASE_URL}/profile`, {
            method: 'GET',
            headers: {
              ...config.headers,
              'Authorization': `Bearer ${accessToken}`
            }
          });

          const profileSuccess = profileResponse.statusCode === 200 && profileResponse.data.success;
          printResult('Get Profile', profileSuccess,
            profileSuccess ? 
              `Profile: ${profileResponse.data.user?.name}` : 
              `Error: ${profileResponse.data.error?.message || 'Unknown error'}`
          );

          if (profileSuccess) {
            passedTests++;
          }
        } catch (error) {
          printError(`Get Profile Error: ${error.message}`);
        }

        // Test 4: Refresh Token
        totalTests++;
        try {
          const refreshResponse = await makeRequest(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: config.headers,
            body: {
              refreshToken: refreshToken
            }
          });

          const refreshSuccess = refreshResponse.statusCode === 200 && refreshResponse.data.success;
          printResult('Refresh Token', refreshSuccess,
            refreshSuccess ? 
              `New Access Token: ${refreshResponse.data.accessToken?.substring(0, 20)}...` : 
              `Error: ${refreshResponse.data.error?.message || 'Unknown error'}`
          );

          if (refreshSuccess) {
            passedTests++;
          }
        } catch (error) {
          printError(`Refresh Token Error: ${error.message}`);
        }

        // Test 5: Logout
        totalTests++;
        try {
          const logoutResponse = await makeRequest(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: config.headers,
            body: {
              refreshToken: refreshToken
            }
          });

          const logoutSuccess = logoutResponse.statusCode === 200 && logoutResponse.data.success;
          printResult('Logout', logoutSuccess,
            logoutSuccess ? 
              `Logout successful` : 
              `Error: ${logoutResponse.data.error?.message || 'Unknown error'}`
          );

          if (logoutSuccess) {
            passedTests++;
          }
        } catch (error) {
          printError(`Logout Error: ${error.message}`);
        }
      }
    } catch (error) {
      printError(`Login Error: ${error.message}`);
    }

    console.log('');
  }

  // Resumen final
  console.log(`${colors.cyan}==========================================${colors.reset}`);
  console.log(`${colors.bright}📊 RESUMEN DE PRUEBAS${colors.reset}`);
  console.log(`${colors.cyan}==========================================${colors.reset}`);
  console.log(`Total de pruebas: ${totalTests}`);
  console.log(`Pruebas exitosas: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Pruebas fallidas: ${colors.red}${totalTests - passedTests}${colors.reset}`);
  console.log(`Tasa de éxito: ${colors.yellow}${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}`);
  
  if (passedTests === totalTests) {
    console.log(`${colors.green}${colors.bright}🎉 ¡TODAS LAS PRUEBAS PASARON!${colors.reset}`);
    console.log(`${colors.green}Tu backend está listo para aplicaciones móviles.${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}⚠️  ALGUNAS PRUEBAS FALLARON${colors.reset}`);
    console.log(`${colors.yellow}Revisa la configuración y los logs.${colors.reset}`);
  }
}

// Función para probar tipos de cliente no soportados
async function testUnsupportedClients() {
  console.log(`${colors.yellow}🧪 Probando tipos de cliente no soportados${colors.reset}`);
  console.log(`${colors.cyan}------------------------------------------${colors.reset}`);

  const unsupportedConfigs = [
    {
      name: 'Cliente no soportado',
      headers: {
        'X-Device-ID': 'unsupported_test_123',
        'X-Device-Type': 'unsupported-type',
        'X-Platform': 'ios',
        'X-App-Version': '1.0.0',
        'X-Client-Type': 'unsupported-type'
      }
    },
    {
      name: 'Plataforma no soportada',
      headers: {
        'X-Device-ID': 'unsupported_platform_test_456',
        'X-Device-Type': 'mobile',
        'X-Platform': 'unsupported-platform',
        'X-App-Version': '1.0.0',
        'X-Client-Type': 'mobile'
      }
    }
  ];

  for (const config of unsupportedConfigs) {
    try {
      const response = await makeRequest(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: config.headers,
        body: {
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        }
      });

      const shouldFail = response.statusCode === 400;
      printResult(`${config.name} (debe fallar)`, shouldFail,
        shouldFail ? 
          `Correctamente rechazado: ${response.data.error?.message}` : 
          `Error: Debería haber sido rechazado pero no lo fue`
      );
    } catch (error) {
      printError(`${config.name} Error: ${error.message}`);
    }
  }
}

// Función principal
async function main() {
  try {
    await runTests();
    console.log('');
    await testUnsupportedClients();
  } catch (error) {
    printError(`Error general: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  testUnsupportedClients,
  makeRequest
};

