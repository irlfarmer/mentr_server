import express from 'express';
import * as supportController from '../controllers/supportController';
import { authenticate, requireAdmin, optionalAuthenticate } from '../middleware/auth';

const router = express.Router();

// Public / Authed User Routes
router.post('/', optionalAuthenticate, supportController.sendSupportMessage);
router.get('/history', optionalAuthenticate, supportController.getSupportHistory);

// Admin Routes
router.get('/admin/tickets', authenticate, requireAdmin, supportController.getAllSupportTickets);
router.post('/admin/respond', authenticate, requireAdmin, supportController.adminRespondToTicket);
router.post('/admin/toggle-status', authenticate, requireAdmin, supportController.toggleTicketStatus);

export default router;
