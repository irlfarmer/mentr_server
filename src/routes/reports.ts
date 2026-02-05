import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../controllers/adminController';
import {
  createReport,
  getReports,
  updateReportStatus,
  getReportStats
} from '../controllers/reportController';

const router = express.Router();

// User routes
router.post('/', authenticate, createReport);

// Admin routes
router.get('/', authenticate, requireAdmin, getReports);
router.patch('/:id', authenticate, requireAdmin, updateReportStatus);
router.get('/stats', authenticate, requireAdmin, getReportStats);

export default router;
