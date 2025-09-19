import { notificationService } from './notificationService';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Service } from '../models/Service';

export interface BookingNotificationData {
  bookingId: string;
  menteeId: string;
  mentorId: string;
  serviceId: string;
  bookingDate: Date;
  meetingLink?: string;
  reason?: string; // For cancellations
  refund?: {
    success: boolean;
    refundId?: string;
    error?: string;
  };
}

class BookingNotificationService {
  // Send new booking notification to mentor
  async sendNewBookingNotification(data: BookingNotificationData): Promise<void> {
    try {
      const [mentor, mentee, service, booking] = await Promise.all([
        User.findById(data.mentorId).select('firstName lastName email'),
        User.findById(data.menteeId).select('firstName lastName email'),
        Service.findById(data.serviceId).select('title'),
        Booking.findById(data.bookingId).select('status')
      ]);

      if (!mentor || !mentee || !service || !booking) {
        throw new Error('Required data not found for booking notification');
      }

      // Send notification to mentor immediately
      await notificationService.createNotification({
        userId: data.mentorId,
        type: 'in_app',
        category: 'booking',
        title: 'New Booking Request',
        message: `${mentee.firstName} ${mentee.lastName} has booked your "${service.title}" service for ${data.bookingDate.toLocaleString()}`,
        data: {
          bookingId: data.bookingId,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          menteeEmail: mentee.email,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          status: booking.status
        },
        priority: 'high',
        sendImmediately: true
      });

      // Send confirmation to mentee immediately
      await notificationService.createNotification({
        userId: data.menteeId,
        type: 'in_app',
        category: 'booking',
        title: 'Booking Confirmation',
        message: `Your booking for "${service.title}" with ${mentor.firstName} ${mentor.lastName} has been confirmed for ${data.bookingDate.toLocaleString()}`,
        data: {
          bookingId: data.bookingId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          status: booking.status
        },
        priority: 'medium',
        sendImmediately: true
      });
    } catch (error) {
      throw error;
    }
  }

  // Send booking confirmation notification
  async sendBookingConfirmationNotification(data: BookingNotificationData): Promise<void> {
    try {
      const [mentor, mentee, service] = await Promise.all([
        User.findById(data.mentorId).select('firstName lastName email'),
        User.findById(data.menteeId).select('firstName lastName email'),
        Service.findById(data.serviceId).select('title')
      ]);

      if (!mentor || !mentee || !service) {
        throw new Error('Required data not found for booking confirmation');
      }

      // Send confirmation to mentee
      await notificationService.createNotification({
        userId: data.menteeId,
        type: 'in_app',
        category: 'booking',
        title: 'Booking Confirmed',
        message: `Great news! Your booking for "${service.title}" with ${mentor.firstName} ${mentor.lastName} has been confirmed for ${data.bookingDate.toLocaleString()}`,
        data: {
          bookingId: data.bookingId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink
        },
        priority: 'medium'
      });
    } catch (error) {
      throw error;
    }
  }

  // Send 24-hour reminder notification
  async send24HourReminderNotification(data: BookingNotificationData): Promise<void> {
    try {
      const [mentor, mentee, service] = await Promise.all([
        User.findById(data.mentorId).select('firstName lastName email'),
        User.findById(data.menteeId).select('firstName lastName email'),
        Service.findById(data.serviceId).select('title')
      ]);

      if (!mentor || !mentee || !service) {
        throw new Error('Required data not found for 24h reminder');
      }

      // Send reminder to both mentor and mentee
      const reminderMessage = `Reminder: Your session "${service.title}" is scheduled for tomorrow at ${data.bookingDate.toLocaleString()}`;
      
      // Mentor reminder
      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'booking',
        'Session Reminder - 24 Hours',
        reminderMessage,
        {
          bookingId: data.bookingId,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          reminderType: '24h'
        },
        'medium'
      );

      // Mentee reminder
      await notificationService.createMultiTypeNotification(
        data.menteeId,
        'booking',
        'Session Reminder - 24 Hours',
        reminderMessage,
        {
          bookingId: data.bookingId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          reminderType: '24h'
        },
        'medium'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send 30-minute reminder notification
  async send30MinuteReminderNotification(data: BookingNotificationData): Promise<void> {
    try {
      const [mentor, mentee, service] = await Promise.all([
        User.findById(data.mentorId).select('firstName lastName email'),
        User.findById(data.menteeId).select('firstName lastName email'),
        Service.findById(data.serviceId).select('title')
      ]);

      if (!mentor || !mentee || !service) {
        throw new Error('Required data not found for 30min reminder');
      }

      // Send reminder to both mentor and mentee
      const reminderMessage = `Your session "${service.title}" starts in 30 minutes at ${data.bookingDate.toLocaleString()}`;
      
      // Mentor reminder
      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'booking',
        'Session Starting Soon - 30 Minutes',
        reminderMessage,
        {
          bookingId: data.bookingId,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          reminderType: '30min'
        },
        'high'
      );

      // Mentee reminder
      await notificationService.createMultiTypeNotification(
        data.menteeId,
        'booking',
        'Session Starting Soon - 30 Minutes',
        reminderMessage,
        {
          bookingId: data.bookingId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          serviceTitle: service.title,
          bookingDate: data.bookingDate,
          meetingLink: data.meetingLink,
          reminderType: '30min'
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send booking cancellation notification
  async sendBookingCancellationNotification(data: BookingNotificationData, cancelledBy: 'mentor' | 'mentee'): Promise<void> {
    try {
      const [mentor, mentee, service] = await Promise.all([
        User.findById(data.mentorId).select('firstName lastName email'),
        User.findById(data.menteeId).select('firstName lastName email'),
        Service.findById(data.serviceId).select('title')
      ]);

      if (!mentor || !mentee || !service) {
        throw new Error('Required data not found for booking cancellation');
      }

      const cancelledByName = cancelledBy === 'mentor' ? `${mentor.firstName} ${mentor.lastName}` : `${mentee.firstName} ${mentee.lastName}`;
      const reasonText = data.reason ? ` Reason: ${data.reason}` : '';
      
      // Add refund information to message
      let refundText = '';
      if (data.refund) {
        if (data.refund.success) {
          refundText = ` You have been automatically refunded.`;
        } else {
          refundText = ` Refund processing failed: ${data.refund.error}`;
        }
      }

      if (cancelledBy === 'mentor') {
        // Notify mentee that mentor cancelled
        await notificationService.createMultiTypeNotification(
          data.menteeId,
          'booking',
          'Session Cancelled by Mentor',
          `Unfortunately, ${cancelledByName} has cancelled your "${service.title}" session scheduled for ${data.bookingDate.toLocaleString()}.${reasonText}${refundText}`,
          {
            bookingId: data.bookingId,
            mentorName: `${mentor.firstName} ${mentor.lastName}`,
            serviceTitle: service.title,
            bookingDate: data.bookingDate,
            cancelledBy: 'mentor',
            reason: data.reason
          },
          'high'
        );
      } else {
        // Notify mentor that mentee cancelled
        await notificationService.createMultiTypeNotification(
          data.mentorId,
          'booking',
          'Session Cancelled by Student',
          `${cancelledByName} has cancelled their "${service.title}" session scheduled for ${data.bookingDate.toLocaleString()}.${reasonText}${refundText}`,
          {
            bookingId: data.bookingId,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            serviceTitle: service.title,
            bookingDate: data.bookingDate,
            cancelledBy: 'mentee',
            reason: data.reason
          },
          'high'
        );
      }
    } catch (error) {
      throw error;
    }
  }

  // Schedule reminder notifications for a booking
  async scheduleReminderNotifications(data: BookingNotificationData): Promise<void> {
    try {
      const now = new Date();
      const bookingTime = new Date(data.bookingDate);
      
      // Calculate reminder times
      const reminder24h = new Date(bookingTime.getTime() - 24 * 60 * 60 * 1000);
      const reminder30min = new Date(bookingTime.getTime() - 30 * 60 * 1000);

      // Only schedule reminders if they're in the future
      const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Schedule 24h reminder if it's more than 24 hours away
      if (hoursUntilBooking > 24) {
        await notificationService.createNotification({
          userId: data.mentorId,
          type: 'in_app',
          category: 'booking',
          title: 'Session Reminder - 24 Hours',
          message: `Reminder: Your session is scheduled for tomorrow`,
          data: {
            bookingId: data.bookingId,
            menteeName: 'Student',
            serviceTitle: 'Service',
            bookingDate: data.bookingDate,
            meetingLink: data.meetingLink,
            reminderType: '24h'
          },
          priority: 'medium',
          scheduledFor: reminder24h
        });

        await notificationService.createNotification({
          userId: data.menteeId,
          type: 'in_app',
          category: 'booking',
          title: 'Session Reminder - 24 Hours',
          message: `Reminder: Your session is scheduled for tomorrow`,
          data: {
            bookingId: data.bookingId,
            mentorName: 'Mentor',
            serviceTitle: 'Service',
            bookingDate: data.bookingDate,
            meetingLink: data.meetingLink,
            reminderType: '24h'
          },
          priority: 'medium',
          scheduledFor: reminder24h
        });
      } else {
      }

      // Schedule 30-minute reminder if it's more than 30 minutes away
      if (hoursUntilBooking > 0.5) {
        await notificationService.createNotification({
          userId: data.mentorId,
          type: 'in_app',
          category: 'booking',
          title: 'Session Starting Soon - 30 Minutes',
          message: `Your session starts in 30 minutes`,
          data: {
            bookingId: data.bookingId,
            menteeName: 'Student',
            serviceTitle: 'Service',
            bookingDate: data.bookingDate,
            meetingLink: data.meetingLink,
            reminderType: '30min'
          },
          priority: 'high',
          scheduledFor: reminder30min
        });

        await notificationService.createNotification({
          userId: data.menteeId,
          type: 'in_app',
          category: 'booking',
          title: 'Session Starting Soon - 30 Minutes',
          message: `Your session starts in 30 minutes`,
          data: {
            bookingId: data.bookingId,
            mentorName: 'Mentor',
            serviceTitle: 'Service',
            bookingDate: data.bookingDate,
            meetingLink: data.meetingLink,
            reminderType: '30min'
          },
          priority: 'high',
          scheduledFor: reminder30min
        });
      } else {
      }
    } catch (error) {
      throw error;
    }
  }

  // Cancel scheduled reminder notifications for a booking
  async cancelScheduledReminders(bookingId: string): Promise<void> {
    try {
      // This would typically involve updating the notification status
      // For now, we'll just log it - in a real implementation, you'd update the database
    } catch (error) {
      throw error;
    }
  }
}

export const bookingNotificationService = new BookingNotificationService();
