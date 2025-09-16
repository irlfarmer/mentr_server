import { notificationService } from './notificationService';
import { User } from '../models/User';
import { Dispute } from '../models/Dispute';
import { Booking } from '../models/Booking';

export interface DisputeNotificationData {
  disputeId: string;
  menteeId: string;
  mentorId: string;
  bookingId: string;
  reason: string;
  description: string;
  status: 'pending' | 'mentor_responded' | 'admin_review' | 'resolved' | 'dismissed';
  decision?: 'refund_full' | 'refund_partial' | 'no_refund' | 'dismissed';
  refundAmount?: number;
  adminReason?: string;
  mentorResponse?: string;
}

class DisputeNotificationService {
  // Send new dispute notification to mentor
  async sendNewDisputeNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      // Check if mentor has dispute notifications enabled
      const preferences = await notificationService.getUserPreferences(data.mentorId);
      if (!preferences?.email?.dispute || !preferences?.inApp?.dispute) {
        console.log(`Dispute notifications disabled for mentor ${data.mentorId}`);
        return;
      }

      const reasonText = this.getReasonText(data.reason);
      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();

      await notificationService.createMultiTypeNotification(
        data.mentorId,
        'dispute',
        'New Dispute Filed',
        `${mentee.firstName} ${mentee.lastName} has filed a dispute for your session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}). Reason: ${reasonText}. Please respond within 48 hours.`,
        {
          disputeId: data.disputeId,
          menteeId: data.menteeId,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          bookingId: data.bookingId,
          bookingTitle: (booking.serviceId as any)?.title || 'Session',
          sessionDate,
          reason: data.reason,
          reasonText,
          description: data.description,
          status: data.status,
          amount: booking.amount,
          responseDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
          timestamp: new Date()
        },
        'urgent'
      );
    } catch (error) {
      console.error('Error sending new dispute notification:', error);
      throw error;
    }
  }

  // Send dispute notification to mentee when mentor responds
  async sendMentorResponseNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      // Check if mentee has dispute notifications enabled
      const preferences = await notificationService.getUserPreferences(data.menteeId);
      if (!preferences?.email?.dispute || !preferences?.inApp?.dispute) {
        console.log(`Dispute notifications disabled for mentee ${data.menteeId}`);
        return;
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();
      const responsePreview = data.mentorResponse 
        ? data.mentorResponse.substring(0, 100) + (data.mentorResponse.length > 100 ? '...' : '')
        : 'No message provided';

      await notificationService.createMultiTypeNotification(
        data.menteeId,
        'dispute',
        'Mentor Responded to Dispute',
        `${mentor.firstName} ${mentor.lastName} has responded to your dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}). Response: "${responsePreview}"`,
        {
          disputeId: data.disputeId,
          mentorId: data.mentorId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          bookingId: data.bookingId,
          bookingTitle: (booking.serviceId as any)?.title || 'Session',
          sessionDate,
          mentorResponse: data.mentorResponse,
          responsePreview,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      console.error('Error sending mentor response notification:', error);
      throw error;
    }
  }

  // Send dispute resolution notification to both parties
  async sendDisputeResolutionNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();
      const decisionText = this.getDecisionText(data.decision || 'dismissed');
      const refundText = data.refundAmount ? `Refund: $${data.refundAmount.toFixed(2)}` : 'No refund';

      // Notify mentee
      const menteePreferences = await notificationService.getUserPreferences(data.menteeId);
      if (menteePreferences?.email?.dispute || menteePreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.menteeId,
          'dispute',
          'Dispute Resolved',
          `Your dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been resolved. Decision: ${decisionText}. ${refundText}.`,
          {
            disputeId: data.disputeId,
            mentorId: data.mentorId,
            mentorName: `${mentor.firstName} ${mentor.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            decision: data.decision,
            decisionText,
            refundAmount: data.refundAmount,
            refundText,
            adminReason: data.adminReason,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'high'
        );
      }

      // Notify mentor
      const mentorPreferences = await notificationService.getUserPreferences(data.mentorId);
      if (mentorPreferences?.email?.dispute || mentorPreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.mentorId,
          'dispute',
          'Dispute Resolved',
          `The dispute for your session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been resolved. Decision: ${decisionText}. ${refundText}.`,
          {
            disputeId: data.disputeId,
            menteeId: data.menteeId,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            decision: data.decision,
            decisionText,
            refundAmount: data.refundAmount,
            refundText,
            adminReason: data.adminReason,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'high'
        );
      }
    } catch (error) {
      console.error('Error sending dispute resolution notification:', error);
      throw error;
    }
  }

  // Send dispute dismissed notification
  async sendDisputeDismissedNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();

      // Notify mentee
      const menteePreferences = await notificationService.getUserPreferences(data.menteeId);
      if (menteePreferences?.email?.dispute || menteePreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.menteeId,
          'dispute',
          'Dispute Dismissed',
          `Your dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been dismissed. Reason: ${data.adminReason || 'No reason provided'}.`,
          {
            disputeId: data.disputeId,
            mentorId: data.mentorId,
            mentorName: `${mentor.firstName} ${mentor.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            decision: 'dismissed',
            adminReason: data.adminReason,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'medium'
        );
      }

      // Notify mentor
      const mentorPreferences = await notificationService.getUserPreferences(data.mentorId);
      if (mentorPreferences?.email?.dispute || mentorPreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.mentorId,
          'dispute',
          'Dispute Dismissed',
          `The dispute for your session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been dismissed. The dispute was found to be invalid.`,
          {
            disputeId: data.disputeId,
            menteeId: data.menteeId,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            decision: 'dismissed',
            adminReason: data.adminReason,
            status: data.status,
            amount: booking.amount,
            timestamp: new Date()
          },
          'medium'
        );
      }
    } catch (error) {
      console.error('Error sending dispute dismissed notification:', error);
      throw error;
    }
  }

  // Send dispute escalation notification (when mentor doesn't respond in time)
  async sendDisputeEscalationNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();

      // Notify mentee
      const menteePreferences = await notificationService.getUserPreferences(data.menteeId);
      if (menteePreferences?.email?.dispute || menteePreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.menteeId,
          'dispute',
          'Dispute Escalated to Admin ⚡',
          `Your dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been escalated to admin review. The mentor did not respond within 48 hours.`,
          {
            disputeId: data.disputeId,
            mentorId: data.mentorId,
            mentorName: `${mentor.firstName} ${mentor.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            status: 'admin_review',
            amount: booking.amount,
            timestamp: new Date()
          },
          'high'
        );
      }

      // Notify mentor
      const mentorPreferences = await notificationService.getUserPreferences(data.mentorId);
      if (mentorPreferences?.email?.dispute || mentorPreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.mentorId,
          'dispute',
          'Dispute Escalated to Admin ⚡',
          `Your dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}) has been escalated to admin review due to no response.`,
          {
            disputeId: data.disputeId,
            menteeId: data.menteeId,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            status: 'admin_review',
            amount: booking.amount,
            timestamp: new Date()
          },
          'high'
        );
      }
    } catch (error) {
      console.error('Error sending dispute escalation notification:', error);
      throw error;
    }
  }

  // Send dispute reminder notification (24 hours before escalation)
  async sendDisputeReminderNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();

      // Notify mentor (reminder to respond)
      const mentorPreferences = await notificationService.getUserPreferences(data.mentorId);
      if (mentorPreferences?.email?.dispute || mentorPreferences?.inApp?.dispute) {
        await notificationService.createMultiTypeNotification(
          data.mentorId,
          'dispute',
          'Dispute Response Reminder',
          `Reminder: You have 24 hours to respond to the dispute for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}). Please respond to avoid escalation to admin review.`,
          {
            disputeId: data.disputeId,
            menteeId: data.menteeId,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            bookingId: data.bookingId,
            bookingTitle: (booking.serviceId as any)?.title || 'Session',
            sessionDate,
            status: data.status,
            amount: booking.amount,
            responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            timestamp: new Date()
          },
          'high'
        );
      }
    } catch (error) {
      console.error('Error sending dispute reminder notification:', error);
      throw error;
    }
  }

  // Send admin notification for new dispute
  async sendAdminDisputeNotification(data: DisputeNotificationData): Promise<void> {
    try {
      const mentee = await User.findById(data.menteeId).select('firstName lastName email');
      const mentor = await User.findById(data.mentorId).select('firstName lastName email');
      const booking = await Booking.findById(data.bookingId).populate('serviceId', 'title').select('serviceId amount scheduledAt');
      
      if (!mentee || !mentor || !booking) {
        throw new Error('Required data not found for dispute notification');
      }

      const sessionDate = new Date(booking.scheduledAt).toLocaleDateString();
      const reasonText = this.getReasonText(data.reason);

      // Send to all admins (you might want to get admin users from database)
      // For now, we'll create a system notification
      await notificationService.createMultiTypeNotification(
        'admin', // This could be a special admin user ID or handled differently
        'dispute',
        'New Dispute Requires Review',
        `New dispute filed by ${mentee.firstName} ${mentee.lastName} against ${mentor.firstName} ${mentor.lastName} for session "${(booking.serviceId as any)?.title || 'Session'}" (${sessionDate}). Reason: ${reasonText}.`,
        {
          disputeId: data.disputeId,
          menteeId: data.menteeId,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          mentorId: data.mentorId,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          bookingId: data.bookingId,
          bookingTitle: (booking.serviceId as any)?.title || 'Session',
          sessionDate,
          reason: data.reason,
          reasonText,
          description: data.description,
          status: data.status,
          amount: booking.amount,
          timestamp: new Date()
        },
        'urgent'
      );
    } catch (error) {
      console.error('Error sending admin dispute notification:', error);
      throw error;
    }
  }

  // Helper method to get human-readable reason text
  private getReasonText(reason: string): string {
    const reasonMap: { [key: string]: string } = {
      'session_not_conducted': 'Session not conducted',
      'poor_quality': 'Poor quality session',
      'inappropriate_behavior': 'Inappropriate behavior',
      'technical_issues': 'Technical issues',
      'misleading_description': 'Misleading description',
      'other': 'Other'
    };
    return reasonMap[reason] || reason;
  }

  // Helper method to get human-readable decision text
  private getDecisionText(decision: string): string {
    const decisionMap: { [key: string]: string } = {
      'refund_full': 'Full refund approved',
      'refund_partial': 'Partial refund approved',
      'no_refund': 'No refund - dispute not valid',
      'dismissed': 'Dispute dismissed'
    };
    return decisionMap[decision] || decision;
  }
}

export const disputeNotificationService = new DisputeNotificationService();
