import { Resend } from 'resend';
import { EmailPreferencesService } from './emailPreferencesService';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface VerificationEmailData {
  name: string;
  email: string;
  verificationLink: string;
}

export interface PasswordResetEmailData {
  name: string;
  email: string;
  resetLink: string;
}

export interface BookingNotificationData {
  name: string;
  email: string;
  mentorName: string;
  sessionDate: string;
  sessionTime: string;
  sessionType: string;
  meetingLink?: string;
}

export interface PayoutNotificationData {
  name: string;
  email: string;
  amount: number;
  payoutDate: string;
  status: 'success' | 'failed' | 'pending';
}

export interface DisputeNotificationData {
  name: string;
  email: string;
  disputeId: string;
  reason: string;
  status: 'created' | 'resolved' | 'dismissed';
}

class EmailService {
  private readonly fromEmail = process.env.FROM_EMAIL || 'noreply@mentr.com';

  /**
   * Add unsubscribe footer to email HTML
   */
  private addUnsubscribeFooter(html: string, unsubscribeToken?: string, category?: string): string {
    if (!unsubscribeToken) {
      return html;
    }

    const unsubscribeUrl = EmailPreferencesService.getUnsubscribeUrl(unsubscribeToken, category);
    const preferencesUrl = process.env.FRONTEND_URL + '/settings/email-preferences';

    const footer = `
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee; margin-top: 30px;">
        <p style="color: #666; font-size: 12px; margin: 0 0 10px 0;">
          You're receiving this email because you have an account with Mentr.
        </p>
        <p style="color: #666; font-size: 12px; margin: 0;">
          <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe</a> | 
          <a href="${preferencesUrl}" style="color: #666; text-decoration: underline;">Manage Email Preferences</a>
        </p>
      </div>
    `;

    // Insert footer before closing body tag
    return html.replace('</body>', footer + '</body>');
  }

  /**
   * Send email with preference checking
   */
  private async sendEmailWithPreferences(
    to: string | string[],
    subject: string,
    html: string,
    userId?: string,
    category?: 'booking' | 'reschedule' | 'chat' | 'payout' | 'dispute' | 'system' | 'verification' | 'marketing'
  ): Promise<boolean> {
    try {
      let unsubscribeToken: string | undefined;

      // If userId is provided, check email preferences and get unsubscribe token
      if (userId && category) {
        const shouldSend = await EmailPreferencesService.shouldSendEmail(userId, category);
        if (!shouldSend) {
          console.log(`Email not sent to user ${userId} due to email preferences for category ${String(category)}`);
          return true; // Return true as it's not an error, just filtered out
        }

        const shouldSendFrequency = await EmailPreferencesService.shouldSendBasedOnFrequency(userId);
        if (!shouldSendFrequency) {
          console.log(`Email not sent to user ${userId} due to frequency preferences`);
          return true;
        }

        // Get unsubscribe token
        const preferences = await EmailPreferencesService.getEmailPreferences(userId);
        unsubscribeToken = preferences?.unsubscribeToken;
      }

      // Add unsubscribe footer to HTML
      const htmlWithFooter = this.addUnsubscribeFooter(html, unsubscribeToken, String(category));

      await resend.emails.send({
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: htmlWithFooter
      });

      // Record email sent if userId is provided
      if (userId) {
        await EmailPreferencesService.recordEmailSent(userId);
      }

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Record bounce if userId is provided
      if (userId) {
        await EmailPreferencesService.recordEmailBounce(Array.isArray(to) ? to[0] : to);
      }
      
      return false;
    }
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(data: VerificationEmailData, userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createVerificationEmail(data);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'verification');
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData, userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createPasswordResetEmail(data);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'system');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  /**
   * Send booking notification
   */
  async sendBookingNotification(data: BookingNotificationData, type: 'confirmation' | 'reminder' | 'cancellation', userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createBookingNotificationEmail(data, type);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'booking');
    } catch (error) {
      console.error('Error sending booking notification:', error);
      return false;
    }
  }

  /**
   * Send payout notification
   */
  async sendPayoutNotification(data: PayoutNotificationData, userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createPayoutNotificationEmail(data);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'payout');
    } catch (error) {
      console.error('Error sending payout notification:', error);
      return false;
    }
  }

  /**
   * Send dispute notification
   */
  async sendDisputeNotification(data: DisputeNotificationData, userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createDisputeNotificationEmail(data);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'dispute');
    } catch (error) {
      console.error('Error sending dispute notification:', error);
      return false;
    }
  }

  /**
   * Create verification email template
   */
  private createVerificationEmail(data: VerificationEmailData): EmailTemplate {
    return {
      to: data.email, // Use the email address
      subject: 'Welcome to Mentr! Verify your account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Mentr! - Verify your account</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Mentr</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Mentr!</h1>
              <p style="color: #e2e8f0; margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">Your mentorship journey starts here</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${data.name}!</h2>
              <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Thank you for joining Mentr! We're excited to have you on board. To complete your registration and start connecting with amazing mentors, please verify your email address.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${data.verificationLink}" 
                   style="background: #10b981; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <!-- Features -->
              <div style="background-color: #f1f5f9; padding: 24px; border-radius: 8px; margin: 24px 0;">
                <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">What you can do on Mentr:</h3>
                <ul style="color: #64748b; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>Connect with verified mentors in your field</li>
                  <li>Book 1-on-1 sessions and get personalized guidance</li>
                  <li>Join group sessions and learn with peers</li>
                  <li>Track your learning progress and achievements</li>
                </ul>
              </div>
              
              <!-- Fallback Link -->
              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">If the button doesn't work, copy and paste this link:</p>
                <p style="color: #2563eb; margin: 0; font-size: 14px; word-break: break-all; font-family: monospace;">${data.verificationLink}</p>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7;  #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 500;">
                  This verification link will expire in 24 hours. If you didn't create an account with Mentr, please ignore this email.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; ">
              <p style="color: #64748b; margin: 0; font-size: 14px; text-align: center;">
                This email was sent by <strong>Mentr</strong> - Your trusted mentorship platform
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Create password reset email template
   */
  private createPasswordResetEmail(data: PasswordResetEmailData): EmailTemplate {
    return {
      to: data.email, // Use the email address
      subject: 'Reset your Mentr password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Mentr</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Password Reset</h1>
              <p style="color: #e2e8f0; margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">Secure your account</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${data.name}!</h2>
              <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your Mentr account. Click the button below to create a new password.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${data.resetLink}" 
                   style="background: #2563eb; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <!-- Fallback Link -->
              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">If the button doesn't work, copy and paste this link:</p>
                <p style="color: #2563eb; margin: 0; font-size: 14px; word-break: break-all; font-family: monospace;">${data.resetLink}</p>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 500;">
                  This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; ">
              <p style="color: #64748b; margin: 0; font-size: 14px; text-align: center;">
                This email was sent by <strong>Mentr</strong> - Your trusted mentorship platform
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Create booking notification email template
   */
  private createBookingNotificationEmail(data: BookingNotificationData, type: 'confirmation' | 'reminder' | 'cancellation'): EmailTemplate {
    const typeConfig = {
      confirmation: {
        subject: 'Session Confirmed! - Your mentorship session is scheduled',
        title: 'Session Confirmed!',
        color: '#10b981',
        bgColor: '#ecfdf5',
        borderColor: '#10b981'
      },
      reminder: {
        subject: 'Session Reminder - Your session starts soon',
        title: 'Session Reminder',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b'
      },
      cancellation: {
        subject: 'Session Cancelled - Your session has been cancelled',
        title: 'Session Cancelled',
        color: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#ef4444'
      }
    };

    const config = typeConfig[type];

    return {
      to: data.email, // Use the email address
      subject: config.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Mentr</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${config.title}</h1>
              <p style="color: #e2e8f0; margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">Session Update</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${data.name}!</h2>
              
              ${type === 'confirmation' ? `
                <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                  Great news! Your session with <strong style="color: #1e293b;">${data.mentorName}</strong> has been confirmed and is ready to go.
                </p>
              ` : type === 'reminder' ? `
                <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                  This is a friendly reminder that your session with <strong style="color: #1e293b;">${data.mentorName}</strong> is coming up soon.
                </p>
              ` : `
                <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                  We're sorry to inform you that your session with <strong style="color: #1e293b;">${data.mentorName}</strong> has been cancelled.
                </p>
              `}
              
              <!-- Session Details Card -->
              <div style="background-color: ${config.bgColor};  ${config.borderColor}; padding: 24px; border-radius: 12px; margin: 24px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <div style="width: 8px; height: 8px; background-color: ${config.color}; border-radius: 50%; margin-right: 12px;"></div>
                  <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">Session Details</h3>
                </div>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Mentor:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.mentorName}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Date:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.sessionDate}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Time:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.sessionTime}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Type:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.sessionType}</span>
                  </div>
                  ${data.meetingLink ? `
                    <div style="margin-top: 16px; text-align: center;">
                      <a href="${data.meetingLink}" 
                         style="background: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                        Join Session
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.FRONTEND_URL}/bookings" 
                   style="background: #2563eb; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  View All Bookings
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; ">
              <p style="color: #64748b; margin: 0; font-size: 14px; text-align: center;">
                This email was sent by <strong>Mentr</strong> - Your trusted mentorship platform
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Create payout notification email template
   */
  private createPayoutNotificationEmail(data: PayoutNotificationData): EmailTemplate {
    const statusConfig = {
      success: {
        title: 'Payout Successful!',
        color: '#10b981',
        bgColor: '#ecfdf5',
        borderColor: '#10b981',
        message: 'Your earnings have been successfully transferred to your account.'
      },
      failed: {
        title: 'Payout Failed',
        color: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#ef4444',
        message: 'There was an issue processing your payout. Please check your payment details.'
      },
      pending: {
        title: 'Payout Pending',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b',
        message: 'Your payout is being processed and will be available soon.'
      }
    };

    const config = statusConfig[data.status];

    return {
      to: data.email, // Use the email address
        subject: `${config.title} - $${data.amount.toFixed(2)} payout`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Mentr</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${config.title}</h1>
              <p style="color: #e2e8f0; margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">Earnings Update</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${data.name}!</h2>
              <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                ${config.message}
              </p>
              
              <!-- Payout Details Card -->
              <div style="background-color: ${config.bgColor};  ${config.borderColor}; padding: 24px; border-radius: 12px; margin: 24px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <div style="width: 8px; height: 8px; background-color: ${config.color}; border-radius: 50%; margin-right: 12px;"></div>
                  <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">Payout Details</h3>
                </div>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Amount:</span>
                    <span style="color: #1e293b; font-weight: 700; font-size: 18px;">$${data.amount.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Date:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.payoutDate}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Status:</span>
                    <span style="color: ${config.color}; font-weight: 600; text-transform: uppercase; font-size: 14px;">${data.status}</span>
                  </div>
                </div>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.FRONTEND_URL}/earnings" 
                   style="background: #2563eb; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  View Earnings Dashboard
                </a>
              </div>
              
              ${data.status === 'failed' ? `
                <!-- Help Section for Failed Payouts -->
                <div style="background-color: #fef2f2;  #fecaca; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h4 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Need Help?</h4>
                  <p style="color: #991b1b; margin: 0 0 12px 0; font-size: 14px; line-height: 1.5;">
                    If you're having trouble with your payout, please check your Stripe Connect account settings or contact our support team.
                  </p>
                  <a href="${process.env.FRONTEND_URL}/support" 
                     style="color: #dc2626; font-weight: 600; font-size: 14px; text-decoration: none;">
                    Contact Support →
                  </a>
                </div>
              ` : ''}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; ">
              <p style="color: #64748b; margin: 0; font-size: 14px; text-align: center;">
                This email was sent by <strong>Mentr</strong> - Your trusted mentorship platform
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Create dispute notification email template
   */
  private createDisputeNotificationEmail(data: DisputeNotificationData): EmailTemplate {
    const statusConfig = {
      created: {
        title: 'New Dispute Reported',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b',
        message: 'A new dispute has been reported regarding one of your sessions.'
      },
      resolved: {
        title: 'Dispute Resolved',
        color: '#10b981',
        bgColor: '#ecfdf5',
        borderColor: '#10b981',
        message: 'Your dispute has been reviewed and resolved.'
      },
      dismissed: {
        title: 'Dispute Dismissed',
        color: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#ef4444',
        message: 'Your dispute has been reviewed and dismissed.'
      }
    };

    const config = statusConfig[data.status];

    return {
      to: data.email, // Use the email address
      subject: `${config.title} - Dispute #${data.disputeId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">Mentr</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${config.title}</h1>
              <p style="color: #e2e8f0; margin: 8px 0 0 0; font-size: 16px; font-weight: 400;">Dispute Center</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${data.name}!</h2>
              <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                ${config.message}
              </p>
              
              <!-- Dispute Details Card -->
              <div style="background-color: ${config.bgColor};  ${config.borderColor}; padding: 24px; border-radius: 12px; margin: 24px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <div style="width: 8px; height: 8px; background-color: ${config.color}; border-radius: 50%; margin-right: 12px;"></div>
                  <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">Dispute Details</h3>
                </div>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Dispute ID:</span>
                    <span style="color: #1e293b; font-weight: 600; font-family: monospace;">#${data.disputeId}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Reason:</span>
                    <span style="color: #1e293b; font-weight: 600;">${data.reason}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-weight: 500;">Status:</span>
                    <span style="color: ${config.color}; font-weight: 600; text-transform: uppercase; font-size: 14px;">${data.status}</span>
                  </div>
                </div>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.FRONTEND_URL}/disputes" 
                   style="background: #2563eb; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  View Dispute Details
                </a>
              </div>
              
              ${data.status === 'created' ? `
                <!-- Help Section for New Disputes -->
                <div style="background-color: #f0f9ff;  #bae6fd; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h4 style="color: #0369a1; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">What happens next?</h4>
                  <p style="color: #0c4a6e; margin: 0 0 12px 0; font-size: 14px; line-height: 1.5;">
                    Our team will review this dispute and get back to you within 24-48 hours. You'll receive updates via email.
                  </p>
                  <a href="${process.env.FRONTEND_URL}/support" 
                     style="color: #0369a1; font-weight: 600; font-size: 14px; text-decoration: none;">
                    Contact Support →
                  </a>
                </div>
              ` : ''}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; ">
              <p style="color: #64748b; margin: 0; font-size: 14px; text-align: center;">
                This email was sent by <strong>Mentr</strong> - Your trusted mentorship platform
              </p>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Send generic email
   */
  async sendGenericEmail(to: string, subject: string, message: string): Promise<boolean> {
    try {
      await resend.emails.send({
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h1 style="color: #333; text-align: center;">${subject}</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">${message}</p>
            <p style="color: #666; font-size: 14px; text-align: center;">
              Best regards,<br>The Mentr Team
            </p>
          </div>
        `
      });

      return true;
    } catch (error) {
      console.error('Error sending generic email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
