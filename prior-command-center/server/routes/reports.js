import express from 'express';
import { generateReport } from '../services/reportGenerator.js';

const router = express.Router();

router.post('/generate', (req, res) => {
  try {
    const { start, end, sections, includeInsights } = req.body;

    if (!start || !end) {
      return res.status(400).json({ ok: false, error: 'start and end dates are required' });
    }

    const validSections = ['klaviyo', 'ga', 'instagram'];
    const requestedSections = (sections || validSections).filter(s => validSections.includes(s));

    const doc = generateReport({
      start,
      end,
      sections: requestedSections,
      includeInsights: includeInsights !== false,
    });

    const filename = `prior-report-${start}-to-${end}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.on('error', (err) => {
      console.error('PDF stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'PDF generation failed' });
      }
    });

    doc.pipe(res);
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
