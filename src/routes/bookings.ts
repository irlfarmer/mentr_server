import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createBooking,
  getBookings,
  getBooking,
  updateBookingStatus,
  updatePaymentStatus,
  getMentorAvailability,
  getAvailableTimeSlots
} from '../controllers/bookingController';
import {
  requestReschedule,
  getRescheduleRequests,
  respondToRescheduleRequest,
  cancelBooking
} from '../controllers/rescheduleController';

const router = express.Router();

// Public routes
router.get('/availability', getMentorAvailability);
router.get('/available-slots', getAvailableTimeSlots);

// Protected routes
router.post('/', authenticate, createBooking);
router.get('/', authenticate, getBookings);

// Reschedule and cancel routes (must come before /:id route)
router.post('/:bookingId/reschedule', authenticate, requestReschedule);
router.get('/reschedule-requests', authenticate, getRescheduleRequests);
router.patch('/reschedule-requests/:requestId', authenticate, respondToRescheduleRequest);
router.patch('/:bookingId/cancel', authenticate, cancelBooking);

// Specific booking routes (must come after specific routes)
router.get('/:id', authenticate, getBooking);
router.patch('/:id/status', authenticate, updateBookingStatus);
router.patch('/:id/payment', authenticate, updatePaymentStatus);

export default router;
