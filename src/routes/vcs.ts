import express from 'express';
import path from 'path';

const router = express.Router();

// Serve VCS static files
router.use('/vcs', express.static(path.join(__dirname, '../vcs')));

// Serve the custom overlay component
router.get('/vcs/overlay.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../vcs/CustomOverlay.js'));
});

// Serve the watermark SVG
router.get('/vcs/watermark.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, '../vcs/watermark.svg'));
});

export default router;
