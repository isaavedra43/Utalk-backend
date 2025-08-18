/**
 * 🤖 PROVEEDOR LM STUDIO
 * 
 * Conecta con LM Studio corriendo en otra computadora
 * para usar modelos locales en lugar de APIs externas
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class LMStudioProvider {
  constructor() {
    this.baseURL = process.env.LM_STUDIO_URL || 'http://192.168.1.100:1234';
    this.timeout = parseInt(process.env.LM_STUDIO_TIMEOUT) || 30000;
    this.maxRetries = parseInt(process.env.LM_STUDIO_MAX_RETRIES) || 3;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info('🤖 LM Studio Provider inicializado', {
      category: 'LM_STUDIO_INIT',
      baseURL: this.baseURL,
      timeout: this.timeout
    });
  }

  /**
   * 🔍 VERIFICAR CONECTIVIDAD CON LM STUDIO
   */
  async testConnection() {
    try {
      const response = await this.client.get('/v1/models');
      logger.info('✅ Conexión exitosa con LM Studio', {
        category: 'LM_STUDIO_CONNECTION',
        models: response.data.data?.length || 0
      });
      return { success: true, models: response.data.data };
    } catch (error) {
      logger.error('❌ Error conectando con LM Studio', {
        category: 'LM_STUDIO_CONNECTION_ERROR',
        error: error.message,
        baseURL: this.baseURL
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚀 GENERAR RESPUESTA CON LM STUDIO
   */
  async generateResponse(prompt, options = {}) {
    const {
      maxTokens = 150,
      temperature = 0.3,
      model = 'local-model',
      systemPrompt = null
    } = options;

    const messages = [];
    
    // Agregar system prompt si existe
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Agregar prompt del usuario
    messages.push({
      role: 'user',
      content: prompt
    });

    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      stream: false
    };

    try {
      logger.info('🤖 Enviando petición a LM Studio', {
        category: 'LM_STUDIO_REQUEST',
        model,
        maxTokens,
        temperature,
        promptLength: prompt.length
      });

      const response = await this.client.post('/v1/chat/completions', requestBody);
      
      const result = {
        success: true,
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model
      };

      logger.info('✅ Respuesta exitosa de LM Studio', {
        category: 'LM_STUDIO_RESPONSE',
        contentLength: result.content.length,
        tokensUsed: result.usage?.total_tokens
      });

      return result;

    } catch (error) {
      logger.error('❌ Error en LM Studio', {
        category: 'LM_STUDIO_ERROR',
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * 🔄 GENERAR CON REINTENTOS
   */
  async generateWithRetry(prompt, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.generateResponse(prompt, options);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error;
        
        // Esperar antes del siguiente intento
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error.message;
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('❌ Todos los reintentos fallaron en LM Studio', {
      category: 'LM_STUDIO_MAX_RETRIES',
      maxRetries: this.maxRetries,
      lastError
    });

    return {
      success: false,
      error: `Máximo de reintentos alcanzado: ${lastError}`,
      fallback: true
    };
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DEL MODELO
   */
  async getModelStats() {
    try {
      const response = await this.client.get('/v1/models');
      return {
        success: true,
        models: response.data.data,
        totalModels: response.data.data?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔧 CONFIGURAR MODELO ESPECÍFICO
   */
  async setModel(modelName) {
    try {
      // LM Studio maneja automáticamente el modelo activo
      // Solo verificamos que esté disponible
      const stats = await this.getModelStats();
      
      if (stats.success) {
        const modelExists = stats.models.some(model => 
          model.id === modelName || model.id.includes(modelName)
        );
        
        if (modelExists) {
          logger.info('✅ Modelo configurado en LM Studio', {
            category: 'LM_STUDIO_MODEL_SET',
            model: modelName
          });
          return { success: true, model: modelName };
        } else {
          return { success: false, error: `Modelo ${modelName} no encontrado` };
        }
      }
      
      return stats;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LMStudioProvider;