import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getMentorPayoutHistory,
  getPlatformPayoutStats,
  runManualPayoutCheck,
  getPendingPayouts,
  forceProcessPayout
} from '../controllers/payoutController';

const router = express.Router();

// Mentor routes
router.get('/mentor/history', authenticate, getMentorPayoutHistory);

// Admin routes
router.get('/admin/stats', authenticate, requireAdmin, getPlatformPayoutStats);
router.get('/admin/pending', authenticate, requireAdmin, getPendingPayouts);
router.post('/admin/check', authenticate, requireAdmin, runManualPayoutCheck);
router.post('/admin/force/:bookingId', authenticate, requireAdmin, forceProcessPayout);

export default router;
