import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { deductTokens } from './tokenController';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { emitToConversation, emitToUser } from '../services/socketService';
import { MentorEarningsService } from '../services/mentorEarningsService';
import { chatNotificationService } from '../services/chatNotificationService';

// Helper function to check if users have an upcoming booking
const hasUpcomingBooking = async (studentId: string, mentorId: string): Promise<boolean> => {
  const now = new Date();
  const upcomingBooking = await Booking.findOne({
    studentId,
    mentorId,
    scheduledAt: { $gte: now },
    status: 'confirmed', // Only confirmed bookings allow warm messages
    paymentStatus: 'paid'
  });
  return !!upcomingBooking;
};


// Get all conversations for a user
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;

    // Get all unique conversation IDs for this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.senderId',
          foreignField: '_id',
          as: 'sender'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.receiverId',
          foreignField: '_id',
          as: 'receiver'
        }
      },
      {
        $addFields: {
          otherUser: {
            $cond: [
              { $eq: ['$lastMessage.senderId', userId] },
              { $arrayElemAt: ['$receiver', 0] },
              { $arrayElemAt: ['$sender', 0] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          conversationId: '$_id',
          otherUser: {
            _id: '$otherUser._id',
            firstName: '$otherUser.firstName',
            lastName: '$otherUser.lastName',
            profileImage: '$otherUser.profileImage',
            isVerified: '$otherUser.isVerified',
            coldMessageRate: '$otherUser.coldMessageRate',
            userType: '$otherUser.userType'
          },
          lastMessage: {
            content: '$lastMessage.content',
            type: '$lastMessage.type',
            createdAt: '$lastMessage.createdAt',
            senderId: '$lastMessage.senderId'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    return res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
};

// Get messages for a specific conversation
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Verify user is part of this conversation
    const conversation = await Message.findOne({
      conversationId,
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Get messages
    const messages = await Message.find({ conversationId })
      .populate('senderId', 'firstName lastName profileImage')
      .populate('receiverId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Mark messages as read for the current user
    await Message.updateMany(
      {
        conversationId,
        receiverId: userId,
        isRead: false
      },
      { isRead: true }
    );

    return res.json({
      success: true,
      data: messages.reverse() // Reverse to show oldest first
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
};

// Send a new message
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { receiverId, content, type = 'text', fileUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Receiver ID and content are required'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sender ID'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receiver ID'
      });
    }

    // Verify receiver exists and get their profile
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        error: 'Receiver not found'
      });
    }

    // Determine if this is a warm or cold message
    const isWarmMessage = await hasUpcomingBooking(userId, receiverId);
    const messageType = isWarmMessage ? 'warm' : 'cold';
    
    // For cold messages, check if payment is required
    let paymentStatus = 'free';
    let paymentAmount = 0;
    
    if (messageType === 'cold' && receiver.coldMessageRate && receiver.coldMessageRate > 0) {
      // Check if user has sufficient token balance
      const user = await User.findById(userId).select('mentraBalance');
      if (!user || user.mentraBalance < receiver.coldMessageRate) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient Mentra token balance',
          data: {
            messageType: 'cold',
            paymentRequired: true,
            amount: receiver.coldMessageRate,
            mentorName: `${receiver.firstName} ${receiver.lastName}`,
            currentBalance: user?.mentraBalance || 0
          }
        });
      }
      
      // Deduct tokens for cold message
      const success = await deductTokens(
        userId, 
        receiver.coldMessageRate, 
        `Cold message to ${receiver.firstName} ${receiver.lastName}`
      );
      
      if (!success) {
        // Send payment required notification
        try {
          await chatNotificationService.sendPaymentRequiredNotification(
            userId.toString(),
            receiverId.toString(),
            receiver.coldMessageRate
          );
        } catch (notificationError) {
          console.error('Error sending payment required notification:', notificationError);
          // Don't fail the response if notification fails
        }

        return res.status(402).json({
          success: false,
          error: 'Failed to process token payment',
          data: {
            messageType: 'cold',
            paymentRequired: true,
            amount: receiver.coldMessageRate,
            mentorName: `${receiver.firstName} ${receiver.lastName}`
          }
        });
      }
      
      paymentStatus = 'paid';
      paymentAmount = receiver.coldMessageRate;
      
      // CRITICAL FIX: Add earnings for the mentor who received the cold message
      try {
        const earningsResult = await MentorEarningsService.addEarnings(
          receiverId,
          {
            amount: receiver.coldMessageRate,
            type: 'message',
            description: `Cold message from ${user?.firstName || 'User'}`,
            messageId: 'temp' // Will be updated after message is created
          }
        );
        
        if (earningsResult.success) {
          console.log(`Mentor ${receiver.firstName} ${receiver.lastName} earned $${(receiver.coldMessageRate * 0.75).toFixed(2)} from cold message (Tier: ${earningsResult.newTier || 'unchanged'})`);
        }
      } catch (error) {
        console.error('Error adding mentor earnings for cold message:', error);
        // Don't fail the message send if earnings tracking fails
      }
    }

    // Create message
    const message = new Message({
      senderId: userId,
      receiverId,
      content,
      type,
      messageType,
      paymentStatus,
      paymentAmount,
      fileUrl
    });

    await message.save();

    // Populate sender info for response
    await message.populate('senderId', 'firstName lastName profileImage');

    // Emit new message to conversation participants
    emitToConversation(message.conversationId, 'new-message', message);

    // Emit notification to receiver
    emitToUser(receiverId, 'new-message-notification', {
      message: message,
      conversationId: message.conversationId
    });

    // Send chat notification
    try {
      // Check if this is the first message in the conversation
      const existingMessages = await Message.countDocuments({
        conversationId: message.conversationId,
        senderId: { $ne: userId }
      });
      const isFirstMessage = existingMessages === 0;

      await chatNotificationService.sendNewMessageNotification({
        senderId: userId.toString(),
        receiverId: receiverId.toString(),
        messageId: message._id.toString(),
        conversationId: message.conversationId,
        content: message.content,
        messageType: message.messageType,
        messageContentType: message.type,
        isFirstMessage,
        isPaidMessage: message.paymentStatus === 'paid',
        paymentAmount: message.paymentAmount
      });

      // If this is a cold message and first message, also send conversation started notification
      if (message.messageType === 'cold' && isFirstMessage) {
        await chatNotificationService.sendConversationStartedNotification({
          senderId: userId.toString(),
          receiverId: receiverId.toString(),
          messageId: message._id.toString(),
          conversationId: message.conversationId,
          content: message.content,
          messageType: message.messageType,
          messageContentType: message.type,
          isFirstMessage: true,
          isPaidMessage: message.paymentStatus === 'paid',
          paymentAmount: message.paymentAmount
        });
      }
    } catch (notificationError) {
      console.error('Error sending chat notification:', notificationError);
      // Don't fail the message send if notification fails
    }

    // Get updated user balance for response
    const updatedUser = await User.findById(userId).select('mentraBalance');
    
    return res.status(201).json({
      success: true,
      data: message,
      updatedBalance: updatedUser?.mentraBalance || 0
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

// Process payment for cold message
export const processColdMessagePayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { receiverId, content, type = 'text', fileUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Receiver ID and content are required'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user IDs'
      });
    }

    // Get receiver and check cold message rate
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.coldMessageRate || receiver.coldMessageRate <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cold message rate not set or invalid'
      });
    }

    // TODO: Implement actual payment processing with Stripe
    // For now, we'll simulate a successful payment
    const paymentAmount = receiver.coldMessageRate;
    
    // Create message with paid status
    const message = new Message({
      senderId: userId,
      receiverId,
      content,
      type,
      messageType: 'cold',
      paymentStatus: 'paid',
      paymentAmount,
      fileUrl
    });

    await message.save();

    // Populate sender info for response
    await message.populate('senderId', 'firstName lastName profileImage');

    // Emit new message to conversation participants
    emitToConversation(message.conversationId, 'new-message', message);

    // Emit notification to receiver
    emitToUser(receiverId, 'new-message-notification', {
      message: message,
      conversationId: message.conversationId
    });

    // Send chat notification
    try {
      // Check if this is the first message in the conversation
      const existingMessages = await Message.countDocuments({
        conversationId: message.conversationId,
        senderId: { $ne: userId }
      });
      const isFirstMessage = existingMessages === 0;

      await chatNotificationService.sendNewMessageNotification({
        senderId: userId.toString(),
        receiverId: receiverId.toString(),
        messageId: message._id.toString(),
        conversationId: message.conversationId,
        content: message.content,
        messageType: message.messageType,
        messageContentType: message.type,
        isFirstMessage,
        isPaidMessage: message.paymentStatus === 'paid',
        paymentAmount: message.paymentAmount
      });

      // If this is a cold message and first message, also send conversation started notification
      if (message.messageType === 'cold' && isFirstMessage) {
        await chatNotificationService.sendConversationStartedNotification({
          senderId: userId.toString(),
          receiverId: receiverId.toString(),
          messageId: message._id.toString(),
          conversationId: message.conversationId,
          content: message.content,
          messageType: message.messageType,
          messageContentType: message.type,
          isFirstMessage: true,
          isPaidMessage: message.paymentStatus === 'paid',
          paymentAmount: message.paymentAmount
        });
      }

      // Send payment successful notification
      await chatNotificationService.sendPaymentSuccessfulNotification(
        userId.toString(),
        receiverId.toString(),
        paymentAmount,
        message._id.toString()
      );
    } catch (notificationError) {
      console.error('Error sending chat notification:', notificationError);
      // Don't fail the message send if notification fails
    }

    // Get updated user balance for response
    const updatedUser = await User.findById(userId).select('mentraBalance');
    
    return res.status(201).json({
      success: true,
      data: message,
      updatedBalance: updatedUser?.mentraBalance || 0
    });
  } catch (error) {
    console.error('Process cold message payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
};

// Mark messages as read
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { conversationId } = req.params;

    // Get the messages that will be marked as read to notify senders
    const messagesToMarkRead = await Message.find({
      conversationId,
      receiverId: userId,
      isRead: false
    }).populate('senderId', 'firstName lastName');

    await Message.updateMany(
      {
        conversationId,
        receiverId: userId,
        isRead: false
      },
      { isRead: true }
    );

    // Send read notifications to senders
    try {
      for (const message of messagesToMarkRead) {
        await chatNotificationService.sendMessageReadNotification(
          message.senderId._id.toString(),
          userId.toString(),
          message._id.toString(),
          conversationId
        );
      }
    } catch (notificationError) {
      console.error('Error sending read notifications:', notificationError);
      // Don't fail the mark as read if notification fails
    }

    return res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
};

// Get unread message count
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false
    });

    return res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
};
