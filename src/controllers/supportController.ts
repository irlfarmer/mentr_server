import { Request, Response } from 'express';
import { SupportMessage } from '../models/SupportMessage';
import { AuthRequest } from '../middleware/auth';
import { io } from '../index';

// Send a support message
export const sendSupportMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, guestEmail, guestName } = req.body;
    const user = req.user;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    let conversationId: string;
    let senderId: any = undefined;
    let email: string | undefined = undefined;
    let name: string | undefined = undefined;

    if (user) {
      senderId = user._id;
      conversationId = `user_${user._id}`;
      email = user.email;
      name = `${user.firstName} ${user.lastName}`;
    } else {
      if (!guestEmail) {
        res.status(400).json({ success: false, error: 'Email is required for guest messages' });
        return;
      }
      email = guestEmail;
      name = guestName || 'Guest';
      conversationId = `guest_${guestEmail.toLowerCase().trim()}`;
    }

    const supportMsg = new SupportMessage({
      senderId: user ? user._id : undefined,
      guestEmail: user ? undefined : email,
      guestName: user ? undefined : name,
      content,
      conversationId,
      isAdmin: false,
      status: 'pending' // Always reset status to pending when user sends a message
    });

    await supportMsg.save();

    // Emit to socket room for admins and the user
    // Use conversation_${conversationId} to match the room clients join
    io.to(`conversation_${conversationId}`).emit('support-message', supportMsg);
    io.to('admin_support').emit('new-support-ticket', { conversationId, email, name, content });
    io.to('admin_support').emit('support-message', supportMsg);

    res.status(201).json({
      success: true,
      data: supportMsg,
      message: 'Support message sent'
    });
  } catch (error) {
    console.error('Send support message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

// Get support history
export const getSupportHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { guestEmail } = req.query;
    const user = req.user;

    let conversationId: string;
    if (user) {
      conversationId = `user_${user._id}`;
    } else if (guestEmail) {
      conversationId = `guest_${(guestEmail as string).toLowerCase().trim()}`;
    } else {
      res.status(400).json({ success: false, error: 'Authentication or guest email required' });
      return;
    }

    const messages = await SupportMessage.find({ conversationId }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Get support history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
};

// Admin: Get all tickets (conversations)
export const getAllSupportTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    // First get all unique conversation IDs with metadata
    const conversationMetas = await SupportMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastUpdate: { $first: '$createdAt' },
          guestEmail: { $first: '$guestEmail' },
          guestName: { $first: '$guestName' },
          senderId: { $max: '$senderId' }, // Use $max to get the user ID even if last message is from admin
          // For status, we want the LAST message's status, or we should track status on the last message?
          // Actually, status is stored on the message.
          // IF we want "Conversation Status", we should either store it separately OR infer it.
          // The instruction says "toggle that lets admin mark the chat as resolved".
          // This implies state persistence.
          // We can use the status of the LATEST message as the conversation status?
          // OR, if we implemented a Conversation model, it would be better.
          // But sticking to SupportMessage, let's assume the status of the *last message* represents the conversation state?
          // OR, we can just grab the status from the latest message.
          status: { $first: '$status' } 
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'senderId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $sort: { lastUpdate: -1 } }
    ]);

    // For each conversation, get all messages
    const tickets = await Promise.all(conversationMetas.map(async (conv) => {
      const messages = await SupportMessage.find({ conversationId: conv._id })
        .sort({ createdAt: 1 })
        .lean();

      const user = conv.userDetails[0] ? {
        _id: conv.userDetails[0]._id,
        name: `${conv.userDetails[0].firstName} ${conv.userDetails[0].lastName}`,
        email: conv.userDetails[0].email
      } : null;

      // Determine status: if the very last message is 'resolved', then the ticket is resolved.
      // If the user sends a new message (updated sendSupportMessage), it becomes 'pending'.
      // But wait, the admin wants to Toggle it.
      // If admin toggles, we need to save that state.
      // Since we don't have a Conversation model, updating the *latest* message's status seems like the way to go
      // or creating a "system" message that sets status.
      // For now, let's look at the latest message's status.
      // If we update status, we should update all messages in the conversation? Or just the last one?
      // Updating all messages to 'resolved' is a simple way to track it.
      
      const currentStatus = messages.length > 0 ? messages[messages.length - 1].status : 'pending';

      return {
        conversationId: conv._id, // Map _id to conversationId
        messages,
        lastMessage: messages[messages.length - 1] || null,
        lastUpdate: conv.lastUpdate,
        guestEmail: conv.guestEmail,
        guestName: conv.guestName,
        guest: conv.guestEmail ? { name: conv.guestName, email: conv.guestEmail } : null,
        user,
        status: currentStatus,
        unreadCount: messages.filter((m: any) => !m.isAdmin && m.status === 'pending').length
      };
    }));

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Admin get support tickets error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
};


// Admin: Respond to a ticket
export const adminRespondToTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, content } = req.body;
    const admin = req.user;

    if (!conversationId || !content) {
      res.status(400).json({ success: false, error: 'Conversation ID and content required' });
      return;
    }

    const responseMsg = new SupportMessage({
      isAdmin: true,
      adminId: admin?._id,
      content,
      conversationId,
      status: 'pending' // Admin response keeps it pending (or could match previous?)
    });

    await responseMsg.save();

    // Notify user via socket - emit to the conversation room AND admin room
    io.to(`conversation_${conversationId}`).emit('support-message', responseMsg);
    io.to('admin_support').emit('support-message', responseMsg);

    res.status(201).json({
      success: true,
      data: responseMsg
    });
  } catch (error) {
    console.error('Admin support response error:', error);
    res.status(500).json({ success: false, error: 'Failed to send response' });
  }
};

// Admin: Toggle ticket status
export const toggleTicketStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, status } = req.body;

    if (!conversationId || !['pending', 'resolved'].includes(status)) {
      res.status(400).json({ success: false, error: 'Valid conversation ID and status required' });
      return;
    }

    // Update ALL messages in this conversation to reflect the status
    // This is a bit of a hack since we lack a Conversation model, but it ensures state persistence
    await SupportMessage.updateMany(
      { conversationId },
      { $set: { status } }
    );

    // Notify user and admins
    io.to(`conversation_${conversationId}`).emit('ticket-status-changed', { conversationId, status });
    io.to('admin_support').emit('ticket-status-changed', { conversationId, status });

    res.json({
      success: true,
      message: `Ticket marked as ${status}`,
      status
    });
  } catch (error) {
    console.error('Toggle ticket status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};
