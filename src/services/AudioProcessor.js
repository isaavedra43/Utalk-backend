const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static');
const logger = require('../utils/logger');
const admin = require('firebase-admin');

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
      const transcription = await this.transcribeAudio(processedBuffer);

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
   * Transcribir audio usando IA (placeholder)
   */
  async transcribeAudio(buffer) {
    try {
      // TODO: Integrar con Whisper API o similar
      // const transcription = await whisperAPI.transcribe(buffer);
      // return transcription.text;
      
      logger.info('🎙️ Transcripción de audio pendiente de implementación');
      return null;
    } catch (error) {
      logger.warn('Error en transcripción:', error.message);
      return null;
    }
  }
}

module.exports = AudioProcessor; 