import { StripeService } from './stripeService';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { TokenTransaction } from '../models/TokenTransaction';

export interface RefundOptions {
  bookingId: string;
  refundType: 'payment_method' | 'tokens';
  reason: string;
  cancelledBy: 'mentor' | 'mentee';
}

export class RefundService {
  // Process refund for booking cancellation
  static async processRefund(options: RefundOptions): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const booking = await Booking.findById(options.bookingId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Check if booking was paid
      if (booking.paymentStatus !== 'paid') {
        return { success: false, error: 'Booking was not paid, no refund needed' };
      }

      // Check if already refunded
      if (booking.refund?.status === 'processed') {
        return { success: false, error: 'Booking already refunded' };
      }

      const refundAmount = booking.amount;

      if (options.refundType === 'payment_method') {
        // Process Stripe refund
        if (!booking.stripePaymentIntentId) {
          return { success: false, error: 'No payment intent found for refund' };
        }

        try {
          const refund = await StripeService.createRefund(
            booking.stripePaymentIntentId,
            refundAmount
          );

          // Update booking with refund info
          booking.refund = {
            status: 'processed',
            type: 'payment_method',
            amount: refundAmount,
            stripeRefundId: refund.id,
            processedAt: new Date(),
            reason: options.reason
          };
          await booking.save();

          return { success: true, refundId: refund.id };
        } catch (stripeError) {
          
          // Mark refund as failed
          booking.refund = {
            status: 'failed',
            type: 'payment_method',
            amount: refundAmount,
            processedAt: new Date(),
            reason: `Stripe refund failed: ${stripeError}`
          };
          await booking.save();

          return { success: false, error: 'Stripe refund failed' };
        }
      } else {
        // Process token refund
        const student = await User.findById(booking.studentId);
        if (!student) {
          return { success: false, error: 'Student not found' };
        }

        // Add tokens to student's balance
        student.mentraBalance += refundAmount;
        await student.save();

        // Create transaction record for token refund
        const transaction = new TokenTransaction({
          userId: booking.studentId,
          type: 'credit',
          amount: refundAmount,
          description: `Booking cancellation refund - ${options.reason}`,
          reference: `refund_${options.bookingId}_${Date.now()}`
        });
        await transaction.save();

        // Update booking with refund info
        booking.refund = {
          status: 'processed',
          type: 'tokens',
          amount: refundAmount,
          processedAt: new Date(),
          reason: options.reason
        };
        await booking.save();

        return { success: true, refundId: (transaction._id as any).toString() };
      }
    } catch (error) {
      return { success: false, error: 'Refund processing failed' };
    }
  }

  // Get refund status for a booking
  static async getRefundStatus(bookingId: string): Promise<{ status: string; details?: any }> {
    try {
      const booking = await Booking.findById(bookingId).select('refund');
      if (!booking) {
        return { status: 'booking_not_found' };
      }

      return {
        status: booking.refund?.status || 'none',
        details: booking.refund
      };
    } catch (error) {
      return { status: 'error' };
    }
  }

  // Calculate refund amount based on cancellation time
  static calculateRefundAmount(booking: any, cancelledBy: 'mentor' | 'mentee'): number {
    const now = new Date();
    const sessionTime = new Date(booking.scheduledAtUTC);
    const hoursUntilSession = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minimumHours = booking.cancellationPolicy?.minimumCancellationHours || 24;

    // If mentor cancels, always full refund
    if (cancelledBy === 'mentor') {
      return booking.amount;
    }

    // If mentee cancels, check timing
    if (hoursUntilSession >= minimumHours) {
      // Full refund if cancelled within policy
      return booking.amount;
    } else if (hoursUntilSession >= 2) {
      // 50% refund if cancelled 2-24 hours before
      return booking.amount * 0.5;
    } else {
      // No refund if cancelled less than 2 hours before
      return 0;
    }
  }
}
