import { Request, Response } from 'express';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Service } from '../models/Service';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

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
            scheduledAt: { $gte: startOfThisMonth, $lte: endOfThisMonth },
            status: { $in: ['completed', 'reviewable', 'reviewed'] }
          }
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service'
          }
        },
        {
          $unwind: '$service'
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
            scheduledAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            status: { $in: ['completed', 'reviewable', 'reviewed'] }
          }
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service'
          }
        },
        {
          $unwind: '$service'
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$amount', 0] } }
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

    const currentRevenue = revenueThisMonth.length > 0 ? revenueThisMonth[0].totalRevenue : 0;
    const lastRevenue = revenueLastMonth.length > 0 ? revenueLastMonth[0].totalRevenue : 0;
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
      .select('firstName lastName email userType isVerified isActive isBanned createdAt profileImage')
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
    const users = await User.find({
      isVerified: false,
      userType: { $in: ['mentor', 'both'] }
    })
      .select('firstName lastName email userType isVerified isActive isBanned linkedinProfileUrl createdAt profileImage')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: users
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
      amount: (booking.serviceId as any)?.hourlyRate || 0,
      status: 'completed',
      createdAt: booking.scheduledAt,
      mentor: booking.mentorId,
      student: booking.studentId
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
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email userType isVerified isActive isBanned createdAt profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
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
    
    // For now, return mock data since we don't have a reports collection yet
    // In a real implementation, you'd have a Reports collection
    const mockReports = [
      {
        id: '1',
        type: 'profile',
        reportedUserId: 'user1',
        reporterUserId: 'user2',
        reason: 'Fake profile',
        description: "The profile contains false information and is misleading.",
        status: 'pending',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        reportedUser: {
          firstName: 'Cameron',
          lastName: 'Wong',
          email: 'cameron@example.com',
          userType: 'mentor'
        },
        reporterUser: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john@example.com'
        }
      },
      {
        id: '2',
        type: 'service',
        reportedUserId: 'user3',
        reporterUserId: 'user4',
        reason: 'Inappropriate content',
        description: "The service description contains inappropriate language.",
        status: 'pending',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        reportedUser: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah@example.com',
          userType: 'mentor'
        },
        reporterUser: {
          firstName: 'Mike',
          lastName: 'Brown',
          email: 'mike@example.com'
        }
      },
      {
        id: '3',
        type: 'message',
        reportedUserId: 'user5',
        reporterUserId: 'user6',
        reason: 'Harassment',
        description: "Received inappropriate messages during a session.",
        status: 'resolved',
        createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        reportedUser: {
          firstName: 'David',
          lastName: 'Wilson',
          email: 'david@example.com',
          userType: 'mentor'
        },
        reporterUser: {
          firstName: 'Emma',
          lastName: 'Davis',
          email: 'emma@example.com'
        }
      }
    ];

    // Filter by type and status if provided
    let filteredReports = mockReports;
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    if (status) {
      filteredReports = filteredReports.filter(report => report.status === status);
    }

    res.json({
      success: true,
      data: filteredReports.slice(0, limit)
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

    // In a real implementation, you'd update the report status in the database
    // For now, we'll just return success

    res.json({
      success: true,
      message: `Report ${action} successfully`
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

    const user = await User.findById(userId).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');
    
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
