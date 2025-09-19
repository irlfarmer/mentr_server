const axios = require('axios');
require('dotenv').config();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const baseUrl = 'https://api.daily.co/v1';

async function testWebhook() {
  try {
    console.log('Testing Daily.co webhook by creating a test room...');
    
    // Create a test room
    const room = await axios.post(`${baseUrl}/rooms`, {
      name: `test-webhook-${Date.now()}`,
      privacy: 'private',
      properties: {
        start_video_off: false,
        start_audio_off: false,
        enable_recording: 'local',
        enable_transcription: false,
        max_participants: 2,
        enable_chat: true,
        enable_screenshare: true,
        enable_knocking: true,
        enable_prejoin_ui: true,
        nbf: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        eject_at_room_exp: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Test room created:', room.data.name);
    console.log('Room URL:', room.data.url);
    console.log('Check your server logs for webhook events when someone joins this room!');
    
  } catch (error) {
    console.error('Error creating test room:', error.response?.data || error.message);
  }
}

testWebhook();
