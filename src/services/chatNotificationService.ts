import { notificationService } from './notificationService';
import { User } from '../models/User';
import Message from '../models/Message';

export interface ChatNotificationData {
  senderId: string;
  receiverId: string;
  messageId: string;
  conversationId: string;
  content: string;
  messageType: 'warm' | 'cold';
  messageContentType: 'text' | 'file' | 'image';
  isFirstMessage?: boolean;
  isPaidMessage?: boolean;
  paymentAmount?: number;
}

class ChatNotificationService {
  // Send new message notification
  async sendNewMessageNotification(data: ChatNotificationData): Promise<void> {
    try {
      const sender = await User.findById(data.senderId).select('firstName lastName email profileImage');
      const receiver = await User.findById(data.receiverId).select('firstName lastName email');
      
      if (!sender || !receiver) {
        throw new Error('Sender or receiver not found for chat notification');
      }

      // Check if user has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(data.receiverId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      // Truncate content for notification
      const truncatedContent = data.content.length > 100 
        ? data.content.substring(0, 100) + '...' 
        : data.content;

      // Determine notification title and message based on message type
      let title = '';
      let message = '';
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

      if (data.messageType === 'cold') {
        if (data.isFirstMessage) {
          title = 'New Cold Message';
          message = `${sender.firstName} ${sender.lastName} sent you a cold message: "${truncatedContent}"`;
          priority = 'high';
        } else {
          title = 'New Message';
          message = `${sender.firstName} ${sender.lastName}: "${truncatedContent}"`;
          priority = 'medium';
        }
      } else {
        title = 'New Message';
        message = `${sender.firstName} ${sender.lastName}: "${truncatedContent}"`;
        priority = 'medium';
      }

      // Add payment info for paid messages
      if (data.isPaidMessage && data.paymentAmount) {
        message += ` (Paid: $${data.paymentAmount.toFixed(2)})`;
      }

      await notificationService.createMultiTypeNotification(
        data.receiverId,
        'chat',
        title,
        message,
        {
          senderId: data.senderId,
          senderName: `${sender.firstName} ${sender.lastName}`,
          senderProfileImage: sender.profileImage,
          messageId: data.messageId,
          conversationId: data.conversationId,
          content: data.content,
          truncatedContent,
          messageType: data.messageType,
          messageContentType: data.messageContentType,
          isFirstMessage: data.isFirstMessage,
          isPaidMessage: data.isPaidMessage,
          paymentAmount: data.paymentAmount,
          timestamp: new Date()
        },
        priority
      );
    } catch (error) {
      throw error;
    }
  }

  // Send message read notification (to sender)
  async sendMessageReadNotification(senderId: string, receiverId: string, messageId: string, conversationId: string): Promise<void> {
    try {
      const receiver = await User.findById(receiverId).select('firstName lastName');
      
      if (!receiver) {
        throw new Error('Receiver not found for read notification');
      }

      // Check if sender has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(senderId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      await notificationService.createMultiTypeNotification(
        senderId,
        'chat',
        'Message Read',
        `${receiver.firstName} ${receiver.lastName} read your message`,
        {
          receiverId,
          receiverName: `${receiver.firstName} ${receiver.lastName}`,
          messageId,
          conversationId,
          timestamp: new Date()
        },
        'low'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send typing indicator notification
  async sendTypingNotification(receiverId: string, senderId: string, conversationId: string, isTyping: boolean): Promise<void> {
    try {
      const sender = await User.findById(senderId).select('firstName lastName');
      
      if (!sender) {
        throw new Error('Sender not found for typing notification');
      }

      // Check if receiver has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(receiverId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      // Only send typing notifications for in-app, not email
      if (isTyping) {
        await notificationService.createNotification({
          userId: receiverId,
          type: 'in_app',
          category: 'chat',
          title: 'Typing...',
          message: `${sender.firstName} ${sender.lastName} is typing...`,
          data: {
            senderId,
            senderName: `${sender.firstName} ${sender.lastName}`,
            conversationId,
            isTyping: true,
            timestamp: new Date()
          },
          priority: 'low'
        });
      }
    } catch (error) {
      throw error;
    }
  }

  // Send conversation started notification (for first message)
  async sendConversationStartedNotification(data: ChatNotificationData): Promise<void> {
    try {
      const sender = await User.findById(data.senderId).select('firstName lastName email profileImage');
      const receiver = await User.findById(data.receiverId).select('firstName lastName email');
      
      if (!sender || !receiver) {
        throw new Error('Sender or receiver not found for conversation started notification');
      }

      // Check if user has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(data.receiverId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      const title = data.messageType === 'cold' 
        ? 'New Cold Message Conversation' 
        : 'New Conversation Started';

      const message = data.messageType === 'cold'
        ? `${sender.firstName} ${sender.lastName} started a conversation with you: "${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}"`
        : `${sender.firstName} ${sender.lastName} started a conversation with you`;

      await notificationService.createMultiTypeNotification(
        data.receiverId,
        'chat',
        title,
        message,
        {
          senderId: data.senderId,
          senderName: `${sender.firstName} ${sender.lastName}`,
          senderProfileImage: sender.profileImage,
          messageId: data.messageId,
          conversationId: data.conversationId,
          content: data.content,
          messageType: data.messageType,
          isFirstMessage: true,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send message delivery notification (when message is delivered)
  async sendMessageDeliveredNotification(senderId: string, receiverId: string, messageId: string, conversationId: string): Promise<void> {
    try {
      const receiver = await User.findById(receiverId).select('firstName lastName');
      
      if (!receiver) {
        throw new Error('Receiver not found for delivery notification');
      }

      // Check if sender has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(senderId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      await notificationService.createMultiTypeNotification(
        senderId,
        'chat',
        'Message Delivered 📨',
        `Your message to ${receiver.firstName} ${receiver.lastName} was delivered`,
        {
          receiverId,
          receiverName: `${receiver.firstName} ${receiver.lastName}`,
          messageId,
          conversationId,
          timestamp: new Date()
        },
        'low'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send message failed notification
  async sendMessageFailedNotification(senderId: string, receiverId: string, messageId: string, conversationId: string, reason: string): Promise<void> {
    try {
      const receiver = await User.findById(receiverId).select('firstName lastName');
      
      if (!receiver) {
        throw new Error('Receiver not found for failed message notification');
      }

      // Check if sender has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(senderId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      await notificationService.createMultiTypeNotification(
        senderId,
        'chat',
        'Message Failed',
        `Failed to send message to ${receiver.firstName} ${receiver.lastName}: ${reason}`,
        {
          receiverId,
          receiverName: `${receiver.firstName} ${receiver.lastName}`,
          messageId,
          conversationId,
          failureReason: reason,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send cold message payment required notification
  async sendPaymentRequiredNotification(senderId: string, receiverId: string, amount: number): Promise<void> {
    try {
      const receiver = await User.findById(receiverId).select('firstName lastName');
      
      if (!receiver) {
        throw new Error('Receiver not found for payment required notification');
      }

      // Check if sender has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(senderId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      await notificationService.createMultiTypeNotification(
        senderId,
        'chat',
        'Payment Required 💳',
        `To send a message to ${receiver.firstName} ${receiver.lastName}, you need to pay $${amount.toFixed(2)}`,
        {
          receiverId,
          receiverName: `${receiver.firstName} ${receiver.lastName}`,
          amount,
          timestamp: new Date()
        },
        'high'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send cold message payment successful notification
  async sendPaymentSuccessfulNotification(senderId: string, receiverId: string, amount: number, messageId: string): Promise<void> {
    try {
      const receiver = await User.findById(receiverId).select('firstName lastName');
      
      if (!receiver) {
        throw new Error('Receiver not found for payment successful notification');
      }

      // Check if sender has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(senderId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      await notificationService.createMultiTypeNotification(
        senderId,
        'chat',
        'Payment Successful',
        `Payment of $${amount.toFixed(2)} processed. Your message to ${receiver.firstName} ${receiver.lastName} was sent successfully.`,
        {
          receiverId,
          receiverName: `${receiver.firstName} ${receiver.lastName}`,
          amount,
          messageId,
          timestamp: new Date()
        },
        'medium'
      );
    } catch (error) {
      throw error;
    }
  }

  // Send conversation summary notification (daily/weekly)
  async sendConversationSummaryNotification(userId: string, period: 'daily' | 'weekly', summary: {
    messageCount: number;
    conversationCount: number;
    newConversations: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    try {
      const user = await User.findById(userId).select('firstName lastName email');
      
      if (!user) {
        throw new Error('User not found for conversation summary notification');
      }

      // Check if user has chat notifications enabled
      const preferences = await notificationService.getUserPreferences(userId);
      if (!preferences?.email?.chat || !preferences?.inApp?.chat) {
        return;
      }

      const periodText = period === 'daily' ? 'day' : 'week';
      const periodRange = `${summary.periodStart.toLocaleDateString()} - ${summary.periodEnd.toLocaleDateString()}`;

      await notificationService.createMultiTypeNotification(
        userId,
        'chat',
        `${periodText.charAt(0).toUpperCase() + periodText.slice(1)}ly Chat Summary`,
        `You had ${summary.messageCount} messages in ${summary.conversationCount} conversations${summary.newConversations > 0 ? ` (${summary.newConversations} new)` : ''} this ${periodText} (${periodRange}).`,
        {
          period,
          messageCount: summary.messageCount,
          conversationCount: summary.conversationCount,
          newConversations: summary.newConversations,
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
}

export const chatNotificationService = new ChatNotificationService();
