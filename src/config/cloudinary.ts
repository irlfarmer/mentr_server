import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to generate signed URL for raw files
export const generateSignedUrl = (publicId: string, resourceType: string = 'raw'): string => {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'upload',
    sign_url: true,
    secure: true
  });
};

// Create storage configuration for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mentr-marketplace/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  } as any
});

// Create storage configuration for service images
const serviceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mentr-marketplace/services',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  } as any
});

// Create multer upload middleware for profile pictures
export const uploadProfile = multer({ 
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!') as any, false);
    }
  }
});

// Create multer upload middleware for service images
export const uploadService = multer({ 
  storage: serviceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for service images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!') as any, false);
    }
  }
});

// Create storage configuration for shared files (ephemeral)
const shareStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mentr/temp', // Separate folder for temp files
    resource_type: 'auto', // Allow any file type (documents, images, etc.)
    // No transformation for raw files
  } as any
});

// Create multer upload middleware for shared files
export const uploadShared = multer({ 
  storage: shareStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow documents and images
    const allowedTypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop() || '');
    const mimetype = allowedTypes.test(file.mimetype.split('/')[1]);
    
    // Just check extension for simplicity as mime types can vary
    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as any, false);
    }
  }
});

// Create storage configuration for message attachments (permanent)
const messageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('pdf');
    const isVideo = file.mimetype.startsWith('video/');
    
    const nameWithoutExt = file.originalname.split('.').slice(0, -1).join('.');
    const ext = file.originalname.split('.').pop();
    // For raw files (and videos to be safe), we must preserve extension in public_id
    const publicId = `${nameWithoutExt}-${Date.now()}${(!isImage && ext) ? '.' + ext : ''}`;

    return {
      folder: 'mentr/messages',
      resource_type: isImage ? 'image' : (isVideo ? 'video' : 'raw'),
      public_id: publicId,
      type: 'upload', // Explicitly public
      access_mode: 'public'
    };
  }
});

// Create multer upload middleware for message attachments
export const uploadMessage = multer({ 
  storage: messageStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow documents, images, and videos
    const allowedTypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|gif|mp4|mov|webm|avi/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop() || '');
    const mimetype = allowedTypes.test(file.mimetype.split('/')[1]) || file.mimetype.startsWith('video/');
    
    // Just check extension for simplicity as mime types can vary
    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as any, false);
    }
  }
});

// Helper function to delete image from Cloudinary
export const deleteResource = async (publicId: string, resourceType: string = 'image') => {
  try {
    // Cloudinary destroy API requires specific resource_type (image, video, raw). 'auto' is not allowed.
    if (resourceType === 'auto') {
        // Try deleting as image first
        try {
            return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (e) {
            // Try raw
            try {
                return await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            } catch (k) {
                 // Try video
                return await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
            }
        }
    }
    
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error(`Error deleting ${resourceType} from Cloudinary:`, error);
    throw error;
  }
};

// Kept for backward compatibility
export const deleteImage = async (publicId: string) => deleteResource(publicId, 'image');

export default cloudinary;
