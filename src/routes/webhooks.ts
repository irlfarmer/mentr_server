import express from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = express.Router();

// Stripe webhook endpoint (must be raw body for signature verification)
router.post('/stripe', express.raw({ type: 'application/json' }), WebhookController.handleWebhook);

// Health check for webhooks
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
