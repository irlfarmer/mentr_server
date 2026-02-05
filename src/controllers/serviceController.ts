import { Request, Response } from 'express';
import { Service } from '../models/Service';
import { Review } from '../models/Review';
import { AuthRequest } from '../types';
import { sanitizeUser } from '../utils/masking';

// Helper function to calculate average rating for services
const calculateServiceRatings = async (services: any[]) => {
  const servicesWithRatings = await Promise.all(
    services.map(async (service) => {
      const reviews = await Review.find({ serviceId: service._id });
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : null;
      
      const serviceObj = service.toObject() as any;
      if (serviceObj.mentor) {
        serviceObj.mentor = sanitizeUser(serviceObj.mentor);
      }
      
      return {
        ...serviceObj,
        rating: averageRating,
        reviewCount: reviews.length
      };
    })
  );
  
  return servicesWithRatings;
};

// Create a new service
export const createService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { title, description, category, tags, hourlyRate, duration, images } = req.body;

    // Validate required fields
    if (!title || !description || !category || !hourlyRate) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    const service = new Service({
      mentorId: userId,
      title,
      description,
      category,
      tags: tags || [],
      hourlyRate: Number(hourlyRate),
      duration: Number(duration) || 60,
      images: images || []
    });

    await service.save();

    res.status(201).json({
      success: true,
      data: service,
      message: 'Service created successfully'
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get all services with filtering and search
export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = { isActive: true };

    // Search functionality
    if (search) {
      query.$text = { $search: search as string };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.hourlyRate = {};
      if (minPrice) query.hourlyRate.$gte = Number(minPrice);
      if (maxPrice) query.hourlyRate.$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = { [sortBy as string]: sortOrder === 'desc' ? -1 : 1 };

    const services = await Service.find(query)
      .populate('mentor', 'firstName lastName profileImage bio userType hourlyRate coldMessageRate timezone isVerified verificationScore isAnonymous anonymityReason')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Service.countDocuments(query);

    // Calculate ratings for each service
    const servicesWithRatings = await calculateServiceRatings(services);

    res.json({
      success: true,
      data: servicesWithRatings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get a single service by ID
export const getService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id)
      .populate('mentor', 'firstName lastName profileImage bio userType skills hourlyRate coldMessageRate timezone isVerified verificationScore isAnonymous anonymityReason');

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    // Calculate rating for this service
    const servicesWithRatings = await calculateServiceRatings([service]);
    const serviceWithRating = servicesWithRatings[0];

    res.json({
      success: true,
      data: serviceWithRating
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update a service
export const updateService = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const service = await Service.findById(id);

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    // Check if user owns the service
    if (service.mentorId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this service'
      });
      return;
    }

    const updatedService = await Service.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedService,
      message: 'Service updated successfully'
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Delete a service (soft delete by setting isActive to false)
export const deleteService = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const service = await Service.findById(id);

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    // Check if user owns the service
    if (service.mentorId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to delete this service'
      });
      return;
    }

    service.isActive = false;
    await service.save();

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get services by mentor
export const getServicesByMentor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId } = req.params;
    const { isActive } = req.query;

    const query: any = { mentorId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const services = await Service.find(query)
      .populate('mentor', 'firstName lastName profileImage bio userType isVerified verificationScore isAnonymous anonymityReason')
      .sort({ createdAt: -1 });

    const sanitizedServices = services.map(service => {
      const s = service.toObject() as any;
      if (s.mentor) s.mentor = sanitizeUser(s.mentor);
      return s;
    });

    res.json({
      success: true,
      data: sanitizedServices
    });
  } catch (error) {
    console.error('Get services by mentor error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get service categories
export const getServiceCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = [
      { value: 'academic-tutoring', label: 'Academic Tutoring' },
      { value: 'career-guidance', label: 'Career Guidance' },
      { value: 'interview-prep', label: 'Interview Preparation' },
      { value: 'skill-development', label: 'Skill Development' },
      { value: 'mentorship', label: 'Mentorship' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'other', label: 'Other' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
