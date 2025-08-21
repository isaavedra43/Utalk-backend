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

  /**
   * 🆕 STREAMING DE AUDIO EN TIEMPO REAL
   * Método para reproducir audio en streaming optimizado para web
   */
  async streamAudio(fileId, conversationId, options = {}) {
    try {
      const {
        chunkSize = 64 * 1024, // 64KB chunks por defecto
        bitrate = 128000,      // 128kbps por defecto
        format = 'mp3',        // MP3 por defecto
        startTime = 0,         // Tiempo de inicio en segundos
        duration = null        // Duración en segundos (null = completo)
      } = options;

      logger.info('🎵 Iniciando streaming de audio', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        chunkSize,
        bitrate,
        format,
        startTime,
        duration
      });

      // Obtener archivo de audio desde storage
      const bucket = this.getBucket();
      const audioFile = bucket.file(`audio/${conversationId}/${fileId}.${format}`);
      
      // Verificar que el archivo existe
      const [exists] = await audioFile.exists();
      if (!exists) {
        throw new Error(`Archivo de audio no encontrado: ${fileId}`);
      }

      // Obtener metadatos del archivo
      const [metadata] = await audioFile.getMetadata();
      const fileSize = parseInt(metadata.size);

      // Calcular rangos para streaming
      const startByte = Math.floor(startTime * bitrate / 8);
      const endByte = duration 
        ? Math.min(startByte + Math.floor(duration * bitrate / 8), fileSize - 1)
        : fileSize - 1;

      // Crear stream de lectura con rangos
      const stream = audioFile.createReadStream({
        start: startByte,
        end: endByte,
        validation: false
      });

      // Configurar headers para streaming
      const headers = {
        'Content-Type': `audio/${format}`,
        'Content-Length': endByte - startByte + 1,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      };

      logger.info('✅ Stream de audio configurado', {
        fileId: fileId.substring(0, 20) + '...',
        startByte,
        endByte,
        totalBytes: endByte - startByte + 1,
        format
      });

      return {
        stream,
        headers,
        metadata: {
          fileId,
          conversationId,
          format,
          bitrate,
          startTime,
          duration,
          totalBytes: endByte - startByte + 1,
          fileSize
        }
      };

    } catch (error) {
      logger.error('❌ Error en streaming de audio', {
        fileId: fileId?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 GENERAR CHUNKS DE AUDIO PARA STREAMING
   * Divide el audio en chunks optimizados para reproducción web
   */
  async generateAudioChunks(buffer, options = {}) {
    try {
      const {
        chunkDuration = 2,     // 2 segundos por chunk
        bitrate = 128000,      // 128kbps
        format = 'mp3'         // Formato de salida
      } = options;

      logger.info('🎵 Generando chunks de audio', {
        bufferSize: buffer.length,
        chunkDuration,
        bitrate,
        format
      });

      const chunks = [];
      const bytesPerChunk = Math.floor(chunkDuration * bitrate / 8);
      const totalChunks = Math.ceil(buffer.length / bytesPerChunk);

      for (let i = 0; i < totalChunks; i++) {
        const startByte = i * bytesPerChunk;
        const endByte = Math.min(startByte + bytesPerChunk, buffer.length);
        const chunkBuffer = buffer.slice(startByte, endByte);

        // Procesar chunk si es necesario
        let processedChunk = chunkBuffer;
        if (format !== 'mp3') {
          processedChunk = await this.convertChunkToFormat(chunkBuffer, format);
        }

        chunks.push({
          index: i,
          buffer: processedChunk,
          size: processedChunk.length,
          duration: chunkDuration,
          timestamp: i * chunkDuration
        });
      }

      logger.info('✅ Chunks de audio generados', {
        totalChunks: chunks.length,
        totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
        averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.size, 0) / chunks.length)
      });

      return chunks;

    } catch (error) {
      logger.error('❌ Error generando chunks de audio', {
        error: error.message,
        bufferSize: buffer?.length
      });
      throw error;
    }
  }

  /**
   * 🆕 CONVERTIR CHUNK A FORMATO ESPECÍFICO
   */
  async convertChunkToFormat(buffer, targetFormat) {
    return new Promise((resolve, reject) => {
      try {
        const { Readable } = require('stream');
        const audioStream = new Readable();
        audioStream.push(buffer);
        audioStream.push(null);

        const chunks = [];
        
        ffmpeg(audioStream)
          .toFormat(targetFormat)
          .audioBitrate(128)
          .audioChannels(2)
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error convirtiendo chunk, usando original:', err.message);
            resolve(buffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      } catch (error) {
        logger.warn('Error en conversión de chunk:', error.message);
        resolve(buffer); // Fallback al original
      }
    });
  }

  /**
   * 🆕 OPTIMIZAR AUDIO PARA REPRODUCCIÓN WEB
   * Aplica optimizaciones específicas para streaming web
   */
  async optimizeForWebStreaming(buffer, options = {}) {
    try {
      const {
        targetBitrate = 128000,    // 128kbps para web
        targetFormat = 'mp3',      // MP3 para compatibilidad
        normalize = true,          // Normalizar volumen
        removeSilence = true       // Remover silencios largos
      } = options;

      logger.info('🎵 Optimizando audio para streaming web', {
        originalSize: buffer.length,
        targetBitrate,
        targetFormat,
        normalize,
        removeSilence
      });

      const { Readable } = require('stream');
      const audioStream = new Readable();
      audioStream.push(buffer);
      audioStream.push(null);

      let ffmpegCommand = ffmpeg(audioStream);

      // Aplicar optimizaciones
      if (normalize) {
        ffmpegCommand = ffmpegCommand.audioFilters('loudnorm');
      }

      if (removeSilence) {
        ffmpegCommand = ffmpegCommand.audioFilters('silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB');
      }

      // Configurar formato y bitrate
      ffmpegCommand = ffmpegCommand
        .toFormat(targetFormat)
        .audioBitrate(targetBitrate)
        .audioChannels(2)
        .audioFrequency(44100);

      const optimizedBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        
        ffmpegCommand
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error optimizando audio, usando original:', err.message);
            resolve(buffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      });

      const compressionRatio = ((buffer.length - optimizedBuffer.length) / buffer.length * 100).toFixed(1);

      logger.info('✅ Audio optimizado para web', {
        originalSize: buffer.length,
        optimizedSize: optimizedBuffer.length,
        compressionRatio: `${compressionRatio}%`,
        targetFormat,
        targetBitrate
      });

      return {
        buffer: optimizedBuffer,
        metadata: {
          originalSize: buffer.length,
          optimizedSize: optimizedBuffer.length,
          compressionRatio: `${compressionRatio}%`,
          format: targetFormat,
          bitrate: targetBitrate
        }
      };

    } catch (error) {
      logger.error('❌ Error optimizando audio para web', {
        error: error.message,
        bufferSize: buffer?.length
      });
      
      // Fallback: devolver audio original
      return {
        buffer,
        metadata: {
          originalSize: buffer.length,
          optimizedSize: buffer.length,
          compressionRatio: '0%',
          format: 'original',
          bitrate: 'unknown'
        }
      };
    }
  }

  /**
   * 🆕 GRABACIÓN DE AUDIO EN TIEMPO REAL
   * Método para grabar audio desde el chat
   */
  async recordAudio(socket, conversationId, options = {}) {
    try {
      const {
        duration = 60,           // Duración máxima en segundos
        sampleRate = 44100,      // Frecuencia de muestreo
        channels = 2,            // Número de canales
        bitrate = 128000,        // Bitrate
        format = 'mp3'           // Formato de salida
      } = options;

      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('🎙️ Iniciando grabación de audio', {
        recordingId,
        conversationId: conversationId.substring(0, 20) + '...',
        duration,
        sampleRate,
        channels,
        bitrate,
        format
      });

      // Crear buffer para almacenar el audio grabado
      const audioChunks = [];
      let isRecording = true;
      let recordingStartTime = Date.now();

      // Configurar stream de grabación
      const recordingStream = this.createRecordingStream({
        sampleRate,
        channels,
        bitrate,
        format
      });

      // Procesar chunks de audio en tiempo real
      recordingStream.on('data', (chunk) => {
        if (isRecording) {
          audioChunks.push(chunk);
          
          // Emitir progreso de grabación
          const elapsedTime = (Date.now() - recordingStartTime) / 1000;
          const progress = Math.min((elapsedTime / duration) * 100, 100);
          
          socket.emit('audio-recording-progress', {
            recordingId,
            conversationId,
            progress: Math.round(progress),
            elapsedTime: Math.round(elapsedTime),
            remainingTime: Math.max(0, duration - elapsedTime)
          });
        }
      });

      // Manejar finalización de grabación
      recordingStream.on('end', async () => {
        isRecording = false;
        
        // Combinar todos los chunks
        const audioBuffer = Buffer.concat(audioChunks);
        
        // Procesar audio grabado
        const processedAudio = await this.processRecordedAudio(audioBuffer, {
          format,
          bitrate,
          normalize: true
        });

        // Guardar audio grabado
        const savedAudio = await this.saveRecordedAudio(processedAudio, {
          recordingId,
          conversationId,
          format
        });

        logger.info('✅ Grabación de audio completada', {
          recordingId,
          conversationId: conversationId.substring(0, 20) + '...',
          duration: Math.round((Date.now() - recordingStartTime) / 1000),
          size: audioBuffer.length
        });

        // Emitir evento de grabación completada
        socket.emit('audio-recording-completed', {
          recordingId,
          conversationId,
          audioUrl: savedAudio.url,
          duration: Math.round((Date.now() - recordingStartTime) / 1000),
          size: audioBuffer.length,
          metadata: savedAudio.metadata
        });
      });

      // Manejar errores de grabación
      recordingStream.on('error', (error) => {
        isRecording = false;
        
        logger.error('❌ Error en grabación de audio', {
          recordingId,
          conversationId: conversationId.substring(0, 20) + '...',
          error: error.message
        });

        socket.emit('audio-recording-error', {
          recordingId,
          conversationId,
          error: error.message
        });
      });

      // Configurar timeout para detener grabación
      setTimeout(() => {
        if (isRecording) {
          isRecording = false;
          recordingStream.end();
        }
      }, duration * 1000);

      return {
        recordingId,
        stream: recordingStream,
        stop: () => {
          isRecording = false;
          recordingStream.end();
        }
      };

    } catch (error) {
      logger.error('❌ Error iniciando grabación de audio', {
        conversationId: conversationId?.substring(0, 20) + '...',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 CREAR STREAM DE GRABACIÓN
   * Configura el stream para capturar audio en tiempo real
   */
  createRecordingStream(options = {}) {
    const {
      sampleRate = 44100,
      channels = 2,
      bitrate = 128000,
      format = 'mp3'
    } = options;

    // Crear stream de grabación usando ffmpeg
    const { Readable } = require('stream');
    const recordingStream = new Readable({
      read() {}
    });

    // Configurar ffmpeg para captura de audio
    const ffmpegCommand = ffmpeg()
      .input('default') // Dispositivo de audio por defecto
      .inputFormat('pulse') // Formato de entrada (Linux)
      .audioFrequency(sampleRate)
      .audioChannels(channels)
      .toFormat(format)
      .audioBitrate(bitrate)
      .on('start', () => {
        logger.info('🎙️ Stream de grabación iniciado', {
          sampleRate,
          channels,
          bitrate,
          format
        });
      })
      .on('error', (err) => {
        logger.error('❌ Error en stream de grabación:', err.message);
        recordingStream.emit('error', err);
      })
      .on('end', () => {
        logger.info('🎙️ Stream de grabación finalizado');
        recordingStream.push(null);
      });

    // Pipe ffmpeg output al stream
    ffmpegCommand.pipe(recordingStream);

    return recordingStream;
  }

  /**
   * 🆕 PROCESAR AUDIO GRABADO
   * Aplica optimizaciones al audio grabado
   */
  async processRecordedAudio(audioBuffer, options = {}) {
    try {
      const {
        format = 'mp3',
        bitrate = 128000,
        normalize = true,
        removeNoise = true
      } = options;

      logger.info('🎵 Procesando audio grabado', {
        bufferSize: audioBuffer.length,
        format,
        bitrate,
        normalize,
        removeNoise
      });

      const { Readable } = require('stream');
      const audioStream = new Readable();
      audioStream.push(audioBuffer);
      audioStream.push(null);

      let ffmpegCommand = ffmpeg(audioStream);

      // Aplicar filtros de audio
      const filters = [];
      
      if (normalize) {
        filters.push('loudnorm');
      }
      
      if (removeNoise) {
        filters.push('anlmdn'); // Remover ruido
      }

      if (filters.length > 0) {
        ffmpegCommand = ffmpegCommand.audioFilters(filters.join(','));
      }

      // Configurar formato de salida
      ffmpegCommand = ffmpegCommand
        .toFormat(format)
        .audioBitrate(bitrate)
        .audioChannels(2)
        .audioFrequency(44100);

      const processedBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        
        ffmpegCommand
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error procesando audio grabado, usando original:', err.message);
            resolve(audioBuffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      });

      logger.info('✅ Audio grabado procesado', {
        originalSize: audioBuffer.length,
        processedSize: processedBuffer.length,
        compressionRatio: ((audioBuffer.length - processedBuffer.length) / audioBuffer.length * 100).toFixed(1) + '%'
      });

      return processedBuffer;

    } catch (error) {
      logger.error('❌ Error procesando audio grabado', {
        error: error.message,
        bufferSize: audioBuffer?.length
      });
      
      // Fallback: devolver audio original
      return audioBuffer;
    }
  }

  /**
   * 🆕 GUARDAR AUDIO GRABADO
   * Guarda el audio grabado en storage
   */
  async saveRecordedAudio(audioBuffer, options = {}) {
    try {
      const {
        recordingId,
        conversationId,
        format = 'mp3'
      } = options;

      logger.info('💾 Guardando audio grabado', {
        recordingId,
        conversationId: conversationId.substring(0, 20) + '...',
        bufferSize: audioBuffer.length,
        format
      });

      // Guardar en Firebase Storage
      const bucket = this.getBucket();
      const storagePath = `recordings/${conversationId}/${recordingId}.${format}`;
      const file = bucket.file(storagePath);

      await file.save(audioBuffer, {
        metadata: {
          contentType: `audio/${format}`,
          metadata: {
            recordingId,
            conversationId,
            recordedAt: new Date().toISOString(),
            format,
            size: audioBuffer.length
          }
        }
      });

      // Generar URL estable de descarga
      const [meta] = await file.getMetadata();
      let token = (meta && meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || null;
      if (!token) {
        const existingMeta = (meta && meta.metadata) || {};
        token = uuidv4();
        await file.setMetadata({ metadata: { ...existingMeta, firebaseStorageDownloadTokens: token } });
      }
      const signedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

      logger.info('✅ Audio grabado guardado', {
        recordingId,
        storagePath,
        url: signedUrl.substring(0, 50) + '...'
      });

      return {
        recordingId,
        url: signedUrl,
        storagePath,
        metadata: {
          format,
          size: audioBuffer.length,
          recordedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('❌ Error guardando audio grabado', {
        recordingId: options.recordingId,
        conversationId: options.conversationId?.substring(0, 20) + '...',
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = AudioProcessor; 