/**
 * 🔒 SCRIPT PARA RESTAURAR LA SEGURIDAD DESPUÉS DE PRUEBAS
 * 
 * Este script restaura el hashing de contraseñas y elimina
 * las modificaciones de texto plano.
 * 
 * ⚠️ EJECUTAR DESPUÉS DE COMPLETAR LAS PRUEBAS
 */

const fs = require('fs');
const path = require('path');

function restoreSecurity() {
  console.log('🔒 RESTAURANDO SEGURIDAD DEL SISTEMA...\n');

  const filesToRestore = [
    {
      file: 'src/models/User.js',
      changes: [
        {
          from: "// 🚨 COMPARACIÓN DIRECTA SIN HASHING (SOLO PRUEBAS)",
          to: "// Comparar contraseña con bcrypt"
        },
        {
          from: "const isValid = (plainPassword === userData.password);",
          to: "const isValid = await bcrypt.compare(plainPassword, userData.password);"
        },
        {
          from: "logger.info('🔐 Validando contraseña para usuario (TEXTO PLANO)', { email });",
          to: "logger.info('🔐 Validando contraseña para usuario', { email });"
        },
        {
          from: "logger.info(isValid ? '✅ Contraseña válida (TEXTO PLANO)' : '❌ Contraseña inválida (TEXTO PLANO)', {",
          to: "logger.info(isValid ? '✅ Contraseña válida' : '❌ Contraseña inválida', {"
        },
        {
          from: "// 🚨 GUARDAR CONTRASEÑA EN TEXTO PLANO (SOLO PRUEBAS)",
          to: "// Hash de la contraseña"
        },
        {
          from: "password: userData.password, // 🚨 TEXTO PLANO",
          to: "password: hashedPassword,"
        },
        {
          from: "// const saltRounds = 12;",
          to: "const saltRounds = 12;"
        },
        {
          from: "// const hashedPassword = await bcrypt.hash(userData.password, saltRounds);",
          to: "const hashedPassword = await bcrypt.hash(userData.password, saltRounds);"
        },
        {
          from: "// 🚨 SI SE ACTUALIZA LA CONTRASEÑA, GUARDAR EN TEXTO PLANO (SOLO PRUEBAS)",
          to: "// Si se actualiza la contraseña, hashearla"
        },
        {
          from: "// const saltRounds = 12;",
          to: "const saltRounds = 12;"
        },
        {
          from: "// updates.password = await bcrypt.hash(updates.password, saltRounds);",
          to: "updates.password = await bcrypt.hash(updates.password, saltRounds);"
        },
        {
          from: "// 🚨 NO HACER HASH - GUARDAR TEXTO PLANO",
          to: "// Hash de la contraseña actualizada"
        },
        {
          from: "logger.info('🚨 Actualizando contraseña en texto plano (SOLO PRUEBAS)', {",
          to: "logger.info('🔐 Actualizando contraseña con hash', {"
        }
      ]
    },
    {
      file: 'src/controllers/AuthController.js',
      changes: [
        {
          from: "// 🚨 VALIDAR contraseña en texto plano (SOLO PRUEBAS)",
          to: "// ✅ VALIDAR contraseña con bcrypt"
        },
        {
          from: "logger.info('🔐 Validando contraseña en texto plano...', { email });",
          to: "logger.info('🔐 Validando contraseña...', { email });"
        }
      ]
    }
  ];

  let totalChanges = 0;

  for (const fileInfo of filesToRestore) {
    const filePath = path.join(process.cwd(), fileInfo.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Archivo no encontrado: ${fileInfo.file}`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanges = 0;

    for (const change of fileInfo.changes) {
      if (content.includes(change.from)) {
        content = content.replace(change.from, change.to);
        fileChanges++;
        totalChanges++;
      }
    }

    if (fileChanges > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Restaurado: ${fileInfo.file} (${fileChanges} cambios)`);
    } else {
      console.log(`⚠️  Sin cambios: ${fileInfo.file}`);
    }
  }

  console.log(`\n🎯 RESTAURACIÓN COMPLETADA`);
  console.log(`   Total de cambios: ${totalChanges}`);
  console.log('');
  console.log('🔒 SEGURIDAD RESTAURADA:');
  console.log('   ✅ Hashing de contraseñas habilitado');
  console.log('   ✅ Validación bcrypt activada');
  console.log('   ✅ Logs de seguridad restaurados');
  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('   1. Reinicia el servidor después de estos cambios');
  console.log('   2. Las contraseñas existentes necesitarán ser actualizadas');
  console.log('   3. Elimina los usuarios de prueba creados');
  console.log('');
  console.log('🧹 Para limpiar archivos de prueba:');
  console.log('   rm test-login-plaintext.js');
  console.log('   rm create-test-users-plaintext.js');
  console.log('   rm restore-security.js');
}

// Ejecutar restauración
restoreSecurity(); 