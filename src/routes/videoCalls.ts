import express from 'express';
import {
  createVideoCallRoom,
  getVideoCall,
  getVideoCallByBooking,
  generateMeetingToken,
  startVideoCall,
  endVideoCall,
  getUserVideoCalls,
  startRecording,
  stopRecording,
} from '../controllers/videoCallController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create video call room for a booking
router.post('/create-room', createVideoCallRoom);

// Get video call details
router.get('/:id', getVideoCall);

// Get video call by booking ID
router.get('/booking/:bookingId', getVideoCallByBooking);

// Generate meeting token for joining call
router.post('/:videoCallId/token', generateMeetingToken);

// Start video call
router.post('/:videoCallId/start', startVideoCall);

// End video call
router.post('/:videoCallId/end', endVideoCall);

// Get user's video calls
router.get('/', getUserVideoCalls);

// Recording endpoints
router.post('/:videoCallId/start-recording', startRecording);
router.post('/:videoCallId/stop-recording', stopRecording);

export default router;
