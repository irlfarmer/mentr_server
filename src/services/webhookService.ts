import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { notificationService } from './notificationService';
import { payoutNotificationService } from './payoutNotificationService';
import { bookingNotificationService } from './bookingNotificationService';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
  processed: boolean;
  error?: string;
}

export class WebhookService {
  // Process payment intent succeeded event
  static async processPaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    try {
      const bookingId = paymentIntent.metadata?.bookingId;
      if (!bookingId) {
        return;
      }

      // Skip processing for temporary IDs (amount-based payments) and token top-ups
      if (bookingId.startsWith('temp_') || bookingId.startsWith('token_topup_')) {
        return;
      }

      // Update booking status
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        // Booking not found
        return;
      }

      // Update payment status and booking status
      let needsUpdate = false;
      
      if (booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid';
        needsUpdate = true;
      }
      
      if (booking.status !== 'confirmed') {
        booking.status = 'confirmed'; // Update booking status to confirmed
        needsUpdate = true;
      }
      
      if (!booking.stripePaymentIntentId) {
        booking.stripePaymentIntentId = paymentIntent.id;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await booking.save();


        // Send payment success notification
        try {
          await notificationService.createMultiTypeNotification(
            booking.studentId.toString(),
            'booking',
            'Payment Successful',
            `Your payment of $${(paymentIntent.amount / 100).toFixed(2)} for the session has been processed successfully.`,
            {
              bookingId: (booking._id as any).toString(),
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              status: 'paid'
            }
          );
        } catch (notificationError) {
          // Don't fail webhook processing if notifications fail
        }

        // Send booking notifications after payment confirmation
        try {
          await bookingNotificationService.sendNewBookingNotification({
            bookingId: (booking._id as any).toString(),
            menteeId: booking.studentId.toString(),
            mentorId: booking.mentorId.toString(),
            serviceId: booking.serviceId.toString(),
            bookingDate: booking.scheduledAt,
            meetingLink: `${process.env.FRONTEND_URL}/video-call/${(booking._id as any).toString()}`
          });

          // Schedule reminder notifications using UTC time
          await bookingNotificationService.scheduleReminderNotifications({
            bookingId: (booking._id as any).toString(),
            menteeId: booking.studentId.toString(),
            mentorId: booking.mentorId.toString(),
            serviceId: booking.serviceId.toString(),
            bookingDate: booking.scheduledAtUTC,
            meetingLink: `${process.env.FRONTEND_URL}/video-call/${(booking._id as any).toString()}`
          });
        } catch (notificationError) {
          // Don't fail webhook processing if notifications fail
        }
      }
    } catch (error) {
      throw error;
    }
  }

  // Process payment intent failed event
  static async processPaymentIntentFailed(paymentIntent: any): Promise<void> {
    try {
      const bookingId = paymentIntent.metadata?.bookingId;
      if (!bookingId) {
        return;
      }

      // Skip processing for temporary IDs (amount-based payments)
      if (bookingId.startsWith('temp_')) {
        return;
      }

      // Update booking status
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        // Booking not found
        return;
      }

      booking.paymentStatus = 'pending'; // Reset to pending for retry
      booking.stripePaymentIntentId = paymentIntent.id;
      await booking.save();


      // Send payment failure notification
      try {
        await notificationService.createMultiTypeNotification(
          booking.studentId.toString(),
          'booking',
          'Payment Failed',
          `Your payment of $${(paymentIntent.amount / 100).toFixed(2)} for the session could not be processed. Please try again.`,
          {
            bookingId: (booking._id as any).toString(),
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            status: 'failed',
            failureReason: paymentIntent.last_payment_error?.message || 'Unknown error'
          }
        );
      } catch (notificationError) {
      }
    } catch (error) {
      throw error;
    }
  }

  // Process transfer created event (successful payout)
  static async processTransferCreated(transfer: any): Promise<void> {
    try {

      // Find bookings with this transfer ID
      const bookings = await Booking.find({ stripeTransferId: transfer.id });
      if (bookings.length === 0) {
        return;
      }

      // Update booking payout status
      for (const booking of bookings) {
        booking.payoutStatus = 'paid';
        booking.payoutDate = new Date();
        await booking.save();
      }

      // Send payout success notification for the first booking (mentor)
      const firstBooking = bookings[0];
      try {
        await payoutNotificationService.sendPayoutSuccessNotification({
          mentorId: firstBooking.mentorId.toString(),
          payoutId: transfer.id,
          amount: transfer.amount / 100,
          status: 'success',
          payoutDate: new Date(),
          bookingIds: bookings.map(b => (b._id as any).toString())
        });
      } catch (notificationError) {
      }
    } catch (error) {
      throw error;
    }
  }

  // Process transfer failed event (failed payout)
  static async processTransferFailed(transfer: any): Promise<void> {
    try {

      // Find bookings with this transfer ID
      const bookings = await Booking.find({ stripeTransferId: transfer.id });
      if (bookings.length === 0) {
        return;
      }

      // Update booking payout status
      for (const booking of bookings) {
        booking.payoutStatus = 'failed';
        booking.payoutDate = new Date();
        await booking.save();
      }

      // Send payout failure notification for the first booking (mentor)
      const firstBooking = bookings[0];
      try {
        await payoutNotificationService.sendPayoutFailureNotification({
          mentorId: firstBooking.mentorId.toString(),
          payoutId: transfer.id,
          amount: transfer.amount / 100,
          status: 'failed',
          payoutDate: new Date(),
          failureReason: transfer.failure_code || 'Unknown error',
          bookingIds: bookings.map(b => (b._id as any).toString())
        });
      } catch (notificationError) {
      }
    } catch (error) {
      throw error;
    }
  }

  // Process Connect account updated event
  static async processAccountUpdated(account: any): Promise<void> {
    try {

      // Find user with this Connect account
      const user = await User.findOne({ 'stripeConnect.accountId': account.id });
      if (!user) {
        return;
      }

      // Update user's Connect account status
      const isReady = account.details_submitted && account.charges_enabled && account.payouts_enabled;
      const previousStatus = user.stripeConnect?.accountStatus;
      if (!user.stripeConnect) {
        user.stripeConnect = {};
      }
      user.stripeConnect.accountStatus = isReady ? 'active' : 'pending';
      user.stripeConnect.lastUpdated = new Date();
      await user.save();

      // Only send notification if status changed
      if (previousStatus !== user.stripeConnect.accountStatus) {
        try {
          const statusMessage = isReady 
            ? 'Your Stripe Connect account is now active and ready to receive payouts!'
            : 'Your Stripe Connect account needs additional information to be fully activated.';

          await notificationService.createMultiTypeNotification(
            (user._id as any).toString(),
            'system',
            'Stripe Connect Account Updated 🔗',
            statusMessage,
            {
              accountId: account.id,
              status: user.stripeConnect.accountStatus,
              isReady,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              detailsSubmitted: account.details_submitted
            }
          );
        } catch (notificationError) {
        }
      }
    } catch (error) {
      throw error;
    }
  }

  // Process Connect account deauthorized event
  static async processAccountDeauthorized(account: any): Promise<void> {
    try {

      // Find user with this Connect account
      const user = await User.findOne({ 'stripeConnect.accountId': account.id });
      if (!user) {
        return;
      }

      // Update user's Connect account status
      if (!user.stripeConnect) {
        user.stripeConnect = {};
      }
      user.stripeConnect.accountStatus = 'rejected';
      user.stripeConnect.accountId = undefined;
      user.stripeConnect.lastUpdated = new Date();
      await user.save();

      // Send deauthorization notification
      try {
        await notificationService.createMultiTypeNotification(
          (user._id as any).toString(),
          'system',
          'Stripe Connect Account Deauthorized',
          'Your Stripe Connect account has been deauthorized. You will need to reconnect your account to receive payouts.',
          {
            accountId: account.id,
            status: 'rejected',
            reason: 'Account deauthorized by Stripe'
          }
        );
      } catch (notificationError) {
      }
    } catch (error) {
      throw error;
    }
  }

  // Log webhook event for debugging
  static logWebhookEvent(eventType: string, eventId: string, data: any, success: boolean, error?: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      eventType,
      eventId,
      success,
      error: error || null,
      data: {
        id: data.id,
        type: data.type,
        created: data.created,
        // Only log essential data, not full payload
        amount: data.amount,
        status: data.status,
        metadata: data.metadata
      }
    };

  }

  // Validate webhook event data
  static validateWebhookEvent(event: any): boolean {
    if (!event || !event.type || !event.data || !event.data.object) {
      return false;
    }

    // Validate required fields based on event type
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
        return !!(event.data.object.id && event.data.object.amount);
      
      case 'transfer.created':
      case 'transfer.failed':
        return !!(event.data.object.id && event.data.object.amount && event.data.object.destination);
      
      case 'account.updated':
      case 'account.application.deauthorized':
        return !!(event.data.object.id);
      
      default:
        return true; // Allow other event types
    }
  }
}
