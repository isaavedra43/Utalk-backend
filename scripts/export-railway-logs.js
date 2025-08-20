/**
 * 📊 EXPORTADOR DE LOGS DE RAILWAY - GRATUITO
 * 
 * Script para exportar logs de Railway usando su API REST
 * No requiere terminal de Railway ni costos adicionales
 * 
 * @author UTalk Backend Team
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class RailwayLogExporter {
  constructor() {
    this.railwayToken = process.env.RAILWAY_TOKEN;
    this.projectId = process.env.RAILWAY_PROJECT_ID;
    this.serviceId = process.env.RAILWAY_SERVICE_ID;
    this.baseUrl = 'https://backboard.railway.app/graphql/v2';
    
    if (!this.railwayToken) {
      throw new Error('❌ RAILWAY_TOKEN no configurado. Obtén tu token en: https://railway.app/account/tokens');
    }
  }

  /**
   * Obtener logs usando la API GraphQL de Railway
   */
  async getLogs(options = {}) {
    const {
      limit = 1000,
      offset = 0,
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
      endDate = new Date(),
      level = null // 'error', 'warn', 'info', 'debug'
    } = options;

    const query = `
      query GetLogs($projectId: ID!, $serviceId: ID!, $limit: Int!, $offset: Int!) {
        project(id: $projectId) {
          service(id: $serviceId) {
            logs(limit: $limit, offset: $offset) {
              edges {
                node {
                  id
                  message
                  level
                  timestamp
                  metadata
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.baseUrl, {
        query,
        variables: {
          projectId: this.projectId,
          serviceId: this.serviceId,
          limit,
          offset
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.railwayToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data?.project?.service?.logs || { edges: [], pageInfo: {} };
    } catch (error) {
      console.error('❌ Error obteniendo logs:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Exportar logs a archivo JSON
   */
  async exportToJSON(outputPath = './railway-logs.json', options = {}) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Exportando logs de Railway...' });
    
    const allLogs = [];
    let offset = 0;
    let hasNextPage = true;
    const limit = options.limit || 100;

    while (hasNextPage && allLogs.length < (options.maxLogs || 10000)) {
      const result = await this.getLogs({ ...options, limit, offset });
      
      const logs = result.edges.map(edge => edge.node);
      allLogs.push(...logs);
      
      hasNextPage = result.pageInfo.hasNextPage;
      offset += limit;
      
      logger.info('� Procesados ${allLogs.length} logs...', { category: 'AUTO_MIGRATED' });
      
      // Pausa para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Filtrar por nivel si se especifica
    let filteredLogs = allLogs;
    if (options.level) {
      filteredLogs = allLogs.filter(log => log.level === options.level);
    }

    // Filtrar por fecha si se especifica
    if (options.startDate || options.endDate) {
      filteredLogs = filteredLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        const start = options.startDate ? new Date(options.startDate) : new Date(0);
        const end = options.endDate ? new Date(options.endDate) : new Date();
        return logDate >= start && logDate <= end;
      });
    }

    // Guardar a archivo
    const output = {
      exportedAt: new Date().toISOString(),
      totalLogs: filteredLogs.length,
      filters: options,
      logs: filteredLogs
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    logger.info('Logs exportados a: ${outputPath}', { category: 'AUTO_MIGRATED' });
    logger.info('Total de logs: ${filteredLogs.length}', { category: 'AUTO_MIGRATED' });
    
    return output;
  }

  /**
   * Exportar logs a archivo CSV
   */
  async exportToCSV(outputPath = './railway-logs.csv', options = {}) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Exportando logs de Railway a CSV...' });
    
    const jsonData = await this.exportToJSON('./temp-logs.json', options);
    
    const csvHeader = 'Timestamp,Level,Message,ID,Metadata\n';
    const csvRows = jsonData.logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const level = log.level || 'info';
      const message = (log.message || '').replace(/"/g, '""'); // Escapar comillas
      const id = log.id || '';
      const metadata = JSON.stringify(log.metadata || {}).replace(/"/g, '""');
      
      return `"${timestamp}","${level}","${message}","${id}","${metadata}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    fs.writeFileSync(outputPath, csvContent);
    
    // Limpiar archivo temporal
    fs.unlinkSync('./temp-logs.json');
    
    logger.info('Logs exportados a CSV: ${outputPath}', { category: 'AUTO_MIGRATED' });
    return csvContent;
  }

  /**
   * Exportar solo errores críticos
   */
  async exportErrors(outputPath = './railway-errors.json') {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚨 Exportando solo errores críticos...' });
    return this.exportToJSON(outputPath, {
      level: 'error',
      maxLogs: 5000
    });
  }

  /**
   * Exportar logs de las últimas N horas
   */
  async exportRecentLogs(hours = 24, outputPath = './railway-recent-logs.json') {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    logger.info('Exportando logs de las últimas ${hours} horas...', { category: 'AUTO_MIGRATED' });
    
    return this.exportToJSON(outputPath, {
      startDate,
      maxLogs: 10000
    });
  }
}

// Función principal para ejecutar el exportador
async function main() {
  try {
    const exporter = new RailwayLogExporter();
    
    // Ejemplo de uso - puedes modificar estas opciones
    const options = {
      // Exportar solo errores
      level: process.argv.includes('--errors-only') ? 'error' : null,
      
      // Exportar de las últimas horas
      hours: process.argv.includes('--recent') ? 24 : null,
      
      // Formato de salida
      format: process.argv.includes('--csv') ? 'csv' : 'json',
      
      // Límite de logs
      maxLogs: 5000
    };

    let outputPath;
    if (options.format === 'csv') {
      outputPath = options.level === 'error' ? './railway-errors.csv' : './railway-logs.csv';
      await exporter.exportToCSV(outputPath, options);
    } else {
      outputPath = options.level === 'error' ? './railway-errors.json' : './railway-logs.json';
      await exporter.exportToJSON(outputPath, options);
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 Exportación completada exitosamente!' });
    
  } catch (error) {
    console.error('❌ Error en la exportación:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = RailwayLogExporter; 