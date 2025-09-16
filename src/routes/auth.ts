import { Router } from 'express';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  verifyLinkedInProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);


// Protected routes
router.get('/profile/:userId?', authenticate as any, getProfile as any);
router.put('/profile', authenticate as any, updateProfile as any);
router.post('/linkedin/verify', authenticate as any, verifyLinkedInProfile as any);

export default router;
