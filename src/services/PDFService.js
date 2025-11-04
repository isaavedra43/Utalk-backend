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
        employeeId: payrollData.employeeId,
        hasPerceptions: payrollData.perceptions?.length > 0,
        hasDeductions: payrollData.deductions?.length > 0
      });

      // Validar datos requeridos
      if (!payrollData || !employeeData || !companyData) {
        throw new Error('Datos requeridos faltantes para generar PDF');
      }

      logger.info('🔧 Creando documento PDF...');
      // Crear el documento
      const PayrollDocument = this.createPayrollDocument(payrollData, employeeData, companyData);
      
      logger.info('📄 Generando buffer del PDF...');
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

  /**
   * Genera PDF de orden de compra
   */
  async generatePurchaseOrderPDF(order, provider) {
    try {
      logger.info('Generando PDF de orden de compra', {
        orderId: order.id,
        orderNumber: order.orderNumber
      });

      // Estilos para el PDF de orden de compra
      const styles = StyleSheet.create({
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
        title: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#1f2937'
        },
        subtitle: {
          fontSize: 12,
          color: '#6b7280',
          marginTop: 5
        },
        section: {
          marginBottom: 15
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: 8
        },
        infoRow: {
          flexDirection: 'row',
          fontSize: 10,
          marginBottom: 4
        },
        label: {
          fontWeight: 'bold',
          width: 120,
          color: '#374151'
        },
        value: {
          color: '#111827'
        },
        table: {
          marginTop: 10
        },
        tableHeader: {
          flexDirection: 'row',
          backgroundColor: '#f3f4f6',
          padding: 8,
          fontSize: 10,
          fontWeight: 'bold'
        },
        tableRow: {
          flexDirection: 'row',
          borderBottom: 1,
          borderBottomColor: '#e5e7eb',
          padding: 8,
          fontSize: 9
        },
        col1: { width: '5%' },
        col2: { width: '35%' },
        col3: { width: '15%', textAlign: 'right' },
        col4: { width: '15%', textAlign: 'right' },
        col5: { width: '15%', textAlign: 'right' },
        col6: { width: '15%', textAlign: 'right' },
        totalsSection: {
          marginTop: 15,
          alignItems: 'flex-end'
        },
        totalRow: {
          flexDirection: 'row',
          marginBottom: 5,
          fontSize: 11
        },
        totalLabel: {
          width: 150,
          textAlign: 'right',
          marginRight: 20
        },
        totalValue: {
          width: 100,
          textAlign: 'right'
        },
        grandTotal: {
          fontSize: 14,
          fontWeight: 'bold'
        },
        footer: {
          position: 'absolute',
          bottom: 30,
          left: 30,
          right: 30,
          fontSize: 8,
          color: '#6b7280',
          textAlign: 'center'
        }
      });

      // Componente PDF
      const PurchaseOrderDocument = () => (
        React.createElement(Document, null,
          React.createElement(Page, { size: 'LETTER', style: styles.page },
            // Header
            React.createElement(View, { style: styles.header },
              React.createElement(View, null,
                React.createElement(Text, { style: styles.title }, 'ORDEN DE COMPRA'),
                React.createElement(Text, { style: styles.subtitle }, order.orderNumber)
              ),
              React.createElement(View, { style: { alignItems: 'flex-end' } },
                React.createElement(Text, { style: { fontSize: 10, marginBottom: 3 } }, 
                  `Fecha: ${new Date(order.createdAt).toLocaleDateString('es-MX')}`
                ),
                React.createElement(Text, { style: { fontSize: 10, color: '#2563eb' } }, 
                  `Estado: ${order.status.toUpperCase()}`
                )
              )
            ),

            // Información del proveedor
            React.createElement(View, { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, 'Proveedor'),
              React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Nombre:'),
                React.createElement(Text, { style: styles.value }, provider.name)
              ),
              provider.contact && React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Contacto:'),
                React.createElement(Text, { style: styles.value }, provider.contact)
              ),
              provider.phone && React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Teléfono:'),
                React.createElement(Text, { style: styles.value }, provider.phone)
              ),
              provider.email && React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Email:'),
                React.createElement(Text, { style: styles.value }, provider.email)
              ),
              provider.address && React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Dirección:'),
                React.createElement(Text, { style: styles.value }, provider.address)
              )
            ),

            // Información de entrega
            order.expectedDeliveryDate && React.createElement(View, { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, 'Entrega'),
              React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Fecha esperada:'),
                React.createElement(Text, { style: styles.value }, 
                  new Date(order.expectedDeliveryDate).toLocaleDateString('es-MX')
                )
              ),
              order.deliveryAddress && React.createElement(View, { style: styles.infoRow },
                React.createElement(Text, { style: styles.label }, 'Dirección:'),
                React.createElement(Text, { style: styles.value }, order.deliveryAddress)
              )
            ),

            // Tabla de items
            React.createElement(View, { style: styles.table },
              React.createElement(Text, { style: styles.sectionTitle }, 'Artículos'),
              
              // Header de tabla
              React.createElement(View, { style: styles.tableHeader },
                React.createElement(Text, { style: styles.col1 }, '#'),
                React.createElement(Text, { style: styles.col2 }, 'Descripción'),
                React.createElement(Text, { style: styles.col3 }, 'Cantidad'),
                React.createElement(Text, { style: styles.col4 }, 'Unidad'),
                React.createElement(Text, { style: styles.col5 }, 'P. Unit.'),
                React.createElement(Text, { style: styles.col6 }, 'Subtotal')
              ),

              // Rows
              ...order.items.map((item, index) =>
                React.createElement(View, { key: item.id, style: styles.tableRow },
                  React.createElement(Text, { style: styles.col1 }, String(index + 1)),
                  React.createElement(Text, { style: styles.col2 }, item.materialName),
                  React.createElement(Text, { style: styles.col3 }, String(item.quantity)),
                  React.createElement(Text, { style: styles.col4 }, item.unit),
                  React.createElement(Text, { style: styles.col5 }, this.formatCurrency(item.unitPrice)),
                  React.createElement(Text, { style: styles.col6 }, this.formatCurrency(item.subtotal))
                )
              )
            ),

            // Totales
            React.createElement(View, { style: styles.totalsSection },
              React.createElement(View, { style: styles.totalRow },
                React.createElement(Text, { style: styles.totalLabel }, 'Subtotal:'),
                React.createElement(Text, { style: styles.totalValue }, this.formatCurrency(order.subtotal))
              ),
              order.discount > 0 && React.createElement(View, { style: styles.totalRow },
                React.createElement(Text, { style: styles.totalLabel }, 
                  `Descuento (${order.discountType === 'percentage' ? order.discount + '%' : 'Fijo'}):`
                ),
                React.createElement(Text, { style: styles.totalValue }, 
                  '-' + this.formatCurrency(
                    order.discountType === 'percentage' 
                      ? order.subtotal * (order.discount / 100)
                      : order.discount
                  )
                )
              ),
              React.createElement(View, { style: styles.totalRow },
                React.createElement(Text, { style: styles.totalLabel }, 'IVA:'),
                React.createElement(Text, { style: styles.totalValue }, this.formatCurrency(order.tax))
              ),
              React.createElement(View, { style: [styles.totalRow, styles.grandTotal] },
                React.createElement(Text, { style: styles.totalLabel }, 'TOTAL:'),
                React.createElement(Text, { style: styles.totalValue }, this.formatCurrency(order.total))
              )
            ),

            // Notas
            order.notes && React.createElement(View, { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, 'Notas'),
              React.createElement(Text, { style: { fontSize: 10 } }, order.notes)
            ),

            // Footer
            React.createElement(View, { style: styles.footer },
              React.createElement(Text, null, 
                `Documento generado el ${new Date().toLocaleDateString('es-MX')} - Orden ${order.orderNumber}`
              )
            )
          )
        )
      );

      // Generar PDF
      const pdfDoc = pdf(React.createElement(PurchaseOrderDocument));
      const pdfBuffer = await pdfDoc.toBuffer();

      logger.info('PDF de orden de compra generado exitosamente', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        bufferSize: pdfBuffer.length
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Error generando PDF de orden de compra', {
        orderId: order?.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = new PDFService();