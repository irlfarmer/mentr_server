import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { RefundService } from './refundService';
import { bookingNotificationService } from './bookingNotificationService';

export class AutoCancelService {
  // Auto-cancel pending bookings older than 4 hours
  static async cancelPendingBookings(): Promise<void> {
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      // Find pending bookings older than 4 hours
      const pendingBookings = await Booking.find({
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: { $lt: fourHoursAgo }
      }).populate('studentId mentorId serviceId');


      for (const booking of pendingBookings) {
        try {
          // Update booking status
          booking.status = 'cancelled';
          booking.notes = booking.notes 
            ? `${booking.notes}\n\nAuto-cancelled due to incomplete payment after 4 hours.`
            : 'Auto-cancelled due to incomplete payment after 4 hours.';
          
          await booking.save();

          // Send notification to both parties
          await bookingNotificationService.sendBookingCancellationNotification(
            {
              bookingId: (booking._id as any).toString(),
              menteeId: (booking.studentId as any)._id.toString(),
              mentorId: (booking.mentorId as any)._id.toString(),
              serviceId: (booking.serviceId as any)._id.toString(),
              bookingDate: booking.scheduledAt,
              reason: 'Auto-cancelled due to incomplete payment after 4 hours'
            },
            'mentee'
          );

        } catch (error) {
          // Error auto-cancelling booking
        }
      }

    } catch (error) {
      // Error in auto-cancel service
    }
  }

  // Get statistics about pending bookings
  static async getPendingBookingStats(): Promise<{
    totalPending: number;
    pendingOver4Hours: number;
    oldestPending: Date | null;
  }> {
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      const totalPending = await Booking.countDocuments({
        status: 'pending',
        paymentStatus: 'pending'
      });

      const pendingOver4Hours = await Booking.countDocuments({
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: { $lt: fourHoursAgo }
      });

      const oldestPendingBooking = await Booking.findOne({
        status: 'pending',
        paymentStatus: 'pending'
      }).sort({ createdAt: 1 }).select('createdAt');

      return {
        totalPending,
        pendingOver4Hours,
        oldestPending: oldestPendingBooking?.createdAt || null
      };
    } catch (error) {
      return {
        totalPending: 0,
        pendingOver4Hours: 0,
        oldestPending: null
      };
    }
  }
}
