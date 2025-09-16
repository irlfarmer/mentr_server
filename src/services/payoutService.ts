import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { Dispute } from '../models/Dispute';
import { MentorEarningsService } from './mentorEarningsService';
import { StripeService } from './stripeService';
import { payoutNotificationService } from './payoutNotificationService';

export interface PayoutData {
  bookingId: string;
  mentorId: string;
  amount: number;
  type: 'session' | 'cold_message';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'disputed';
  disputeDeadline: Date;
  createdAt: Date;
  processedAt?: Date;
  failureReason?: string;
}

export class PayoutService {
  // Check for bookings ready for payout (48 hours after completion, no disputes)
  static async checkPendingPayouts(): Promise<void> {
    try {
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Find completed bookings that are 48+ hours old and not already processed
      const readyBookings = await Booking.find({
        status: 'completed',
        updatedAt: { $lte: fortyEightHoursAgo },
        $or: [
          { payoutStatus: { $exists: false } },
          { payoutStatus: 'pending' }
        ]
      }).populate('mentorId', 'firstName lastName email');

      console.log(`Found ${readyBookings.length} bookings ready for payout processing`);

      for (const booking of readyBookings) {
        await this.processBookingPayout(booking);
      }
    } catch (error) {
      console.error('Error checking pending payouts:', error);
    }
  }

  // Process payout for a specific booking
  static async processBookingPayout(booking: any): Promise<void> {
    try {
      // Check if there's an active dispute for this booking
      const activeDispute = await Dispute.findOne({
        bookingId: booking._id,
        status: { $in: ['pending', 'mentor_responded', 'admin_review'] }
      });

      if (activeDispute) {
        console.log(`Booking ${booking._id} has active dispute, skipping payout`);
        await Booking.findByIdAndUpdate(booking._id, {
          payoutStatus: 'disputed',
          payoutProcessedAt: new Date()
        });
        return;
      }

      // Calculate payout amounts
      const totalAmount = booking.amount;
      const commissionRate = await this.getCommissionRate(booking.mentorId._id);
      const platformCommission = totalAmount * commissionRate;
      const mentorPayout = totalAmount - platformCommission;

      // Update booking with payout information
      await Booking.findByIdAndUpdate(booking._id, {
        platformCommission,
        mentorPayout,
        payoutStatus: 'processing',
        payoutDate: new Date()
      });

      // Get mentor's Stripe Connect account
      const mentor = await User.findById(booking.mentorId._id);
      if (!mentor || !mentor.stripeConnect?.accountId) {
        throw new Error('Mentor does not have a connected Stripe account');
      }

      // Check if account is ready for payouts
      const isAccountReady = await StripeService.isAccountReady(mentor.stripeConnect.accountId);
      if (!isAccountReady) {
        throw new Error('Mentor Stripe account is not ready for payouts');
      }

      // Transfer funds to mentor's Stripe account
      const transfer = await StripeService.transferToAccount({
        amount: Math.round(mentorPayout * 100), // Convert to cents
        currency: 'usd',
        destination: mentor.stripeConnect.accountId,
        description: `Session payout for booking ${booking._id}`,
        metadata: {
          bookingId: booking._id.toString(),
          mentorId: (mentor._id as any).toString(),
          type: 'session'
        }
      });

      // Update booking with transfer ID
      await Booking.findByIdAndUpdate(booking._id, {
        stripeTransferId: transfer.id,
        payoutStatus: 'completed'
      });

      // Update mentor earnings
      await MentorEarningsService.addEarnings(
        booking.mentorId._id,
        {
          amount: mentorPayout,
          type: 'session',
          description: 'Session payout',
          bookingId: booking._id.toString()
        }
      );

      // Send payout success notification
      try {
        await payoutNotificationService.sendPayoutSuccessNotification({
          mentorId: booking.mentorId._id.toString(),
          payoutId: transfer.id,
          amount: mentorPayout,
          status: 'success',
          payoutDate: new Date(),
          bookingIds: [booking._id.toString()]
        });
      } catch (notificationError) {
        console.error('Error sending payout success notification:', notificationError);
        // Don't fail the payout if notification fails
      }

      console.log(`Processed payout for booking ${booking._id}: $${mentorPayout} to mentor, $${platformCommission} commission`);
    } catch (error) {
      console.error(`Error processing payout for booking ${booking._id}:`, error);
      
      // Mark as failed
      await Booking.findByIdAndUpdate(booking._id, {
        payoutStatus: 'failed',
        payoutFailureReason: (error as Error).message || 'Unknown error'
      });

      // Send payout failure notification
      try {
        await payoutNotificationService.sendPayoutFailureNotification({
          mentorId: booking.mentorId._id.toString(),
          payoutId: `failed_${booking._id}`,
          amount: booking.mentorPayout || booking.amount,
          status: 'failed',
          payoutDate: new Date(),
          failureReason: (error as Error).message || 'Unknown error',
          bookingIds: [booking._id.toString()]
        });
      } catch (notificationError) {
        console.error('Error sending payout failure notification:', notificationError);
        // Don't fail the error handling if notification fails
      }
    }
  }

  // Process cold message payouts
  static async processColdMessagePayout(mentorId: string, amount: number, messageId: string): Promise<void> {
    try {
      // Calculate payout amounts
      const commissionRate = await this.getCommissionRate(mentorId);
      const platformCommission = amount * commissionRate;
      const mentorPayout = amount - platformCommission;

      // Get mentor's Stripe Connect account
      const mentor = await User.findById(mentorId);
      if (!mentor || !mentor.stripeConnect?.accountId) {
        console.log(`Mentor ${mentorId} does not have a connected Stripe account, skipping payout`);
        return;
      }

      // Check if account is ready for payouts
      const isAccountReady = await StripeService.isAccountReady(mentor.stripeConnect.accountId);
      if (!isAccountReady) {
        console.log(`Mentor ${mentorId} Stripe account is not ready for payouts, skipping payout`);
        return;
      }

      // Transfer funds to mentor's Stripe account
      const transfer = await StripeService.transferToAccount({
        amount: Math.round(mentorPayout * 100), // Convert to cents
        currency: 'usd',
        destination: mentor.stripeConnect.accountId,
        description: `Cold message payout for message ${messageId}`,
        metadata: {
          messageId: messageId,
          mentorId: mentorId,
          type: 'cold_message'
        }
      });

      // Update mentor earnings
      await MentorEarningsService.addEarnings(
        mentorId,
        {
          amount: mentorPayout,
          type: 'message',
          description: 'Cold message payout',
          messageId: messageId
        }
      );

      // Send payout success notification
      try {
        await payoutNotificationService.sendPayoutSuccessNotification({
          mentorId: mentorId,
          payoutId: transfer.id,
          amount: mentorPayout,
          status: 'success',
          payoutDate: new Date()
        });
      } catch (notificationError) {
        console.error('Error sending cold message payout success notification:', notificationError);
        // Don't fail the payout if notification fails
      }

      console.log(`Processed cold message payout: $${mentorPayout} to mentor ${mentorId}, $${platformCommission} commission, transfer: ${transfer.id}`);
    } catch (error) {
      console.error(`Error processing cold message payout for mentor ${mentorId}:`, error);
      
      // Send payout failure notification
      try {
        await payoutNotificationService.sendPayoutFailureNotification({
          mentorId: mentorId,
          payoutId: `failed_cold_message_${messageId}`,
          amount: amount,
          status: 'failed',
          payoutDate: new Date(),
          failureReason: (error as Error).message || 'Unknown error'
        });
      } catch (notificationError) {
        console.error('Error sending cold message payout failure notification:', notificationError);
        // Don't fail the error handling if notification fails
      }
    }
  }

  // Get commission rate for a mentor
  private static async getCommissionRate(mentorId: string): Promise<number> {
    try {
      const user = await User.findById(mentorId);
      if (!user || !user.mentorEarnings) {
        return 0.25; // Default 25% commission
      }

      const tier = user.mentorEarnings.commissionTier || 'tier1';
      const tierRates: { [key: string]: number } = {
        tier1: 0.25, // 25%
        tier2: 0.22, // 22%
        tier3: 0.20, // 20%
        tier4: 0.18, // 18%
        tier5: 0.16, // 16%
        tier6: 0.14, // 14%
        tier7: 0.12, // 12%
        tier8: 0.08  // 8%
      };

      return tierRates[tier] || 0.25;
    } catch (error) {
      console.error('Error getting commission rate:', error);
      return 0.25; // Default fallback
    }
  }

  // Get payout history for a mentor
  static async getMentorPayoutHistory(mentorId: string, limit: number = 50): Promise<any[]> {
    try {
      const bookings = await Booking.find({
        mentorId,
        payoutStatus: { $in: ['completed', 'failed', 'disputed'] }
      })
      .sort({ payoutDate: -1 })
      .limit(limit)
      .populate('studentId', 'firstName lastName');

      return bookings.map(booking => ({
        id: booking._id,
        type: 'session',
        amount: booking.mentorPayout || 0,
        status: booking.payoutStatus,
        date: booking.payoutDate || booking.updatedAt,
        student: booking.studentId && typeof booking.studentId === 'object' && 'firstName' in booking.studentId ? {
          name: `${(booking.studentId as any).firstName} ${(booking.studentId as any).lastName}`,
          id: (booking.studentId as any)._id
        } : null,
        failureReason: undefined
      }));
    } catch (error) {
      console.error('Error getting mentor payout history:', error);
      return [];
    }
  }

  // Get platform payout statistics
  static async getPlatformPayoutStats(): Promise<{
    totalPayouts: number;
    totalAmount: number;
    pendingPayouts: number;
    failedPayouts: number;
    disputedPayouts: number;
  }> {
    try {
      const stats = await Booking.aggregate([
        {
          $group: {
            _id: '$payoutStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$mentorPayout' }
          }
        }
      ]);

      const result = {
        totalPayouts: 0,
        totalAmount: 0,
        pendingPayouts: 0,
        failedPayouts: 0,
        disputedPayouts: 0
      };

      stats.forEach(stat => {
        if (stat._id === 'completed') {
          result.totalPayouts = stat.count;
          result.totalAmount = stat.totalAmount || 0;
        } else if (stat._id === 'pending') {
          result.pendingPayouts = stat.count;
        } else if (stat._id === 'failed') {
          result.failedPayouts = stat.count;
        } else if (stat._id === 'disputed') {
          result.disputedPayouts = stat.count;
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting platform payout stats:', error);
      return {
        totalPayouts: 0,
        totalAmount: 0,
        pendingPayouts: 0,
        failedPayouts: 0,
        disputedPayouts: 0
      };
    }
  }

  // Handle dispute resolution payouts
  static async handleDisputeResolution(disputeId: string, decision: string, amount?: number): Promise<void> {
    try {
      const dispute = await Dispute.findById(disputeId).populate('bookingId');
      if (!dispute) return;

      const booking = dispute.bookingId as any;
      
      if (decision === 'refund_mentee') {
        // Refund mentee, no payout to mentor
        await Booking.findByIdAndUpdate(booking._id, {
          payoutStatus: 'refunded',
          payoutProcessedAt: new Date()
        });
      } else if (decision === 'pay_mentor') {
        // Pay mentor full amount
        await this.processBookingPayout(booking);
      } else if (decision === 'partial_refund' && amount) {
        // Partial refund - pay mentor reduced amount
        const mentorPayout = booking.amount - amount;
        const commissionRate = await this.getCommissionRate(booking.mentorId);
        const platformCommission = mentorPayout * commissionRate;
        const finalMentorPayout = mentorPayout - platformCommission;

        await Booking.findByIdAndUpdate(booking._id, {
          platformCommission,
          mentorPayout: finalMentorPayout,
          payoutStatus: 'completed',
          payoutDate: new Date()
        });

        // Update mentor earnings
        await MentorEarningsService.addEarnings(
          booking.mentorId,
          {
            amount: finalMentorPayout,
            type: 'session',
            description: 'Partial refund session payout',
            bookingId: booking._id.toString()
          }
        );
      }
    } catch (error) {
      console.error('Error handling dispute resolution payout:', error);
    }
  }
}
