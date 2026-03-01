import express from 'express';
import multer from 'multer';
import { parseFromPdf } from '../../services/uploader/pdfParser.js';
import { convertToMarkdown } from '../../services/uploader/markdownConverter.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

router.post('/', (req, res, next) => {
  upload.single('pdfFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const parsed = await parseFromPdf(req.file.buffer);
    const articleBody = convertToMarkdown(parsed.bodyLines, parsed.bodyFontSize);

    res.json({
      title: parsed.title,
      subtitle: parsed.subtitle,
      homepageExcerpt: parsed.subtitle,
      slug: parsed.slug,
      authorName: parsed.authorName,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      keywords: parsed.keywords,
      articleBody,
    });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
