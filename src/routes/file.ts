import express from 'express';
import { uploadMessage } from '../config/cloudinary';
import { authenticate } from '../middleware/auth';
import { uploadSharedFile, getMeetingFiles, proxyCloudinaryFile } from '../controllers/fileController';

const router = express.Router();

// Upload shared file
// Uses the uploadMessage middleware for permanent storage
router.post('/upload', authenticate, uploadMessage.single('file'), uploadSharedFile);

// Get meeting files
router.get('/meeting/:meetingId', authenticate, getMeetingFiles);

// Proxy endpoint to serve raw files from Cloudinary (no auth needed - files are already shared)
router.get('/proxy/:publicId(*)', proxyCloudinaryFile);

export default router;
