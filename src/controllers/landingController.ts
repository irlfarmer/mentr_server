import { Request, Response } from 'express';
import { Service } from '../models/Service';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Review } from '../models/Review';

// Get featured mentors (3-day rolling window of most active mentors)
export const getFeaturedMentors = async (req: Request, res: Response): Promise<void> => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get mentors with most interactions in the last 3 days
    const mentors = await User.aggregate([
      {
        $match: {
          userType: { $in: ['mentor', 'both'] },
          isVerified: true,
          mentorEarnings: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: 'mentorId',
          as: 'services'
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'mentorId',
          as: 'recentBookings'
        }
      },
      {
        $addFields: {
          recentBookings: {
            $filter: {
              input: '$recentBookings',
              cond: { $gte: ['$$this.createdAt', threeDaysAgo] }
            }
          },
          activeServices: {
            $filter: {
              input: '$services',
              cond: { $eq: ['$$this.isActive', true] }
            }
          }
        }
      },
      {
        $addFields: {
          interactionScore: {
            $add: [
              { $size: '$recentBookings' },
              { $multiply: [{ $size: '$activeServices' }, 0.5] }
            ]
          }
        }
      },
      {
        $match: {
          interactionScore: { $gt: 0 }
        }
      },
      {
        $sort: { interactionScore: -1 }
      },
      {
        $limit: 4
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          profileImage: 1,
          bio: 1,
          hourlyRate: 1,
          coldMessageRate: 1,
          skills: 1,
          verificationScore: 1,
          interactionScore: 1,
          activeServices: { $size: '$activeServices' }
        }
      }
    ]);

    // Get average ratings for each mentor
    const mentorsWithRatings = await Promise.all(
      mentors.map(async (mentor) => {
        const reviews = await Review.aggregate([
          {
            $lookup: {
              from: 'services',
              localField: 'serviceId',
              foreignField: '_id',
              as: 'service'
            }
          },
          {
            $match: {
              'service.mentorId': mentor._id
            }
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              reviewCount: { $sum: 1 }
            }
          }
        ]);

        const ratingData = reviews[0] || { averageRating: null, reviewCount: 0 };

        return {
          id: mentor._id.toString(),
          name: `${mentor.firstName} ${mentor.lastName}`,
          expertise: mentor.skills?.[0] || 'Professional Mentor',
          price: mentor.hourlyRate || 0,
          priceType: 'per hour',
          image: mentor.profileImage || '/api/placeholder/80/80',
          verified: mentor.verificationScore > 0.7,
          rating: ratingData.averageRating ? Math.round(ratingData.averageRating * 10) / 10 : 5,
          reviewCount: ratingData.reviewCount,
          activeServices: mentor.activeServices
        };
      })
    );

    res.json({
      success: true,
      data: mentorsWithRatings
    });
  } catch (error) {
    console.error('Error getting featured mentors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured mentors'
    });
  }
};

// Get platform statistics
export const getPlatformStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalMentors,
      totalSessions,
      totalServices
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ userType: { $in: ['mentor', 'both'] } }),
      Booking.countDocuments({ status: 'completed' }),
      Service.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMentors,
        totalSessions,
        totalServices
      }
    });
  } catch (error) {
    console.error('Error getting platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform statistics'
    });
  }
};

// Get category statistics
export const getCategoryStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Service.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const categoryMap: { [key: string]: string } = {
      'academic-tutoring': 'Academic Tutoring',
      'career-guidance': 'Career Guidance',
      'interview-prep': 'Interview Preparation',
      'skill-development': 'Skill Development',
      'mentorship': 'Mentorship',
      'consulting': 'Consulting',
      'other': 'Other'
    };

    const formattedCategories = categories.map(cat => ({
      id: cat._id,
      name: categoryMap[cat._id] || cat._id,
      count: `${cat.count}+ mentors`
    }));

    res.json({
      success: true,
      data: formattedCategories
    });
  } catch (error) {
    console.error('Error getting category stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category statistics'
    });
  }
};
