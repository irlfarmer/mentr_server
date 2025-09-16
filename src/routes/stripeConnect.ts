import express from 'express';
import { 
  createConnectAccount, 
  getConnectAccountStatus, 
  createAccountLink, 
  handleConnectWebhook 
} from '../controllers/stripeConnectController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create Stripe Connect account
router.post('/create', authenticate, createConnectAccount);

// Get Connect account status
router.get('/status', authenticate, getConnectAccountStatus);

// Create account link for onboarding/updates
router.post('/account-link', authenticate, createAccountLink);

// Stripe Connect webhook (no auth required)
router.post('/webhook', handleConnectWebhook);

export default router;
