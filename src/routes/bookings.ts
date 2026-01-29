import express from 'express';
import { authenticate } from '../middleware/auth';
import { Booking } from '../models/Booking';
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
import { TokenPaymentService } from '../services/tokenPaymentService';

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

// Token payment routes
router.post('/:id/pay-with-tokens', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Get booking to check amount
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    // Check if booking belongs to user
    if (booking.studentId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Process token payment
    const result = await TokenPaymentService.processTokenPayment(
      id as string,
      userId,
      booking.amount
    );
    
    if (result.success) {
      // Verify the booking was updated
      const updatedBooking = await Booking.findById(id);
      console.log('Token payment - Final booking status:', {
        paymentStatus: updatedBooking?.paymentStatus,
        paymentMethod: updatedBooking?.paymentMethod,
        status: updatedBooking?.status
      });
      
      return res.json({
        success: true,
        message: 'Payment successful',
        transactionId: result.transactionId
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Token payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Check token balance for booking
router.post('/:id/check-token-balance', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Get booking to check amount
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    // Check if booking belongs to user
    if (booking.studentId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Check token balance
    const balanceCheck = await TokenPaymentService.checkTokenBalance(
      userId,
      booking.amount
    );
    
    return res.json({
      success: true,
      data: balanceCheck
    });
  } catch (error) {
    console.error('Check token balance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get pending bookings for payment
router.get('/pending-payments', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?._id;
    
    const pendingBookings = await Booking.find({
      studentId: userId,
      status: 'pending',
      paymentStatus: 'pending'
    }).populate('serviceId mentorId', 'title firstName lastName email');
    
    res.json({
      success: true,
      data: pendingBookings
    });
  } catch (error) {
    console.error('Error getting pending bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending bookings'
    });
  }
});

// Get booking token history
router.get('/token-history', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?._id;
    const { limit = 20, offset = 0 } = req.query;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    const history = await TokenPaymentService.getBookingTokenHistory(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get token history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
