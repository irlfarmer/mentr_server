import { Request, Response } from 'express';
import * as crypto from 'crypto';
// Import Daily.co webhook service
import { DailyWebhookService } from '../services/dailyWebhookService';

export class DailyWebhookController {
  // Handle Daily.co webhook events
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['daily-signature'] as string;
      const webhookSecret = process.env.DAILY_WEBHOOK_SECRET;

      // Optional signature verification (Daily.co doesn't always send signatures)
      if (signature && webhookSecret) {
        const isValid = DailyWebhookController.verifySignature(req.body, signature, webhookSecret);
        if (!isValid) {
          console.error('Invalid Daily.co webhook signature');
          res.status(400).json({ error: 'Invalid webhook signature' });
          return;
        }
        console.log('Daily.co webhook signature verified');
      } else {
        console.log('Daily.co webhook received without signature verification');
      }

      const event = req.body;
      console.log('Received Daily.co webhook event:', event.type);

      // Process the webhook event
      await DailyWebhookService.processWebhookEvent(event);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error processing Daily.co webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Verify Daily.co webhook signature
  private static verifySignature(payload: any, signature: string, secret: string): boolean {
    try {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying Daily.co webhook signature:', error);
      return false;
    }
  }
}
