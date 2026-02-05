import { Router } from 'express';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  verifyLinkedInProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshToken,
  logout
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter, strictLimiter } from '../middleware/rateLimit';

const router = Router();

// Public routes
// Public routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', strictLimiter, forgotPassword);
router.post('/verify-reset-token', strictLimiter, verifyResetToken);
router.post('/reset-password', strictLimiter, resetPassword);
router.post('/refresh-token', authLimiter, refreshToken);


// Protected routes
router.get('/profile/:userId?', authenticate as any, getProfile as any);
router.put('/profile', authenticate as any, updateProfile as any);
router.post('/linkedin/verify', authenticate as any, verifyLinkedInProfile as any);
router.post('/logout', authenticate as any, logout as any);

export default router;
