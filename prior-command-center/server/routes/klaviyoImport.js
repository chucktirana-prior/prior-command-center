import express from 'express';
import multer from 'multer';
import { getRecentKlaviyoImportReview } from '../db/index.js';
import { confirmKlaviyoCsvImport, parseAndPreviewKlaviyoCsv } from '../services/connectors/klaviyoCsv.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/review', (req, res) => {
  try {
    res.json({ ok: true, data: getRecentKlaviyoImportReview(50) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/parse', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'CSV file is required' });
    }

    const csvText = req.file.buffer.toString('utf8');
    const preview = parseAndPreviewKlaviyoCsv(csvText, req.file.originalname);
    res.json({ ok: true, preview });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/confirm', (req, res) => {
  try {
    const preview = req.body?.preview;
    if (!preview?.rows?.length) {
      return res.status(400).json({ ok: false, error: 'Preview rows are required' });
    }

    const result = confirmKlaviyoCsvImport(preview, preview.fileName);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

export default router;
