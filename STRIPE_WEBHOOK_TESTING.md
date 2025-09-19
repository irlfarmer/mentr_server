# Stripe Webhook Testing Guide

## 🎯 **Webhook Endpoints**

Your server has two webhook endpoints:

1. **Main Payment Webhooks**: `POST /api/webhooks/stripe`
2. **Stripe Connect Webhooks**: `POST /api/stripe-connect/webhook`

## 🔧 **Setup for Testing**

### 1. **Install Stripe CLI**
```bash
# Windows (using Chocolatey)
choco install stripe-cli

# Or download from: https://github.com/stripe/stripe-cli/releases
```

### 2. **Login to Stripe**
```bash
stripe login
```

### 3. **Forward Webhooks to Local Server**
```bash
# For main payment webhooks
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# For Stripe Connect webhooks (in another terminal)
stripe listen --forward-to localhost:5000/api/stripe-connect/webhook --events account.updated,account.application.deauthorized
```

### 4. **Copy Webhook Signing Secret**
The CLI will output a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
```

Add this to your `.env` file:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

## 🧪 **Testing Different Webhook Events**

### **1. Payment Intent Succeeded**
```bash
stripe trigger payment_intent.succeeded
```

**What happens:**
- Updates booking payment status to 'paid'
- Sends payment success notification to student
- Logs the event

### **2. Payment Intent Failed**
```bash
stripe trigger payment_intent.payment_failed
```

**What happens:**
- Sends payment failure notification to student
- Logs the event

### **3. Transfer Created (Payout)**
```bash
stripe trigger transfer.created
```

**What happens:**
- Updates mentor's payout status
- Sends payout notification to mentor
- Logs the event

### **4. Account Updated (Stripe Connect)**
```bash
stripe trigger account.updated
```

**What happens:**
- Updates mentor's Stripe Connect account status
- Updates onboarding completion status
- Logs the event

### **5. Account Deauthorized**
```bash
stripe trigger account.application.deauthorized
```

**What happens:**
- Updates mentor's account status to 'rejected'
- Sends deauthorization notification
- Logs the event

## 🔍 **Testing with Real Data**

### **1. Create a Test Booking**
```bash
# Use your API to create a booking with test payment
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "serviceId": "SERVICE_ID",
    "scheduledAt": "2024-01-15T10:00:00Z",
    "duration": 60,
    "notes": "Test booking for webhook testing"
  }'
```

### **2. Simulate Payment Success**
```bash
# Trigger payment success for the booking
stripe trigger payment_intent.succeeded --add payment_intent:metadata:bookingId=BOOKING_ID
```

## 📊 **Monitoring Webhook Events**

### **1. Check Server Logs**
```bash
# In your server terminal, you should see:
Received webhook event: payment_intent.succeeded
Payment succeeded for booking 64f1234567890abcdef12345
Webhook processed successfully: {...}
```

### **2. Check Database**
```javascript
// Check if booking was updated
db.bookings.findOne({_id: ObjectId("BOOKING_ID")})

// Check if notifications were created
db.notifications.find({category: "booking"})
```

### **3. Check Email Delivery**
- Check your email client for notifications
- Verify email templates are working correctly

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Webhook Signature Verification Failed**
   - Check `STRIPE_WEBHOOK_SECRET` in `.env`
   - Ensure webhook endpoint is correct
   - Verify Stripe CLI is forwarding to correct port

2. **Booking Not Found**
   - Ensure booking ID is in payment intent metadata
   - Check if booking exists in database

3. **Notification Not Sent**
   - Check user's notification preferences
   - Verify email service configuration
   - Check server logs for errors

### **Debug Mode:**
Add this to your webhook controller for more detailed logging:
```javascript
console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
console.log('Webhook headers:', req.headers);
```

## 🎯 **Test Scenarios**

### **Complete Booking Flow:**
1. Create booking → `POST /api/bookings`
2. Process payment → `stripe trigger payment_intent.succeeded`
3. Verify booking status updated
4. Check notification sent
5. Check email delivered

### **Cancellation Flow:**
1. Create booking
2. Process payment
3. Cancel booking → `PUT /api/bookings/:id` with `status: 'cancelled'`
4. Verify cancellation notification sent

### **Payout Flow:**
1. Complete a session
2. Trigger payout → `stripe trigger transfer.created`
3. Verify mentor gets payout notification
4. Check payout status updated

## 📝 **Webhook Event Logs**

All webhook events are logged with:
- Event type
- Event ID
- Processing status
- Error messages (if any)

Check your server logs for detailed webhook processing information.

## 🔐 **Security Notes**

- Never expose webhook secrets in client-side code
- Always verify webhook signatures
- Use HTTPS in production
- Monitor for suspicious webhook activity

## 🚀 **Production Setup**

For production, you'll need to:
1. Set up webhook endpoints in Stripe Dashboard
2. Configure production webhook secrets
3. Use ngrok or similar for local testing
4. Set up proper error monitoring and alerting
