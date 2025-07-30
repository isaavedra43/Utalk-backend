const ffmpeg = require('fluent-ffmpeg');
const ffprobe = require('ffprobe-static');
const logger = require('../utils/logger');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio de procesamiento de audio con Firebase Storage
 * Procesa archivos de audio directamente en memoria sin almacenamiento local
 */
class AudioProcessor {
  constructor() {
    this.storage = new Storage();
    this.bucket = admin.storage().bucket();
    
    // Configurar FFmpeg para usar el binario estático
    ffmpeg.setFfprobePath(ffprobe);
  }

  /**
   * Extraer metadatos de audio desde buffer
   */
  async extractMetadata(audioBuffer) {
    try {
      return new Promise((resolve, reject) => {
        // Crear un stream temporal en memoria
        const Readable = require('stream').Readable;
        const audioStream = new Readable();
        audioStream.push(audioBuffer);
        audioStream.push(null);

        ffmpeg(audioStream)
          .ffprobe((err, metadata) => {
            if (err) {
              logger.error('Error extrayendo metadatos de audio:', err);
              reject(err);
              return;
            }

            const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
            if (!audioStream) {
              reject(new Error('No se encontró stream de audio válido'));
              return;
            }

            const audioMetadata = {
              duration: this.formatDuration(parseFloat(metadata.format.duration) || 0),
              durationSeconds: parseFloat(metadata.format.duration) || 0,
              bitrate: parseInt(audioStream.bit_rate) || 0,
              sampleRate: parseInt(audioStream.sample_rate) || 0,
              channels: parseInt(audioStream.channels) || 0,
              codec: audioStream.codec_name || 'unknown',
              format: metadata.format.format_name || 'unknown',
              size: parseInt(metadata.format.size) || audioBuffer.length
            };

            logger.info('Metadatos de audio extraídos:', audioMetadata);
            resolve(audioMetadata);
          });
      });
    } catch (error) {
      logger.error('Error procesando metadatos de audio:', error);
      throw error;
    }
  }

  /**
   * Convertir audio a MP3 y subir a Firebase Storage
   */
  async convertToMp3AndUpload(audioBuffer, originalFilename, conversationId) {
    try {
      const fileId = uuidv4();
      const mp3Filename = `${fileId}.mp3`;
      const storagePath = `audio/${conversationId}/${mp3Filename}`;

      return new Promise((resolve, reject) => {
        // Crear streams en memoria
        const Readable = require('stream').Readable;
        const { PassThrough } = require('stream');
        
        const inputStream = new Readable();
        inputStream.push(audioBuffer);
        inputStream.push(null);
        
        const outputStream = new PassThrough();
        const chunks = [];

        // Configurar conversión a MP3
        ffmpeg(inputStream)
          .toFormat('mp3')
          .audioBitrate(128)
          .audioChannels(2)
          .audioFrequency(44100)
          .on('error', (err) => {
            logger.error('Error convirtiendo audio a MP3:', err);
            reject(err);
          })
          .on('end', async () => {
            try {
              const mp3Buffer = Buffer.concat(chunks);
              
              // Subir a Firebase Storage
              const file = this.bucket.file(storagePath);
              await file.save(mp3Buffer, {
                metadata: {
                  contentType: 'audio/mpeg',
                  metadata: {
                    originalName: originalFilename,
                    conversationId: conversationId,
                    processedAt: new Date().toISOString(),
                    fileId: fileId
                  }
                }
              });

              // Generar URL firmada
              const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
              });

              const result = {
                fileId,
                storagePath,
                signedUrl,
                size: mp3Buffer.length,
                contentType: 'audio/mpeg',
                processed: true
              };

              logger.info('Audio convertido y subido a Firebase Storage:', result);
              resolve(result);
            } catch (uploadError) {
              logger.error('Error subiendo audio a Firebase Storage:', uploadError);
              reject(uploadError);
            }
          })
          .pipe(outputStream);

        outputStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
      });
    } catch (error) {
      logger.error('Error en conversión y subida de audio:', error);
      throw error;
    }
  }

  /**
   * Procesar audio completo: metadatos + conversión + subida
   */
  async processAudio(audioBuffer, originalFilename, conversationId) {
    try {
      logger.info('Iniciando procesamiento completo de audio:', {
        originalFilename,
        conversationId,
        bufferSize: audioBuffer.length
      });

      // Extraer metadatos del audio original
      const metadata = await this.extractMetadata(audioBuffer);
      
      // Convertir a MP3 y subir a Firebase Storage
      const uploadResult = await this.convertToMp3AndUpload(audioBuffer, originalFilename, conversationId);
      
      // Combinar resultados
      const result = {
        ...uploadResult,
        metadata: {
          ...metadata,
          originalFilename,
          processedAt: new Date().toISOString()
        }
      };

      logger.info('Procesamiento de audio completado:', result);
      return result;
    } catch (error) {
      logger.error('Error en procesamiento de audio:', error);
      throw error;
    }
  }

  /**
   * Formatear duración en formato legible
   */
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Obtener metadatos de archivo de audio desde Firebase Storage
   */
  async getAudioMetadata(storagePath) {
    try {
      const file = this.bucket.file(storagePath);
      const [metadata] = await file.getMetadata();
      
      return {
        name: metadata.name,
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        customMetadata: metadata.metadata || {}
      };
    } catch (error) {
      logger.error('Error obteniendo metadatos de audio:', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo de audio de Firebase Storage
   */
  async deleteAudio(storagePath) {
    try {
      const file = this.bucket.file(storagePath);
      await file.delete();
      
      logger.info('Audio eliminado de Firebase Storage:', { storagePath });
      return true;
    } catch (error) {
      logger.error('Error eliminando audio:', error);
      throw error;
    }
  }
}

module.exports = new AudioProcessor(); 