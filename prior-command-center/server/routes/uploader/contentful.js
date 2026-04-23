import express from 'express';
import {
  searchAuthors,
  listCategories,
  createDraftArticle,
  searchArticlesBySlugs,
} from '../../services/uploader/contentful.js';

const router = express.Router();

router.get('/authors', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const authors = await searchAuthors(q);
    res.json(authors);
  } catch (err) {
    console.error('Author search error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await listCategories();
    res.json(categories);
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/related-articles', async (req, res) => {
  try {
    const slugs = [].concat(req.query.slug || []).filter(Boolean);
    if (!slugs.length) return res.json({ articles: [] });
    const articles = await searchArticlesBySlugs(slugs);
    res.json({ articles });
  } catch (err) {
    console.error('Related articles search error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/draft', async (req, res) => {
  try {
    const result = await createDraftArticle(req.body);
    res.json(result);
  } catch (err) {
    console.error('Draft creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
