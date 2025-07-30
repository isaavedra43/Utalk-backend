const ffmpeg = require('fluent-ffmpeg');
const ffprobe = require('ffprobe-static');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

// CONFIGURAR FFMPEG
if (ffprobe) {
  ffmpeg.setFfprobePath(ffprobe.path);
}

/**
 * SERVICIO DE PROCESAMIENTO DE AUDIO
 * Extrae metadatos, convierte formatos y procesa archivos de audio
 */
class AudioProcessor {
  
  /**
   * EXTRAER METADATOS DE AUDIO
   */
  async extractMetadata(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        // Crear archivo temporal
        const tempPath = path.join(__dirname, '../../temp', `temp_audio_${Date.now()}.tmp`);
        
        // Escribir buffer a archivo temporal
        fs.writeFile(tempPath, audioBuffer)
          .then(() => {
            // Usar ffprobe para extraer metadatos
            ffmpeg.ffprobe(tempPath, async (err, metadata) => {
              // Limpiar archivo temporal
              try {
                await fs.unlink(tempPath);
              } catch (unlinkError) {
                logger.warn('Error eliminando archivo temporal:', unlinkError);
              }

              if (err) {
                logger.error('Error extrayendo metadatos de audio:', err);
                return reject(err);
              }

              try {
                const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
                
                const processedMetadata = {
                  duration: this.formatDuration(metadata.format.duration),
                  durationSeconds: parseFloat(metadata.format.duration) || 0,
                  bitrate: parseInt(metadata.format.bit_rate) || null,
                  format: metadata.format.format_name,
                  codec: audioStream?.codec_name || 'unknown',
                  sampleRate: parseInt(audioStream?.sample_rate) || null,
                  channels: parseInt(audioStream?.channels) || null,
                  size: parseInt(metadata.format.size) || audioBuffer.length,
                  tags: metadata.format.tags || {}
                };

                logger.info('Metadatos de audio extraídos', {
                  duration: processedMetadata.duration,
                  format: processedMetadata.format,
                  size: processedMetadata.size
                });

                resolve(processedMetadata);
              } catch (parseError) {
                logger.error('Error procesando metadatos:', parseError);
                reject(parseError);
              }
            });
          })
          .catch(writeError => {
            logger.error('Error escribiendo archivo temporal:', writeError);
            reject(writeError);
          });

      } catch (error) {
        logger.error('Error en extractMetadata:', error);
        reject(error);
      }
    });
  }

  /**
   * CONVERTIR AUDIO A MP3
   */
  async convertToMp3(audioBuffer, originalFormat) {
    return new Promise((resolve, reject) => {
      try {
        // Si ya es MP3, no convertir
        if (originalFormat.includes('mp3') || originalFormat.includes('mpeg')) {
          logger.info('Audio ya está en formato MP3, omitiendo conversión');
          return resolve(audioBuffer);
        }

        const tempInputPath = path.join(__dirname, '../../temp', `input_${Date.now()}.tmp`);
        const tempOutputPath = path.join(__dirname, '../../temp', `output_${Date.now()}.mp3`);

        // Escribir buffer de entrada
        fs.writeFile(tempInputPath, audioBuffer)
          .then(() => {
            // Convertir usando ffmpeg
            ffmpeg(tempInputPath)
              .audioCodec('libmp3lame')
              .audioBitrate(128)
              .audioChannels(2)
              .audioFrequency(44100)
              .output(tempOutputPath)
              .on('end', async () => {
                try {
                  // Leer archivo convertido
                  const convertedBuffer = await fs.readFile(tempOutputPath);
                  
                  // Limpiar archivos temporales
                  await Promise.all([
                    fs.unlink(tempInputPath).catch(() => {}),
                    fs.unlink(tempOutputPath).catch(() => {})
                  ]);

                  logger.info('Audio convertido a MP3 exitosamente', {
                    originalSize: audioBuffer.length,
                    convertedSize: convertedBuffer.length
                  });

                  resolve(convertedBuffer);
                } catch (readError) {
                  logger.error('Error leyendo archivo convertido:', readError);
                  reject(readError);
                }
              })
              .on('error', async (err) => {
                // Limpiar archivos temporales en caso de error
                await Promise.all([
                  fs.unlink(tempInputPath).catch(() => {}),
                  fs.unlink(tempOutputPath).catch(() => {})
                ]);

                logger.error('Error convirtiendo audio a MP3:', err);
                reject(err);
              })
              .run();
          })
          .catch(writeError => {
            logger.error('Error escribiendo archivo temporal para conversión:', writeError);
            reject(writeError);
          });

      } catch (error) {
        logger.error('Error en convertToMp3:', error);
        reject(error);
      }
    });
  }

  /**
   * TRANSCRIBIR AUDIO (PLACEHOLDER PARA IA)
   * Integrar con OpenAI Whisper u otro servicio
   */
  async transcribeAudio(audioBuffer) {
    try {
      // Implementar transcripción real con Whisper
      logger.info('Transcripción de audio pendiente de implementación');
      
      // Por ahora retornar null
      return {
        transcription: null,
        language: null,
        confidence: null,
        transcribedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error en transcripción de audio:', error);
      return {
        transcription: null,
        error: error.message,
        transcribedAt: new Date().toISOString()
      };
    }
  }

  /**
   * PROCESAR AUDIO COMPLETO
   */
  async processAudio(audioBuffer, originalFilename) {
    try {
      logger.info('🎵 Iniciando procesamiento de audio', {
        filename: originalFilename,
        size: audioBuffer.length
      });

      // 1. Extraer metadatos
      const metadata = await this.extractMetadata(audioBuffer);

      // 2. Convertir a MP3 si es necesario
      const mp3Buffer = await this.convertToMp3(audioBuffer, metadata.format);

      // 3. Transcribir audio (opcional)
      const transcription = await this.transcribeAudio(mp3Buffer);

      const result = {
        processedBuffer: mp3Buffer,
        metadata: {
          ...metadata,
          ...transcription,
          originalFilename,
          processedAt: new Date().toISOString(),
          processed: true
        }
      };

      logger.info('Audio procesado exitosamente', {
        filename: originalFilename,
        duration: metadata.duration,
        originalSize: audioBuffer.length,
        processedSize: mp3Buffer.length
      });

      return result;

    } catch (error) {
      logger.error('Error procesando audio:', error);
      
      // En caso de error, devolver buffer original
      return {
        processedBuffer: audioBuffer,
        metadata: {
          originalFilename,
          processedAt: new Date().toISOString(),
          processed: false,
          error: error.message
        }
      };
    }
  }

  /**
   * FORMATEAR DURACIÓN
   */
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';
    
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
   * VERIFICAR SI ES ARCHIVO DE AUDIO
   */
  isAudioFile(mimeType) {
    const audioTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
      'audio/webm', 'audio/m4a', 'audio/aac', 'audio/flac'
    ];
    return audioTypes.includes(mimeType);
  }
}

module.exports = new AudioProcessor(); 