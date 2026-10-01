import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Répertoire de stockage local sécurisé sur cPanel
const STORAGE_DIR = path.resolve(__dirname, '../../storage/uploads');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Configuration du stockage Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Filtres de sécurité pour types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'application/zip'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 Mo max
  }
});

/**
 * POST /api/files/upload
 * Téléverse un fichier sur le stockage local cPanel
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier transmis.' });
    }

    const fileUrl = `/api/files/view/${req.file.filename}`;
    const downloadUrl = `/api/files/download/${req.file.filename}`;

    return res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: fileUrl,
        downloadUrl
      }
    });
  } catch (error) {
    console.error('[Upload Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/files/view/:filename
 * Consultation en ligne (affichage direct dans le navigateur)
 */
router.get('/view/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Assainissement contre directory traversal
    const filePath = path.join(STORAGE_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable.' });
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/files/download/:filename
 * Téléchargement forcé du fichier
 */
router.get('/download/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(STORAGE_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable.' });
    }

    return res.download(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/files/:filename
 * Suppression d'un fichier du stockage local
 */
router.delete('/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(STORAGE_DIR, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({ success: true, message: 'Fichier supprimé avec succès.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
