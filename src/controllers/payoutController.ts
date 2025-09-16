import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PayoutService } from '../services/payoutService';
import { CronService } from '../services/cronService';

// Get mentor's payout history
export const getMentorPayoutHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mentorId = req.user?._id;
    const { limit = 50 } = req.query;

    if (!mentorId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const payouts = await PayoutService.getMentorPayoutHistory(mentorId, Number(limit));

    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Error fetching mentor payout history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payout history'
    });
  }
};

// Get platform payout statistics (admin only)
export const getPlatformPayoutStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await PayoutService.getPlatformPayoutStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching platform payout stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payout statistics'
    });
  }
};

// Manual payout check (admin only)
export const runManualPayoutCheck = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await CronService.runManualPayoutCheck();

    res.json({
      success: true,
      message: 'Manual payout check completed successfully'
    });
  } catch (error) {
    console.error('Error running manual payout check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run manual payout check'
    });
  }
};

// Get pending payouts (admin only)
export const getPendingPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Booking } = await import('../models/Booking');
    const { User } = await import('../models/User');
    
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const pendingBookings = await Booking.find({
      status: 'completed',
      updatedAt: { $lte: fortyEightHoursAgo },
      $or: [
        { payoutStatus: { $exists: false } },
        { payoutStatus: 'pending' }
      ]
    })
    .populate('mentorId', 'firstName lastName email')
    .populate('studentId', 'firstName lastName email')
    .sort({ updatedAt: 1 });

    const payouts = pendingBookings.map(booking => ({
      bookingId: booking._id,
      mentor: booking.mentorId,
      student: booking.studentId,
      amount: booking.amount,
      completedAt: booking.updatedAt,
      timeUntilPayout: Math.max(0, 48 * 60 * 60 * 1000 - (now.getTime() - booking.updatedAt.getTime())),
      status: booking.payoutStatus || 'pending'
    }));

    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending payouts'
    });
  }
};

// Force process a specific payout (admin only)
export const forceProcessPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { Booking } = await import('../models/Booking');

    const booking = await Booking.findById(bookingId).populate('mentorId', 'firstName lastName email');
    
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    if (booking.status !== 'completed') {
      res.status(400).json({
        success: false,
        error: 'Booking is not completed'
      });
      return;
    }

    await PayoutService.processBookingPayout(booking);

    res.json({
      success: true,
      message: 'Payout processed successfully'
    });
  } catch (error) {
    console.error('Error force processing payout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payout'
    });
  }
};
