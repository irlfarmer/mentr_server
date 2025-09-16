import { Request, Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';

// Get user profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
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
      data: user,
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get public user profile (no authentication required)
export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    const user = await User.findById(userId).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires -email -phone -isBanned');
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      message: 'Public profile retrieved successfully'
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update user availability
export const updateAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { availability } = req.body;

    if (!availability || !Array.isArray(availability)) {
      res.status(400).json({
        success: false,
        error: 'Availability array is required'
      });
      return;
    }

    // Validate availability data
    for (const slot of availability) {
      if (!slot.day || !slot.startTime || !slot.endTime) {
        res.status(400).json({
          success: false,
          error: 'Each availability slot must have day, startTime, and endTime'
        });
        return;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        res.status(400).json({
          success: false,
          error: 'Time must be in HH:MM format'
        });
        return;
      }

      // Ensure end time is after start time
      if (slot.startTime >= slot.endTime) {
        res.status(400).json({
          success: false,
          error: `End time must be after start time for ${slot.day}`
        });
        return;
      }

      // Ensure timezone is provided
      if (!slot.timezone) {
        res.status(400).json({
          success: false,
          error: 'Each availability slot must have a timezone'
        });
        return;
      }
    }

    // Extract timezone from request body if provided
    const { timezone } = req.body;
    
    const updateData: any = { availability };
    if (timezone) {
      updateData.timezone = timezone;
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

    res.json({
      success: true,
      data: user,
      message: 'Availability updated successfully'
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const {
      firstName,
      lastName,
      bio,
      userType,
      skills,
      hourlyRate,
      coldMessageRate,
      availability,
      linkedinProfileUrl,
      // Professional fields
      professionalHeadline,
      currentCompany,
      currentPosition,
      workExperience,
      // Student-specific fields
      learningInterests,
      educationBackground,
      careerGoals
    } = req.body;

    const updateData: any = {};
    
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (userType) updateData.userType = userType;
    if (skills) updateData.skills = skills;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (coldMessageRate !== undefined) updateData.coldMessageRate = coldMessageRate;
    if (availability) updateData.availability = availability;
    if (linkedinProfileUrl) updateData.linkedinProfileUrl = linkedinProfileUrl;
    if (professionalHeadline) updateData.professionalHeadline = professionalHeadline;
    if (currentCompany) updateData.currentCompany = currentCompany;
    if (currentPosition) updateData.currentPosition = currentPosition;
    if (workExperience) {
      // Filter out empty work experience entries while preserving all fields including documents
      const filteredWorkExperience = workExperience.filter((work: any) => {
        // Convert year to number if it's a string (e.g., "2025-07" -> 2025)
        const startYear = typeof work.startDate?.year === 'string' 
          ? parseInt(work.startDate.year.split('-')[0]) 
          : work.startDate?.year;
        
        const isValid = work.company && work.company.trim() !== '' &&
          work.position && work.position.trim() !== '' &&
          work.startDate && startYear && startYear > 0;
        
        return isValid;
      }).map((work: any) => {
        // Convert year strings to numbers for MongoDB
        const startYear = typeof work.startDate?.year === 'string' 
          ? parseInt(work.startDate.year.split('-')[0]) 
          : work.startDate?.year;
        const endYear = typeof work.endDate?.year === 'string' 
          ? parseInt(work.endDate.year.split('-')[0]) 
          : work.endDate?.year;

        return {
          // Preserve all fields including documents
          company: work.company,
          position: work.position,
          description: work.description || '',
          location: work.location || '',
          startDate: {
            year: startYear,
            month: work.startDate?.month || 1
          },
          endDate: {
            year: endYear,
            month: work.endDate?.month || 1
          },
          isCurrent: work.isCurrent || false,
          documents: work.documents || [] // Preserve documents array
        };
      });
      
      updateData.workExperience = filteredWorkExperience;
    }
    
    // Handle student-specific fields
    if (learningInterests !== undefined) updateData.learningInterests = learningInterests;
    if (educationBackground !== undefined) {
      // Filter out empty education entries while preserving all fields including documents
      updateData.educationBackground = educationBackground.filter((edu: any) => {
        // Convert year to number if it's a string
        const year = typeof edu.year === 'string' 
          ? parseInt(edu.year.split('-')[0]) 
          : edu.year;
        
        const isValid = edu.school && edu.school.trim() !== '' &&
          edu.degree && edu.degree.trim() !== '' &&
          edu.field && edu.field.trim() !== '' &&
          year && year > 0;
        
        return isValid;
      }).map((edu: any) => {
        // Convert year to number for MongoDB
        const year = typeof edu.year === 'string' 
          ? parseInt(edu.year.split('-')[0]) 
          : edu.year;

        return {
          // Preserve all fields including documents
          school: edu.school,
          degree: edu.degree,
          field: edu.field,
          year: year,
          isCurrent: edu.isCurrent || false,
          documents: edu.documents || [] // Preserve documents array
        };
      });
      
    }
    if (careerGoals !== undefined) updateData.careerGoals = careerGoals;
    
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

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Upload profile image
export const uploadProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // TODO: Implement file upload to AWS S3
    // For now, we'll accept a URL
    const { imageUrl } = req.body;

    if (!imageUrl) {
      res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage: imageUrl },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      message: 'Profile image updated successfully'
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Add document
export const addDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { type, url, name } = req.body;

    if (!type || !url || !name) {
      res.status(400).json({
        success: false,
        error: 'Type, URL, and name are required'
      });
      return;
    }

    const document = {
      type,
      url,
      name,
      uploadedAt: new Date()
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { documents: document } },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      message: 'Document added successfully'
    });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove document
export const removeDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { documentId } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { documents: { _id: documentId } } },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      message: 'Document removed successfully'
    });
  } catch (error) {
    console.error('Remove document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};


// Get mentor availability by mentor ID
export const getMentorAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId } = req.params;

    if (!mentorId) {
      res.status(400).json({
        success: false,
        error: 'Mentor ID is required'
      });
      return;
    }

    const user = await User.findById(mentorId)
      .select('availability timezone firstName lastName')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Mentor not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        availability: user.availability || [],
        timezone: user.timezone || 'UTC',
        mentorName: `${user.firstName} ${user.lastName}`
      },
      message: 'Mentor availability retrieved successfully'
    });
  } catch (error) {
    console.error('Get mentor availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Search profiles
export const searchProfiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userType,
      skills,
      minRate,
      maxRate,
      isVerified,
      page = 1,
      limit = 10
    } = req.query;

    const query: any = { isActive: true };

    if (userType) query.userType = userType;
    if (skills) query.skills = { $in: Array.isArray(skills) ? skills : [skills] };
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = Number(minRate);
      if (maxRate) query.hourlyRate.$lte = Number(maxRate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(query)
      .select('firstName lastName bio userType linkedinProfileUrl skills hourlyRate isVerified verificationDate profileImage')
      .skip(skip)
      .limit(Number(limit))
      .sort({ isVerified: -1, hourlyRate: 1 })
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      },
      message: 'Profiles retrieved successfully'
    });
  } catch (error) {
    console.error('Search profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
