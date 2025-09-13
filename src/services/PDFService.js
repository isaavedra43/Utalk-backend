const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { storage } = require('../config/storage');

/**
 * Servicio de Generación de PDFs
 * Maneja la creación de PDFs para nóminas, reportes y documentos
 */
class PDFService {
  constructor() {
    this.browser = null;
    this.templatesPath = path.join(__dirname, '../templates');
    this.registerHandlebarsHelpers();
  }

  /**
   * Registrar helpers de Handlebars
   */
  registerHandlebarsHelpers() {
    // Helper para formatear moneda
    handlebars.registerHelper('formatCurrency', function(amount) {
      if (typeof amount !== 'number') return '0.00';
      return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    });

    // Helper para formatear fechas
    handlebars.registerHelper('formatDate', function(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('es-MX');
    });

    // Helper para formatear números
    handlebars.registerHelper('formatNumber', function(number) {
      if (typeof number !== 'number') return '0';
      return number.toLocaleString('es-MX');
    });
  }

  /**
   * Inicializar navegador Puppeteer
   */
  async initializeBrowser() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        logger.info('✅ Navegador Puppeteer inicializado');
      } catch (error) {
        logger.error('❌ Error inicializando navegador Puppeteer', error);
        throw error;
      }
    }
    return this.browser;
  }

  /**
   * Cerrar navegador
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('🔒 Navegador Puppeteer cerrado');
    }
  }

  /**
   * Generar PDF de recibo de nómina
   */
  async generatePayrollReceipt(payrollData, employeeData, companyData) {
    try {
      await this.initializeBrowser();
      
      // Preparar datos para el template
      const templateData = {
        // Información de la empresa
        company: {
          name: companyData.name || 'UTalk',
          address: companyData.address || 'Dirección de la empresa',
          phone: companyData.phone || 'Teléfono',
          email: companyData.email || 'email@empresa.com',
          rfc: companyData.rfc || 'RFC123456789',
          logo: companyData.logo || null
        },
        
        // Información del empleado
        employee: {
          name: employeeData.name || 'Empleado',
          employeeId: employeeData.id || 'N/A',
          department: employeeData.department || 'N/A',
          position: employeeData.position || 'N/A',
          rfc: employeeData.rfc || 'N/A',
          curp: employeeData.curp || 'N/A',
          imss: employeeData.imss || 'N/A',
          bankAccount: employeeData.bankAccount || 'N/A'
        },
        
        // Información del período
        period: {
          startDate: new Date(payrollData.periodStart).toLocaleDateString('es-MX'),
          endDate: new Date(payrollData.periodEnd).toLocaleDateString('es-MX'),
          frequency: this.getFrequencyText(payrollData.frequency),
          weekNumber: payrollData.weekNumber,
          year: payrollData.year,
          month: payrollData.month
        },
        
        // Detalles de nómina
        payroll: {
          id: payrollData.id,
          baseSalary: payrollData.baseSalary,
          calculatedSalary: payrollData.calculatedSalary,
          grossSalary: payrollData.grossSalary,
          totalPerceptions: payrollData.totalPerceptions,
          totalDeductions: payrollData.totalDeductions,
          netSalary: payrollData.netSalary,
          status: this.getStatusText(payrollData.status),
          generatedAt: new Date(payrollData.createdAt).toLocaleDateString('es-MX'),
          generatedTime: new Date(payrollData.createdAt).toLocaleTimeString('es-MX')
        },
        
        // Percepciones y deducciones
        perceptions: payrollData.perceptions || [],
        deductions: payrollData.deductions || [],
        
        // Información adicional
        generatedAt: new Date().toLocaleDateString('es-MX'),
        generatedTime: new Date().toLocaleTimeString('es-MX'),
        receiptNumber: `REC-${payrollData.id.substring(0, 8).toUpperCase()}`,
        
        // Espacios para firmas
        signatures: {
          employeeSignature: null,
          hrSignature: null,
          employeeName: employeeData.name,
          hrName: 'Recursos Humanos',
          employeeDate: new Date().toLocaleDateString('es-MX'),
          hrDate: new Date().toLocaleDateString('es-MX')
        }
      };

      // Generar HTML
      const html = await this.generateHTML('payroll-receipt', templateData);
      
      // Convertir a PDF
      const pdfBuffer = await this.htmlToPDF(html);
      
      // Guardar PDF en storage
      const fileName = `payroll-receipt-${payrollData.id}-${Date.now()}.pdf`;
      const pdfUrl = await this.savePDFToStorage(pdfBuffer, fileName, 'payroll-receipts');
      
      // Actualizar registro de nómina con URL del PDF
      await this.updatePayrollPDFUrl(payrollData.id, pdfUrl);
      
      logger.info('✅ PDF de recibo de nómina generado exitosamente', {
        payrollId: payrollData.id,
        employeeId: employeeData.id,
        pdfUrl: pdfUrl
      });

      return {
        success: true,
        pdfUrl: pdfUrl,
        fileName: fileName,
        size: pdfBuffer.length
      };

    } catch (error) {
      logger.error('❌ Error generando PDF de recibo de nómina', error);
      throw error;
    }
  }

  /**
   * Generar HTML desde template
   */
  async generateHTML(templateName, data) {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (error) {
      logger.error('❌ Error generando HTML desde template', error);
      throw error;
    }
  }

  /**
   * Convertir HTML a PDF
   */
  async htmlToPDF(html) {
    try {
      const page = await this.browser.newPage();
      
      // Configurar página
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Generar PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
            <span>Recibo de Nómina - Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
            <span>Generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX')}</span>
          </div>
        `
      });
      
      await page.close();
      return pdfBuffer;
      
    } catch (error) {
      logger.error('❌ Error convirtiendo HTML a PDF', error);
      throw error;
    }
  }

  /**
   * Guardar PDF en storage
   */
  async savePDFToStorage(pdfBuffer, fileName, folder = 'pdfs') {
    try {
      const filePath = `${folder}/${fileName}`;
      const file = storage.bucket().file(filePath);
      
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000'
        }
      });
      
      // Hacer el archivo público
      await file.makePublic();
      
      // Obtener URL pública
      const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;
      
      return publicUrl;
    } catch (error) {
      logger.error('❌ Error guardando PDF en storage', error);
      throw error;
    }
  }

  /**
   * Actualizar URL del PDF en registro de nómina
   */
  async updatePayrollPDFUrl(payrollId, pdfUrl) {
    try {
      const Payroll = require('../models/Payroll');
      const payroll = await Payroll.findById(payrollId);
      
      if (payroll) {
        payroll.pdfUrl = pdfUrl;
        payroll.updatedAt = new Date().toISOString();
        await payroll.save();
      }
    } catch (error) {
      logger.error('❌ Error actualizando URL del PDF en nómina', error);
      // No lanzar error para no interrumpir la generación del PDF
    }
  }

  /**
   * Obtener texto de frecuencia
   */
  getFrequencyText(frequency) {
    const frequencies = {
      'daily': 'Diario',
      'weekly': 'Semanal',
      'biweekly': 'Quincenal',
      'monthly': 'Mensual'
    };
    return frequencies[frequency] || frequency;
  }

  /**
   * Obtener texto de estado
   */
  getStatusText(status) {
    const statuses = {
      'calculated': 'Calculado',
      'approved': 'Aprobado',
      'paid': 'Pagado',
      'cancelled': 'Cancelado'
    };
    return statuses[status] || status;
  }

  /**
   * Generar PDF de reporte consolidado
   */
  async generateConsolidatedReport(reportData, companyData) {
    try {
      await this.initializeBrowser();
      
      const templateData = {
        company: companyData,
        report: reportData,
        generatedAt: new Date().toLocaleDateString('es-MX'),
        generatedTime: new Date().toLocaleTimeString('es-MX')
      };

      const html = await this.generateHTML('consolidated-report', templateData);
      const pdfBuffer = await this.htmlToPDF(html);
      
      const fileName = `consolidated-report-${Date.now()}.pdf`;
      const pdfUrl = await this.savePDFToStorage(pdfBuffer, fileName, 'reports');
      
      return {
        success: true,
        pdfUrl: pdfUrl,
        fileName: fileName,
        size: pdfBuffer.length
      };
      
    } catch (error) {
      logger.error('❌ Error generando reporte consolidado', error);
      throw error;
    }
  }

  /**
   * Limpiar archivos temporales
   */
  async cleanup() {
    try {
      await this.closeBrowser();
      logger.info('🧹 Limpieza de PDFService completada');
    } catch (error) {
      logger.error('❌ Error en limpieza de PDFService', error);
    }
  }
}

module.exports = new PDFService();
