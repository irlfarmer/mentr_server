const axios = require('axios');
require('dotenv').config();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const WEBHOOK_URL = process.env.DAILY_WEBHOOK_URL || 'https://744c53d659c5.ngrok-free.app/api/webhooks/daily';

const baseUrl = 'https://api.daily.co/v1';

async function setupWebhooks() {
  try {
    console.log('Setting up Daily.co webhooks...');
    console.log('Webhook URL:', WEBHOOK_URL);
    
    // First, check existing webhooks
    console.log('\n1. Checking existing webhooks...');
    const existingWebhooks = await axios.get(`${baseUrl}/webhooks`, {
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Existing webhooks:', existingWebhooks.data);
    
    // Delete existing webhooks if any
    if (existingWebhooks.data.data && existingWebhooks.data.data.length > 0) {
      console.log('\n2. Deleting existing webhooks...');
      for (const webhook of existingWebhooks.data.data) {
        await axios.delete(`${baseUrl}/webhooks/${webhook.id}`, {
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`Deleted webhook: ${webhook.id}`);
      }
    }
    
    // Subscribe to new webhooks
    console.log('\n3. Subscribing to new webhooks...');
    const webhookEvents = [
      'meeting.started',
      'meeting.ended', 
      'participant.joined',
      'participant.left',
      'recording.started',
      'recording.ready-to-download',
      'transcript.started',
      'transcript.ready-to-download'
    ];
    
    const newWebhook = await axios.post(`${baseUrl}/webhooks`, {
      url: WEBHOOK_URL
    }, {
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Successfully subscribed to webhooks!');
    console.log('Webhook ID:', newWebhook.data.id);
    console.log('URL:', WEBHOOK_URL);
    console.log('Note: Daily.co will send all available events to this webhook');
    
  } catch (error) {
    console.error('Error setting up webhooks:', error.response?.data || error.message);
  }
}

setupWebhooks();
