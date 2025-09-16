import crypto from 'crypto';
import { EmailPreferences, IEmailPreferences } from '../models/EmailPreferences';
import { User } from '../models/User';

export interface EmailPreferencesData {
  userId: string;
  email: string;
  categories?: Partial<IEmailPreferences['categories']>;
  frequency?: IEmailPreferences['frequency'];
}

export interface UnsubscribeData {
  token: string;
  email?: string;
  category?: string;
}

export class EmailPreferencesService {
  // Generate a secure unsubscribe token
  private static generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create email preferences for a user
  static async createEmailPreferences(data: EmailPreferencesData): Promise<IEmailPreferences> {
    try {
      const unsubscribeToken = this.generateUnsubscribeToken();
      
      const preferences = new EmailPreferences({
        userId: data.userId,
        email: data.email,
        unsubscribeToken,
        categories: data.categories || {
          booking: true,
          reschedule: true,
          chat: true,
          payout: true,
          dispute: true,
          system: true,
          verification: true,
          marketing: false
        },
        frequency: data.frequency || 'immediate'
      });

      await preferences.save();
      return preferences;
    } catch (error) {
      console.error('Error creating email preferences:', error);
      throw error;
    }
  }

  // Get email preferences for a user
  static async getEmailPreferences(userId: string): Promise<IEmailPreferences | null> {
    try {
      return await EmailPreferences.findOne({ userId });
    } catch (error) {
      console.error('Error getting email preferences:', error);
      return null;
    }
  }

  // Get email preferences by email
  static async getEmailPreferencesByEmail(email: string): Promise<IEmailPreferences | null> {
    try {
      return await EmailPreferences.findOne({ email });
    } catch (error) {
      console.error('Error getting email preferences by email:', error);
      return null;
    }
  }

  // Get email preferences by unsubscribe token
  static async getEmailPreferencesByToken(token: string): Promise<IEmailPreferences | null> {
    try {
      return await EmailPreferences.findOne({ unsubscribeToken: token });
    } catch (error) {
      console.error('Error getting email preferences by token:', error);
      return null;
    }
  }

  // Get unsubscribe token for a user
  static async getUnsubscribeToken(userId: string): Promise<string | null> {
    try {
      const preferences = await EmailPreferences.findOne({ userId });
      return preferences?.unsubscribeToken || null;
    } catch (error) {
      console.error('Error getting unsubscribe token:', error);
      return null;
    }
  }

  // Update email preferences
  static async updateEmailPreferences(
    userId: string, 
    updates: Partial<IEmailPreferences>
  ): Promise<IEmailPreferences | null> {
    try {
      return await EmailPreferences.findOneAndUpdate(
        { userId },
        updates,
        { new: true }
      );
    } catch (error) {
      console.error('Error updating email preferences:', error);
      return null;
    }
  }

  // Check if user should receive email for a specific category
  static async shouldSendEmail(
    userId: string,
    category: keyof IEmailPreferences['categories']
  ): Promise<boolean> {
    try {
      const preferences = await this.getEmailPreferences(userId);
      if (!preferences) {
        return true; // Default to allowing emails if no preferences exist
      }

      // Check if user is unsubscribed
      if (preferences.isUnsubscribed) {
        return false;
      }

      // Check if user is active
      if (!preferences.isActive) {
        return false;
      }

      // Check if category is enabled
      return preferences.categories[category] || false;
    } catch (error) {
      console.error('Error checking email preferences:', error);
      return true; // Default to allowing emails on error
    }
  }

  // Check if email should be sent based on frequency
  static async shouldSendBasedOnFrequency(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getEmailPreferences(userId);
      if (!preferences) {
        return true; // Default to allowing emails
      }

      if (preferences.frequency === 'never') {
        return false;
      }

      if (preferences.frequency === 'immediate') {
        return true;
      }

      if (preferences.frequency === 'daily') {
        const lastEmail = preferences.lastEmailSent;
        if (!lastEmail) {
          return true;
        }
        const now = new Date();
        const hoursSinceLastEmail = (now.getTime() - lastEmail.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastEmail >= 24;
      }

      if (preferences.frequency === 'weekly') {
        const lastEmail = preferences.lastEmailSent;
        if (!lastEmail) {
          return true;
        }
        const now = new Date();
        const daysSinceLastEmail = (now.getTime() - lastEmail.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastEmail >= 7;
      }

      return true;
    } catch (error) {
      console.error('Error checking email frequency:', error);
      return true;
    }
  }

  // Unsubscribe user from all emails
  static async unsubscribeAll(token: string): Promise<boolean> {
    try {
      const preferences = await this.getEmailPreferencesByToken(token);
      if (!preferences) {
        return false;
      }

      preferences.isUnsubscribed = true;
      preferences.unsubscribeDate = new Date();
      await preferences.save();

      return true;
    } catch (error) {
      console.error('Error unsubscribing user:', error);
      return false;
    }
  }

  // Unsubscribe user from specific category
  static async unsubscribeCategory(token: string, category: keyof IEmailPreferences['categories']): Promise<boolean> {
    try {
      const preferences = await this.getEmailPreferencesByToken(token);
      if (!preferences) {
        return false;
      }

      preferences.categories[category] = false;
      await preferences.save();

      return true;
    } catch (error) {
      console.error('Error unsubscribing from category:', error);
      return false;
    }
  }

  // Resubscribe user
  static async resubscribe(token: string): Promise<boolean> {
    try {
      const preferences = await this.getEmailPreferencesByToken(token);
      if (!preferences) {
        return false;
      }

      preferences.isUnsubscribed = false;
      preferences.unsubscribeDate = undefined;
      await preferences.save();

      return true;
    } catch (error) {
      console.error('Error resubscribing user:', error);
      return false;
    }
  }

  // Update email count and last sent date
  static async recordEmailSent(userId: string): Promise<void> {
    try {
      await EmailPreferences.findOneAndUpdate(
        { userId },
        {
          $inc: { emailCount: 1 },
          $set: { lastEmailSent: new Date() }
        }
      );
    } catch (error) {
      console.error('Error recording email sent:', error);
    }
  }

  // Record email bounce
  static async recordEmailBounce(email: string): Promise<void> {
    try {
      await EmailPreferences.findOneAndUpdate(
        { email },
        { $inc: { bounceCount: 1 } }
      );
    } catch (error) {
      console.error('Error recording email bounce:', error);
    }
  }

  // Record email complaint
  static async recordEmailComplaint(email: string): Promise<void> {
    try {
      await EmailPreferences.findOneAndUpdate(
        { email },
        { $inc: { complaintCount: 1 } }
      );
    } catch (error) {
      console.error('Error recording email complaint:', error);
    }
  }

  // Deactivate user due to high bounce/complaint rate
  static async deactivateUser(email: string): Promise<void> {
    try {
      await EmailPreferences.findOneAndUpdate(
        { email },
        { isActive: false }
      );
    } catch (error) {
      console.error('Error deactivating user:', error);
    }
  }

  // Get unsubscribe URL
  static getUnsubscribeUrl(token: string, category?: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = new URL('/unsubscribe', baseUrl);
    url.searchParams.set('token', token);
    if (category) {
      url.searchParams.set('category', category);
    }
    return url.toString();
  }

  // Get resubscribe URL
  static getResubscribeUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = new URL('/resubscribe', baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  // Get email preferences management URL
  static getEmailPreferencesUrl(userId: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/settings/email-preferences?userId=${userId}`;
  }

  // Create or update email preferences for a user
  static async ensureEmailPreferences(userId: string, email: string): Promise<IEmailPreferences> {
    try {
      let preferences = await this.getEmailPreferences(userId);
      
      if (!preferences) {
        preferences = await this.createEmailPreferences({ userId, email });
      } else if (preferences.email !== email) {
        // Update email if it has changed
        preferences.email = email;
        await preferences.save();
      }

      return preferences;
    } catch (error) {
      console.error('Error ensuring email preferences:', error);
      throw error;
    }
  }

  // Get users who should receive emails for a specific category
  static async getUsersForCategory(category: keyof IEmailPreferences['categories']): Promise<string[]> {
    try {
      const preferences = await EmailPreferences.find({
        isUnsubscribed: false,
        isActive: true,
        [`categories.${category}`]: true
      }).select('userId');

      return preferences.map(p => p.userId.toString());
    } catch (error) {
      console.error('Error getting users for category:', error);
      return [];
    }
  }

  // Get email statistics
  static async getEmailStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    unsubscribedUsers: number;
    totalEmailsSent: number;
    totalBounces: number;
    totalComplaints: number;
  }> {
    try {
      const [totalUsers, activeUsers, unsubscribedUsers, emailStats] = await Promise.all([
        EmailPreferences.countDocuments(),
        EmailPreferences.countDocuments({ isActive: true, isUnsubscribed: false }),
        EmailPreferences.countDocuments({ isUnsubscribed: true }),
        EmailPreferences.aggregate([
          {
            $group: {
              _id: null,
              totalEmailsSent: { $sum: '$emailCount' },
              totalBounces: { $sum: '$bounceCount' },
              totalComplaints: { $sum: '$complaintCount' }
            }
          }
        ])
      ]);

      return {
        totalUsers,
        activeUsers,
        unsubscribedUsers,
        totalEmailsSent: emailStats[0]?.totalEmailsSent || 0,
        totalBounces: emailStats[0]?.totalBounces || 0,
        totalComplaints: emailStats[0]?.totalComplaints || 0
      };
    } catch (error) {
      console.error('Error getting email statistics:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        unsubscribedUsers: 0,
        totalEmailsSent: 0,
        totalBounces: 0,
        totalComplaints: 0
      };
    }
  }
}
