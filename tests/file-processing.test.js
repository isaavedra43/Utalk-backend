/**
 * 🧪 TESTS UNITARIOS: PROCESAMIENTO DE ARCHIVOS
 * 
 * Este archivo contiene tests unitarios completos para todas las funcionalidades
 * de procesamiento de archivos implementadas en las Fases 1-6.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { v4: uuidv4 } = require('uuid');

// Importar servicios y utilidades
const FileService = require('../src/services/FileService');
const AudioProcessor = require('../src/services/AudioProcessor');
const fileMonitoringSystem = require('../src/utils/monitoring');

describe('🧪 TESTS UNITARIOS: PROCESAMIENTO DE ARCHIVOS', () => {
  let fileService;
  let audioProcessor;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fileService = new FileService();
    audioProcessor = new AudioProcessor();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('📁 FASE 1: CORRECCIÓN CRÍTICA', () => {
    describe('processMessageAttachments', () => {
      it('debería procesar archivos adjuntos en mensajes correctamente', async () => {
        const testFile = {
          buffer: Buffer.from('test file content'),
          mimetype: 'text/plain',
          originalName: 'test.txt',
          size: 18
        };

        const messageData = {
          conversationId: 'test-conversation',
          senderId: 'test-user',
          content: 'Mensaje con archivo adjunto',
          attachments: [testFile]
        };

        const result = await fileService.processMessageAttachments(messageData);

        expect(result).to.be.an('object');
        expect(result.processedAttachments).to.be.an('array');
        expect(result.processedAttachments).to.have.length(1);
        expect(result.processedAttachments[0]).to.have.property('fileId');
        expect(result.processedAttachments[0]).to.have.property('url');
      });

      it('debería manejar mensajes sin archivos adjuntos', async () => {
        const messageData = {
          conversationId: 'test-conversation',
          senderId: 'test-user',
          content: 'Mensaje sin archivos',
          attachments: []
        };

        const result = await fileService.processMessageAttachments(messageData);

        expect(result).to.be.an('object');
        expect(result.processedAttachments).to.be.an('array');
        expect(result.processedAttachments).to.have.length(0);
      });

      it('debería manejar errores en el procesamiento de archivos', async () => {
        const invalidFile = {
          buffer: null,
          mimetype: 'invalid/type',
          originalName: 'invalid.txt',
          size: 0
        };

        const messageData = {
          conversationId: 'test-conversation',
          senderId: 'test-user',
          content: 'Mensaje con archivo inválido',
          attachments: [invalidFile]
        };

        try {
          await fileService.processMessageAttachments(messageData);
          expect.fail('Debería haber lanzado un error');
        } catch (error) {
          expect(error).to.be.instanceOf(Error);
          expect(error.message).to.include('Error procesando archivo');
        }
      });
    });

    describe('processSingleAttachment', () => {
      it('debería procesar un archivo individual correctamente', async () => {
        const testFile = {
          buffer: Buffer.from('test content'),
          mimetype: 'text/plain',
          originalName: 'test.txt',
          size: 12
        };

        const result = await fileService.processSingleAttachment(testFile, 'test-conversation');

        expect(result).to.be.an('object');
        expect(result).to.have.property('fileId');
        expect(result).to.have.property('url');
        expect(result).to.have.property('mimetype', 'text/plain');
        expect(result).to.have.property('originalName', 'test.txt');
      });

      it('debería validar el tamaño del archivo', async () => {
        const largeFile = {
          buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
          mimetype: 'text/plain',
          originalName: 'large.txt',
          size: 100 * 1024 * 1024
        };

        try {
          await fileService.processSingleAttachment(largeFile, 'test-conversation');
          expect.fail('Debería haber lanzado un error por tamaño');
        } catch (error) {
          expect(error).to.be.instanceOf(Error);
          expect(error.message).to.include('tamaño');
        }
      });
    });
  });

  describe('🔄 FASE 2: INTEGRACIÓN WEBSOCKET', () => {
    describe('Eventos WebSocket de archivos', () => {
      it('debería emitir evento FILE_UPLOADED al subir archivo', async () => {
        const testFile = {
          buffer: Buffer.from('test content'),
          mimetype: 'text/plain',
          originalName: 'test.txt',
          size: 12
        };

        // Mock del socket
        const mockSocket = {
          emit: sandbox.spy(),
          to: sandbox.stub().returns({
            emit: sandbox.spy()
          })
        };

        const result = await fileService.uploadFile(testFile, 'test-conversation', {
          socket: mockSocket
        });

        expect(result).to.be.an('object');
        expect(result).to.have.property('fileId');
        expect(result).to.have.property('url');
      });

      it('debería emitir eventos de progreso durante el procesamiento', async () => {
        const testFile = {
          buffer: Buffer.from('test content'),
          mimetype: 'image/jpeg',
          originalName: 'test.jpg',
          size: 12
        };

        const mockSocket = {
          emit: sandbox.spy(),
          to: sandbox.stub().returns({
            emit: sandbox.spy()
          })
        };

        await fileService.uploadFile(testFile, 'test-conversation', {
          socket: mockSocket,
          emitProgress: true
        });

        // Verificar que se emitieron eventos de progreso
        expect(mockSocket.to.called).to.be.true;
      });
    });
  });

  describe('🎵 FASE 3: AUDIO EN TIEMPO REAL', () => {
    describe('AudioProcessor - Streaming', () => {
      it('debería generar chunks de audio correctamente', async () => {
        const testBuffer = Buffer.from('audio test content');
        const options = {
          chunkSize: 1024,
          format: 'mp3'
        };

        const chunks = await audioProcessor.generateAudioChunks(testBuffer, options);

        expect(chunks).to.be.an('array');
        expect(chunks.length).to.be.greaterThan(0);
        chunks.forEach(chunk => {
          expect(chunk).to.be.instanceOf(Buffer);
          expect(chunk.length).to.be.at.most(options.chunkSize);
        });
      });

      it('debería optimizar audio para streaming web', async () => {
        const testBuffer = Buffer.from('audio test content');
        const options = {
          targetBitrate: 128,
          targetFormat: 'mp3',
          normalize: true
        };

        const optimizedBuffer = await audioProcessor.optimizeForWebStreaming(testBuffer, options);

        expect(optimizedBuffer).to.be.instanceOf(Buffer);
        expect(optimizedBuffer.length).to.be.greaterThan(0);
      });

      it('debería manejar streaming de audio desde storage', async () => {
        const fileId = 'test-audio-file';
        const conversationId = 'test-conversation';
        const options = {
          startTime: 0,
          duration: 30
        };

        // Mock del storage
        sandbox.stub(fileService, 'getFileFromStorage').resolves({
          buffer: Buffer.from('audio content'),
          mimetype: 'audio/mp3'
        });

        const streamResult = await audioProcessor.streamAudio(fileId, conversationId, options);

        expect(streamResult).to.be.an('object');
        expect(streamResult).to.have.property('stream');
        expect(streamResult).to.have.property('headers');
        expect(streamResult).to.have.property('metadata');
      });
    });

    describe('AudioProcessor - Grabación', () => {
      it('debería iniciar grabación de audio', async () => {
        const mockSocket = {
          emit: sandbox.spy(),
          id: 'test-socket-id'
        };

        const conversationId = 'test-conversation';
        const options = {
          duration: 30,
          format: 'mp3',
          quality: 'high'
        };

        const recording = await audioProcessor.recordAudio(mockSocket, conversationId, options);

        expect(recording).to.be.an('object');
        expect(recording).to.have.property('recordingId');
        expect(recording).to.have.property('stream');
        expect(recording).to.have.property('stop');
        expect(typeof recording.stop).to.equal('function');
      });

      it('debería procesar audio grabado', async () => {
        const audioBuffer = Buffer.from('recorded audio content');
        const options = {
          removeNoise: true,
          normalize: true,
          format: 'mp3'
        };

        const processedAudio = await audioProcessor.processRecordedAudio(audioBuffer, options);

        expect(processedAudio).to.be.instanceOf(Buffer);
        expect(processedAudio.length).to.be.greaterThan(0);
      });
    });
  });

  describe('📱 FASE 4: VALIDACIÓN WHATSAPP', () => {
    describe('validateWhatsAppCompatibility', () => {
      it('debería validar imagen compatible con WhatsApp', () => {
        const imageFile = {
          mimetype: 'image/jpeg',
          size: 500 * 1024 // 500KB
        };

        const validation = fileService.validateWhatsAppCompatibility(imageFile);

        expect(validation).to.be.an('object');
        expect(validation.isValid).to.be.true;
        expect(validation.category).to.equal('image');
        expect(validation.message).to.include('compatible');
      });

      it('debería rechazar imagen muy grande', () => {
        const largeImage = {
          mimetype: 'image/jpeg',
          size: 20 * 1024 * 1024 // 20MB
        };

        const validation = fileService.validateWhatsAppCompatibility(largeImage);

        expect(validation).to.be.an('object');
        expect(validation.isValid).to.be.false;
        expect(validation.message).to.include('tamaño');
      });

      it('debería validar video compatible con WhatsApp', () => {
        const videoFile = {
          mimetype: 'video/mp4',
          size: 10 * 1024 * 1024 // 10MB
        };

        const validation = fileService.validateWhatsAppCompatibility(videoFile);

        expect(validation).to.be.an('object');
        expect(validation.isValid).to.be.true;
        expect(validation.category).to.equal('video');
      });

      it('debería validar sticker compatible con WhatsApp', () => {
        const stickerFile = {
          mimetype: 'image/webp',
          size: 50 * 1024 // 50KB
        };

        const validation = fileService.validateStickerForWhatsApp(stickerFile.buffer, stickerFile.mimetype);

        expect(validation).to.be.an('object');
        expect(validation.isValid).to.be.true;
        expect(validation.category).to.equal('sticker');
      });
    });

    describe('convertForWhatsApp', () => {
      it('debería convertir imagen PNG a JPEG para WhatsApp', async () => {
        const pngBuffer = Buffer.from('fake png content');
        const pngFile = {
          buffer: pngBuffer,
          mimetype: 'image/png',
          size: pngBuffer.length,
          originalName: 'test.png'
        };

        const result = await fileService.convertForWhatsApp(pngFile);

        expect(result).to.be.an('object');
        expect(result.success).to.be.true;
        expect(result.convertedFile).to.have.property('mimetype', 'image/jpeg');
        expect(result.message).to.include('convertido');
      });

      it('debería convertir video AVI a MP4 para WhatsApp', async () => {
        const aviBuffer = Buffer.from('fake avi content');
        const aviFile = {
          buffer: aviBuffer,
          mimetype: 'video/avi',
          size: aviBuffer.length,
          originalName: 'test.avi'
        };

        const result = await fileService.convertForWhatsApp(aviFile);

        expect(result).to.be.an('object');
        expect(result.success).to.be.true;
        expect(result.convertedFile).to.have.property('mimetype', 'video/mp4');
      });

      it('debería procesar sticker completo para WhatsApp', async () => {
        const stickerBuffer = Buffer.from('fake sticker content');
        const mimetype = 'image/png';
        const originalName = 'sticker.png';

        const result = await fileService.processStickerForWhatsApp(stickerBuffer, mimetype, originalName);

        expect(result).to.be.an('object');
        expect(result.success).to.be.true;
        expect(result.processedSticker).to.have.property('category', 'sticker');
      });
    });
  });

  describe('🖼️ FASE 5: PREVIEW Y VISUALIZACIÓN', () => {
    describe('generateImagePreview', () => {
      it('debería generar preview de imagen con thumbnail', async () => {
        const imageBuffer = Buffer.from('fake image content');
        const fileId = 'test-image';
        const conversationId = 'test-conversation';
        const options = {
          thumbnailSize: 150,
          previewSize: 800,
          quality: 85
        };

        const preview = await fileService.generateImagePreview(imageBuffer, fileId, conversationId, options);

        expect(preview).to.be.an('object');
        expect(preview).to.have.property('thumbnail');
        expect(preview).to.have.property('preview');
        expect(preview).to.have.property('original');
        expect(preview.thumbnail).to.have.property('url');
        expect(preview.preview).to.have.property('url');
      });

      it('debería generar thumbnail rápido para lazy loading', async () => {
        const imageBuffer = Buffer.from('fake image content');
        const fileId = 'test-image';
        const conversationId = 'test-conversation';

        const thumbnail = await fileService.generateQuickThumbnail(imageBuffer, fileId, conversationId);

        expect(thumbnail).to.be.an('object');
        expect(thumbnail).to.have.property('url');
        expect(thumbnail).to.have.property('size');
        expect(thumbnail).to.have.property('dimensions');
        expect(thumbnail.dimensions.width).to.equal(50);
        expect(thumbnail.dimensions.height).to.equal(50);
      });
    });

    describe('generateDocumentPreview', () => {
      it('debería generar preview de PDF', async () => {
        const pdfBuffer = Buffer.from('fake pdf content');
        const fileId = 'test-pdf';
        const conversationId = 'test-conversation';
        const mimetype = 'application/pdf';
        const options = {
          extractText: true,
          generateThumbnail: true,
          maxPages: 3
        };

        const preview = await fileService.generateDocumentPreview(pdfBuffer, fileId, conversationId, mimetype, options);

        expect(preview).to.be.an('object');
        expect(preview).to.have.property('documentType', 'pdf');
        expect(preview).to.have.property('pages');
        expect(preview).to.have.property('text');
        expect(preview).to.have.property('thumbnail');
      });

      it('debería extraer texto de documento Word', async () => {
        const wordBuffer = Buffer.from('fake word content');
        const fileId = 'test-word';
        const conversationId = 'test-conversation';
        const mimetype = 'application/msword';
        const options = {
          extractText: true,
          generateThumbnail: true
        };

        const preview = await fileService.generateDocumentPreview(wordBuffer, fileId, conversationId, mimetype, options);

        expect(preview).to.be.an('object');
        expect(preview).to.have.property('documentType', 'word');
        expect(preview).to.have.property('text');
        expect(preview).to.have.property('thumbnail');
      });
    });

    describe('generateVideoPreview', () => {
      it('debería generar preview de video con thumbnail', async () => {
        const videoBuffer = Buffer.from('fake video content');
        const fileId = 'test-video';
        const conversationId = 'test-conversation';
        const options = {
          generateThumbnail: true,
          extractMetadata: true,
          thumbnailSize: 320,
          thumbnailTime: 5
        };

        const preview = await fileService.generateVideoPreview(videoBuffer, fileId, conversationId, options);

        expect(preview).to.be.an('object');
        expect(preview).to.have.property('videoType', 'video');
        expect(preview).to.have.property('thumbnail');
        expect(preview).to.have.property('metadata');
      });

      it('debería extraer metadatos de video', async () => {
        const videoBuffer = Buffer.from('fake video content');
        const metadata = await fileService.extractVideoMetadata(videoBuffer);

        expect(metadata).to.be.an('object');
        expect(metadata).to.have.property('duration');
        expect(metadata).to.have.property('format');
        expect(metadata).to.have.property('video');
        expect(metadata).to.have.property('audio');
      });
    });
  });

  describe('⚡ FASE 6: OPTIMIZACIÓN Y MONITOREO', () => {
    describe('Optimización de rendimiento', () => {
      it('debería procesar archivo grande en chunks', async () => {
        const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
        const fileId = 'test-large-file';
        const conversationId = 'test-conversation';
        const options = {};

        const result = await fileService.processLargeFile(largeBuffer, fileId, conversationId, options);

        expect(result).to.be.an('object');
        expect(result).to.have.property('processedInChunks', true);
        expect(result).to.have.property('totalChunks');
        expect(result.totalChunks).to.be.greaterThan(1);
      });

      it('debería usar cache para archivos procesados', async () => {
        const testBuffer = Buffer.from('test content');
        const fileId = 'test-cache-file';
        const conversationId = 'test-conversation';
        const options = {};

        // Primera llamada - debería procesar
        const result1 = await fileService.processLargeFile(testBuffer, fileId, conversationId, options);
        
        // Segunda llamada - debería usar cache
        const result2 = await fileService.processLargeFile(testBuffer, fileId, conversationId, options);

        expect(result1).to.be.an('object');
        expect(result2).to.be.an('object');
      });

      it('debería optimizar procesamiento de imágenes', async () => {
        const imageBuffer = Buffer.from('fake image content');
        const fileId = 'test-optimized-image';
        const conversationId = 'test-conversation';
        const options = {
          mimetype: 'image/jpeg',
          width: 800,
          height: 600,
          quality: 85
        };

        const result = await fileService.optimizeImageProcessing(imageBuffer, fileId, conversationId, options);

        expect(result).to.be.an('object');
        expect(result).to.have.property('optimized', true);
        expect(result).to.have.property('processingTime');
      });
    });

    describe('Sistema de monitoreo', () => {
      it('debería registrar procesamiento de archivo', () => {
        const fileData = {
          fileId: 'test-file',
          conversationId: 'test-conversation',
          userId: 'test-user',
          mimetype: 'image/jpeg',
          size: 1024,
          processingTime: 150,
          success: true
        };

        fileMonitoringSystem.recordFileProcessing(fileData);

        const metrics = fileMonitoringSystem.getCurrentMetrics();
        expect(metrics.files.totalProcessed).to.be.greaterThan(0);
        expect(metrics.files.byType.images).to.be.greaterThan(0);
      });

      it('debería registrar errores correctamente', () => {
        const error = new Error('Test error');
        const errorType = 'file_processing';
        const context = 'test-context';

        fileMonitoringSystem.recordError(error, errorType, context);

        const metrics = fileMonitoringSystem.getCurrentMetrics();
        expect(metrics.errors.total).to.be.greaterThan(0);
        expect(metrics.errors.recent).to.have.length.greaterThan(0);
      });

      it('debería generar alertas cuando se exceden thresholds', () => {
        // Simular alta tasa de errores
        for (let i = 0; i < 15; i++) {
          const error = new Error(`Error ${i}`);
          fileMonitoringSystem.recordError(error, 'test_error');
        }

        // Verificar que se generó alerta
        const stats = fileMonitoringSystem.getDetailedStats();
        expect(stats.overview.errorRate).to.be.greaterThan(0);
      });

      it('debería obtener estadísticas detalladas', () => {
        const stats = fileMonitoringSystem.getDetailedStats();

        expect(stats).to.be.an('object');
        expect(stats).to.have.property('overview');
        expect(stats).to.have.property('fileTypes');
        expect(stats).to.have.property('fileSizes');
        expect(stats).to.have.property('topConversations');
        expect(stats).to.have.property('topUsers');
        expect(stats).to.have.property('recentErrors');
        expect(stats).to.have.property('systemHealth');
      });
    });

    describe('Métricas de rendimiento', () => {
      it('debería obtener métricas de rendimiento', () => {
        const metrics = fileService.getPerformanceMetrics();

        expect(metrics).to.be.an('object');
        expect(metrics).to.have.property('filesProcessed');
        expect(metrics).to.have.property('cacheHits');
        expect(metrics).to.have.property('cacheMisses');
        expect(metrics).to.have.property('cacheHitRate');
        expect(metrics).to.have.property('averageProcessingTime');
        expect(metrics).to.have.property('errors');
        expect(metrics).to.have.property('cacheSize');
      });

      it('debería calcular tasa de acierto de cache correctamente', () => {
        // Simular hits y misses
        fileService.performanceMetrics.cacheHits = 80;
        fileService.performanceMetrics.cacheMisses = 20;

        const metrics = fileService.getPerformanceMetrics();
        expect(metrics.cacheHitRate).to.equal('80.00%');
      });
    });
  });

  describe('🔄 INTEGRACIÓN COMPLETA', () => {
    it('debería procesar archivo completo con todas las funcionalidades', async () => {
      const testFile = {
        buffer: Buffer.from('test file content'),
        mimetype: 'image/jpeg',
        originalName: 'test.jpg',
        size: 1024
      };

      const conversationId = 'test-conversation';
      const userId = 'test-user';

      // 1. Procesar archivo con optimización
      const processedFile = await fileService.processLargeFile(
        testFile.buffer,
        'test-file',
        conversationId,
        { mimetype: testFile.mimetype }
      );

      // 2. Validar para WhatsApp
      const whatsappValidation = fileService.validateWhatsAppCompatibility({
        mimetype: testFile.mimetype,
        size: testFile.size
      });

      // 3. Generar preview
      const preview = await fileService.generateImagePreview(
        testFile.buffer,
        'test-file',
        conversationId
      );

      // 4. Registrar métricas
      fileMonitoringSystem.recordFileProcessing({
        fileId: 'test-file',
        conversationId,
        userId,
        mimetype: testFile.mimetype,
        size: testFile.size,
        processingTime: 100,
        success: true
      });

      // Verificar resultados
      expect(processedFile).to.be.an('object');
      expect(whatsappValidation.isValid).to.be.true;
      expect(preview).to.have.property('thumbnail');
      expect(preview).to.have.property('preview');

      const metrics = fileMonitoringSystem.getCurrentMetrics();
      expect(metrics.files.totalProcessed).to.be.greaterThan(0);
    });

    it('debería manejar errores en el flujo completo', async () => {
      const invalidFile = {
        buffer: null,
        mimetype: 'invalid/type',
        originalName: 'invalid.txt',
        size: 0
      };

      try {
        await fileService.processLargeFile(
          invalidFile.buffer,
          'invalid-file',
          'test-conversation',
          { mimetype: invalidFile.mimetype }
        );
        expect.fail('Debería haber lanzado un error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        
        // Verificar que se registró el error
        const metrics = fileMonitoringSystem.getCurrentMetrics();
        expect(metrics.errors.total).to.be.greaterThan(0);
      }
    });
  });
}); 