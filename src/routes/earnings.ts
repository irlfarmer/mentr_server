import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { 
  getMentorEarnings, 
  getMonthlyEarnings,
  getCommissionTiers, 
  getTierProgress,
  getAllMentorEarnings,
  updateMentorTier
} from '../controllers/earningsController';

const router = Router();

// Public routes
router.get('/tiers', getCommissionTiers);

// Authenticated routes
router.get('/mentor', authenticate, getMentorEarnings);
router.get('/monthly', authenticate, getMonthlyEarnings);
router.get('/tier-progress', authenticate, getTierProgress);

// Admin routes
router.get('/all', authenticate, requireAdmin, getAllMentorEarnings);
router.put('/update-tier', authenticate, requireAdmin, updateMentorTier);

export default router;
