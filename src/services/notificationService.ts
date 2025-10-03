import { Notification, INotification } from '../models/Notification';
import { NotificationPreferences, INotificationPreferences } from '../models/NotificationPreferences';
import { User } from '../models/User';
import emailService from './emailService';
import { NotificationPreferencesService } from './notificationPreferencesService';
import mongoose from 'mongoose';

export interface CreateNotificationData {
  userId: string;
  type: 'email' | 'push' | 'in_app';
  category: 'booking' | 'reschedule' | 'chat' | 'payout' | 'dispute' | 'system' | 'verification';
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: Date;
  sendImmediately?: boolean; // New option to send immediately
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}

class NotificationService {
  // Create a new notification
  async createNotification(data: CreateNotificationData): Promise<INotification> {
    const notification = new Notification({
      userId: data.userId,
      type: data.type,
      category: data.category,
      title: data.title,
      message: data.message,
      data: data.data || {},
      priority: data.priority || 'medium',
      scheduledFor: data.scheduledFor
    });

    await notification.save();

    // If sendImmediately is true, send the notification right away
    if (data.sendImmediately) {
      await this.sendNotification(notification);
    }

    return notification;
  }

  // Create multiple notifications for different types
  async createMultiTypeNotification(
    userId: string,
    category: CreateNotificationData['category'],
    title: string,
    message: string,
    data?: any,
    priority: CreateNotificationData['priority'] = 'medium',
    scheduledFor?: Date
  ): Promise<INotification[]> {
    const notifications: INotification[] = [];
    
    // Check if it's quiet hours (skip non-urgent notifications)
    const isQuietHours = await NotificationPreferencesService.isQuietHours(userId);
    if (isQuietHours && priority !== 'urgent') {
      return notifications;
    }
    
    // Check user preferences for each channel
    const [emailEnabled, pushEnabled, inAppEnabled] = await Promise.all([
      NotificationPreferencesService.shouldSendNotification(userId, 'email', category),
      NotificationPreferencesService.shouldSendNotification(userId, 'push', category),
      NotificationPreferencesService.shouldSendNotification(userId, 'inApp', category)
    ]);
    
    // Create email notification if enabled
    if (emailEnabled) {
      const emailNotification = await this.createNotification({
        userId,
        type: 'email',
        category,
        title,
        message,
        data,
        priority,
        scheduledFor
      });
      notifications.push(emailNotification);
    }

    // Create push notification if enabled (skip verification for push)
    if (pushEnabled && category !== 'verification') {
      const pushNotification = await this.createNotification({
        userId,
        type: 'push',
        category,
        title,
        message,
        data,
        priority,
        scheduledFor
      });
      notifications.push(pushNotification);
    }

    // Create in-app notification if enabled (skip verification for in-app)
    if (inAppEnabled && category !== 'verification') {
      const inAppNotification = await this.createNotification({
        userId,
        type: 'in_app',
        category,
        title,
        message,
        data,
        priority,
        scheduledFor
      });
      notifications.push(inAppNotification);
    }

    return notifications;
  }

  // Get user notification preferences
  async getUserPreferences(userId: string): Promise<INotificationPreferences | null> {
    return await NotificationPreferencesService.getUserPreferences(userId);
  }

  // Update user notification preferences
  async updateUserPreferences(userId: string, preferences: Partial<INotificationPreferences>): Promise<INotificationPreferences> {
    const updatedPreferences = await NotificationPreferences.findOneAndUpdate(
      { userId },
      { $set: preferences },
      { new: true, upsert: true }
    );
    
    return updatedPreferences!;
  }

  // Get user notifications
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    category?: string,
    isRead?: boolean
  ): Promise<{ notifications: INotification[]; total: number; pages: number }> {
    const query: any = { userId };
    
    if (category) {
      query.category = category;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead;
    }

    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      notifications: notifications as unknown as INotification[],
      total,
      pages: Math.ceil(total / limit)
    };
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.updateOne(
      { _id: notificationId, userId },
      { 
        isRead: true,
        readAt: new Date()
      }
    );
    
    return result.modifiedCount > 0;
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { 
        isRead: true,
        readAt: new Date()
      }
    );
    
    return result.modifiedCount;
  }

  // Get notification statistics
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const [total, unread, byCategory, byType] = await Promise.all([
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
      Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]),
      Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $project: { type: '$_id', count: 1, _id: 0 } }
      ])
    ]);

    const categoryStats: Record<string, number> = {};
    byCategory.forEach((item: any) => {
      categoryStats[item.category] = item.count;
    });

    const typeStats: Record<string, number> = {};
    byType.forEach((item: any) => {
      typeStats[item.type] = item.count;
    });

    return {
      total,
      unread,
      byCategory: categoryStats,
      byType: typeStats
    };
  }

  // Process pending notifications
  async processPendingNotifications(): Promise<void> {
    const now = new Date();
    
    // Get pending notifications that are ready to be sent
    const pendingNotifications = await Notification.find({
      status: 'pending',
      $or: [
        { scheduledFor: { $lte: now } },
        { scheduledFor: { $exists: false } }
      ]
    }).populate('userId', 'email firstName lastName');

    for (const notification of pendingNotifications) {
      try {
        await this.sendNotification(notification);
      } catch (error) {
        await this.handleNotificationError(notification, error);
      }
    }
  }

  // Send a notification immediately
  async sendNotificationImmediately(notification: INotification): Promise<void> {
    await this.sendNotification(notification);
  }

  // Send a notification
  private async sendNotification(notification: INotification): Promise<void> {
    const user = notification.userId as any;
    
    if (notification.type === 'email') {
      await this.sendEmailNotification(notification, user);
    } else if (notification.type === 'push') {
      await this.sendPushNotification(notification, user);
    } else if (notification.type === 'in_app') {
      // In-app notifications are already "sent" when created
      await this.markNotificationAsSent(notification);
    }
  }

  // Send email notification
  private async sendEmailNotification(notification: INotification, user: any): Promise<void> {
    try {
      let emailSent = false;
      
      // Send appropriate email based on category
      switch (notification.category) {
        case 'booking':
          emailSent = await emailService.sendBookingNotification(
            {
              name: user.firstName,
              email: user.email,
              mentorName: notification.data?.mentorName || 'Mentor',
              sessionDate: notification.data?.bookingDate ? new Date(notification.data.bookingDate).toLocaleDateString() : new Date().toLocaleDateString(),
              sessionTime: notification.data?.bookingDate ? new Date(notification.data.bookingDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
              sessionType: notification.data?.serviceTitle || 'Service',
              meetingLink: notification.data?.meetingLink || '#'
            },
            'confirmation'
          );
          break;
        case 'payout':
          emailSent = await emailService.sendPayoutNotification({
            name: user.firstName,
            email: user.email,
            amount: notification.data?.amount || 0,
            status: notification.data?.status || 'pending',
            payoutDate: notification.data?.payoutDate ? new Date(notification.data.payoutDate).toLocaleDateString() : new Date().toLocaleDateString()
          });
          break;
        case 'dispute':
          emailSent = await emailService.sendDisputeNotification({
            name: user.firstName,
            email: user.email,
            disputeId: notification.data?.disputeId || 'Unknown',
            reason: notification.data?.reason || 'Dispute',
            status: notification.data?.status || 'pending'
          });
          break;
        case 'verification':
          emailSent = await emailService.sendVerificationEmail({
            name: user.firstName,
            email: user.email,
            verificationLink: notification.data?.verificationLink || '#'
          });
          break;
        default:
          // Generic email for other categories
          emailSent = await emailService.sendGenericEmail(
            user.email,
            notification.title,
            notification.message
          );
      }

      if (emailSent) {
        await this.markNotificationAsSent(notification);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      throw new Error(`Email sending failed: ${error}`);
    }
  }

  // Send push notification (placeholder for future implementation)
  private async sendPushNotification(notification: INotification, user: any): Promise<void> {
    // TODO: Implement push notification service (Firebase, OneSignal, etc.)
    await this.markNotificationAsSent(notification);
  }

  // Mark notification as sent
  private async markNotificationAsSent(notification: INotification): Promise<void> {
    await Notification.updateOne(
      { _id: notification._id },
      {
        status: 'sent',
        isSent: true,
        sentAt: new Date()
      }
    );
  }

  // Handle notification error
  private async handleNotificationError(notification: INotification, error: any): Promise<void> {
    const retryCount = notification.retryCount + 1;
    const maxRetries = notification.maxRetries;
    
    if (retryCount >= maxRetries) {
      // Mark as failed after max retries
      await Notification.updateOne(
        { _id: notification._id },
        {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          retryCount
        }
      );
    } else {
      // Schedule for retry
      const retryDelay = Math.pow(2, retryCount) * 60000; // Exponential backoff in minutes
      const retryAt = new Date(Date.now() + retryDelay);
      
      await Notification.updateOne(
        { _id: notification._id },
        {
          retryCount,
          scheduledFor: retryAt,
          errorMessage: error.message || 'Unknown error'
        }
      );
    }
  }

  // Delete old notifications
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['sent', 'failed'] }
    });
    
    return result.deletedCount;
  }
}

export const notificationService = new NotificationService();
