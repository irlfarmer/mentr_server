import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createPaymentIntent,
  confirmPayment,
  handleWebhook
} from '../controllers/paymentController';

const router = express.Router();

// Public webhook route (no authentication required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected payment routes
router.post('/create-payment-intent', authenticate as any, createPaymentIntent);
router.post('/confirm-payment', authenticate as any, confirmPayment);

export default router;
