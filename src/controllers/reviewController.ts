import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { Booking } from '../models/Booking';
import { AuthRequest } from '../types';

// Create a new review
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { bookingId, rating, comment } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!bookingId || !rating || !comment) {
      res.status(400).json({
        success: false,
        error: 'Booking ID, rating, and comment are required'
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
      return;
    }

    // Get the booking
    const booking = await Booking.findById(bookingId)
      .populate('serviceId', 'title')
      .populate('mentorId', 'firstName lastName')
      .populate('studentId', 'firstName lastName');

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is the student who made the booking
    const studentId = booking.studentId._id ? booking.studentId._id.toString() : booking.studentId.toString();
    
    if (studentId !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the student who made the booking can leave a review'
      });
      return;
    }

    // Check if booking is completed or reviewable
    if (!['completed', 'reviewable'].includes(booking.status)) {
      res.status(400).json({
        success: false,
        error: 'Can only review completed sessions'
      });
      return;
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      res.status(400).json({
        success: false,
        error: 'Review already exists for this booking'
      });
      return;
    }

    // Create the review
    const review = new Review({
      serviceId: booking.serviceId,
      studentId: booking.studentId,
      mentorId: booking.mentorId,
      bookingId: booking._id,
      rating,
      comment
    });

    await review.save();

    // Update booking status to reviewed after review is submitted
    if (booking.status === 'completed' || booking.status === 'reviewable') {
      booking.status = 'reviewed';
      await booking.save();
    }

    // Populate the review for response
    await review.populate([
      { path: 'serviceId', select: 'title' },
      { path: 'studentId', select: 'firstName lastName' },
      { path: 'mentorId', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review created successfully'
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
};

// Get reviews for a service
export const getServiceReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ serviceId })
      .populate('studentId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ serviceId });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get service reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
};

// Get reviews for a mentor
export const getMentorReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ mentorId })
      .populate('studentId', 'firstName lastName profileImage')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ mentorId });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get mentor reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
};

// Get user's reviews
export const getUserReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const reviews = await Review.find({ studentId: userId })
      .populate('serviceId', 'title')
      .populate('mentorId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ studentId: userId });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
};

// Update a review
export const updateReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      });
      return;
    }

    // Check if user is the author
    if (review.studentId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this review'
      });
      return;
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
        return;
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    res.json({
      success: true,
      data: review,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    });
  }
};

// Delete a review
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({
        success: false,
        error: 'Review not found'
      });
      return;
    }

    // Check if user is the author
    if (review.studentId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to delete this review'
      });
      return;
    }

    await Review.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review'
    });
  }
};
