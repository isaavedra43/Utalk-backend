#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script para migrar todos los console.log a logger estructurado
 * Automatiza la migración masiva siguiendo patrones consistentes
 */

const PATTERNS = [
  // Patrones de reemplazo para console.log
  {
    pattern: /console\.log\('🚨([^']+)'[,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.trim();
      const category = generateCategory(cleanMessage);
      return `logger.info('${cleanMessage}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.log\('🔍([^']+)'[,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.trim();
      const category = generateCategory(cleanMessage);
      return `logger.debug('${cleanMessage}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.log\('✅([^']+)'[,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.trim();
      const category = generateCategory(cleanMessage);
      return `logger.info('${cleanMessage}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.log\('❌([^']+)'[,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.trim();
      const category = generateCategory(cleanMessage);
      return `logger.error('${cleanMessage}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.log\('⚠️([^']+)'[,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const cleanMessage = message.trim();
      const category = generateCategory(cleanMessage);
      return `logger.warn('${cleanMessage}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.error\(['"]([^'"]+)['"][,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const category = generateCategory(message);
      return `logger.error('${message}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  {
    pattern: /console\.warn\(['"]([^'"]+)['"][,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const category = generateCategory(message);
      return `logger.warn('${message}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  },
  // Patrón genérico para console.log restantes
  {
    pattern: /console\.log\(['"]([^'"]+)['"][,:]?\s*(\{[^}]*\})?/g,
    replacement: (match, message, data) => {
      const category = generateCategory(message);
      return `logger.info('${message}', { category: '${category}'${data ? `, ${data.slice(1, -1)}` : ''} }`;
    }
  }
];

function generateCategory(message) {
  // Generar categoría basada en el mensaje
  const cleaned = message
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, '_')
    .toUpperCase()
    .substring(0, 30);
  
  return cleaned || 'GENERAL';
}

function migrateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Verificar si ya tiene logger import
    if (!content.includes("require('../utils/logger')") && !content.includes("require('./utils/logger')")) {
      // Agregar import de logger si no existe
      const lines = content.split('\n');
      let insertIndex = 0;
      
      // Buscar después de otros requires
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('require(') || lines[i].includes('const ') || lines[i].includes('import ')) {
          insertIndex = i + 1;
        } else if (lines[i].trim() === '' || lines[i].startsWith('//') || lines[i].startsWith('/*')) {
          continue;
        } else {
          break;
        }
      }
      
      lines.splice(insertIndex, 0, "const logger = require('../utils/logger');");
      content = lines.join('\n');
      modified = true;
    }
    
    // Aplicar patrones de reemplazo
    PATTERNS.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Migrado: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error migrando ${filePath}:`, error.message);
    return false;
  }
}

function findJSFiles(dir) {
  const files = [];
  
  function walkDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
        walkDir(fullPath);
      } else if (stat.isFile() && item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function main() {
  console.log('🚀 Iniciando migración masiva de console.log a logger...');
  
  const srcDir = path.join(__dirname, 'src');
  const jsFiles = findJSFiles(srcDir);
  
  let migratedCount = 0;
  let totalFiles = 0;
  
  for (const file of jsFiles) {
    // Solo procesar archivos que contienen console.
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('console.')) {
        totalFiles++;
        if (migrateFile(file)) {
          migratedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error leyendo ${file}:`, error.message);
    }
  }
  
  console.log(`\n📊 Migración completada:`);
  console.log(`   📁 Archivos procesados: ${totalFiles}`);
  console.log(`   ✅ Archivos migrados: ${migratedCount}`);
  console.log(`   ❌ Archivos sin cambios: ${totalFiles - migratedCount}`);
  
  // Verificar archivos restantes con console.log
  try {
    const remaining = execSync('find src -name "*.js" -exec grep -l "console\\." {} \\;', { encoding: 'utf8' });
    const remainingFiles = remaining.trim().split('\n').filter(f => f);
    
    if (remainingFiles.length > 0) {
      console.log(`\n⚠️ Archivos que aún contienen console.log: ${remainingFiles.length}`);
      remainingFiles.forEach(file => console.log(`   - ${file}`));
    } else {
      console.log(`\n🎉 ¡Migración completa! No quedan console.log en el proyecto.`);
    }
  } catch (error) {
    console.log(`\n🔍 No se pudo verificar archivos restantes: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, generateCategory };