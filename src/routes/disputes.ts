import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  createDispute,
  getUserDisputes,
  getDispute,
  mentorRespondToDispute,
  getAllDisputes,
  resolveDispute,
  dismissDispute
} from '../controllers/disputeController';

const router = express.Router();

// User routes (mentee and mentor)
router.post('/', authenticate, createDispute);
router.get('/user', authenticate, getUserDisputes);
router.get('/:disputeId', authenticate, getDispute);
router.put('/:disputeId/respond', authenticate, mentorRespondToDispute);

// Admin routes
router.get('/admin/all', authenticate, requireAdmin, getAllDisputes);
router.put('/admin/:disputeId/resolve', authenticate, requireAdmin, resolveDispute);
router.put('/admin/:disputeId/dismiss', authenticate, requireAdmin, dismissDispute);

export default router;
