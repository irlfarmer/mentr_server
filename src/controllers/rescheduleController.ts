import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import RescheduleRequest from '../models/RescheduleRequest';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { rescheduleNotificationService } from '../services/rescheduleNotificationService';
import { RefundService } from '../services/refundService';

// Request a reschedule
export const requestReschedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { bookingId } = req.params;
    const { newScheduledAt, reason } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Get the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is either mentor or student in this booking
    if (booking.mentorId.toString() !== userId && booking.studentId.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: 'You are not authorized to reschedule this booking'
      });
      return;
    }

    // Check if booking can be rescheduled (not completed or cancelled)
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      res.status(400).json({
        success: false,
        error: 'Cannot reschedule a completed or cancelled booking'
      });
      return;
    }

    // Check if there's already a pending reschedule request
    const existingRequest = await RescheduleRequest.findOne({
      bookingId,
      status: 'pending'
    });

    if (existingRequest) {
      res.status(400).json({
        success: false,
        error: 'There is already a pending reschedule request for this booking'
      });
      return;
    }

    // Convert new scheduled time to UTC
    const newScheduledAtUTC = new Date(newScheduledAt);

    // Create reschedule request
    const rescheduleRequest = new RescheduleRequest({
      bookingId,
      requestedBy: userId,
      newScheduledAt,
      newScheduledAtUTC,
      reason
    });

    await rescheduleRequest.save();

    // Populate the request with user data
    await rescheduleRequest.populate([
      { path: 'requestedBy', select: 'firstName lastName email' },
      { path: 'bookingId', populate: [
        { path: 'mentorId', select: 'firstName lastName email' },
        { path: 'studentId', select: 'firstName lastName email' }
      ]}
    ]);

    // Send reschedule request notification
    try {
      // Determine who should receive the notification (the other party)
      const requestedTo = booking.mentorId.toString() === userId 
        ? booking.studentId.toString() 
        : booking.mentorId.toString();

      await rescheduleNotificationService.sendNewRescheduleRequestNotification({
        rescheduleRequestId: (rescheduleRequest._id as any).toString(),
        bookingId: bookingId,
        requestedBy: userId,
        requestedTo: requestedTo,
        newScheduledAt: new Date(newScheduledAt),
        oldScheduledAt: booking.scheduledAt,
        reason: reason,
        status: 'pending'
      });
    } catch (notificationError) {
      // Don't fail the reschedule request if notification fails
    }

    res.status(201).json({
      success: true,
      data: rescheduleRequest,
      message: 'Reschedule request submitted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get reschedule requests for a user
export const getRescheduleRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { status } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // First, get all bookings where the user is either mentor or student
    const userBookings = await Booking.find({
      $or: [
        { mentorId: userId },
        { studentId: userId }
      ]
    }).select('_id');

    const bookingIds = userBookings.map(booking => booking._id);

    let query: any = {
      $or: [
        { requestedBy: userId },
        { respondedBy: userId },
        { bookingId: { $in: bookingIds } }
      ]
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const requests = await RescheduleRequest.find(query)
      .populate([
        { path: 'requestedBy', select: 'firstName lastName email' },
        { path: 'respondedBy', select: 'firstName lastName email' },
        { 
          path: 'bookingId', 
          populate: [
            { path: 'mentorId', select: 'firstName lastName email' },
            { path: 'studentId', select: 'firstName lastName email' },
            { path: 'serviceId', select: 'title' }
          ]
        }
      ])
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Respond to a reschedule request (approve or reject)
export const respondToRescheduleRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { requestId } = req.params;
    const { action, responseReason } = req.body; // action: 'approve' or 'reject'

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Get the reschedule request
    const rescheduleRequest = await RescheduleRequest.findById(requestId)
      .populate('bookingId');

    if (!rescheduleRequest) {
      res.status(404).json({
        success: false,
        error: 'Reschedule request not found'
      });
      return;
    }

    const booking = rescheduleRequest.bookingId as any;

    // Check if user is the other party (not the one who requested)
    if (booking.mentorId.toString() === rescheduleRequest.requestedBy.toString()) {
      // Mentor requested, student should respond
      if (booking.studentId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: 'You are not authorized to respond to this request'
        });
        return;
      }
    } else {
      // Student requested, mentor should respond
      if (booking.mentorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: 'You are not authorized to respond to this request'
        });
        return;
      }
    }

    // Check if request is still pending
    if (rescheduleRequest.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'This reschedule request has already been responded to'
      });
      return;
    }

    // Update the request
    rescheduleRequest.status = action === 'approve' ? 'approved' : 'rejected';
    rescheduleRequest.respondedBy = userId;
    rescheduleRequest.respondedAt = new Date();
    rescheduleRequest.responseReason = responseReason;

    await rescheduleRequest.save();

    // If approved, update the booking
    if (action === 'approve') {
      booking.scheduledAt = rescheduleRequest.newScheduledAt;
      booking.scheduledAtUTC = rescheduleRequest.newScheduledAtUTC;
      await booking.save();
    }

    // Populate the updated request
    await rescheduleRequest.populate([
      { path: 'requestedBy', select: 'firstName lastName email' },
      { path: 'respondedBy', select: 'firstName lastName email' },
      { 
        path: 'bookingId', 
        populate: [
          { path: 'mentorId', select: 'firstName lastName email' },
          { path: 'studentId', select: 'firstName lastName email' },
          { path: 'serviceId', select: 'title' }
        ]
      }
    ]);

    // Send reschedule response notification
    try {
      const requestedBy = rescheduleRequest.requestedBy.toString();
      const respondedBy = userId;

      if (action === 'approve') {
        await rescheduleNotificationService.sendRescheduleApprovedNotification({
          rescheduleRequestId: (rescheduleRequest._id as any).toString(),
          bookingId: booking._id.toString(),
          requestedBy: requestedBy,
          requestedTo: respondedBy,
          newScheduledAt: rescheduleRequest.newScheduledAt,
          oldScheduledAt: booking.scheduledAt,
          reason: rescheduleRequest.reason,
          status: 'approved',
          responseReason: responseReason,
          respondedBy: respondedBy
        });
      } else {
        await rescheduleNotificationService.sendRescheduleRejectedNotification({
          rescheduleRequestId: (rescheduleRequest._id as any).toString(),
          bookingId: booking._id.toString(),
          requestedBy: requestedBy,
          requestedTo: respondedBy,
          newScheduledAt: rescheduleRequest.newScheduledAt,
          oldScheduledAt: booking.scheduledAt,
          reason: rescheduleRequest.reason,
          status: 'rejected',
          responseReason: responseReason,
          respondedBy: respondedBy
        });
      }
    } catch (notificationError) {
      console.error('Error sending reschedule response notification:', notificationError);
      // Don't fail the response if notification fails
    }

    res.json({
      success: true,
      data: rescheduleRequest,
      message: `Reschedule request ${action}d successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Cancel a booking
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { bookingId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Get the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is either mentor or student in this booking
    if (booking.mentorId.toString() !== userId && booking.studentId.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: 'You are not authorized to cancel this booking'
      });
      return;
    }

    // Check if booking can be cancelled
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      res.status(400).json({
        success: false,
        error: 'Booking cannot be cancelled'
      });
      return;
    }

    // Check cancellation time limit
    const now = new Date();
    const sessionTime = new Date(booking.scheduledAtUTC);
    const hoursUntilSession = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minimumHours = booking.cancellationPolicy?.minimumCancellationHours || 24;

    if (hoursUntilSession < minimumHours) {
      res.status(400).json({
        success: false,
        error: `Booking cannot be cancelled less than ${minimumHours} hours before the session. You can cancel until ${new Date(sessionTime.getTime() - minimumHours * 60 * 60 * 1000).toLocaleString()}.`
      });
      return;
    }

    // Determine who cancelled and refund type
    const isMentor = booking.mentorId.toString() === userId;
    const cancelledBy = isMentor ? 'mentor' : 'mentee';
    
    // For mentee cancellations, check if they want refund in tokens or payment method
    const refundType = req.body.refundType || (isMentor ? 'payment_method' : 'tokens');

    // Update booking status
    booking.status = 'cancelled';
    booking.notes = booking.notes ? `${booking.notes}\n\nCancelled by user. Reason: ${reason || 'No reason provided'}` : `Cancelled by user. Reason: ${reason || 'No reason provided'}`;
    await booking.save();

    // Process refund
    let refundResult = null;
    if (booking.paymentStatus === 'paid') {
      refundResult = await RefundService.processRefund({
        bookingId: bookingId,
        refundType: refundType as 'payment_method' | 'tokens',
        reason: reason || 'Booking cancelled',
        cancelledBy: cancelledBy
      });
    }

    // Cancel any pending reschedule requests
    await RescheduleRequest.updateMany(
      { bookingId, status: 'pending' },
      { 
        status: 'rejected',
        respondedBy: userId,
        respondedAt: new Date(),
        responseReason: 'Booking was cancelled'
      }
    );

    res.json({
      success: true,
      data: booking,
      refund: refundResult,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
