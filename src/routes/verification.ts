import { Router } from 'express';
import { 
  sendVerificationEmail, 
  verifyEmail, 
  resendVerificationEmail, 
  checkVerificationStatus 
} from '../controllers/verificationController';

const router = Router();

// Public routes (no authentication required)
router.post('/send', sendVerificationEmail);
router.post('/verify', verifyEmail);
router.post('/resend', resendVerificationEmail);
router.get('/status', checkVerificationStatus);

export default router;
