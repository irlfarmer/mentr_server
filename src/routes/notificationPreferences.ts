import express from 'express';
import { NotificationPreferencesController } from '../controllers/notificationPreferencesController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get current user's notification preferences
router.get('/', authenticate, NotificationPreferencesController.getPreferences);

// Update current user's notification preferences
router.put('/', authenticate, NotificationPreferencesController.updatePreferences);

// Reset current user's notification preferences to defaults
router.post('/reset', authenticate, NotificationPreferencesController.resetPreferences);

// Admin routes for managing other users' preferences
router.get('/user/:userId', authenticate, NotificationPreferencesController.getPreferencesForUser);
router.put('/user/:userId', authenticate, NotificationPreferencesController.updatePreferencesForUser);

export default router;
