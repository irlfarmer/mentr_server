import { notificationService } from './notificationService';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import RescheduleRequest from '../models/RescheduleRequest';

export interface RescheduleNotificationData {
  rescheduleRequestId: string;
  bookingId: string;
  requestedBy: string;
  requestedTo: string;
  newScheduledAt: Date;
  oldScheduledAt: Date;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  responseReason?: string;
  respondedBy?: string;
}

class RescheduleNotificationService {
  // Send new reschedule request notification
  async sendNewRescheduleRequestNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const recipient = await User.findById(data.requestedTo).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !recipient || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Check if recipient has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(data.requestedTo);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const serviceTitle = (booking.serviceId as any)?.title || 'Session';
      const oldDate = new Date(data.oldScheduledAt).toLocaleDateString();
      const oldTime = new Date(data.oldScheduledAt).toLocaleTimeString();
      const newDate = new Date(data.newScheduledAt).toLocaleDateString();
      const newTime = new Date(data.newScheduledAt).toLocaleTimeString();
      const reasonText = data.reason ? ` Reason: ${data.reason}` : '';

      await notificationService.createMultiTypeNotification(
        data.requestedTo,
        'reschedule',
        'New Reschedule Request',
        `${requester.firstName} ${requester.lastName} has requested to reschedule your session "${serviceTitle}" from ${oldDate} at ${oldTime} to ${newDate} at ${newTime}.${reasonText}`,
        {
          rescheduleRequestId: data.rescheduleRequestId,
          bookingId: data.bookingId,
          requesterId: data.requestedBy,
          requesterName: `${requester.firstName} ${requester.lastName}`,
          serviceTitle,
          oldScheduledAt: data.oldScheduledAt,
          newScheduledAt: data.newScheduledAt,
          oldDate,
          oldTime,
          newDate,
          newTime,
          reason: data.reason,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule request approved notification
  async sendRescheduleApprovedNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const approver = await User.findById(data.respondedBy).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !approver || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Check if requester has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(data.requestedBy);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const serviceTitle = (booking.serviceId as any)?.title || 'Session';
      const newDate = new Date(data.newScheduledAt).toLocaleDateString();
      const newTime = new Date(data.newScheduledAt).toLocaleTimeString();
      const responseText = data.responseReason ? ` Response: ${data.responseReason}` : '';

      await notificationService.createMultiTypeNotification(
        data.requestedBy,
        'reschedule',
        'Reschedule Request Approved',
        `${approver.firstName} ${approver.lastName} has approved your reschedule request for session "${serviceTitle}". New time: ${newDate} at ${newTime}.${responseText}`,
        {
          rescheduleRequestId: data.rescheduleRequestId,
          bookingId: data.bookingId,
          approverId: data.respondedBy,
          approverName: `${approver.firstName} ${approver.lastName}`,
          serviceTitle,
          newScheduledAt: data.newScheduledAt,
          newDate,
          newTime,
          responseReason: data.responseReason,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule request rejected notification
  async sendRescheduleRejectedNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const rejector = await User.findById(data.respondedBy).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !rejector || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Check if requester has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(data.requestedBy);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const serviceTitle = (booking.serviceId as any)?.title || 'Session';
      const oldDate = new Date(data.oldScheduledAt).toLocaleDateString();
      const oldTime = new Date(data.oldScheduledAt).toLocaleTimeString();
      const responseText = data.responseReason ? ` Reason: ${data.responseReason}` : '';

      await notificationService.createMultiTypeNotification(
        data.requestedBy,
        'reschedule',
        'Reschedule Request Rejected',
        `${rejector.firstName} ${rejector.lastName} has rejected your reschedule request for session "${serviceTitle}". The session remains scheduled for ${oldDate} at ${oldTime}.${responseText}`,
        {
          rescheduleRequestId: data.rescheduleRequestId,
          bookingId: data.bookingId,
          rejectorId: data.respondedBy,
          rejectorName: `${rejector.firstName} ${rejector.lastName}`,
          serviceTitle,
          oldScheduledAt: data.oldScheduledAt,
          newScheduledAt: data.newScheduledAt,
          oldDate,
          oldTime,
          responseReason: data.responseReason,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule reminder notification (24 hours before response deadline)
  async sendRescheduleReminderNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const recipient = await User.findById(data.requestedTo).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !recipient || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Check if recipient has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(data.requestedTo);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const serviceTitle = (booking.serviceId as any)?.title || 'Session';
      const newDate = new Date(data.newScheduledAt).toLocaleDateString();
      const newTime = new Date(data.newScheduledAt).toLocaleTimeString();

      await notificationService.createMultiTypeNotification(
        data.requestedTo,
        'reschedule',
        'Reschedule Request Reminder',
        `Reminder: You have a pending reschedule request from ${requester.firstName} ${requester.lastName} for session "${serviceTitle}" to ${newDate} at ${newTime}. Please respond soon.`,
        {
          rescheduleRequestId: data.rescheduleRequestId,
          bookingId: data.bookingId,
          requesterId: data.requestedBy,
          requesterName: `${requester.firstName} ${requester.lastName}`,
          serviceTitle,
          newScheduledAt: data.newScheduledAt,
          newDate,
          newTime,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'medium'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule auto-approval notification (if no response within deadline)
  async sendRescheduleAutoApprovalNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const recipient = await User.findById(data.requestedTo).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !recipient || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Notify requester
      const requesterPreferences = await notificationService.getUserPreferences(data.requestedBy);
      if (requesterPreferences?.email?.reschedule || requesterPreferences?.inApp?.reschedule) {
        const serviceTitle = (booking.serviceId as any)?.title || 'Session';
        const newDate = new Date(data.newScheduledAt).toLocaleDateString();
        const newTime = new Date(data.newScheduledAt).toLocaleTimeString();

        await notificationService.createMultiTypeNotification(
          data.requestedBy,
          'reschedule',
          'Reschedule Auto-Approved ⚡',
          `Your reschedule request for session "${serviceTitle}" has been automatically approved due to no response. New time: ${newDate} at ${newTime}.`,
          {
            rescheduleRequestId: data.rescheduleRequestId,
            bookingId: data.bookingId,
            serviceTitle,
            newScheduledAt: data.newScheduledAt,
            newDate,
            newTime,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'medium'
        );
      }

      // Notify recipient
      const recipientPreferences = await notificationService.getUserPreferences(data.requestedTo);
      if (recipientPreferences?.email?.reschedule || recipientPreferences?.inApp?.reschedule) {
        const serviceTitle = (booking.serviceId as any)?.title || 'Session';
        const newDate = new Date(data.newScheduledAt).toLocaleDateString();
        const newTime = new Date(data.newScheduledAt).toLocaleTimeString();

        await notificationService.createMultiTypeNotification(
          data.requestedTo,
          'reschedule',
          'Reschedule Auto-Approved ⚡',
          `The reschedule request for session "${serviceTitle}" has been automatically approved. New time: ${newDate} at ${newTime}.`,
          {
            rescheduleRequestId: data.rescheduleRequestId,
            bookingId: data.bookingId,
            requesterId: data.requestedBy,
            requesterName: `${requester.firstName} ${requester.lastName}`,
            serviceTitle,
            newScheduledAt: data.newScheduledAt,
            newDate,
            newTime,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'medium'
        );
      }
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule summary notification (weekly)
  async sendRescheduleSummaryNotification(userId: string, period: 'weekly' | 'monthly', summary: {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    try {
      const user = await User.findById(userId).select('firstName lastName email');
      
      if (!user) {
        throw new Error('User not found for reschedule summary notification');
      }

      // Check if user has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(userId);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const periodText = period === 'weekly' ? 'week' : 'month';
      const periodRange = `${summary.periodStart.toLocaleDateString()} - ${summary.periodEnd.toLocaleDateString()}`;

      await notificationService.createMultiTypeNotification(
        userId,
        'reschedule',
        `${periodText.charAt(0).toUpperCase() + periodText.slice(1)}ly Reschedule Summary`,
        `Here's your ${periodText}ly reschedule activity: ${summary.totalRequests} total requests (${summary.approvedRequests} approved, ${summary.rejectedRequests} rejected, ${summary.pendingRequests} pending) for the period ${periodRange}.`,
        {
          period,
          totalRequests: summary.totalRequests,
          approvedRequests: summary.approvedRequests,
          rejectedRequests: summary.rejectedRequests,
          pendingRequests: summary.pendingRequests,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          periodRange
        },
        'low'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send reschedule deadline warning notification (2 hours before auto-approval)
  async sendRescheduleDeadlineWarningNotification(data: RescheduleNotificationData): Promise<void> {
    try {
      const requester = await User.findById(data.requestedBy).select('firstName lastName email');
      const recipient = await User.findById(data.requestedTo).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!requester || !recipient || !booking) {
        throw new Error('Required data not found for reschedule notification');
      }

      // Check if recipient has reschedule notifications enabled
      const preferences = await notificationService.getUserPreferences(data.requestedTo);
      if (!preferences?.email?.reschedule || !preferences?.inApp?.reschedule) {
        return;
      }

      const serviceTitle = (booking.serviceId as any)?.title || 'Session';
      const newDate = new Date(data.newScheduledAt).toLocaleDateString();
      const newTime = new Date(data.newScheduledAt).toLocaleTimeString();

      await notificationService.createMultiTypeNotification(
        data.requestedTo,
        'reschedule',
        'Reschedule Request Expiring Soon',
        `Warning: The reschedule request from ${requester.firstName} ${requester.lastName} for session "${serviceTitle}" to ${newDate} at ${newTime} will be auto-approved in 2 hours if no response is given.`,
        {
          rescheduleRequestId: data.rescheduleRequestId,
          bookingId: data.bookingId,
          requesterId: data.requestedBy,
          requesterName: `${requester.firstName} ${requester.lastName}`,
          serviceTitle,
          newScheduledAt: data.newScheduledAt,
          newDate,
          newTime,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }
}

export const rescheduleNotificationService = new RescheduleNotificationService();
