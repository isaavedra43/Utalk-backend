const React = require('react');
const { Document, Page, Text, View, StyleSheet, pdf, Font } = require('@react-pdf/renderer');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Servicio de generación de PDFs usando @react-pdf/renderer
 * Reemplaza Puppeteer para compatibilidad con Railway
 */
class PDFService {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'utalk-attachments';
  }

  /**
   * Estilos para el PDF de nómina
   */
  getPayrollStyles() {
    return StyleSheet.create({
      page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 30,
        fontFamily: 'Helvetica'
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottom: 2,
        borderBottomColor: '#2563eb',
        paddingBottom: 10
      },
      companyInfo: {
        flex: 1
      },
      companyName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 5
      },
      companyDetails: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 2
      },
      receiptTitle: {
        flex: 1,
        alignItems: 'flex-end'
      },
      receiptTitleText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#dc2626',
        marginBottom: 5
      },
      periodInfo: {
        fontSize: 12,
        color: '#374151'
      },
      section: {
        marginBottom: 15
      },
      sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
        borderBottom: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 3
      },
      employeeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap'
      },
      employeeItem: {
        width: '50%',
        fontSize: 10,
        marginBottom: 4,
        flexDirection: 'row'
      },
      employeeLabel: {
        fontWeight: 'bold',
        width: 80,
        color: '#374151'
      },
      employeeValue: {
        color: '#111827'
      },
      summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        backgroundColor: '#f9fafb',
        padding: 15,
        borderRadius: 8
      },
      summaryBox: {
        alignItems: 'center',
        flex: 1
      },
      summaryLabel: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 3
      },
      summaryValue: {
        fontSize: 16,
        fontWeight: 'bold'
      },
      grossValue: {
        color: '#059669'
      },
      deductionValue: {
        color: '#dc2626'
      },
      netValue: {
        color: '#1d4ed8'
      },
      detailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20
      },
      detailsColumn: {
        flex: 1,
        marginHorizontal: 5
      },
      detailsHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
        textAlign: 'center',
        backgroundColor: '#f3f4f6',
        padding: 8,
        borderRadius: 4
      },
      perceptionsHeader: {
        backgroundColor: '#d1fae5',
        color: '#065f46'
      },
      deductionsHeader: {
        backgroundColor: '#fee2e2',
        color: '#991b1b'
      },
      detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottom: 1,
        borderBottomColor: '#f3f4f6'
      },
      detailConcept: {
        fontSize: 10,
        color: '#374151',
        flex: 1
      },
      detailAmount: {
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'right'
      },
      perceptionAmount: {
        color: '#059669'
      },
      deductionAmount: {
        color: '#dc2626'
      },
      noItems: {
        textAlign: 'center',
        fontSize: 10,
        color: '#9ca3af',
        fontStyle: 'italic',
        paddingVertical: 10
      },
      signatureSection: {
        marginTop: 30,
        flexDirection: 'row',
        justifyContent: 'space-between'
      },
      signatureBox: {
        width: '45%',
        alignItems: 'center'
      },
      signatureLine: {
        width: '100%',
        borderBottom: 1,
        borderBottomColor: '#374151',
        marginBottom: 5,
        height: 40
      },
      signatureLabel: {
        fontSize: 10,
        color: '#6b7280',
        textAlign: 'center'
      },
      footer: {
        marginTop: 20,
        paddingTop: 10,
        borderTop: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center'
      },
      footerText: {
        fontSize: 8,
        color: '#9ca3af',
        textAlign: 'center'
      }
    });
  }

  /**
   * Componente del PDF de nómina
   */
  createPayrollDocument(payrollData, employeeData, companyData) {
    const styles = this.getPayrollStyles();

    const PayrollDocument = () => (
      React.createElement(Document, {},
        React.createElement(Page, { size: 'A4', style: styles.page },
          // Header
          React.createElement(View, { style: styles.header },
            React.createElement(View, { style: styles.companyInfo },
              React.createElement(Text, { style: styles.companyName }, companyData.name || 'UTalk'),
              React.createElement(Text, { style: styles.companyDetails }, companyData.address || 'Dirección de la empresa'),
              React.createElement(Text, { style: styles.companyDetails }, `Tel: ${companyData.phone || 'Teléfono'} | Email: ${companyData.email || 'email@empresa.com'}`),
              React.createElement(Text, { style: styles.companyDetails }, `RFC: ${companyData.rfc || 'RFC123456789'}`)
            ),
            React.createElement(View, { style: styles.receiptTitle },
              React.createElement(Text, { style: styles.receiptTitleText }, 'RECIBO DE NÓMINA'),
              React.createElement(Text, { style: styles.periodInfo }, `Período: ${this.formatDate(payrollData.periodStart)} - ${this.formatDate(payrollData.periodEnd)}`),
              React.createElement(Text, { style: styles.periodInfo }, `Frecuencia: ${this.getFrequencyText(payrollData.frequency)}`)
            )
          ),

          // Employee Details
          React.createElement(View, { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Datos del Empleado'),
            React.createElement(View, { style: styles.employeeGrid },
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'Nombre:'),
                React.createElement(Text, { style: styles.employeeValue }, `${employeeData.personalInfo?.firstName || ''} ${employeeData.personalInfo?.lastName || ''}`)
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'ID Empleado:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.employeeNumber || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'Puesto:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.position?.title || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'Departamento:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.position?.department || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'RFC:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.personalInfo?.rfc || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'CURP:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.personalInfo?.curp || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'NSS:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.personalInfo?.nss || 'N/A')
              ),
              React.createElement(View, { style: styles.employeeItem },
                React.createElement(Text, { style: styles.employeeLabel }, 'Cuenta:'),
                React.createElement(Text, { style: styles.employeeValue }, employeeData.personalInfo?.bankInfo?.accountNumber || 'N/A')
              )
            )
          ),

          // Summary
          React.createElement(View, { style: styles.summaryContainer },
            React.createElement(View, { style: styles.summaryBox },
              React.createElement(Text, { style: styles.summaryLabel }, 'SALARIO BRUTO'),
              React.createElement(Text, { style: [styles.summaryValue, styles.grossValue] }, this.formatCurrency(payrollData.grossSalary))
            ),
            React.createElement(View, { style: styles.summaryBox },
              React.createElement(Text, { style: styles.summaryLabel }, 'DEDUCCIONES'),
              React.createElement(Text, { style: [styles.summaryValue, styles.deductionValue] }, this.formatCurrency(payrollData.totalDeductions))
            ),
            React.createElement(View, { style: styles.summaryBox },
              React.createElement(Text, { style: styles.summaryLabel }, 'SALARIO NETO'),
              React.createElement(Text, { style: [styles.summaryValue, styles.netValue] }, this.formatCurrency(payrollData.netSalary))
            )
          ),

          // Details
          React.createElement(View, { style: styles.detailsContainer },
            // Percepciones
            React.createElement(View, { style: styles.detailsColumn },
              React.createElement(Text, { style: [styles.detailsHeader, styles.perceptionsHeader] }, '💰 PERCEPCIONES'),
              payrollData.perceptions && payrollData.perceptions.length > 0 
                ? payrollData.perceptions.map((perception, index) =>
                    React.createElement(View, { key: index, style: styles.detailItem },
                      React.createElement(Text, { style: styles.detailConcept }, perception.concept),
                      React.createElement(Text, { style: [styles.detailAmount, styles.perceptionAmount] }, `+${this.formatCurrency(perception.amount)}`)
                    )
                  )
                : React.createElement(Text, { style: styles.noItems }, 'No hay percepciones adicionales')
            ),
            
            // Deducciones
            React.createElement(View, { style: styles.detailsColumn },
              React.createElement(Text, { style: [styles.detailsHeader, styles.deductionsHeader] }, '📉 DEDUCCIONES'),
              payrollData.deductions && payrollData.deductions.length > 0
                ? payrollData.deductions.map((deduction, index) =>
                    React.createElement(View, { key: index, style: styles.detailItem },
                      React.createElement(Text, { style: styles.detailConcept }, deduction.concept),
                      React.createElement(Text, { style: [styles.detailAmount, styles.deductionAmount] }, `-${this.formatCurrency(deduction.amount)}`)
                    )
                  )
                : React.createElement(Text, { style: styles.noItems }, 'No hay deducciones registradas')
            )
          ),

          // Signatures
          React.createElement(View, { style: styles.signatureSection },
            React.createElement(View, { style: styles.signatureBox },
              React.createElement(View, { style: styles.signatureLine }),
              React.createElement(Text, { style: styles.signatureLabel }, 'Firma del Empleado')
            ),
            React.createElement(View, { style: styles.signatureBox },
              React.createElement(View, { style: styles.signatureLine }),
              React.createElement(Text, { style: styles.signatureLabel }, 'Firma de Conformidad')
            )
          ),

          // Footer
          React.createElement(View, { style: styles.footer },
            React.createElement(Text, { style: styles.footerText }, `Generado el ${this.formatDate(new Date())} | UTalk - Sistema de Gestión de Nómina`),
            React.createElement(Text, { style: styles.footerText }, 'Este documento es válido como comprobante de pago')
          )
        )
      )
    );

    return PayrollDocument;
  }

  /**
   * Generar PDF de recibo de nómina
   */
  async generatePayrollReceipt(payrollData, employeeData, companyData) {
    try {
      logger.info('🎨 Generando PDF con @react-pdf/renderer', {
        payrollId: payrollData.id,
        employeeId: payrollData.employeeId
      });

      // Crear el documento
      const PayrollDocument = this.createPayrollDocument(payrollData, employeeData, companyData);
      
      // Generar el PDF
      const pdfBuffer = await pdf(React.createElement(PayrollDocument)).toBuffer();
      
      // Generar nombre del archivo
      const fileName = `recibo-nomina-${payrollData.employeeId}-${payrollData.periodStart}-${payrollData.periodEnd}.pdf`;
      
      logger.info('✅ PDF generado exitosamente', {
        fileName,
        fileSize: pdfBuffer.length
      });

      // DEVOLVER PDF DIRECTAMENTE SIN SUBIR A STORAGE
      return {
        success: true,
        pdfBuffer: pdfBuffer,
        fileName: fileName,
        size: pdfBuffer.length,
        contentType: 'application/pdf'
      };

    } catch (error) {
      logger.error('❌ Error generando PDF de nómina', error);
      throw error;
    }
  }

  /**
   * Subir PDF a Google Cloud Storage
   */
  async uploadPdfToStorage(buffer, fileName, contentType = 'application/pdf') {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(`payroll-receipts/${fileName}`);
      
      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            generatedAt: new Date().toISOString(),
            service: 'utalk-payroll'
          }
        }
      });

      // Hacer el archivo público
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/payroll-receipts/${fileName}`;
      
      logger.info('📤 PDF subido a Google Cloud Storage', {
        fileName,
        publicUrl,
        size: buffer.length
      });

      return publicUrl;
    } catch (error) {
      logger.error('❌ Error subiendo PDF a storage', error);
      throw error;
    }
  }

  /**
   * Formatear fecha
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatear moneda
   */
  formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  /**
   * Obtener texto de frecuencia
   */
  getFrequencyText(frequency) {
    const frequencies = {
      daily: 'Diaria',
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual'
    };
    return frequencies[frequency] || frequency;
  }
}

module.exports = new PDFService();