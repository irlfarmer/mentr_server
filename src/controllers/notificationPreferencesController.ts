import { Request, Response } from 'express';
import { NotificationPreferences } from '../models/NotificationPreferences';
import { User } from '../models/User';

export class NotificationPreferencesController {
  // Get user's notification preferences
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      let preferences = await NotificationPreferences.findOne({ userId });
      
      // Create default preferences if none exist
      if (!preferences) {
        preferences = new NotificationPreferences({
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
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification preferences'
      });
    }
  }

  // Update user's notification preferences
  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const {
        email,
        push,
        inApp,
        quietHours,
        frequency
      } = req.body;

      // Validate the request body
      if (!email && !push && !inApp && !quietHours && !frequency) {
        res.status(400).json({
          success: false,
          error: 'At least one preference category must be provided'
        });
        return;
      }

      // Find existing preferences or create new ones
      let preferences = await NotificationPreferences.findOne({ userId });
      if (!preferences) {
        preferences = new NotificationPreferences({ userId });
      }

      // Update email preferences
      if (email) {
        if (typeof email.enabled === 'boolean') {
          preferences.email.enabled = email.enabled;
        }
        if (typeof email.booking === 'boolean') {
          preferences.email.booking = email.booking;
        }
        if (typeof email.reschedule === 'boolean') {
          preferences.email.reschedule = email.reschedule;
        }
        if (typeof email.chat === 'boolean') {
          preferences.email.chat = email.chat;
        }
        if (typeof email.payout === 'boolean') {
          preferences.email.payout = email.payout;
        }
        if (typeof email.dispute === 'boolean') {
          preferences.email.dispute = email.dispute;
        }
        if (typeof email.system === 'boolean') {
          preferences.email.system = email.system;
        }
        if (typeof email.verification === 'boolean') {
          preferences.email.verification = email.verification;
        }
      }

      // Update push preferences
      if (push) {
        if (typeof push.enabled === 'boolean') {
          preferences.push.enabled = push.enabled;
        }
        if (typeof push.booking === 'boolean') {
          preferences.push.booking = push.booking;
        }
        if (typeof push.reschedule === 'boolean') {
          preferences.push.reschedule = push.reschedule;
        }
        if (typeof push.chat === 'boolean') {
          preferences.push.chat = push.chat;
        }
        if (typeof push.payout === 'boolean') {
          preferences.push.payout = push.payout;
        }
        if (typeof push.dispute === 'boolean') {
          preferences.push.dispute = push.dispute;
        }
        if (typeof push.system === 'boolean') {
          preferences.push.system = push.system;
        }
      }

      // Update in-app preferences
      if (inApp) {
        if (typeof inApp.enabled === 'boolean') {
          preferences.inApp.enabled = inApp.enabled;
        }
        if (typeof inApp.booking === 'boolean') {
          preferences.inApp.booking = inApp.booking;
        }
        if (typeof inApp.reschedule === 'boolean') {
          preferences.inApp.reschedule = inApp.reschedule;
        }
        if (typeof inApp.chat === 'boolean') {
          preferences.inApp.chat = inApp.chat;
        }
        if (typeof inApp.payout === 'boolean') {
          preferences.inApp.payout = inApp.payout;
        }
        if (typeof inApp.dispute === 'boolean') {
          preferences.inApp.dispute = inApp.dispute;
        }
        if (typeof inApp.system === 'boolean') {
          preferences.inApp.system = inApp.system;
        }
      }

      // Update quiet hours
      if (quietHours) {
        if (typeof quietHours.enabled === 'boolean') {
          preferences.quietHours.enabled = quietHours.enabled;
        }
        if (quietHours.start && typeof quietHours.start === 'string') {
          // Validate time format (HH:MM)
          if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.start)) {
            preferences.quietHours.start = quietHours.start;
          } else {
            res.status(400).json({
              success: false,
              error: 'Invalid quiet hours start time format. Use HH:MM format.'
            });
            return;
          }
        }
        if (quietHours.end && typeof quietHours.end === 'string') {
          // Validate time format (HH:MM)
          if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.end)) {
            preferences.quietHours.end = quietHours.end;
          } else {
            res.status(400).json({
              success: false,
              error: 'Invalid quiet hours end time format. Use HH:MM format.'
            });
            return;
          }
        }
        if (quietHours.timezone && typeof quietHours.timezone === 'string') {
          preferences.quietHours.timezone = quietHours.timezone;
        }
      }

      // Update frequency preferences
      if (frequency) {
        if (typeof frequency.immediate === 'boolean') {
          preferences.frequency.immediate = frequency.immediate;
        }
        if (typeof frequency.daily === 'boolean') {
          preferences.frequency.daily = frequency.daily;
        }
        if (typeof frequency.weekly === 'boolean') {
          preferences.frequency.weekly = frequency.weekly;
        }
      }

      await preferences.save();

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification preferences'
      });
    }
  }

  // Reset preferences to defaults
  static async resetPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Delete existing preferences
      await NotificationPreferences.findOneAndDelete({ userId });

      // Create new default preferences
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

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences reset to defaults'
      });
    } catch (error) {
      console.error('Error resetting notification preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset notification preferences'
      });
    }
  }

  // Get notification preferences for a specific user (admin only)
  static async getPreferencesForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      // Check if user is admin
      const admin = await User.findById(adminId);
      if (!admin || admin.userType !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const preferences = await NotificationPreferences.findOne({ userId });
      if (!preferences) {
        res.status(404).json({
          success: false,
          error: 'Notification preferences not found for this user'
        });
        return;
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user notification preferences'
      });
    }
  }

  // Update notification preferences for a specific user (admin only)
  static async updatePreferencesForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      // Check if user is admin
      const admin = await User.findById(adminId);
      if (!admin || admin.userType !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      // Check if target user exists
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Use the same update logic as regular update
      const updateData = req.body;
      const preferences = await NotificationPreferences.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, upsert: true }
      );

      res.json({
        success: true,
        data: preferences,
        message: 'User notification preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating user notification preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user notification preferences'
      });
    }
  }
}
