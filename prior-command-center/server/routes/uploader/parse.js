import express from 'express';
import multer from 'multer';
import { parseFromPdf } from '../../services/uploader/pdfParser.js';
import { convertToMarkdown, scrubLeadingMetadata } from '../../services/uploader/markdownConverter.js';

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
    const rawArticleBody = convertToMarkdown(parsed.bodyLines, parsed.bodyFontSize);
    const { markdown: articleBody, recovered } = scrubLeadingMetadata(rawArticleBody, parsed);

    console.log('[parse] keepReading text:', parsed.keepReading || '(empty)');
    console.log('[parse] keepReadingLinks:', parsed.keepReadingLinks?.length ? parsed.keepReadingLinks : '(none found)');

    res.json({
      title: parsed.title,
      subtitle: parsed.subtitle,
      homepageExcerpt: parsed.subtitle,
      slug: parsed.slug || recovered.slug || '',
      authorName: parsed.authorName,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      keywords: parsed.keywords?.length ? parsed.keywords : (recovered.keywords || []),
      bio: parsed.bio,
      social: parsed.social || recovered.social || '',
      category: parsed.category || recovered.category || '',
      location: parsed.location || recovered.location || '',
      heroCaption: parsed.heroCaption || recovered.heroCaption || '',
      keepReading: parsed.keepReading || recovered.keepReading || '',
      emailSl: parsed.emailSl || recovered.emailSl || '',
      emailPt: parsed.emailPt || recovered.emailPt || '',
      captions: parsed.captions,
      keepReadingLinks: parsed.keepReadingLinks || [],
      articleBody,
    });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
