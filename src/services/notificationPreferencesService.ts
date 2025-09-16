import { NotificationPreferences } from '../models/NotificationPreferences';
import { INotificationPreferences } from '../models/NotificationPreferences';

export class NotificationPreferencesService {
  // Get user's notification preferences
  static async getUserPreferences(userId: string): Promise<INotificationPreferences | null> {
    try {
      return await NotificationPreferences.findOne({ userId });
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return null;
    }
  }

  // Check if user should receive a specific type of notification
  static async shouldSendNotification(
    userId: string,
    channel: 'email' | 'push' | 'inApp',
    type: 'booking' | 'reschedule' | 'chat' | 'payout' | 'dispute' | 'system' | 'verification'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) {
        // If no preferences exist, allow all notifications (default behavior)
        return true;
      }

      // Check if the channel is enabled
      if (!preferences[channel].enabled) {
        return false;
      }

      // Check if the specific notification type is enabled
      if (type === 'verification' && channel === 'email') {
        return preferences.email.verification;
      }

      if (type === 'verification' && channel !== 'email') {
        // Verification notifications are only sent via email
        return false;
      }

      // For other types, check the channel-specific setting
      if (channel === 'email') {
        return preferences.email[type as keyof typeof preferences.email] || false;
      } else if (channel === 'push') {
        return preferences.push[type as keyof typeof preferences.push] || false;
      } else if (channel === 'inApp') {
        return preferences.inApp[type as keyof typeof preferences.inApp] || false;
      }

      return false;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to allowing notifications if there's an error
      return true;
    }
  }

  // Check if it's currently quiet hours for the user
  static async isQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences || !preferences.quietHours.enabled) {
        return false;
      }

      const now = new Date();
      const userTimezone = preferences.quietHours.timezone || 'UTC';
      
      // Convert current time to user's timezone
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const currentTime = userTime.getHours() * 60 + userTime.getMinutes(); // Convert to minutes

      // Parse quiet hours
      const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      // Handle quiet hours that cross midnight
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
      } else {
        return currentTime >= startTime && currentTime < endTime;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  // Check if notification should be sent based on frequency preferences
  static async shouldSendBasedOnFrequency(
    userId: string,
    type: 'immediate' | 'daily' | 'weekly'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) {
        return true; // Default to allowing if no preferences
      }

      return preferences.frequency[type] || false;
    } catch (error) {
      console.error('Error checking frequency preferences:', error);
      return true;
    }
  }

  // Get comprehensive notification settings for a user
  static async getNotificationSettings(userId: string): Promise<{
    canReceive: boolean;
    channels: {
      email: boolean;
      push: boolean;
      inApp: boolean;
    };
    quietHours: {
      enabled: boolean;
      isActive: boolean;
    };
    frequency: {
      immediate: boolean;
      daily: boolean;
      weekly: boolean;
    };
  }> {
    try {
      const preferences = await this.getUserPreferences(userId);
      const isQuiet = await this.isQuietHours(userId);

      if (!preferences) {
        return {
          canReceive: true,
          channels: {
            email: true,
            push: true,
            inApp: true
          },
          quietHours: {
            enabled: false,
            isActive: false
          },
          frequency: {
            immediate: true,
            daily: false,
            weekly: false
          }
        };
      }

      return {
        canReceive: !isQuiet,
        channels: {
          email: preferences.email.enabled,
          push: preferences.push.enabled,
          inApp: preferences.inApp.enabled
        },
        quietHours: {
          enabled: preferences.quietHours.enabled,
          isActive: isQuiet
        },
        frequency: {
          immediate: preferences.frequency.immediate,
          daily: preferences.frequency.daily,
          weekly: preferences.frequency.weekly
        }
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return {
        canReceive: true,
        channels: {
          email: true,
          push: true,
          inApp: true
        },
        quietHours: {
          enabled: false,
          isActive: false
        },
        frequency: {
          immediate: true,
          daily: false,
          weekly: false
        }
      };
    }
  }

  // Create default preferences for a new user
  static async createDefaultPreferences(userId: string): Promise<INotificationPreferences> {
    try {
      const preferences = new NotificationPreferences({
        userId,
        email: {
          enabled: true,
          booking: true,
          reschedule: true,
          chat: true,
          payout: true,
          dispute: true,
          system: true,
          verification: true
        },
        push: {
          enabled: true,
          booking: true,
          reschedule: true,
          chat: true,
          payout: true,
          dispute: true,
          system: true
        },
        inApp: {
          enabled: true,
          booking: true,
          reschedule: true,
          chat: true,
          payout: true,
          dispute: true,
          system: true
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        },
        frequency: {
          immediate: true,
          daily: false,
          weekly: false
        }
      });

      await preferences.save();
      return preferences;
    } catch (error) {
      console.error('Error creating default preferences:', error);
      throw error;
    }
  }

  // Update user's timezone in quiet hours
  static async updateUserTimezone(userId: string, timezone: string): Promise<void> {
    try {
      await NotificationPreferences.findOneAndUpdate(
        { userId },
        { 'quietHours.timezone': timezone },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating user timezone:', error);
      throw error;
    }
  }

  // Get all users who have specific notification preferences
  static async getUsersWithPreferences(
    channel: 'email' | 'push' | 'inApp',
    type: 'booking' | 'reschedule' | 'chat' | 'payout' | 'dispute' | 'system' | 'verification'
  ): Promise<string[]> {
    try {
      const query: any = {};
      query[`${channel}.enabled`] = true;
      query[`${channel}.${type}`] = true;

      const preferences = await NotificationPreferences.find(query).select('userId');
      return preferences.map(p => p.userId.toString());
    } catch (error) {
      console.error('Error getting users with preferences:', error);
      return [];
    }
  }

  // Bulk update preferences for multiple users (admin function)
  static async bulkUpdatePreferences(
    userIds: string[],
    updates: Partial<INotificationPreferences>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await NotificationPreferences.findOneAndUpdate(
          { userId },
          updates,
          { upsert: true }
        );
        success++;
      } catch (error) {
        console.error(`Error updating preferences for user ${userId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}
