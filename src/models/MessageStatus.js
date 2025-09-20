const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { logger } = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');

/**
 * 📊 MODELO DE STATUS DE MENSAJES TWILIO
 * 
 * Maneja el tracking completo del status de mensajes:
 * - Historial de estados por mensaje
 * - Timestamps de cada cambio
 * - Metadatos de Twilio (precio, país, canal, etc.)
 * - Información de contacto (foto de perfil, etc.)
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class MessageStatus {
  constructor(data) {
    this.id = data.id || `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.messageId = data.messageId; // ID del mensaje
    this.twilioSid = data.twilioSid; // SID de Twilio
    this.status = data.status; // queued, sent, delivered, read, undelivered, failed
    this.timestamp = data.timestamp || Timestamp.now();
    this.previousStatus = data.previousStatus || null;
    this.metadata = data.metadata || {};
    this.contactInfo = data.contactInfo || {};
    this.createdAt = data.createdAt || Timestamp.now();
  }

  /**
   * Crear nuevo status de mensaje
   */
  static async create(statusData) {
    const messageStatus = new MessageStatus(statusData);

    const cleanData = prepareForFirestore({
      ...messageStatus,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Guardar en la colección de status
    await firestore
      .collection('message_statuses')
      .doc(messageStatus.id)
      .set(cleanData);

    // Actualizar el mensaje principal con el último status
    await this.updateMessageStatus(messageStatus.messageId, messageStatus);

    logger.info('📊 Status de mensaje guardado', {
      messageId: messageStatus.messageId,
      twilioSid: messageStatus.twilioSid,
      status: messageStatus.status,
      timestamp: messageStatus.timestamp
    });

    return messageStatus;
  }

  /**
   * Actualizar status del mensaje principal
   */
  static async updateMessageStatus(messageId, statusData) {
    try {
      // 🗑️ OBSOLETO: No usar colección conversations antigua
      logger.warn('🗑️ OBSOLETO: Búsqueda en colección conversations antigua eliminada');
      throw new Error('Búsqueda en colección conversations antigua ELIMINADA - usar estructura contacts/{contactId}/conversations');
      
      for (const convDoc of conversationsSnapshot.docs) {
        const messageRef = convDoc.ref.collection('messages').doc(messageId);
        const messageDoc = await messageRef.get();
        
        if (messageDoc.exists) {
          await messageRef.update({
            status: statusData.status,
            lastStatusUpdate: statusData.timestamp,
            statusHistory: FieldValue.arrayUnion({
              status: statusData.status,
              timestamp: statusData.timestamp,
              metadata: statusData.metadata
            }),
            updatedAt: FieldValue.serverTimestamp()
          });

          logger.info('📊 Mensaje actualizado con nuevo status', {
            messageId,
            conversationId: convDoc.id,
            status: statusData.status
          });

          return true;
        }
      }

      logger.warn('⚠️ Mensaje no encontrado para actualizar status', { messageId });
      return false;

    } catch (error) {
      logger.error('Error actualizando status del mensaje', {
        messageId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Obtener historial de status de un mensaje
   */
  static async getStatusHistory(messageId) {
    try {
      const snapshot = await firestore
        .collection('message_statuses')
        .where('messageId', '==', messageId)
        .orderBy('timestamp', 'desc')
        .get();

      return snapshot.docs.map(doc => new MessageStatus({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error obteniendo historial de status', {
        messageId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Obtener último status de un mensaje
   */
  static async getLastStatus(messageId) {
    try {
      const snapshot = await firestore
        .collection('message_statuses')
        .where('messageId', '==', messageId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return new MessageStatus({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (error) {
      logger.error('Error obteniendo último status', {
        messageId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Procesar webhook de status de Twilio
   */
  static async processStatusWebhook(webhookData) {
    try {
      const {
        MessageSid: twilioSid,
        MessageStatus: status,
        ErrorCode: errorCode,
        ErrorMessage: errorMessage,
        To: to,
        From: from,
        AccountSid: accountSid,
        ApiVersion: apiVersion,
        Price: price,
        PriceUnit: priceUnit,
        NumSegments: numSegments,
        NumMedia: numMedia,
        MediaUrl0: mediaUrl,
        ProfileName: profileName,
        WaId: waId,
        SmsStatus: smsStatus,
        SmsSid: smsSid,
        SmsMessageSid: smsMessageSid,
        Body: body,
        NumSegments: numSegmentsSms,
        ReferralNumMedia: referralNumMedia,
        ReferralNumSegments: referralNumSegments,
        ReferralIntegrationError: referralIntegrationError,
        ReferralTo: referralTo,
        ReferralFrom: referralFrom,
        ReferralMediaUrl: referralMediaUrl,
        ReferralMediaContentType: referralMediaContentType,
        ReferralMediaSize: referralMediaSize,
        ReferralMediaSid: referralMediaSid,
        ReferralMediaUrl0: referralMediaUrl0,
        ReferralMediaUrl1: referralMediaUrl1,
        ReferralMediaUrl2: referralMediaUrl2,
        ReferralMediaUrl3: referralMediaUrl3,
        ReferralMediaUrl4: referralMediaUrl4,
        ReferralMediaUrl5: referralMediaUrl5,
        ReferralMediaUrl6: referralMediaUrl6,
        ReferralMediaUrl7: referralMediaUrl7,
        ReferralMediaUrl8: referralMediaUrl8,
        ReferralMediaUrl9: referralMediaUrl9,
        ReferralMediaUrl10: referralMediaUrl10,
        ReferralMediaUrl11: referralMediaUrl11,
        ReferralMediaUrl12: referralMediaUrl12,
        ReferralMediaUrl13: referralMediaUrl13,
        ReferralMediaUrl14: referralMediaUrl14,
        ReferralMediaUrl15: referralMediaUrl15,
        ReferralMediaUrl16: referralMediaUrl16,
        ReferralMediaUrl17: referralMediaUrl17,
        ReferralMediaUrl18: referralMediaUrl18,
        ReferralMediaUrl19: referralMediaUrl19,
        ReferralMediaUrl20: referralMediaUrl20,
        ReferralMediaUrl21: referralMediaUrl21,
        ReferralMediaUrl22: referralMediaUrl22,
        ReferralMediaUrl23: referralMediaUrl23,
        ReferralMediaUrl24: referralMediaUrl24,
        ReferralMediaUrl25: referralMediaUrl25,
        ReferralMediaUrl26: referralMediaUrl26,
        ReferralMediaUrl27: referralMediaUrl27,
        ReferralMediaUrl28: referralMediaUrl28,
        ReferralMediaUrl29: referralMediaUrl29,
        ReferralMediaUrl30: referralMediaUrl30,
        ReferralMediaUrl31: referralMediaUrl31,
        ReferralMediaUrl32: referralMediaUrl32,
        ReferralMediaUrl33: referralMediaUrl33,
        ReferralMediaUrl34: referralMediaUrl34,
        ReferralMediaUrl35: referralMediaUrl35,
        ReferralMediaUrl36: referralMediaUrl36,
        ReferralMediaUrl37: referralMediaUrl37,
        ReferralMediaUrl38: referralMediaUrl38,
        ReferralMediaUrl39: referralMediaUrl39,
        ReferralMediaUrl40: referralMediaUrl40,
        ReferralMediaUrl41: referralMediaUrl41,
        ReferralMediaUrl42: referralMediaUrl42,
        ReferralMediaUrl43: referralMediaUrl43,
        ReferralMediaUrl44: referralMediaUrl44,
        ReferralMediaUrl45: referralMediaUrl45,
        ReferralMediaUrl46: referralMediaUrl46,
        ReferralMediaUrl47: referralMediaUrl47,
        ReferralMediaUrl48: referralMediaUrl48,
        ReferralMediaUrl49: referralMediaUrl49,
        ReferralMediaUrl50: referralMediaUrl50,
        ReferralMediaUrl51: referralMediaUrl51,
        ReferralMediaUrl52: referralMediaUrl52,
        ReferralMediaUrl53: referralMediaUrl53,
        ReferralMediaUrl54: referralMediaUrl54,
        ReferralMediaUrl55: referralMediaUrl55,
        ReferralMediaUrl56: referralMediaUrl56,
        ReferralMediaUrl57: referralMediaUrl57,
        ReferralMediaUrl58: referralMediaUrl58,
        ReferralMediaUrl59: referralMediaUrl59,
        ReferralMediaUrl60: referralMediaUrl60,
        ReferralMediaUrl61: referralMediaUrl61,
        ReferralMediaUrl62: referralMediaUrl62,
        ReferralMediaUrl63: referralMediaUrl63,
        ReferralMediaUrl64: referralMediaUrl64,
        ReferralMediaUrl65: referralMediaUrl65,
        ReferralMediaUrl66: referralMediaUrl66,
        ReferralMediaUrl67: referralMediaUrl67,
        ReferralMediaUrl68: referralMediaUrl68,
        ReferralMediaUrl69: referralMediaUrl69,
        ReferralMediaUrl70: referralMediaUrl70,
        ReferralMediaUrl71: referralMediaUrl71,
        ReferralMediaUrl72: referralMediaUrl72,
        ReferralMediaUrl73: referralMediaUrl73,
        ReferralMediaUrl74: referralMediaUrl74,
        ReferralMediaUrl75: referralMediaUrl75,
        ReferralMediaUrl76: referralMediaUrl76,
        ReferralMediaUrl77: referralMediaUrl77,
        ReferralMediaUrl78: referralMediaUrl78,
        ReferralMediaUrl79: referralMediaUrl79,
        ReferralMediaUrl80: referralMediaUrl80,
        ReferralMediaUrl81: referralMediaUrl81,
        ReferralMediaUrl82: referralMediaUrl82,
        ReferralMediaUrl83: referralMediaUrl83,
        ReferralMediaUrl84: referralMediaUrl84,
        ReferralMediaUrl85: referralMediaUrl85,
        ReferralMediaUrl86: referralMediaUrl86,
        ReferralMediaUrl87: referralMediaUrl87,
        ReferralMediaUrl88: referralMediaUrl88,
        ReferralMediaUrl89: referralMediaUrl89,
        ReferralMediaUrl90: referralMediaUrl90,
        ReferralMediaUrl91: referralMediaUrl91,
        ReferralMediaUrl92: referralMediaUrl92,
        ReferralMediaUrl93: referralMediaUrl93,
        ReferralMediaUrl94: referralMediaUrl94,
        ReferralMediaUrl95: referralMediaUrl95,
        ReferralMediaUrl96: referralMediaUrl96,
        ReferralMediaUrl97: referralMediaUrl97,
        ReferralMediaUrl98: referralMediaUrl98,
        ReferralMediaUrl99: referralMediaUrl99
      } = webhookData;

      logger.info('📊 Procesando webhook de status de Twilio', {
        twilioSid,
        status,
        errorCode,
        errorMessage,
        to,
        from,
        profileName,
        waId
      });

      // Buscar el mensaje por Twilio SID
      const messageId = await this.findMessageByTwilioSid(twilioSid);
      
      if (!messageId) {
        logger.warn('⚠️ Mensaje no encontrado para status', { twilioSid });
        return null;
      }

      // Obtener status anterior
      const previousStatus = await this.getLastStatus(messageId);
      const previousStatusValue = previousStatus ? previousStatus.status : null;

      // Preparar metadatos completos
      const metadata = {
        twilio: {
          accountSid,
          apiVersion,
          price: parseFloat(price) || null,
          priceUnit,
          numSegments: parseInt(numSegments) || null,
          numMedia: parseInt(numMedia) || null,
          errorCode,
          errorMessage,
          smsStatus,
          smsSid,
          smsMessageSid,
          body,
          numSegmentsSms: parseInt(numSegmentsSms) || null,
          referralNumMedia: parseInt(referralNumMedia) || null,
          referralNumSegments: parseInt(referralNumSegments) || null,
          referralIntegrationError,
          referralTo,
          referralFrom,
          referralMediaUrl,
          referralMediaContentType,
          referralMediaSize: parseInt(referralMediaSize) || null,
          referralMediaSid,
          // Incluir todos los media URLs de referral
          referralMediaUrls: [
            referralMediaUrl0, referralMediaUrl1, referralMediaUrl2, referralMediaUrl3, referralMediaUrl4,
            referralMediaUrl5, referralMediaUrl6, referralMediaUrl7, referralMediaUrl8, referralMediaUrl9,
            referralMediaUrl10, referralMediaUrl11, referralMediaUrl12, referralMediaUrl13, referralMediaUrl14,
            referralMediaUrl15, referralMediaUrl16, referralMediaUrl17, referralMediaUrl18, referralMediaUrl19,
            referralMediaUrl20, referralMediaUrl21, referralMediaUrl22, referralMediaUrl23, referralMediaUrl24,
            referralMediaUrl25, referralMediaUrl26, referralMediaUrl27, referralMediaUrl28, referralMediaUrl29,
            referralMediaUrl30, referralMediaUrl31, referralMediaUrl32, referralMediaUrl33, referralMediaUrl34,
            referralMediaUrl35, referralMediaUrl36, referralMediaUrl37, referralMediaUrl38, referralMediaUrl39,
            referralMediaUrl40, referralMediaUrl41, referralMediaUrl42, referralMediaUrl43, referralMediaUrl44,
            referralMediaUrl45, referralMediaUrl46, referralMediaUrl47, referralMediaUrl48, referralMediaUrl49,
            referralMediaUrl50, referralMediaUrl51, referralMediaUrl52, referralMediaUrl53, referralMediaUrl54,
            referralMediaUrl55, referralMediaUrl56, referralMediaUrl57, referralMediaUrl58, referralMediaUrl59,
            referralMediaUrl60, referralMediaUrl61, referralMediaUrl62, referralMediaUrl63, referralMediaUrl64,
            referralMediaUrl65, referralMediaUrl66, referralMediaUrl67, referralMediaUrl68, referralMediaUrl69,
            referralMediaUrl70, referralMediaUrl71, referralMediaUrl72, referralMediaUrl73, referralMediaUrl74,
            referralMediaUrl75, referralMediaUrl76, referralMediaUrl77, referralMediaUrl78, referralMediaUrl79,
            referralMediaUrl80, referralMediaUrl81, referralMediaUrl82, referralMediaUrl83, referralMediaUrl84,
            referralMediaUrl85, referralMediaUrl86, referralMediaUrl87, referralMediaUrl88, referralMediaUrl89,
            referralMediaUrl90, referralMediaUrl91, referralMediaUrl92, referralMediaUrl93, referralMediaUrl94,
            referralMediaUrl95, referralMediaUrl96, referralMediaUrl97, referralMediaUrl98, referralMediaUrl99
          ].filter(url => url) // Filtrar URLs vacías
        },
        webhook: {
          receivedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          rawData: webhookData
        }
      };

      // Preparar información de contacto
      const contactInfo = {
        profileName: profileName || null,
        waId: waId || null,
        to,
        from,
        hasProfileName: !!profileName,
        hasWaId: !!waId
      };

      // Crear nuevo status
      const statusData = {
        messageId,
        twilioSid,
        status,
        previousStatus: previousStatusValue,
        metadata,
        contactInfo,
        timestamp: Timestamp.now()
      };

      const messageStatus = await this.create(statusData);

      // Actualizar contacto si hay información nueva
      if (profileName || waId) {
        await this.updateContactInfo(to, from, contactInfo);
      }

      logger.info('✅ Status de mensaje procesado exitosamente', {
        messageId,
        twilioSid,
        status,
        previousStatus: previousStatusValue,
        hasContactInfo: !!(profileName || waId)
      });

      return messageStatus;

    } catch (error) {
      logger.error('❌ Error procesando webhook de status', {
        error: error.message,
        webhookData: {
          MessageSid: webhookData.MessageSid,
          MessageStatus: webhookData.MessageStatus,
          ErrorCode: webhookData.ErrorCode
        }
      });
      throw error;
    }
  }

  /**
   * Buscar mensaje por Twilio SID
   */
  static async findMessageByTwilioSid(twilioSid) {
    try {
      // 🗑️ OBSOLETO: No usar colección conversations antigua
      logger.warn('🗑️ OBSOLETO: findMessageByTwilioSid en colección conversations antigua eliminado');
      throw new Error('findMessageByTwilioSid en colección conversations antigua ELIMINADO - usar ConversationsRepository');
      
      for (const convDoc of conversationsSnapshot.docs) {
        const messagesQuery = convDoc.ref
          .collection('messages')
          .where('metadata.twilioSid', '==', twilioSid)
          .limit(1);
        
        const messagesSnapshot = await messagesQuery.get();
        
        if (!messagesSnapshot.empty) {
          return messagesSnapshot.docs[0].id;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error buscando mensaje por Twilio SID', {
        twilioSid,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Actualizar información de contacto
   */
  static async updateContactInfo(to, from, contactInfo) {
    try {
      // Buscar contacto por número de teléfono
      const phoneNumber = to || from;
      if (!phoneNumber) return;

      // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
      const normalizedPhone = phoneNumber.startsWith('whatsapp:') 
        ? phoneNumber 
        : `whatsapp:${phoneNumber}`;

      const contactsSnapshot = await firestore
        .collection('contacts')
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!contactsSnapshot.empty) {
        const contactRef = contactsSnapshot.docs[0].ref;
        const updates = {};

        if (contactInfo.profileName) {
          updates.name = contactInfo.profileName;
        }

        if (contactInfo.waId) {
          updates.waId = contactInfo.waId;
        }

        updates.lastStatusUpdate = Timestamp.now();
        updates.updatedAt = FieldValue.serverTimestamp();

        await contactRef.update(updates);

        logger.info('✅ Información de contacto actualizada', {
          phoneNumber,
          profileName: contactInfo.profileName,
          waId: contactInfo.waId
        });
      }
    } catch (error) {
      logger.error('Error actualizando información de contacto', {
        error: error.message,
        contactInfo
      });
    }
  }

  /**
   * Obtener estadísticas de status
   */
  static async getStatusStats(options = {}) {
    const { startDate = null, endDate = null, status = null } = options;

    let query = firestore.collection('message_statuses');

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const statuses = snapshot.docs.map(doc => new MessageStatus({ id: doc.id, ...doc.data() }));

    // Calcular estadísticas
    const stats = {
      total: statuses.length,
      byStatus: {},
      byHour: {},
      byDay: {},
      averageProcessingTime: 0
    };

    statuses.forEach(status => {
      // Contar por status
      stats.byStatus[status.status] = (stats.byStatus[status.status] || 0) + 1;

      // Contar por hora
      const hour = status.timestamp.toDate().getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

      // Contar por día
      const day = status.timestamp.toDate().toDateString();
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    });

    return stats;
  }

  /**
   * Convertir a objeto plano
   */
  toJSON() {
    return {
      id: this.id,
      messageId: this.messageId,
      twilioSid: this.twilioSid,
      status: this.status,
      previousStatus: this.previousStatus,
      timestamp: this.timestamp?.toDate?.()?.toISOString() || this.timestamp,
      metadata: this.metadata,
      contactInfo: this.contactInfo,
      createdAt: this.createdAt?.toDate?.()?.toISOString() || this.createdAt
    };
  }
}

module.exports = MessageStatus; 