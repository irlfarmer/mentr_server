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

// Protected routes (require auth)
import { authenticate } from '../middleware/auth';
import { 
  initializeVerification, 
  verifyVerificationPayment, 
  uploadVerificationDocuments 
} from '../controllers/verificationController';

router.post('/purchase', authenticate, initializeVerification);
router.post('/verify-payment', authenticate, verifyVerificationPayment);
router.post('/upload', authenticate, uploadVerificationDocuments);

export default router;
