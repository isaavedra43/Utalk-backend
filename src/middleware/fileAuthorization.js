/**
 * 🔐 MIDDLEWARE DE AUTORIZACIÓN PARA ARCHIVOS - FASE 5
 * 
 * Controla el acceso a archivos basado en permisos de usuario y conversación.
 * Verifica que el usuario tenga acceso a la conversación donde se encuentra el archivo.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const File = require('../models/File');
const Conversation = require('../models/Conversation');
const { logger } = require('../utils/logger');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');

/**
 * Middleware de autorización para archivos
 * Verifica que el usuario tenga acceso al archivo solicitado
 */
const fileAuthorizationMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || 'unknown';
  
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    logger.info('🔐 Iniciando autorización de archivo', {
      category: 'FILE_AUTH_START',
      requestId,
      fileId,
      userId,
      userEmail,
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    });

    // 🔍 VALIDACIÓN BÁSICA
    if (!fileId) {
      logger.warn('FileId faltante en autorización', {
        category: 'FILE_AUTH_MISSING_ID',
        requestId,
        userId,
        userEmail
      });
      
      return ResponseHandler.error(res, new ApiError(
        'MISSING_FILE_ID',
        'ID de archivo requerido',
        'Especifica el ID del archivo en la URL',
        400
      ));
    }

    if (!userId || !userEmail) {
      logger.warn('Usuario no autenticado en autorización de archivo', {
        category: 'FILE_AUTH_NO_USER',
        requestId,
        fileId,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });
      
      return ResponseHandler.error(res, new ApiError(
        'USER_NOT_AUTHENTICATED',
        'Usuario no autenticado',
        'Debes estar autenticado para acceder a archivos',
        401
      ));
    }

    // 📁 OBTENER INFORMACIÓN DEL ARCHIVO
    logger.info('📁 Obteniendo información del archivo', {
      category: 'FILE_AUTH_GET_FILE',
      requestId,
      fileId,
      userId
    });

    const file = await File.getById(fileId);
    
    if (!file) {
      logger.warn('Archivo no encontrado en autorización', {
        category: 'FILE_AUTH_NOT_FOUND',
        requestId,
        fileId,
        userId
      });
      
      return ResponseHandler.error(res, new ApiError(
        'FILE_NOT_FOUND',
        'Archivo no encontrado',
        'El archivo especificado no existe o fue eliminado',
        404
      ));
    }

    const fileData = file.toJSON();

    // 🔍 VERIFICAR SI EL ARCHIVO ESTÁ ACTIVO
    if (!fileData.isActive) {
      logger.warn('Archivo inactivo en autorización', {
        category: 'FILE_AUTH_INACTIVE',
        requestId,
        fileId,
        userId,
        fileStatus: fileData.isActive
      });
      
      return ResponseHandler.error(res, new ApiError(
        'FILE_INACTIVE',
        'Archivo inactivo',
        'El archivo ha sido eliminado o desactivado',
        404
      ));
    }

    // 💬 OBTENER INFORMACIÓN DE LA CONVERSACIÓN
    logger.info('💬 Obteniendo información de la conversación', {
      category: 'FILE_AUTH_GET_CONVERSATION',
      requestId,
      fileId,
      conversationId: fileData.conversationId,
      userId
    });

    const ConversationService = require('../services/ConversationService');
    const conversation = await ConversationService.getConversationById(fileData.conversationId);
    
    if (!conversation) {
      logger.warn('Conversación no encontrada en autorización de archivo', {
        category: 'FILE_AUTH_CONVERSATION_NOT_FOUND',
        requestId,
        fileId,
        conversationId: fileData.conversationId,
        userId
      });
      
      return ResponseHandler.error(res, new ApiError(
        'CONVERSATION_NOT_FOUND',
        'Conversación no encontrada',
        'La conversación asociada al archivo no existe',
        404
      ));
    }

    const conversationData = conversation.toJSON();

    // 🔒 VERIFICAR PERMISOS DE ACCESO
    logger.info('🔒 Verificando permisos de acceso', {
      category: 'FILE_AUTH_CHECK_PERMISSIONS',
      requestId,
      fileId,
      conversationId: fileData.conversationId,
      userId,
      userEmail,
      participants: conversationData.participants?.length || 0
    });

    // Verificar si el usuario es el propietario del archivo
    const isOwner = fileData.userId === userId || fileData.uploadedBy === userEmail;
    
    // Verificar si el usuario es participante de la conversación
    const isParticipant = conversationData.participants && 
                         conversationData.participants.includes(userEmail);
    
    // Verificar si el usuario es admin o superadmin
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    logger.info('🔍 Resultados de verificación de permisos', {
      category: 'FILE_AUTH_PERMISSION_RESULTS',
      requestId,
      fileId,
      userId,
      isOwner,
      isParticipant,
      isAdmin,
      userRole: req.user.role
    });

    // ✅ AUTORIZACIÓN: Permitir acceso si cumple alguna condición
    if (isOwner || isParticipant || isAdmin) {
      logger.info('✅ Autorización de archivo exitosa', {
        category: 'FILE_AUTH_SUCCESS',
        requestId,
        fileId,
        userId,
        reason: isOwner ? 'owner' : isParticipant ? 'participant' : 'admin',
        processTime: Date.now() - startTime
      });

      // Adjuntar datos del archivo y conversación a la request
      req.fileData = fileData;
      req.conversationData = conversationData;
      req.fileAuthorization = {
        isOwner,
        isParticipant,
        isAdmin,
        reason: isOwner ? 'owner' : isParticipant ? 'participant' : 'admin'
      };

      return next();
    }

    // ❌ ACCESO DENEGADO
    logger.warn('❌ Acceso denegado a archivo', {
      category: 'FILE_AUTH_DENIED',
      requestId,
      fileId,
      userId,
      userEmail,
      conversationId: fileData.conversationId,
      isOwner,
      isParticipant,
      isAdmin,
      userRole: req.user.role,
      processTime: Date.now() - startTime
    });

    return ResponseHandler.error(res, new ApiError(
      'ACCESS_DENIED',
      'Sin permisos para acceder a este archivo',
      'No tienes permisos para acceder a este archivo. Verifica que seas participante de la conversación.',
      403,
      {
        fileId,
        conversationId: fileData.conversationId,
        reason: 'not_participant_or_owner'
      }
    ));

  } catch (error) {
    logger.error('❌ Error en autorización de archivo', {
      category: 'FILE_AUTH_ERROR',
      requestId,
      fileId: req.params?.fileId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      processTime: Date.now() - startTime
    });

    return ResponseHandler.error(res, new ApiError(
      'AUTHORIZATION_ERROR',
      'Error verificando permisos del archivo',
      'Ocurrió un error al verificar los permisos. Intenta nuevamente.',
      500
    ));
  }
};

/**
 * Middleware de autorización para archivos por conversación
 * Verifica que el usuario tenga acceso a la conversación
 */
const conversationFileAuthorizationMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || 'unknown';
  
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    logger.info('🔐 Iniciando autorización de archivos por conversación', {
      category: 'CONVERSATION_FILE_AUTH_START',
      requestId,
      conversationId,
      userId,
      userEmail,
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    });

    // 🔍 VALIDACIÓN BÁSICA
    if (!conversationId) {
      logger.warn('ConversationId faltante en autorización', {
        category: 'CONVERSATION_FILE_AUTH_MISSING_ID',
        requestId,
        userId
      });
      
      return ResponseHandler.error(res, new ApiError(
        'MISSING_CONVERSATION_ID',
        'ID de conversación requerido',
        'Especifica el ID de la conversación en la URL',
        400
      ));
    }

    // 💬 OBTENER INFORMACIÓN DE LA CONVERSACIÓN
    const ConversationService = require('../services/ConversationService');
    const conversation = await ConversationService.getConversationById(conversationId);
    
    if (!conversation) {
      logger.warn('Conversación no encontrada en autorización', {
        category: 'CONVERSATION_FILE_AUTH_NOT_FOUND',
        requestId,
        conversationId,
        userId
      });
      
      return ResponseHandler.error(res, new ApiError(
        'CONVERSATION_NOT_FOUND',
        'Conversación no encontrada',
        'La conversación especificada no existe',
        404
      ));
    }

    const conversationData = conversation.toJSON();

    // 🔒 VERIFICAR PERMISOS DE ACCESO
    const isParticipant = conversationData.participants && 
                         conversationData.participants.includes(userEmail);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    logger.info('🔍 Resultados de verificación de permisos de conversación', {
      category: 'CONVERSATION_FILE_AUTH_PERMISSION_RESULTS',
      requestId,
      conversationId,
      userId,
      isParticipant,
      isAdmin,
      userRole: req.user.role
    });

    // ✅ AUTORIZACIÓN: Permitir acceso si es participante o admin
    if (isParticipant || isAdmin) {
      logger.info('✅ Autorización de conversación exitosa', {
        category: 'CONVERSATION_FILE_AUTH_SUCCESS',
        requestId,
        conversationId,
        userId,
        reason: isParticipant ? 'participant' : 'admin',
        processTime: Date.now() - startTime
      });

      // Adjuntar datos de la conversación a la request
      req.conversationData = conversationData;
      req.conversationAuthorization = {
        isParticipant,
        isAdmin,
        reason: isParticipant ? 'participant' : 'admin'
      };

      return next();
    }

    // ❌ ACCESO DENEGADO
    logger.warn('❌ Acceso denegado a conversación', {
      category: 'CONVERSATION_FILE_AUTH_DENIED',
      requestId,
      conversationId,
      userId,
      userEmail,
      isParticipant,
      isAdmin,
      userRole: req.user.role,
      processTime: Date.now() - startTime
    });

    return ResponseHandler.error(res, new ApiError(
      'ACCESS_DENIED',
      'Sin permisos para acceder a esta conversación',
      'No tienes permisos para acceder a esta conversación. Verifica que seas participante.',
      403,
      {
        conversationId,
        reason: 'not_participant'
      }
    ));

  } catch (error) {
    logger.error('❌ Error en autorización de conversación', {
      category: 'CONVERSATION_FILE_AUTH_ERROR',
      requestId,
      conversationId: req.params?.conversationId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      processTime: Date.now() - startTime
    });

    return ResponseHandler.error(res, new ApiError(
      'AUTHORIZATION_ERROR',
      'Error verificando permisos de la conversación',
      'Ocurrió un error al verificar los permisos. Intenta nuevamente.',
      500
    ));
  }
};

/**
 * Middleware de autorización para eliminación de archivos
 * Verifica permisos especiales para eliminación
 */
const fileDeleteAuthorizationMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || 'unknown';
  
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    logger.info('🗑️ Iniciando autorización de eliminación de archivo', {
      category: 'FILE_DELETE_AUTH_START',
      requestId,
      fileId,
      userId,
      userEmail
    });

    // Obtener información del archivo
    const file = await File.getById(fileId);
    
    if (!file) {
      return ResponseHandler.error(res, new ApiError(
        'FILE_NOT_FOUND',
        'Archivo no encontrado',
        'El archivo especificado no existe',
        404
      ));
    }

    const fileData = file.toJSON();

    // Verificar permisos especiales para eliminación
    const isOwner = fileData.userId === userId || fileData.uploadedBy === userEmail;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isSuperAdmin = req.user.role === 'superadmin';

    logger.info('🔍 Verificación de permisos de eliminación', {
      category: 'FILE_DELETE_AUTH_PERMISSIONS',
      requestId,
      fileId,
      userId,
      isOwner,
      isAdmin,
      isSuperAdmin
    });

    // Solo permitir eliminación al propietario, admin o superadmin
    if (isOwner || isAdmin || isSuperAdmin) {
      logger.info('✅ Autorización de eliminación exitosa', {
        category: 'FILE_DELETE_AUTH_SUCCESS',
        requestId,
        fileId,
        userId,
        reason: isOwner ? 'owner' : isSuperAdmin ? 'superadmin' : 'admin'
      });

      req.fileData = fileData;
      req.deleteAuthorization = {
        isOwner,
        isAdmin,
        isSuperAdmin,
        reason: isOwner ? 'owner' : isSuperAdmin ? 'superadmin' : 'admin'
      };

      return next();
    }

    // ❌ ACCESO DENEGADO PARA ELIMINACIÓN
    logger.warn('❌ Acceso denegado para eliminación de archivo', {
      category: 'FILE_DELETE_AUTH_DENIED',
      requestId,
      fileId,
      userId,
      isOwner,
      isAdmin,
      isSuperAdmin
    });

    return ResponseHandler.error(res, new ApiError(
      'DELETE_PERMISSION_DENIED',
      'Sin permisos para eliminar este archivo',
      'Solo el propietario del archivo o un administrador puede eliminarlo.',
      403,
      {
        fileId,
        reason: 'not_owner_or_admin'
      }
    ));

  } catch (error) {
    logger.error('❌ Error en autorización de eliminación', {
      category: 'FILE_DELETE_AUTH_ERROR',
      requestId,
      fileId: req.params?.fileId,
      userId: req.user?.id,
      error: error.message
    });

    return ResponseHandler.error(res, new ApiError(
      'AUTHORIZATION_ERROR',
      'Error verificando permisos de eliminación',
      'Ocurrió un error al verificar los permisos. Intenta nuevamente.',
      500
    ));
  }
};

module.exports = {
  fileAuthorizationMiddleware,
  conversationFileAuthorizationMiddleware,
  fileDeleteAuthorizationMiddleware
}; 