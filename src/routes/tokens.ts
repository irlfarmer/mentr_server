import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  getBalance, 
  createTokenTopUpPaymentIntent,
  confirmTokenTopUp,
  getTransactions, 
  checkBalance 
} from '../controllers/tokenController';

const router = Router();

// All token routes require authentication
router.use(authenticate);

// Get user's token balance
router.get('/balance', getBalance);

// Create payment intent for token top-up
router.post('/create-payment-intent', createTokenTopUpPaymentIntent);

// Confirm token top-up payment
router.post('/confirm-payment', confirmTokenTopUp);

// Get transaction history
router.get('/transactions', getTransactions);

// Check if user has sufficient balance
router.post('/check-balance', checkBalance);

export default router;
