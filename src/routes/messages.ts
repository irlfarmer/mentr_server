import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  processColdMessagePayment,
  markAsRead,
  getUnreadCount
} from '../controllers/messageController';
import { presenceService } from '../services/presenceService';
import { authenticate } from '../middleware/auth';
import { uploadShared, uploadMessage } from '../config/cloudinary';

const router = express.Router();

// All routes require authentication
router.use(authenticate);



// Get all conversations for the authenticated user
router.get('/conversations', getConversations);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send a new message
router.post('/send', uploadMessage.array('files', 5), sendMessage);

// Process payment for cold message
router.post('/send-cold', processColdMessagePayment);

// Mark messages as read
router.put('/conversations/:conversationId/read', markAsRead);

// Get unread message count
router.get('/unread-count', getUnreadCount);

// Get online status for users
router.get('/online-status/:userIds', async (req, res) => {
  try {
    const { userIds } = req.params;
    const userIdArray = userIds.split(',');
    
    const statuses = await presenceService.getUsersOnlineStatus(userIdArray);
    
    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Error getting online status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get online status'
    });
  }
});

export default router;
