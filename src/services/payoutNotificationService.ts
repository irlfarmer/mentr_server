import { notificationService } from './notificationService';
import { User } from '../models/User';
import { Booking } from '../models/Booking';

export interface PayoutNotificationData {
  mentorId: string;
  payoutId: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  payoutDate: Date;
  failureReason?: string;
  bookingIds?: string[];
}

class PayoutNotificationService {
  // Send payout success notification
  async sendPayoutSuccessNotification(data: PayoutNotificationData): Promise<void> {
    try {
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout notification');
      }

      // Get booking details if available
      let bookingDetails = '';
      if (data.bookingIds && data.bookingIds.length > 0) {
        const bookings = await Booking.find({ _id: { $in: data.bookingIds } })
          .populate('serviceId', 'title')
          .select('serviceId scheduledAt');
        
        const sessionCount = bookings.length;
        const serviceNames = bookings.map(b => (b.serviceId as any)?.title || 'Session').join(', ');
        bookingDetails = ` for ${sessionCount} session${sessionCount > 1 ? 's' : ''}: ${serviceNames}`;
      }

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'payout',
        'Payout Successful! 💰',
        `Great news! Your payout of $${data.amount.toFixed(2)} has been successfully transferred to your account${bookingDetails}.`,
        {
          payoutId: data.payoutId,
          amount: data.amount,
          payoutDate: data.payoutDate,
          status: 'success',
          bookingIds: data.bookingIds,
          sessionCount: data.bookingIds?.length || 0
        },
        'high'
      );
    } catch (error) {
      console.error('Error sending payout success notification:', error);
      throw error;
    }
  }

  // Send payout failure notification
  async sendPayoutFailureNotification(data: PayoutNotificationData): Promise<void> {
    try {
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout notification');
      }

      const failureMessage = data.failureReason 
        ? ` Unfortunately, your payout failed due to: ${data.failureReason}. Please check your Stripe Connect account settings.`
        : ' Unfortunately, your payout failed. Please check your Stripe Connect account settings.';

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'payout',
        'Payout Failed ❌',
        `We were unable to process your payout of $${data.amount.toFixed(2)}.${failureMessage}`,
        {
          payoutId: data.payoutId,
          amount: data.amount,
          payoutDate: data.payoutDate,
          status: 'failed',
          failureReason: data.failureReason,
          bookingIds: data.bookingIds
        },
        'urgent'
      );
    } catch (error) {
      console.error('Error sending payout failure notification:', error);
      throw error;
    }
  }

  // Send payout pending notification
  async sendPayoutPendingNotification(data: PayoutNotificationData): Promise<void> {
    try {
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout notification');
      }

      // Get booking details if available
      let bookingDetails = '';
      if (data.bookingIds && data.bookingIds.length > 0) {
        const bookings = await Booking.find({ _id: { $in: data.bookingIds } })
          .populate('serviceId', 'title')
          .select('serviceId scheduledAt');
        
        const sessionCount = bookings.length;
        const serviceNames = bookings.map(b => (b.serviceId as any)?.title || 'Session').join(', ');
        bookingDetails = ` for ${sessionCount} session${sessionCount > 1 ? 's' : ''}: ${serviceNames}`;
      }

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'payout',
        'Payout Processing ⏳',
        `Your payout of $${data.amount.toFixed(2)} is being processed${bookingDetails}. It will be transferred to your account within 1-2 business days.`,
        {
          payoutId: data.payoutId,
          amount: data.amount,
          payoutDate: data.payoutDate,
          status: 'pending',
          bookingIds: data.bookingIds,
          sessionCount: data.bookingIds?.length || 0
        },
        'medium'
      );
    } catch (error) {
      console.error('Error sending payout pending notification:', error);
      throw error;
    }
  }

  // Send payout initiated notification (when payout is first created)
  async sendPayoutInitiatedNotification(data: PayoutNotificationData): Promise<void> {
    try {
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout notification');
      }

      // Get booking details if available
      let bookingDetails = '';
      if (data.bookingIds && data.bookingIds.length > 0) {
        const bookings = await Booking.find({ _id: { $in: data.bookingIds } })
          .populate('serviceId', 'title')
          .select('serviceId scheduledAt');
        
        const sessionCount = bookings.length;
        const serviceNames = bookings.map(b => (b.serviceId as any)?.title || 'Session').join(', ');
        bookingDetails = ` for ${sessionCount} session${sessionCount > 1 ? 's' : ''}: ${serviceNames}`;
      }

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'payout',
        'Payout Initiated 🚀',
        `Your payout of $${data.amount.toFixed(2)} has been initiated${bookingDetails}. It will be processed after the 48-hour dispute period.`,
        {
          payoutId: data.payoutId,
          amount: data.amount,
          payoutDate: data.payoutDate,
          status: 'initiated',
          bookingIds: data.bookingIds,
          sessionCount: data.bookingIds?.length || 0,
          disputePeriodEnds: new Date(data.payoutDate.getTime() + 48 * 60 * 60 * 1000)
        },
        'medium'
      );
    } catch (error) {
      console.error('Error sending payout initiated notification:', error);
      throw error;
    }
  }

  // Send payout summary notification (weekly/monthly)
  async sendPayoutSummaryNotification(mentorId: string, period: 'weekly' | 'monthly', summary: {
    totalAmount: number;
    sessionCount: number;
    payoutCount: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    try {
      const mentor = await User.findById(mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout summary notification');
      }

      const periodText = period === 'weekly' ? 'week' : 'month';
      const periodRange = `${summary.periodStart.toLocaleDateString()} - ${summary.periodEnd.toLocaleDateString()}`;

      await notificationService.createMultiTypeNotification(
        mentorId,
        'payout',
        `${periodText.charAt(0).toUpperCase() + periodText.slice(1)}ly Payout Summary 📊`,
        `Here's your ${periodText}ly earnings summary: $${summary.totalAmount.toFixed(2)} earned from ${summary.sessionCount} session${summary.sessionCount !== 1 ? 's' : ''} across ${summary.payoutCount} payout${summary.payoutCount !== 1 ? 's' : ''} (${periodRange}).`,
        {
          period,
          totalAmount: summary.totalAmount,
          sessionCount: summary.sessionCount,
          payoutCount: summary.payoutCount,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          periodRange
        },
        'low'
      );
    } catch (error) {
      console.error('Error sending payout summary notification:', error);
      throw error;
    }
  }

  // Send payout threshold notification (when mentor reaches earning milestones)
  async sendPayoutThresholdNotification(mentorId: string, threshold: number, currentEarnings: number): Promise<void> {
    try {
      const mentor = await User.findById(mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout threshold notification');
      }

      await notificationService.createMultiTypeNotification(
        mentorId,
        'payout',
        'Earnings Milestone Reached! 🎉',
        `Congratulations! You've reached $${currentEarnings.toFixed(2)} in total earnings. Keep up the great work!`,
        {
          threshold,
          currentEarnings,
          milestone: threshold
        },
        'medium'
      );
    } catch (error) {
      console.error('Error sending payout threshold notification:', error);
      throw error;
    }
  }

  // Send payout delay notification (if payout is delayed)
  async sendPayoutDelayNotification(data: PayoutNotificationData, delayReason: string): Promise<void> {
    try {
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      
      if (!mentor) {
        throw new Error('Mentor not found for payout delay notification');
      }

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'payout',
        'Payout Delayed ⚠️',
        `Your payout of $${data.amount.toFixed(2)} has been delayed. Reason: ${delayReason}. We're working to resolve this as soon as possible.`,
        {
          payoutId: data.payoutId,
          amount: data.amount,
          payoutDate: data.payoutDate,
          status: 'delayed',
          delayReason,
          bookingIds: data.bookingIds
        },
        'high'
      );
    } catch (error) {
      console.error('Error sending payout delay notification:', error);
      throw error;
    }
  }
}

export const payoutNotificationService = new PayoutNotificationService();
