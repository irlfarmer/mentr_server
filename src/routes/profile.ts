import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProfile,
  updateProfile,
  updateAvailability,
  uploadProfileImage,
  addDocument,
  removeDocument,
  getPublicProfile,
  searchProfiles,
  getMentorAvailability,
  deleteAccount
} from '../controllers/profileController';

const router = Router();

// Protected routes (require authentication)
router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);
router.put('/availability', authenticate, updateAvailability);
router.put('/me/image', authenticate, uploadProfileImage);
router.post('/me/documents', authenticate, addDocument);
router.delete('/me/documents/:documentId', authenticate, removeDocument);
router.delete('/me', authenticate, deleteAccount);

// Public routes (no authentication required)
router.get('/:userId', getPublicProfile);
router.get('/search', searchProfiles);
router.get('/mentor/:mentorId/availability', getMentorAvailability);

export default router;
