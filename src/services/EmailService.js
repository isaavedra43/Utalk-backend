/**
 * 📧 SERVICIO DE ENVÍO DE EMAILS
 * 
 * Maneja el envío de correos electrónicos del sistema.
 * 
 * @version 1.0.0
 */

const logger = require('../utils/logger');

/**
 * NOTA: Este servicio está preparado para usar nodemailer u otro proveedor de emails.
 * Por ahora funciona como stub para logging, pero está listo para integración real.
 * 
 * Para activar el envío real de emails:
 * 1. Instalar: npm install nodemailer
 * 2. Configurar variables de entorno (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 3. Descomentar el código de nodemailer abajo
 */

class EmailService {
  constructor() {
    this.configured = false;
    
    // Verificar si hay configuración de email
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.configured = true;
      logger.info('EmailService configurado correctamente', {
        category: 'EMAIL_SERVICE_INIT'
      });
    } else {
      logger.warn('EmailService no configurado - funcionará en modo stub (solo logging)', {
        category: 'EMAIL_SERVICE_WARNING',
        message: 'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS para habilitar envío real'
      });
    }

    // DESCOMENTAR PARA ACTIVAR ENVÍO REAL:
    /*
    const nodemailer = require('nodemailer');
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    */
  }

  /**
   * Envía un email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      logger.info('Enviando email', {
        category: 'EMAIL_SEND',
        to,
        subject,
        hasAttachments: attachments.length > 0,
        attachmentsCount: attachments.length
      });

      // Validar parámetros
      if (!to) {
        throw new Error('El destinatario (to) es requerido');
      }
      if (!subject) {
        throw new Error('El asunto (subject) es requerido');
      }
      if (!html && !text) {
        throw new Error('Se requiere al menos html o text');
      }

      // MODO STUB: Solo logging (sin envío real)
      if (!this.configured) {
        logger.info('EMAIL STUB - Email no enviado (servicio no configurado)', {
          category: 'EMAIL_STUB',
          to,
          subject,
          htmlLength: html?.length || 0,
          textLength: text?.length || 0,
          attachments: attachments.map(a => ({
            filename: a.filename,
            size: a.content?.length || 0
          }))
        });

        return {
          success: true,
          messageId: `stub-${Date.now()}`,
          stub: true,
          message: 'Email no enviado - servicio en modo stub'
        };
      }

      // DESCOMENTAR PARA ACTIVAR ENVÍO REAL:
      /*
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text,
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email enviado exitosamente', {
        category: 'EMAIL_SENT',
        messageId: info.messageId,
        to,
        subject
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
      */

      // Mientras no esté configurado, retornar como si se enviara
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        stub: true
      };

    } catch (error) {
      logger.error('Error enviando email', {
        category: 'EMAIL_ERROR',
        error: error.message,
        to,
        subject
      });
      throw error;
    }
  }

  /**
   * Envía un email de orden de compra
   */
  async sendPurchaseOrderEmail({ to, subject, order, provider, message, pdfBuffer }) {
    try {
      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #2563eb;">Orden de Compra ${order.orderNumber}</h2>
            <p>Estimado/a ${provider.name},</p>
            <p>Adjunto encontrará la Orden de Compra ${order.orderNumber}.</p>
            ${message ? `<p>${message}</p>` : ''}
            <h3>Detalles de la orden:</h3>
            <ul>
              <li><strong>Número:</strong> ${order.orderNumber}</li>
              <li><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleDateString('es-MX')}</li>
              <li><strong>Total:</strong> ${this.formatCurrency(order.total)}</li>
              ${order.expectedDeliveryDate ? `<li><strong>Fecha de entrega esperada:</strong> ${new Date(order.expectedDeliveryDate).toLocaleDateString('es-MX')}</li>` : ''}
            </ul>
            <p>Saludos cordiales.</p>
          </body>
        </html>
      `;

      const attachments = pdfBuffer ? [{
        filename: `Orden_${order.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }] : [];

      return await this.sendEmail({
        to,
        subject: subject || `Orden de Compra ${order.orderNumber}`,
        html: emailHtml,
        attachments
      });
    } catch (error) {
      logger.error('Error enviando email de orden de compra', {
        category: 'EMAIL_ERROR',
        orderNumber: order.orderNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Formatea moneda
   */
  formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }
}

module.exports = new EmailService();

