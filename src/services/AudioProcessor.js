const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static');
const logger = require('../utils/logger');
const admin = require('firebase-admin');
const axios = require('axios'); // Added for OpenAI Whisper API

ffmpeg.setFfprobePath(ffprobePath);

/**
 * Procesador de archivos de audio
 * Maneja conversión, extracción de metadatos y transcripción
 */
class AudioProcessor {
  constructor() {
    // No inicializar bucket aquí para evitar errores
  }

  /**
   * Obtener bucket de forma segura
   */
  getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      return admin.storage().bucket();
    } catch (error) {
      logger.warn('Firebase Storage no disponible, usando mock:', error.message);
      return {
        file: () => ({
          save: () => Promise.reject(new Error('Storage no disponible')),
          getSignedUrl: () => Promise.reject(new Error('Storage no disponible')),
          delete: () => Promise.reject(new Error('Storage no disponible'))
        })
      };
    }
  }

  /**
   * Procesar archivo de audio
   */
  async processAudio(buffer, filename, originalContentType = 'audio/mpeg') {
    try {
      logger.info('🎵 Iniciando procesamiento de audio', {
        filename,
        originalType: originalContentType,
        size: buffer.length
      });

      // Extraer metadatos usando streams en memoria
      const metadata = await this.extractMetadata(buffer);
      
      // Convertir a MP3 si es necesario
      let processedBuffer = buffer;
      let finalContentType = originalContentType;

      if (originalContentType !== 'audio/mpeg' && originalContentType !== 'audio/mp3') {
        logger.info('🔄 Convirtiendo audio a MP3', { originalType: originalContentType });
        processedBuffer = await this.convertToMp3(buffer);
        finalContentType = 'audio/mp3';
      }

      // Transcripción con IA (placeholder)
      const transcription = await this.transcribeAudio(processedBuffer, { fileName: filename });

      const result = {
        buffer: processedBuffer,
        contentType: finalContentType,
        metadata: {
          duration: metadata.duration || '00:00:00',
          durationSeconds: metadata.durationSeconds || 0,
          bitrate: metadata.bitrate || 128000,
          format: finalContentType.split('/')[1] || 'mp3',
          codec: metadata.codec || 'mp3',
          sampleRate: metadata.sampleRate || 44100,
          channels: metadata.channels || 2,
          transcription,
          processed: true,
          originalFilename: filename,
          processedAt: new Date().toISOString()
        }
      };

      logger.info('✅ Audio procesado exitosamente', {
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        duration: result.metadata.duration,
        transcription: transcription ? 'Disponible' : 'No disponible'
      });

      return result;

    } catch (error) {
      logger.error('❌ Error procesando audio:', error);
      
      // Fallback: devolver audio original
      return {
        buffer,
        contentType: originalContentType,
        metadata: {
          duration: '00:00:00',
          durationSeconds: 0,
          bitrate: 0,
          format: 'unknown',
          codec: 'unknown',
          sampleRate: 0,
          channels: 0,
          transcription: null,
          processed: false,
          originalFilename: filename,
          processedAt: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Extraer metadatos del audio
   */
  async extractMetadata(buffer) {
    return new Promise((resolve) => {
      try {
        const { Readable } = require('stream');
        const audioStream = new Readable();
        audioStream.push(buffer);
        audioStream.push(null);

        ffmpeg(audioStream)
          .ffprobe((err, metadata) => {
            if (err) {
              logger.warn('No se pudieron extraer metadatos de audio:', err.message);
              resolve({
                duration: '00:00:00',
                durationSeconds: 0,
                bitrate: 128000,
                codec: 'unknown',
                sampleRate: 44100,
                channels: 2
              });
              return;
            }

            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            const duration = metadata.format.duration || 0;
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = Math.floor(duration % 60);
            const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            resolve({
              duration: formattedDuration,
              durationSeconds: Math.floor(duration),
              bitrate: parseInt(metadata.format.bit_rate) || 128000,
              codec: audioStream?.codec_name || 'unknown',
              sampleRate: audioStream?.sample_rate || 44100,
              channels: audioStream?.channels || 2
            });
          });
      } catch (error) {
        logger.warn('Error extrayendo metadatos:', error.message);
        resolve({
          duration: '00:00:00',
          durationSeconds: 0,
          bitrate: 128000,
          codec: 'unknown',
          sampleRate: 44100,
          channels: 2
        });
      }
    });
  }

  /**
   * Convertir audio a MP3
   */
  async convertToMp3(buffer) {
    return new Promise((resolve, reject) => {
      try {
        const { Readable } = require('stream');
        const audioStream = new Readable();
        audioStream.push(buffer);
        audioStream.push(null);

        const chunks = [];
        
        ffmpeg(audioStream)
          .toFormat('mp3')
          .audioBitrate(128)
          .audioChannels(2)
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            logger.info('✅ Conversión a MP3 completada', {
              originalSize: buffer.length,
              convertedSize: outputBuffer.length
            });
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error convirtiendo a MP3, usando original:', err.message);
            resolve(buffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      } catch (error) {
        logger.warn('Error en conversión MP3:', error.message);
        resolve(buffer); // Fallback al original
      }
    });
  }

  /**
   * Transcribir audio usando OpenAI Whisper API
   */
  async transcribeAudio(buffer, options = {}) {
    try {
      const {
        language = 'auto',
        model = 'whisper-1',
        temperature = 0.2,
        maxRetries = 3
      } = options;

      // Verificar que el buffer es válido
      if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('Buffer de audio inválido para transcripción');
      }

      // Verificar tamaño del archivo (Whisper tiene límite de 25MB)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (buffer.length > maxSize) {
        logger.warn('Archivo de audio muy grande para transcripción', {
          size: buffer.length,
          maxSize,
          fileName: options.fileName || 'unknown'
        });
        throw new Error('Archivo de audio muy grande (máximo 25MB)');
      }

      // Verificar si OpenAI API Key está configurada
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        logger.warn('OpenAI API Key no configurada - transcripción deshabilitada');
        return {
          success: false,
          text: null,
          error: 'Transcripción no disponible (API Key no configurada)',
          confidence: 0
        };
      }

      logger.info('🎙️ Iniciando transcripción de audio con Whisper', {
        audioSize: buffer.length,
        language,
        model,
        fileName: options.fileName || 'buffer'
      });

      // Crear FormData para envío a OpenAI
      const FormData = require('form-data');
      const form = new FormData();
      
      // Agregar archivo de audio
      form.append('file', buffer, {
        filename: options.fileName || 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Agregar parámetros
      form.append('model', model);
      if (language && language !== 'auto') {
        form.append('language', language);
      }
      form.append('temperature', temperature.toString());
      form.append('response_format', 'verbose_json');

      // Realizar petición con reintentos
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                ...form.getHeaders()
              },
              timeout: 120000, // 2 minutos timeout
              maxContentLength: 50 * 1024 * 1024 // 50MB response limit
            }
          );

          const transcription = response.data;
          
          logger.info('✅ Transcripción completada exitosamente', {
            textLength: transcription.text ? transcription.text.length : 0,
            language: transcription.language || 'unknown',
            duration: transcription.duration || 'unknown',
            attempt,
            confidence: transcription.confidence || 'unknown'
          });

          return {
            success: true,
            text: transcription.text || '',
            language: transcription.language,
            duration: transcription.duration,
            confidence: transcription.confidence || 0.8,
            segments: transcription.segments || [],
            words: transcription.words || []
          };

        } catch (error) {
          lastError = error;
          
          if (error.response?.status === 429) {
            // Rate limit - esperar antes del siguiente intento
            const waitTime = Math.pow(2, attempt) * 1000; // Backoff exponencial
            logger.warn(`Rate limit alcanzado, esperando ${waitTime}ms antes del intento ${attempt + 1}`, {
              attempt,
              maxRetries,
              waitTime
            });
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          } else if (error.response?.status >= 500) {
            // Error del servidor - reintentar
            logger.warn(`Error del servidor OpenAI, reintentando (${attempt}/${maxRetries})`, {
              status: error.response.status,
              message: error.response.data?.error?.message || error.message
            });
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
          } else {
            // Error no recuperable
            break;
          }
        }
      }

      // Si llegamos aquí, todos los intentos fallaron
      logger.error('❌ Error en transcripción de audio después de todos los intentos', {
        error: lastError.response?.data || lastError.message,
        status: lastError.response?.status,
        attempts: maxRetries
      });

      return {
        success: false,
        text: null,
        error: lastError.response?.data?.error?.message || lastError.message,
        confidence: 0
      };

    } catch (error) {
      logger.error('❌ Error crítico en transcripción de audio', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        text: null,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Verificar si la transcripción está disponible
   */
  isTranscriptionAvailable() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Obtener información de costos estimados para transcripción
   */
  getTranscriptionCostEstimate(durationSeconds) {
    // OpenAI Whisper cobra $0.006 por minuto
    const costPerMinute = 0.006;
    const minutes = Math.ceil(durationSeconds / 60);
    return {
      estimatedCost: minutes * costPerMinute,
      currency: 'USD',
      minutes
    };
  }
}

module.exports = AudioProcessor; 