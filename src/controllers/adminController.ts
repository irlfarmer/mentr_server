import { Request, Response } from 'express';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Service } from '../models/Service';
import { TokenTransaction } from '../models/TokenTransaction';
import VerificationRequest from '../models/VerificationRequest';
import { deleteResource } from '../config/cloudinary'; // Import delete helper
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { RefundService } from '../services/refundService';
import { PayoutService } from '../services/payoutService';

// Admin middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: any): void => {
  const user = (req as any).user;
  if (!user || user.userType !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }
  next();
};

// Get admin dashboard statistics
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);
    const startOfThisMonth = startOfMonth(now);
    const endOfThisMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subMonths(now, 1));
    const endOfLastMonth = endOfMonth(subMonths(now, 1));

    // Get current stats
    const [
      totalUsers,
      activeMentors,
      sessionsToday,
      revenueThisMonth,
      totalUsersLastMonth,
      activeMentorsLastMonth,
      sessionsLastMonth,
      revenueLastMonth
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ userType: { $in: ['mentor', 'both'] }, isActive: true }),
      Booking.countDocuments({
        scheduledAt: { $gte: startOfToday, $lte: endOfToday },
        status: { $in: ['confirmed', 'completed'] }
      }),
      Booking.aggregate([
        {
          $match: {
            updatedAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
            paymentMethod: 'stripe',
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$amount', 0] } }
          }
        }
      ]),
      User.countDocuments({
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }),
      User.countDocuments({
        userType: { $in: ['mentor', 'both'] },
        isActive: true,
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }),
      Booking.countDocuments({
        scheduledAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        status: { $in: ['confirmed', 'completed'] }
      }),
      Booking.aggregate([
        {
          $match: {
            updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            paymentMethod: 'stripe',
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$amount', 0] } }
          }
        }
      ]),
      TokenTransaction.aggregate([
        {
          $match: {
             createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
             type: 'credit',
             reference: { $regex: /^stripe_/ }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]),
      TokenTransaction.aggregate([
        {
          $match: {
             createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
             type: 'credit',
             reference: { $regex: /^stripe_/ }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ])
    ]);

    // Calculate growth percentages
    const userGrowth = totalUsersLastMonth > 0 
      ? ((totalUsers - totalUsersLastMonth) / totalUsersLastMonth) * 100 
      : 0;
    
    const mentorGrowth = activeMentorsLastMonth > 0 
      ? ((activeMentors - activeMentorsLastMonth) / activeMentorsLastMonth) * 100 
      : 0;
    
    const sessionGrowth = sessionsLastMonth > 0 
      ? ((sessionsToday - sessionsLastMonth) / sessionsLastMonth) * 100 
      : 0;

    // Extract revenues from the Promise.all results array
    // Indices: 0-7 are standard, 8 is tokenRevenueThisMonth, 9 is tokenRevenueLastMonth
    const currentBookingRevenue = revenueThisMonth.length > 0 ? revenueThisMonth[0].totalRevenue : 0;
    const lastBookingRevenue = revenueLastMonth.length > 0 ? revenueLastMonth[0].totalRevenue : 0;
    
    // @ts-ignore - Accessing extra array elements
    const results = [
      totalUsers, activeMentors, sessionsToday, revenueThisMonth,
      totalUsersLastMonth, activeMentorsLastMonth, sessionsLastMonth, revenueLastMonth
    ];
    // In reality, Promise.all returned the full array, but we destructured only the first 8.
    // However, since we can't easily access the original array 'allResults' without changing the diff huge amount,
    // We will just re-run the token queries separately for code cleanliness/safety, as passing [8] in 
    // destructuring via replace is tricky if variable names aren't there.
    // actually, let's just do the separate query approach, it is safer than relying on hidden array indices.
    
    const tokenRevenueCurrent = (await TokenTransaction.aggregate([
        {
          $match: {
             createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
             type: 'credit',
             reference: { $regex: /^stripe_/ }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
    ]))[0]?.totalRevenue || 0;

    const tokenRevenueLast = (await TokenTransaction.aggregate([
        {
          $match: {
             createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
             type: 'credit',
             reference: { $regex: /^stripe_/ }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
    ]))[0]?.totalRevenue || 0;

    const currentRevenue = currentBookingRevenue + tokenRevenueCurrent;
    const lastRevenue = lastBookingRevenue + tokenRevenueLast;
    
    const revenueGrowth = lastRevenue > 0 
      ? ((currentRevenue - lastRevenue) / lastRevenue) * 100  
      : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeMentors,
        sessionsToday,
        revenueThisMonth: currentRevenue,
        userGrowth,
        mentorGrowth,
        sessionGrowth,
        revenueGrowth
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin statistics'
    });
  }
};

// Get recent users
export const getRecentUsers = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const users = await User.find()
      .select('firstName lastName email userType isVerified isEmailVerified isActive isBanned createdAt profileImage')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent users'
    });
  }
};

// Get pending verifications
export const getPendingVerifications = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const requests = await VerificationRequest.find({
      status: 'pending_review'
    })
      .populate('userId', 'firstName lastName email userType isVerified isActive isBanned linkedinProfileUrl createdAt profileImage')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending verifications'
    });
  }
};

// Get recent transactions (completed bookings)
export const getRecentTransactions = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const bookings = await Booking.find({
      status: { $in: ['completed', 'reviewable', 'reviewed'] }
    })
      .populate('mentorId', 'firstName lastName')
      .populate('studentId', 'firstName lastName')
      .populate('serviceId', 'hourlyRate')
      .sort({ scheduledAt: -1 })
      .limit(limit);

    const transactions = bookings.map((booking: any) => ({
      _id: booking._id,
      mentorId: booking.mentorId,
      studentId: booking.studentId,
      amount: booking.amount || (booking.serviceId as any)?.hourlyRate || 0,
      status: booking.status === 'completed' && booking.payoutStatus === 'paid' ? 'completed' : 
              booking.status === 'failed' || booking.payoutStatus === 'failed' ? 'failed' :
              booking.status === 'cancelled' || booking.refund?.status === 'processed' ? 'cancelled' : 'pending',
      payoutStatus: booking.payoutStatus || 'pending',
      paymentStatus: booking.paymentStatus || 'paid',
      createdAt: booking.createdAt,
      scheduledAt: booking.scheduledAt,
      mentor: booking.mentorId,
      student: booking.studentId,
      type: 'session'
    }));

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent transactions'
    });
  }
};

// Get platform activity
export const getPlatformActivity = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = subDays(new Date(), days);
    
    // Get daily user registrations
    const userActivity = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          users: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get daily sessions and revenue
    const sessionActivity = await Booking.aggregate([
      {
        $match: {
          scheduledAt: { $gte: startDate },
          status: { $in: ['confirmed', 'completed', 'reviewable', 'reviewed'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' }
          },
          sessions: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$amount', 0] } }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get daily token revenue
    const tokenActivity = await TokenTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          type: 'credit',
          reference: { $regex: /^stripe_/ }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Create a complete date range to ensure no gaps
    const dateRange = [];
    for (let i = 0; i < days; i++) {
      const date = subDays(new Date(), days - 1 - i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    // Combine data with complete date range
    const activityMap = new Map();
    
    // Initialize all dates with zero values
    dateRange.forEach(date => {
      activityMap.set(date, { date, users: 0, sessions: 0, revenue: 0 });
    });
    
    // Add user activity
    userActivity.forEach((item: any) => {
      const existing = activityMap.get(item._id);
      if (existing) {
        existing.users = item.users;
      }
    });
    
    // Add session activity
    sessionActivity.forEach((item: any) => {
      const existing = activityMap.get(item._id);
      if (existing) {
        existing.sessions = item.sessions;
        existing.revenue = item.revenue;
      }
    });

    // Add token revenue
    tokenActivity.forEach((item: any) => {
      const existing = activityMap.get(item._id);
      if (existing) {
        existing.revenue += item.revenue;
      }
    });

    const activity = Array.from(activityMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching platform activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform activity'
    });
  }
};

// Get all users with pagination
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const userType = req.query.type as string; // Support type filtering
    const status = req.query.status as string; // Support status filtering
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Apply user type filter if provided
    if (userType && userType !== 'all') {
      if (userType === 'both') {
        query.userType = 'both';
      } else {
        query.userType = userType;
      }
    }
    
    // Apply status filter if provided
    if (status && status !== 'all') {
      if (status === 'verified') {
        query.isVerified = true;
      } else if (status === 'unverified') {
        query.isVerified = false;
      } else if (status === 'suspended') {
        query.isActive = false;
      }
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email userType isVerified isEmailVerified isActive isBanned createdAt profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);
    
    // Fetch pending verification requests for these users
    const userIds = users.map((u: any) => u._id);
    const pendingRequests = await VerificationRequest.find({
      userId: { $in: userIds },
      status: 'pending_review'
    }).select('_id userId documents status');
    
    // Map requests to users
    const enrichedUsers = users.map((user: any) => {
      const request = pendingRequests.find((req: any) => req.userId.toString() === user._id.toString());
      if (request) {
        return {
          ...user,
          verificationRequestId: request._id,
          documents: request.documents,
          hasPendingVerification: true
        };
      }
      return user;
    });

    res.json({
      success: true,
      data: {
        users: enrichedUsers,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

// Update user status
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'banned'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status. Must be active, inactive, or banned'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isActive: status === 'active',
        ...(status === 'banned' && { isBanned: true })
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
};

// Verify user
export const verifyUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isVerified: true,
        verificationDate: new Date()
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user'
    });
  }
};

// Handle verification request (approve/reject)
export const handleVerificationDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params;
    const { decision, reason, adminNotes } = req.body; // decision: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(decision)) {
       res.status(400).json({ success: false, error: 'Invalid decision' });
       return;
    }

    const request = await VerificationRequest.findById(requestId);
    if (!request) {
       res.status(404).json({ success: false, error: 'Request not found' });
       return;
    }

    if (request.status !== 'pending_review') {
       res.status(400).json({ success: false, error: 'Request is not pending review' });
       return;
    }

    if (decision === 'approve') {
      request.status = 'approved';
      request.adminNotes = adminNotes;
      
      // Update User
      await User.findByIdAndUpdate(request.userId, {
        isVerified: true,
        verificationDate: new Date()
      });
      
      // Delete documents from Cloudinary after verification
      if (request.documents && request.documents.length > 0) {
        for (const doc of request.documents) {
            // Extract public_id from URL if not stored separately
            // Assuming documents have _id, name, url, type. 
            // If public_id isn't stored, we might need to parse it from URL or use a different approach.
            // For now, let's try to extract from URL if possible, or skip if unsafe.
            // Better approach: If you are not storing public_id, you cannot reliably delete.
            // However, many Cloudinary implementations store it.
            // Let's assume standard Cloudinary URL structure if public_id is missing.
            
            try {
                // Regex to extract public ID from Cloudinary URL
                // Pattern: .../upload/v<version>/<folder>/<public_id>.<ext>
                const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
                const match = doc.url.match(regex);
                if (match && match[1]) {
                    const publicId = match[1];
                    await deleteResource(publicId, 'image'); // Assume images for now
                }
            } catch (err) {
                console.error('Failed to delete verification document:', err);
            }
        }
        // Clear documents buffer from DB object if desired, or keep record but file is gone.
        // Usually keeping record is good for audit, even if link breaks.
      }

      // TODO: Send approval email notification
    } else {
      request.status = 'rejected';
      request.rejectionReason = reason;
      request.adminNotes = adminNotes;
      
      // TODO: Send rejection email notification
    }

    await request.save();

    res.json({
      success: true,
      message: `Verification request ${decision}d successfully`
    });

  } catch (error) {
    console.error('Error handling verification decision:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process decision'
    });
  }
};

// Get system alerts
export const getSystemAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = [];
    const now = new Date();
    
    // Check for pending verifications
    const pendingVerifications = await User.countDocuments({
      isVerified: false,
      userType: { $in: ['mentor', 'both'] }
    });
    
    if (pendingVerifications > 0) {
      alerts.push({
        id: 'pending-verifications',
        type: 'warning',
        message: `${pendingVerifications} mentor verification${pendingVerifications > 1 ? 's' : ''} pending review`,
        timestamp: now.toISOString()
      });
    }
    
    // Check for failed transactions in the last 24 hours
    const failedTransactions = await Booking.countDocuments({
      status: 'failed',
      createdAt: { $gte: subDays(now, 1) }
    });
    
    if (failedTransactions > 0) {
      alerts.push({
        id: 'failed-transactions',
        type: 'error',
        message: `${failedTransactions} transaction${failedTransactions > 1 ? 's' : ''} failed in the last 24 hours`,
        timestamp: now.toISOString()
      });
    }
    
    // Check for inactive users (no activity in 30 days)
    const inactiveUsers = await User.countDocuments({
      lastActiveAt: { $lt: subDays(now, 30) },
      isActive: true
    });
    
    if (inactiveUsers > 10) {
      alerts.push({
        id: 'inactive-users',
        type: 'warning',
        message: `${inactiveUsers} users have been inactive for over 30 days`,
        timestamp: now.toISOString()
      });
    }
    
    // Check for high session volume (more than 50 sessions today)
    const todaySessions = await Booking.countDocuments({
      scheduledAt: {
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      },
      status: { $in: ['confirmed', 'completed'] }
    });
    
    if (todaySessions > 50) {
      alerts.push({
        id: 'high-session-volume',
        type: 'info',
        message: `High session volume: ${todaySessions} sessions scheduled today`,
        timestamp: now.toISOString()
      });
    }
    
    // Check for low revenue this month (less than $1000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          scheduledAt: { $gte: startOfMonth },
          status: { $in: ['confirmed', 'completed', 'reviewable', 'reviewed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$amount', 0] } }
        }
      }
    ]);
    
    const revenue = monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0;
    if (revenue < 1000 && revenue > 0) {
      alerts.push({
        id: 'low-revenue',
        type: 'warning',
        message: `Low monthly revenue: $${revenue.toFixed(2)} (target: $1000+)`,
        timestamp: now.toISOString()
      });
    }
    
    // If no alerts, show system health
    if (alerts.length === 0) {
      alerts.push({
        id: 'system-health',
        type: 'info',
        message: 'All systems operational - no issues detected',
        timestamp: now.toISOString()
      });
    }

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching system alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system alerts'
    });
  }
};

// Get user analytics for analytics dashboard
export const getUserAnalytics = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get users with their booking statistics
    const users = await User.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'mentorId',
          as: 'mentorBookings'
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'studentId',
          as: 'studentBookings'
        }
      },
      {
        $addFields: {
          totalSessions: { $size: { $concatArrays: ['$mentorBookings', '$studentBookings'] } },
          mentorSessions: { $size: '$mentorBookings' },
          studentSessions: { $size: '$studentBookings' },
          totalRevenue: {
            $sum: {
              $map: {
                input: '$mentorBookings',
                as: 'booking',
                in: { $ifNull: ['$$booking.amount', 0] }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          userType: 1,
          totalSessions: 1,
          mentorSessions: 1,
          studentSessions: 1,
          totalRevenue: 1,
          engagementScore: {
            $min: [100, {
              $add: [
                { $multiply: ['$totalSessions', 10] },
                { $multiply: ['$totalRevenue', 0.5] }
              ]
            }]
          }
        }
      },
      {
        $sort: { totalSessions: -1 }
      },
      {
        $limit: limit
      }
    ]);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics'
    });
  }
};

// Get content reports for moderation
export const getContentReports = async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Import Report model at the top of the file if not already done
    const { Report } = await import('../models/Report');
    
    const query: any = {};
    
    // Default to pending if no status is specified
    if (!status || status === 'all') {
      query.status = 'pending';
    } else {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      query.reportedModel = type === 'profile' ? 'User' : 'Service';
    }

    const reports = await Report.find(query)
      .populate('reporterId', 'firstName lastName email profileImage')
      .populate({
        path: 'reportedId',
        select: 'firstName lastName email profileImage title description'
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Transform to match frontend expectations
    const transformedReports = reports.map((report: any) => ({
      id: report._id,
      type: report.reportedModel === 'User' ? 'profile' : 'service',
      reportedUserId: report.reportedId?._id,
      reporterUserId: report.reporterId?._id,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      reportedUser: report.reportedId,
      reporterUser: report.reporterId,
      adminNotes: report.adminNotes
    }));

    res.json({
      success: true,
      data: transformedReports
    });
  } catch (error) {
    console.error('Error fetching content reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content reports'
    });
  }
};

// Handle content report actions
export const handleReportAction = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { action, reason } = req.body;

   if (!['dismiss', 'warn', 'suspend', 'delete'].includes(action)) {
      res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
      return;
    }

    const { Report } = await import('../models/Report');
    
    // Find the report
    const report = await Report.findById(reportId)
      .populate('reportedId');

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    // Update report status to resolved
    report.status = 'resolved';
    report.adminNotes = `Action taken: ${action}${reason ? ` - ${reason}` : ''}`;
    await report.save();

    const { notificationService } = await import('../services/notificationService');
    const reportedModel = report.reportedModel;
    const reportedId = report.reportedId;

    // Perform action on reported content/user
    switch (action) {
      case 'dismiss':
        // Just mark as resolved, no further action
        break;

      case 'warn':
        // Send a warning notification to the user
        const warnTargetId = reportedModel === 'User' ? (reportedId as any)._id : (reportedId as any).mentorId;
        if (warnTargetId) {
          await notificationService.createMultiTypeNotification(
            warnTargetId.toString(),
            'system',
            'Warning: Content Report',
            `Administrator has issued a warning regarding your ${reportedModel.toLowerCase()}. Reason: ${reason || report.reason}`,
            { reportId: report._id, action: 'warn' },
            'high'
          );
        }
        break;

      case 'suspend':
        // Suspend the user account
        const suspendTargetId = reportedModel === 'User' ? (reportedId as any)._id : (reportedId as any).mentorId;
        if (suspendTargetId) {
          await User.findByIdAndUpdate(suspendTargetId, {
            isActive: false,
            isBanned: true
          });
          
          await notificationService.createMultiTypeNotification(
            suspendTargetId.toString(),
            'system',
            'Account Suspended',
            `Your account has been suspended by an administrator due to violations. Reason: ${reason || report.reason}`,
            { reportId: report._id, action: 'suspend' },
            'urgent'
          );
        }
        break;

      case 'delete':
        // Delete the content
        if (reportedModel === 'Service') {
          await Service.findByIdAndDelete((reportedId as any)._id);
          
          const mentorId = (reportedId as any).mentorId;
          if (mentorId) {
            await notificationService.createMultiTypeNotification(
              mentorId.toString(),
              'system',
              'Content Deleted',
              `Your service "${(reportedId as any).title}" has been removed by an administrator to due a content report. Reason: ${reason || report.reason}`,
              { reportId: report._id, action: 'delete' },
              'high'
            );
          }
        } else if (reportedModel === 'User') {
          // For User, delete means ban/disable as we usually don't hard delete users
          await User.findByIdAndUpdate((reportedId as any)._id, {
            isActive: false,
            isBanned: true
          });
        }
        break;
    }

    res.json({
      success: true,
      message: `Report ${action} action completed successfully`
    });
  } catch (error) {
    console.error('Error handling report action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle report action'
    });
  }
};

// Get revenue by service category
export const getRevenueByCategory = async (req: Request, res: Response) => {
  try {
    // Get revenue by service category using aggregation
    const revenueByCategory = await Service.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'serviceId',
          as: 'bookings'
        }
      },
      {
        $addFields: {
          totalRevenue: {
            $sum: {
              $map: {
                input: '$bookings',
                as: 'booking',
                in: { $ifNull: ['$$booking.amount', 0] }
              }
            }
          },
          bookingCount: { $size: '$bookings' }
        }
      },
      {
        $group: {
          _id: '$category',
          totalRevenue: { $sum: '$totalRevenue' },
          totalBookings: { $sum: '$bookingCount' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Calculate percentages
    const totalRevenue = revenueByCategory.reduce((sum, cat) => sum + cat.totalRevenue, 0);
    const categoriesWithPercentage = revenueByCategory.map(cat => ({
      category: cat._id,
      revenue: cat.totalRevenue,
      bookings: cat.totalBookings,
      percentage: totalRevenue > 0 ? Math.round((cat.totalRevenue / totalRevenue) * 100) : 0
    }));

    res.json({
      success: true,
      data: categoriesWithPercentage
    });
  } catch (error) {
    console.error('Error fetching revenue by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue by category'
    });
  }
};

// Get user distribution by type
export const getUserDistribution = async (req: Request, res: Response) => {
  try {
    const userDistribution = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalUsers = userDistribution.reduce((sum, type) => sum + type.count, 0);
    const distributionWithPercentage = userDistribution.map(type => ({
      type: type._id,
      count: type.count,
      percentage: totalUsers > 0 ? Math.round((type.count / totalUsers) * 100) : 0
    }));

    res.json({
      success: true,
      data: distributionWithPercentage
    });
  } catch (error) {
    console.error('Error fetching user distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user distribution'
    });
  }
};

// Get user growth over time
export const getUserGrowth = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Format the data for the frontend
    const formattedGrowth = userGrowth.map(item => ({
      date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
      users: item.count
    }));

    res.json({
      success: true,
      data: formattedGrowth
    });
  } catch (error) {
    console.error('Error fetching user growth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user growth'
    });
  }
};

// Get full user profile for admin review
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    const user = await User.findById(userId).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires').lean();
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check for pending verification request
    const pendingRequest = await VerificationRequest.findOne({
      userId: user._id,
      status: 'pending_review'
    });

    const enrichedUser = {
      ...user,
      verificationRequestId: pendingRequest?._id,
      hasPendingVerification: !!pendingRequest,
      verificationDocuments: pendingRequest?.documents || []
    };

    res.json({
      success: true,
      data: enrichedUser
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Verify or reject user verification
export const updateUserVerification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { verified, verificationScore, notes } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    const updateData: any = {
      isVerified: verified,
      verificationScore: verificationScore || (verified ? 100 : 0)
    };

    if (verified) {
      updateData.verificationDate = new Date();
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Log the verification action (you could extend this to store notes in a separate collection)

    res.json({
      success: true,
      data: user,
      message: `User ${verified ? 'verified' : 'verification rejected'} successfully`
    });
  } catch (error) {
    console.error('Update user verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get all mentor earnings for admin dashboard
export const getAllMentorEarnings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { MentorEarningsService } = await import('../services/mentorEarningsService');
    const { CommissionService } = await import('../services/commissionService');
    
    const earningsData = await MentorEarningsService.getAllMentorEarnings();
    const platformStats = await MentorEarningsService.getPlatformStats();
    
    res.json({
      success: true,
      data: {
        mentorEarnings: earningsData,
        platformStats: platformStats
      }
    });
  } catch (error) {
    console.error('Error getting all mentor earnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mentor earnings data'
    });
  }
};

// Get platform statistics
export const getPlatformStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { MentorEarningsService } = await import('../services/mentorEarningsService');
    
    const platformStats = await MentorEarningsService.getPlatformStats();
    
    res.json({
      success: true,
      data: platformStats
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform statistics'
    });
  }
};
// Refund a transaction
export const refundTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const { reason = 'Admin refund' } = req.body;

    const booking = await Booking.findById(transactionId);
    if (!booking) {
      res.status(404).json({ success: false, error: 'Transaction/Booking not found' });
      return;
    }

    const result = await RefundService.processRefund({
      bookingId: transactionId,
      refundType: booking.paymentMethod === 'tokens' ? 'tokens' : 'payment_method',
      reason,
      cancelledBy: 'mentor' // Admin action treated as mentor cancellation for full refund
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error refunding transaction:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Process payout manually
export const processManualPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;

    const booking = await Booking.findById(transactionId).populate('mentorId', 'firstName lastName email');
    if (!booking) {
      res.status(404).json({ success: false, error: 'Transaction/Booking not found' });
      return;
    }

    if (booking.status !== 'completed') {
      res.status(400).json({ success: false, error: 'Only completed bookings can be paid out' });
      return;
    }

    await PayoutService.processBookingPayout(booking);

    res.json({
      success: true,
      message: 'Payout processed successfully'
    });
  } catch (error) {
    console.error('Error processing manual payout:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Retry a failed transaction (payout or payment)
export const retryFailedTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;

    const booking = await Booking.findById(transactionId).populate('mentorId', 'firstName lastName email');
    if (!booking) {
      res.status(404).json({ success: false, error: 'Transaction/Booking not found' });
      return;
    }

    // If payout failed, retry it
    if (booking.payoutStatus === 'failed' || (booking.status === 'completed' && booking.payoutStatus !== 'paid')) {
      await PayoutService.processBookingPayout(booking);
      res.json({
        success: true,
        message: 'Payout retry initiated'
      });
      return;
    }

    // For other types of retries, we might need more logic
    res.status(400).json({
      success: false,
      error: 'Transaction cannot be retried automatically'
    });
  } catch (error) {
    console.error('Error retrying transaction:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
