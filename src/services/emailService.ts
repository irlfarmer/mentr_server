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
  private readonly fromEmail = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

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
      <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; margin-top: 30px;">
        <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0;">
          You're receiving this email because you have an account with Mentr.
        </p>
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> | 
          <a href="${preferencesUrl}" style="color: #6b7280; text-decoration: underline;">Manage Email Preferences</a>
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
          return true; // Return true as it's not an error, just filtered out
        }

        unsubscribeToken = await EmailPreferencesService.getUnsubscribeToken(userId) || undefined;
      }

      // Add unsubscribe footer if token is available
      const finalHtml = this.addUnsubscribeFooter(html, unsubscribeToken, category);

      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: finalHtml,
      });

      if (error) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(data: VerificationEmailData, userId?: string): Promise<boolean> {
    try {
      const { to, subject, html } = this.createVerificationEmail(data);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'verification');
    } catch (error) {
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
      return false;
    }
  }

  /**
   * Send generic email
   */
  async sendGenericEmail(to: string, subject: string, message: string, userId?: string): Promise<boolean> {
    try {
      const html = this.createGenericEmailHtml(subject, message);
      
      return await this.sendEmailWithPreferences(to, subject, html, userId, 'system');
    } catch (error) {
      return false;
    }
  }

  /**
   * Create generic email template
   */
  private createGenericEmailHtml(subject: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject} - Mentr</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          
          <!-- Header -->
          <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
            <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
              <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
              </div>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
            </div>
            <p style="color: #e0e7ff; font-size: 16px; margin: 0;">${subject}</p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              © 2024 Mentr. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create verification email template
   */
  private createVerificationEmail(data: VerificationEmailData): EmailTemplate {
    return {
      to: data.email,
      subject: 'Welcome to Mentr! Verify your account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Mentr! - Verify your account</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
              </div>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">Welcome to the future of mentorship</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">Welcome to Mentr, ${data.name}!</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for joining Mentr! We're excited to have you on board. To get started, please verify your email address by clicking the button below.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.verificationLink}" 
                   style="background: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Verify Email Address
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                If the button doesn't work, you can also copy and paste this link into your browser:
              </p>
              <p style="color: #6b7280; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
                ${data.verificationLink}
              </p>

              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">What's next?</h3>
                <ul style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Complete your profile setup</li>
                  <li>Browse available mentors or services</li>
                  <li>Start your mentorship journey</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If you didn't create an account with Mentr, please ignore this email.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
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
      to: data.email,
      subject: 'Reset your Mentr password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
              </div>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">Reset your password</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">Hi ${data.name}!</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We received a request to reset your password for your Mentr account. Click the button below to create a new password.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.resetLink}" 
                   style="background: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Reset Password
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                If the button doesn't work, you can also copy and paste this link into your browser:
              </p>
              <p style="color: #6b7280; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
                ${data.resetLink}
              </p>

              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 30px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 500;">
                  This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
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
      to: data.email,
      subject: config.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
              </div>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">${config.title}</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">Hi ${data.name}!</h2>
              
              <div style="background: ${config.bgColor}; border: 1px solid ${config.borderColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: ${config.color}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${config.title}</h3>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
                  Your session with <strong>${data.mentorName}</strong> is scheduled for:
                </p>
                <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 10px 0 0 0;">
                  ${data.sessionDate} at ${data.sessionTime}
                </p>
                <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
                  Session Type: ${data.sessionType}
                </p>
              </div>

              ${data.meetingLink ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.meetingLink}" 
                   style="background: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Join Session
                </a>
              </div>
              ` : ''}

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If you have any questions, please contact our support team.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
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
        message: 'Your payout is being processed and will be completed soon.'
      }
    };

    const config = statusConfig[data.status];

    return {
      to: data.email,
      subject: `${config.title} - Your Mentr payout`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
              </div>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">Payout Notification</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">Hi ${data.name}!</h2>
              
              <div style="background: ${config.bgColor}; border: 1px solid ${config.borderColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: ${config.color}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${config.title}</h3>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                  ${config.message}
                </p>
                <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 10px 0 0 0;">
                  Amount: $${data.amount.toFixed(2)}
                </p>
                <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
                  Date: ${data.payoutDate}
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If you have any questions about this payout, please contact our support team.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
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
      to: data.email,
      subject: `${config.title} - Dispute #${data.disputeId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.title} - Mentr</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: #2563eb; padding: 40px 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                  <span style="font-size: 20px; font-weight: bold; color: #2563eb;">M</span>
                </div>
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Mentr</h1>
              </div>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">Dispute Notification</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">Hi ${data.name}!</h2>
              
              <div style="background: ${config.bgColor}; border: 1px solid ${config.borderColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: ${config.color}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${config.title}</h3>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                  ${config.message}
                </p>
                <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 10px 0 0 0;">
                  Dispute ID: #${data.disputeId}
                </p>
                <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
                  Reason: ${data.reason}
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If you have any questions about this dispute, please contact our support team.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                © 2024 Mentr. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }
}

export default new EmailService();