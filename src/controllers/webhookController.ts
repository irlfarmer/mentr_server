import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import { WebhookService } from '../services/webhookService';

export class WebhookController {
  // Handle Stripe webhook events
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;


    let event;

    try {
      // Verify webhook signature - convert Buffer to string
      const body = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
      event = StripeService.verifyWebhookSignature(
        body,
        sig,
        endpointSecret
      );
    } catch (err) {
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    try {
      // Validate webhook event
      if (!WebhookService.validateWebhookEvent(event)) {
        res.status(400).json({ error: 'Invalid webhook event' });
        return;
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.created':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'payment_intent.succeeded':
          await WebhookService.processPaymentIntentSucceeded(event.data.object);
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'payment_intent.payment_failed':
          await WebhookService.processPaymentIntentFailed(event.data.object);
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'charge.succeeded':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'charge.updated':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'transfer.created':
          await WebhookService.processTransferCreated(event.data.object);
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'transfer.failed' as any:
          await WebhookService.processTransferFailed((event as any).data.object);
          WebhookService.logWebhookEvent((event as any).type, (event as any).id, (event as any).data.object, true);
          break;

        case 'account.updated':
          await WebhookService.processAccountUpdated(event.data.object);
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'account.application.deauthorized':
          await WebhookService.processAccountDeauthorized(event.data.object);
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'invoice.payment_succeeded':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'invoice.payment_failed':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'customer.subscription.created':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'customer.subscription.updated':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        case 'customer.subscription.deleted':
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
          break;

        default:
          WebhookService.logWebhookEvent(event.type, event.id, event.data.object, true);
      }

      res.json({ received: true });
    } catch (error) {
      WebhookService.logWebhookEvent((event as any).type, (event as any).id, (event as any).data.object, false, (error as Error).message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
