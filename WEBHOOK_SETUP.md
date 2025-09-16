# Stripe Webhook Setup Guide

## Overview
The Mentr platform uses Stripe webhooks to handle real-time payment events and Connect account updates. This ensures that payment statuses, payout processing, and account changes are automatically synchronized.

## Webhook Endpoint
- **URL**: `https://yourdomain.com/api/webhooks/stripe`
- **Method**: POST
- **Content-Type**: application/json

## Required Environment Variables
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Supported Webhook Events

### Payment Events
- `payment_intent.succeeded` - Payment completed successfully
- `payment_intent.payment_failed` - Payment failed

### Payout Events  
- `transfer.created` - Payout to mentor initiated successfully
- `transfer.failed` - Payout to mentor failed

### Connect Account Events
- `account.updated` - Connect account status changed
- `account.application.deauthorized` - Connect account deauthorized

### Subscription Events (Future)
- `invoice.payment_succeeded` - Subscription payment succeeded
- `invoice.payment_failed` - Subscription payment failed
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled

## Webhook Processing

### Payment Intent Succeeded
1. Updates booking `paymentStatus` to 'paid'
2. Stores `stripePaymentIntentId`
3. Sends payment success notification to mentee

### Payment Intent Failed
1. Resets booking `paymentStatus` to 'pending'
2. Stores `stripePaymentIntentId`
3. Sends payment failure notification to mentee

### Transfer Created (Payout Success)
1. Updates booking `payoutStatus` to 'paid'
2. Sets `payoutDate`
3. Sends payout success notification to mentor

### Transfer Failed (Payout Failure)
1. Updates booking `payoutStatus` to 'failed'
2. Sets `payoutDate`
3. Sends payout failure notification to mentor

### Account Updated
1. Updates user `stripeConnect.accountStatus`
2. Updates `stripeConnect.lastUpdated`
3. Sends account status notification to user

### Account Deauthorized
1. Sets `stripeConnect.accountStatus` to 'rejected'
2. Clears `stripeConnect.accountId`
3. Sends deauthorization notification to user

## Setup Instructions

### 1. Stripe Dashboard Setup
1. Go to Stripe Dashboard > Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select the following events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `transfer.failed`
   - `account.updated`
   - `account.application.deauthorized`
5. Copy the webhook signing secret
6. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

### 2. Local Development
For local development, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# Copy the webhook signing secret from the output
```

### 3. Testing Webhooks
Use Stripe CLI to trigger test events:

```bash
# Test payment success
stripe trigger payment_intent.succeeded

# Test payment failure
stripe trigger payment_intent.payment_failed

# Test transfer success
stripe trigger transfer.created

# Test transfer failure
stripe trigger transfer.failed

# Test account update
stripe trigger account.updated
```

## Security

### Webhook Signature Verification
All webhook requests are verified using Stripe's webhook signature:
- Uses `STRIPE_WEBHOOK_SECRET` for verification
- Rejects requests with invalid signatures
- Returns 400 status for verification failures

### Error Handling
- Webhook processing errors are logged
- Failed webhooks return 500 status
- Individual notification failures don't break webhook processing
- All webhook events are logged for debugging

## Monitoring

### Logs
Webhook events are logged with:
- Event type and ID
- Processing success/failure
- Error messages (if any)
- Essential event data

### Health Check
- Endpoint: `GET /api/webhooks/health`
- Returns webhook service status

## Troubleshooting

### Common Issues

1. **Webhook signature verification failed**
   - Check `STRIPE_WEBHOOK_SECRET` is correct
   - Ensure webhook URL is accessible
   - Verify webhook is configured in Stripe Dashboard

2. **Webhook processing failed**
   - Check server logs for specific errors
   - Verify database connection
   - Check notification service configuration

3. **Events not being received**
   - Verify webhook URL is correct
   - Check if webhook is enabled in Stripe Dashboard
   - Ensure server is accessible from internet

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

This will log detailed webhook processing information.

## Production Considerations

1. **HTTPS Required**: Webhooks must use HTTPS in production
2. **Idempotency**: Webhook processing is idempotent - duplicate events are handled safely
3. **Rate Limiting**: Consider implementing rate limiting for webhook endpoints
4. **Monitoring**: Set up monitoring for webhook processing failures
5. **Retry Logic**: Stripe automatically retries failed webhooks

## Support

For webhook-related issues:
1. Check server logs for error details
2. Verify webhook configuration in Stripe Dashboard
3. Test with Stripe CLI for local debugging
4. Contact development team with specific error messages
