import { Request, Response } from 'express';
import { Dispute } from '../models/Dispute';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../utils/cloudinary';
import { PayoutService } from '../services/payoutService';
import { disputeNotificationService } from '../services/disputeNotificationService';

// Create a new dispute
export const createDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId, reason, description, evidence } = req.body;
    const menteeId = req.user?._id;

    if (!menteeId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Check if booking exists and belongs to the mentee
    const booking = await Booking.findById(bookingId)
      .populate('mentorId', 'firstName lastName')
      .populate('studentId', 'firstName lastName');

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    if (booking.studentId.toString() !== menteeId.toString()) {
      res.status(403).json({
        success: false,
        error: 'You can only create disputes for your own bookings'
      });
      return;
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      res.status(400).json({
        success: false,
        error: 'Can only create disputes for completed bookings'
      });
      return;
    }

    // Check if dispute period has expired (48 hours)
    const disputeDeadline = new Date(booking.updatedAt);
    disputeDeadline.setHours(disputeDeadline.getHours() + 48);
    
    if (new Date() > disputeDeadline) {
      res.status(400).json({
        success: false,
        error: 'Dispute period has expired (48 hours after session completion)'
      });
      return;
    }

    // Check if dispute already exists for this booking
    const existingDispute = await Dispute.findOne({ bookingId });
    if (existingDispute) {
      res.status(400).json({
        success: false,
        error: 'A dispute already exists for this booking'
      });
      return;
    }

    // Process evidence uploads if any
    let processedEvidence = [];
    if (evidence && evidence.length > 0) {
      for (const item of evidence) {
        if (item.type === 'text') {
          processedEvidence.push({
            type: item.type,
            url: item.content || '',
            description: item.description,
            uploadedAt: new Date()
          });
        } else if (item.file) {
          // Upload file to Cloudinary
          const uploadResult = await uploadToCloudinary(item.file, 'disputes');
          processedEvidence.push({
            type: item.type,
            url: uploadResult.secure_url,
            description: item.description,
            uploadedAt: new Date()
          });
        }
      }
    }

    // Create the dispute
    const dispute = new Dispute({
      bookingId,
      menteeId,
      mentorId: booking.mentorId,
      reason,
      description,
      evidence: processedEvidence,
      status: 'pending'
    });

    await dispute.save();

    // Populate the response
    await dispute.populate([
      { path: 'bookingId', select: 'title amount status' },
      { path: 'menteeId', select: 'firstName lastName email' },
      { path: 'mentorId', select: 'firstName lastName email' }
    ]);

    // Send dispute notifications
    try {
      // Notify mentor about new dispute
      await disputeNotificationService.sendNewDisputeNotification({
        disputeId: (dispute._id as any).toString(),
        menteeId: dispute.menteeId.toString(),
        mentorId: dispute.mentorId.toString(),
        bookingId: dispute.bookingId.toString(),
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status
      });

      // Notify admin about new dispute
      await disputeNotificationService.sendAdminDisputeNotification({
        disputeId: (dispute._id as any).toString(),
        menteeId: dispute.menteeId.toString(),
        mentorId: dispute.mentorId.toString(),
        bookingId: dispute.bookingId.toString(),
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status
      });
    } catch (notificationError) {
      console.error('Error sending dispute notifications:', notificationError);
      // Don't fail the dispute creation if notification fails
    }

    res.status(201).json({
      success: true,
      data: dispute,
      message: 'Dispute created successfully'
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dispute'
    });
  }
};

// Get disputes for a user (mentee or mentor)
export const getUserDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { status, limit = 20, page = 1 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const query: any = {
      $or: [
        { menteeId: userId },
        { mentorId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const disputes = await Dispute.find(query)
      .populate('bookingId', 'title amount status')
      .populate('menteeId', 'firstName lastName email')
      .populate('mentorId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disputes'
    });
  }
};

// Get a specific dispute
export const getDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const dispute = await Dispute.findById(disputeId)
      .populate('bookingId', 'title amount status')
      .populate('menteeId', 'firstName lastName email')
      .populate('mentorId', 'firstName lastName email');

    if (!dispute) {
      res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
      return;
    }

    // Check if user is involved in this dispute
    if (dispute.menteeId._id.toString() !== userId.toString() && 
        dispute.mentorId._id.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dispute'
    });
  }
};

// Mentor responds to dispute
export const mentorRespondToDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const { message, evidence } = req.body;
    const mentorId = req.user?._id;

    if (!mentorId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const dispute = await Dispute.findById(disputeId);

    if (!dispute) {
      res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
      return;
    }

    if (dispute.mentorId.toString() !== mentorId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the mentor can respond to this dispute'
      });
      return;
    }

    if (dispute.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'Dispute is no longer pending'
      });
      return;
    }

    // Process evidence uploads if any
    let processedEvidence = [];
    if (evidence && evidence.length > 0) {
      for (const item of evidence) {
        if (item.type === 'text') {
          processedEvidence.push({
            type: item.type,
            url: item.content || '',
            description: item.description,
            uploadedAt: new Date()
          });
        } else if (item.file) {
          // Upload file to Cloudinary
          const uploadResult = await uploadToCloudinary(item.file, 'disputes');
          processedEvidence.push({
            type: item.type,
            url: uploadResult.secure_url,
            description: item.description,
            uploadedAt: new Date()
          });
        }
      }
    }

    // Update dispute with mentor response
    dispute.mentorResponse = {
      message,
      evidence: processedEvidence,
      respondedAt: new Date()
    };
    dispute.status = 'mentor_responded';

    await dispute.save();

    // Send mentor response notification
    try {
      await disputeNotificationService.sendMentorResponseNotification({
        disputeId: (dispute._id as any).toString(),
        menteeId: dispute.menteeId.toString(),
        mentorId: dispute.mentorId.toString(),
        bookingId: dispute.bookingId.toString(),
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        mentorResponse: message
      });
    } catch (notificationError) {
      console.error('Error sending mentor response notification:', notificationError);
      // Don't fail the response if notification fails
    }

    res.json({
      success: true,
      data: dispute,
      message: 'Response submitted successfully'
    });
  } catch (error) {
    console.error('Error responding to dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to dispute'
    });
  }
};

// Admin gets all disputes
export const getAllDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const disputes = await Dispute.find(query)
      .populate('bookingId', 'title amount status')
      .populate('menteeId', 'firstName lastName email')
      .populate('mentorId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all disputes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disputes'
    });
  }
};

// Admin resolves dispute
export const resolveDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const { decision, amount, reason } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const dispute = await Dispute.findById(disputeId)
      .populate('bookingId');

    if (!dispute) {
      res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
      return;
    }

    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      res.status(400).json({
        success: false,
        error: 'Dispute has already been resolved'
      });
      return;
    }

    // Update dispute with admin resolution
    dispute.adminResolution = {
      decision,
      amount: amount || 0,
      reason,
      resolvedAt: new Date(),
      adminId
    };
    dispute.status = 'resolved';

    await dispute.save();

    // Handle payment processing based on decision
    await PayoutService.handleDisputeResolution(disputeId, decision, amount);

    // Send dispute resolution notification
    try {
      await disputeNotificationService.sendDisputeResolutionNotification({
        disputeId: (dispute._id as any).toString(),
        menteeId: dispute.menteeId.toString(),
        mentorId: dispute.mentorId.toString(),
        bookingId: dispute.bookingId.toString(),
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        decision,
        refundAmount: amount,
        adminReason: reason
      });
    } catch (notificationError) {
      console.error('Error sending dispute resolution notification:', notificationError);
      // Don't fail the resolution if notification fails
    }

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve dispute'
    });
  }
};

// Admin dismisses dispute
export const dismissDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const { reason } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const dispute = await Dispute.findById(disputeId);

    if (!dispute) {
      res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
      return;
    }

    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      res.status(400).json({
        success: false,
        error: 'Dispute has already been processed'
      });
      return;
    }

    // Update dispute status
    dispute.status = 'dismissed';
    dispute.adminResolution = {
      decision: 'pay_mentor',
      amount: 0,
      reason: reason || 'Dispute dismissed',
      resolvedAt: new Date(),
      adminId
    };

    await dispute.save();

    // Send dispute dismissed notification
    try {
      await disputeNotificationService.sendDisputeDismissedNotification({
        disputeId: (dispute._id as any).toString(),
        menteeId: dispute.menteeId.toString(),
        mentorId: dispute.mentorId.toString(),
        bookingId: dispute.bookingId.toString(),
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        adminReason: reason
      });
    } catch (notificationError) {
      console.error('Error sending dispute dismissed notification:', notificationError);
      // Don't fail the dismissal if notification fails
    }

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss dispute'
    });
  }
};
