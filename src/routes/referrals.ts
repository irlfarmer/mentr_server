import express from 'express';
import { ReferralController } from '../controllers/referralController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get user's referral code and link
router.get('/code', authenticate, ReferralController.getReferralCode);

// Get referral statistics
router.get('/stats', authenticate, ReferralController.getReferralStats);

// Process pending earnings
router.post('/process-earnings', authenticate, ReferralController.processPendingEarnings);

// Process referral code during signup (no auth required)
router.post('/process-code', ReferralController.processReferralCode);

export default router;
