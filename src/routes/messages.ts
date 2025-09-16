import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  processColdMessagePayment,
  markAsRead,
  getUnreadCount
} from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);



// Get all conversations for the authenticated user
router.get('/conversations', getConversations);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send a new message
router.post('/send', sendMessage);

// Process payment for cold message
router.post('/send-cold', processColdMessagePayment);

// Mark messages as read
router.put('/conversations/:conversationId/read', markAsRead);

// Get unread message count
router.get('/unread-count', getUnreadCount);

export default router;
