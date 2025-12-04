const { db } = require('../config/firebase');

class HRDocumentsController {
  static async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        category = null,
        folderId = null,
        isConfidential = null,
        status = 'active',
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      let query = db.collection('hr_documents');

      if (status) query = query.where('status', '==', status);
      if (category) query = query.where('category', '==', category);
      if (folderId) query = query.where('folderId', '==', folderId);
      if (isConfidential !== null && isConfidential !== undefined) {
        query = query.where('isConfidential', '==', String(isConfidential) === 'true');
      }

      // Firestore no soporta full-text; aplicamos filtro simple en memoria sobre el resultado paginado
      const snap = await query.orderBy(sortBy, sortOrder === 'asc' ? 'asc' : 'desc').limit(500).get();
      let documents = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.status !== 'deleted');

      if (search) {
        const s = search.toLowerCase();
        documents = documents.filter(d =>
          (d.title || '').toLowerCase().includes(s) ||
          (d.originalName || '').toLowerCase().includes(s) ||
          (Array.isArray(d.tags) ? d.tags.join(' ').toLowerCase() : '').includes(s)
        );
      }

      const total = documents.length;
      const start = (pageNum - 1) * limitNum;
      const paged = documents.slice(start, start + limitNum);

      return res.json({
        success: true,
        data: {
          documents: paged,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 0
          }
        }
      });
    } catch (error) {
      console.error('HRDocuments.list error', error);
      return res.json({ success: true, data: { documents: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
    }
  }

  static async summary(req, res) {
    try {
      const snap = await db.collection('hr_documents').get();
      const byCategoryKeys = ['contract','identification','payroll','medical','training','performance','other'];
      const byCategory = byCategoryKeys.reduce((acc, k) => (acc[k] = 0, acc), {});
      let totalDocuments = 0;
      let totalSizeBytes = 0;

      snap.forEach(doc => {
        const d = doc.data();
        if (d.status === 'deleted') return;
        totalDocuments += 1;
        totalSizeBytes += Number(d.fileSize || 0);
        const cat = d.category && byCategory.hasOwnProperty(d.category) ? d.category : 'other';
        byCategory[cat] += 1;
      });

      const foldersSnap = await db.collection('hr_document_folders').get();
      const totalFolders = foldersSnap.size || 0;

      return res.json({ success: true, data: { totalDocuments, totalSizeBytes, totalFolders, byCategory } });
    } catch (error) {
      console.error('HRDocuments.summary error', error);
      return res.json({ success: true, data: { totalDocuments: 0, totalSizeBytes: 0, totalFolders: 0, byCategory: { contract:0, identification:0, payroll:0, medical:0, training:0, performance:0, other:0 } } });
    }
  }

  static async folders(req, res) {
    try {
      const snap = await db.collection('hr_document_folders').get();
      if (snap.empty) {
        // devolver al menos raíz
        return res.json({ success: true, data: [{ id: 'root', name: 'Todos', parentId: null, path: [] }] });
      }
      const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // asegurar raíz
      const hasRoot = folders.some(f => f.id === 'root');
      if (!hasRoot) folders.unshift({ id: 'root', name: 'Todos', parentId: null, path: [] });
      return res.json({ success: true, data: folders });
    } catch (error) {
      console.error('HRDocuments.folders error', error);
      return res.json({ success: true, data: [{ id: 'root', name: 'Todos', parentId: null, path: [] }] });
    }
  }
}

module.exports = HRDocumentsController;


