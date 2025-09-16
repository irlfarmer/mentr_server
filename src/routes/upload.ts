import express from 'express';
import { uploadProfile, uploadService, deleteImage } from '../config/cloudinary';
import { authenticate } from '../middleware/auth';
import { User } from '../models/User';
import { Service } from '../models/Service';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// Upload profile picture
router.post('/profile-picture', authenticate, uploadProfile.single('profileImage'), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image uploaded' });
      return;
    }

    const userId = (req.user as any)?._id;
    
    // Update user's profile image in database
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage: req.file.path },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        imageUrl: req.file.path,
        publicId: req.file.filename,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: user.profileImage,
          userType: user.userType
        }
      },
      message: 'Profile picture updated successfully'
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Upload service images
router.post('/service-images', authenticate, uploadService.array('images', 5), async (req, res): Promise<void> => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ success: false, message: 'No images uploaded' });
      return;
    }

    const imageUrls = (req.files as Express.Multer.File[]).map(file => file.path);
    const publicIds = (req.files as Express.Multer.File[]).map(file => file.filename);

    res.json({
      success: true,
      data: {
        imageUrls,
        publicIds
      },
      message: 'Service images uploaded successfully'
    });
  } catch (error) {
    console.error('Service images upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Update service with images
router.patch('/service/:serviceId/images', authenticate, async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { images } = req.body;
    const userId = (req.user as any)?._id;
    

    // Find service and verify ownership
    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }


    if (service.mentorId.toString() !== userId.toString()) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Update service with new images
    service.images = images;
    await service.save();

    res.json({
      success: true,
      data: service,
      message: 'Service images updated successfully'
    });
  } catch (error) {
    console.error('Service images update error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// Delete image
router.delete('/image/:publicId', authenticate, async (req, res): Promise<void> => {
  try {
    const { publicId } = req.params;
    
    // Delete from Cloudinary
    const result = await deleteImage(publicId);
    
    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete image'
      });
    }
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({ success: false, message: 'Deletion failed' });
  }
});

// Configure multer for document uploads
const documentStorage = multer.memoryStorage();
const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'));
    }
  }
});

// Upload document (for education, work experience, skills verification)
router.post('/document', authenticate, documentUpload.single('file'), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const { documentType } = req.body;
    const userId = (req.user as any)?._id;

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: `mentr/documents/${userId}`,
          public_id: `${documentType}_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    res.json({
      success: true,
      url: (result as any).secure_url,
      publicId: (result as any).public_id,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

export default router;
