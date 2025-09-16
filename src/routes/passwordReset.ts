import { Router } from 'express';
import { 
  requestPasswordReset, 
  resetPassword, 
  validateResetToken,
  changePassword 
} from '../controllers/passwordResetController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/request', requestPasswordReset);
router.post('/reset', resetPassword);
router.get('/validate', validateResetToken);

// Protected route (authentication required)
router.post('/change', authenticate, changePassword);

export default router;
