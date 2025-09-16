import express from 'express';
import { EmailPreferencesController } from '../controllers/emailPreferencesController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get current user's email preferences
router.get('/', authenticate, EmailPreferencesController.getPreferences);

// Update current user's email preferences
router.put('/', authenticate, EmailPreferencesController.updatePreferences);

// Unsubscribe from all emails (public endpoint)
router.post('/unsubscribe/:token', EmailPreferencesController.unsubscribeAll);

// Unsubscribe from specific category (public endpoint)
router.post('/unsubscribe/:token/:category', EmailPreferencesController.unsubscribeCategory);

// Resubscribe to emails (public endpoint)
router.post('/resubscribe/:token', EmailPreferencesController.resubscribe);

// Get unsubscribe page data (public endpoint)
router.get('/unsubscribe/:token', EmailPreferencesController.getUnsubscribePage);

// Admin routes
router.get('/statistics', authenticate, EmailPreferencesController.getStatistics);
router.get('/user/:userId', authenticate, EmailPreferencesController.getPreferencesForUser);
router.put('/user/:userId', authenticate, EmailPreferencesController.updatePreferencesForUser);

export default router;
