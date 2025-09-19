# Daily.co Webhook Setup Guide

## **🔍 Understanding Daily.co Webhooks**

Daily.co uses **room-level webhooks**, not global webhook settings. Each room is configured with webhook URLs when created.

## **📋 Setup Steps**

### **Step 1: Environment Variables**

Add to your `.env` file:

```bash
# Daily.co Configuration
DAILY_API_KEY=your_daily_api_key_here
DAILY_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/webhooks/daily
SERVER_URL=https://your-ngrok-url.ngrok.io
```

### **Step 2: Start ngrok**

```bash
# Install ngrok (if not already installed)
npm install -g ngrok

# Start ngrok to expose your local server
ngrok http 5000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### **Step 3: Update Environment Variables**

Update your `.env` with the ngrok URL:

```bash
DAILY_WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/daily
SERVER_URL=https://abc123.ngrok.io
```

### **Step 4: Restart Your Server**

```bash
npm run dev
```

## **🔧 How It Works**

### **Room Creation with Webhooks**

When you create a video call room, the system automatically adds:

```javascript
{
  properties: {
    meeting_join_hook: "https://your-ngrok-url.ngrok.io/api/webhooks/daily",
    meeting_ended_hook: "https://your-ngrok-url.ngrok.io/api/webhooks/daily"
  }
}
```

### **Webhook Events Received**

1. **Participant Joined:**
   ```json
   {
     "domain_name": "mentrtest.daily.co",
     "room_name": "mentr-booking123-1234567890-abc123",
     "room_url": "https://mentrtest.daily.co/mentr-booking123-1234567890-abc123",
     "user_name": "John Doe",
     "user_id": "68b6c1dd141c91e3185aff64",
     "is_owner": false,
     "owner_is_present": false,
     "first_non_owner_join": false,
     "meeting_session_id": "ab35ad88-35aa-4dde-a9e1-a5454a5be8c6"
   }
   ```

2. **Room Ended:**
   ```json
   {
     "domain_name": "mentrtest.daily.co",
     "room_name": "mentr-booking123-1234567890-abc123",
     "room_url": "https://mentrtest.daily.co/mentr-booking123-1234567890-abc123",
     "meeting_ended": true
   }
   ```

## **🧪 Testing**

### **Test with Postman**

1. **Participant Joined:**
   ```http
   POST https://abc123.ngrok.io/api/webhooks/daily
   Content-Type: application/json

   {
     "domain_name": "mentrtest.daily.co",
     "room_name": "mentr-booking123-1234567890-abc123",
     "room_url": "https://mentrtest.daily.co/mentr-booking123-1234567890-abc123",
     "user_name": "John Doe",
     "user_id": "68b6c1dd141c91e3185aff64",
     "is_owner": false,
     "owner_is_present": false,
     "first_non_owner_join": false,
     "meeting_session_id": "ab35ad88-35aa-4dde-a9e1-a5454a5be8c6"
   }
   ```

2. **Room Ended:**
   ```http
   POST https://abc123.ngrok.io/api/webhooks/daily
   Content-Type: application/json

   {
     "domain_name": "mentrtest.daily.co",
     "room_name": "mentr-booking123-1234567890-abc123",
     "room_url": "https://mentrtest.daily.co/mentr-booking123-1234567890-abc123",
     "meeting_ended": true
   }
   ```

### **Test with Real Video Call**

1. Create a booking
2. Join the video call
3. Check server logs for webhook events
4. End the call
5. Check if session is marked as completed

## **🔍 Troubleshooting**

### **No Webhook Events Received**

1. **Check ngrok URL**: Make sure it's accessible
2. **Check environment variables**: Verify `DAILY_WEBHOOK_URL` is set
3. **Check room creation**: Look for webhook URLs in room properties
4. **Check server logs**: Look for webhook processing messages

### **Webhook Events Not Processing**

1. **Check room name**: Ensure it matches existing VideoCall records
2. **Check user IDs**: Verify mentor/student IDs match database
3. **Check server logs**: Look for error messages

## **📊 Expected Behavior**

### **When Participant Joins:**
- Video call status: `scheduled` → `in_progress`
- Participant tracked in database
- `startedAt` timestamp set

### **When Room Ends:**
- If both mentor and mentee joined: `completed`
- If only one participant: `no_show`
- Booking status updated accordingly
- Duration calculated automatically

## **🎯 Benefits**

- **Automatic Status Updates**: No manual intervention needed
- **Participant Validation**: Ensures both mentor and mentee joined
- **Real-time Processing**: Immediate status changes
- **Fraud Prevention**: Can't mark complete without both participants
