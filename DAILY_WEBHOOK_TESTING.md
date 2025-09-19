# Daily.co Webhook Testing Guide

## Setup

1. **Environment Variables:**
   ```bash
   DAILY_WEBHOOK_SECRET=your_daily_webhook_secret_here
   ```

2. **Start Server:**
   ```bash
   npm run dev
   ```

3. **Webhook Endpoint:**
   ```
   POST http://localhost:5000/api/webhooks/daily
   ```

## Postman Collection

### 1. Participant Joined Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "room.participant-joined",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "participant": {
      "id": "participant_123",
      "user_name": "John Doe",
      "user_id": "68b6c1dd141c91e3185aff64",
      "join_time": "2025-09-18T22:00:00.000Z"
    }
  }
}
```

### 2. Participant Left Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "room.participant-left",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "participant": {
      "id": "participant_123",
      "user_name": "John Doe",
      "user_id": "68b6c1dd141c91e3185aff64",
      "leave_time": "2025-09-18T22:30:00.000Z"
    }
  }
}
```

### 3. Room Ended Event (Valid Session)

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "room.ended",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    }
  }
}
```

### 4. Recording Started Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "recording.started",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "recording": {
      "id": "rec_123456789",
      "status": "started"
    }
  }
}
```

### 5. Recording Uploaded Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "recording.uploaded",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "recording": {
      "id": "rec_123456789",
      "download_link": "https://daily.co/recordings/rec_123456789.mp4",
      "status": "uploaded"
    }
  }
}
```

### 6. Recording Stopped Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "recording.stopped",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "recording": {
      "id": "rec_123456789",
      "status": "stopped"
    }
  }
}
```

### 7. Transcription Updated Event

**Request:**
```http
POST http://localhost:5000/api/webhooks/daily
Content-Type: application/json
daily-signature: [calculated_signature]

{
  "type": "transcription.updated",
  "room_name": "mentr-booking123-1234567890-abc123",
  "data": {
    "room": {
      "name": "mentr-booking123-1234567890-abc123",
      "id": "room_123"
    },
    "transcription": {
      "id": "trans_123456789",
      "download_link": "https://daily.co/transcriptions/trans_123456789.txt",
      "status": "updated"
    }
  }
}
```

## Testing Scenarios

### Scenario 1: Valid Session (Both Mentor and Mentee Join)

1. **Mentor Joins:**
   - Send `room.participant-joined` with mentor user_id
   - Video call status should change to `in_progress`

2. **Mentee Joins:**
   - Send `room.participant-joined` with mentee user_id
   - Both participants should be tracked

3. **Room Ends:**
   - Send `room.ended` event
   - Video call should be marked as `completed`
   - Booking status should be updated to `completed`

### Scenario 2: No-Show Session (Only One Participant)

1. **Mentor Joins:**
   - Send `room.participant-joined` with mentor user_id only

2. **Room Ends:**
   - Send `room.ended` event
   - Video call should be marked as `no_show`
   - Booking status should remain unchanged

### Scenario 3: Recording Workflow

1. **Start Recording:**
   - Send `recording.started` event
   - Video call status should change to `recording`

2. **Stop Recording:**
   - Send `recording.stopped` event
   - Video call status should return to `in_progress`

3. **Recording Uploaded:**
   - Send `recording.uploaded` event
   - Recording URL should be stored

## Signature Calculation

For testing, you can temporarily disable signature verification by commenting out the verification code in `DailyWebhookController.handleWebhook()`.

Or calculate the signature using:

```javascript
const crypto = require('crypto');
const payload = JSON.stringify(requestBody);
const signature = crypto
  .createHmac('sha256', 'your_webhook_secret')
  .update(payload)
  .digest('hex');
```

## Expected Database Changes

### VideoCall Document Updates:

1. **Participant Joined:**
   - `status`: `scheduled` → `in_progress` (first participant)
   - `startedAt`: Set to current time
   - `participants`: Array updated with participant data

2. **Room Ended (Valid):**
   - `status`: `in_progress` → `completed`
   - `endedAt`: Set to current time
   - `duration`: Calculated in minutes

3. **Room Ended (Invalid):**
   - `status`: `in_progress` → `no_show`
   - `endedAt`: Set to current time

4. **Recording Events:**
   - `recordingId`: Set when recording starts
   - `recordingUrl`: Set when recording is uploaded
   - `status`: `in_progress` → `recording` → `in_progress`

### Booking Document Updates:

- `status`: Updated to `completed` when valid session ends

## Troubleshooting

1. **"Video call not found" errors:**
   - Ensure the `room_name` in the webhook matches an existing VideoCall document
   - Check that the room was created via the video call API

2. **Signature verification failures:**
   - Verify `DAILY_WEBHOOK_SECRET` is set correctly
   - Ensure the signature is calculated correctly
   - Check that the request body matches the signature calculation

3. **Participant validation issues:**
   - Ensure `user_id` in participant data matches mentor/student IDs
   - Check that both mentor and mentee have valid user IDs in the database
