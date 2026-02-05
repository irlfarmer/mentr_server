import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { SharedFile } from '../models/SharedFile';
import { Booking } from '../models/Booking';
import { AuthRequest } from '../types';

// Upload shared file
export const uploadSharedFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const { meetingId } = req.body;
    const userId = (req.user as any)?._id;

    if (!meetingId) {
      res.status(400).json({ success: false, message: 'Meeting ID is required' });
      return;
    }

    // Verify user is part of the meeting (optional but recommended)
    // For now assuming meetingId corresponds to a booking or daily room
    // You might want to lookup the booking here to verify participation

    // Upload to Cloudinary (using stream from memory storage or direct path if disk storage)
    // Since we're using the upload middleware which puts file in Cloudinary, we just need the info
    // However, we need to ensure we use the right middleware that returns the cloudinary info
    
    // NOTE: The route should use uploadMiddleware which populates req.file with cloudinary info
    const fileData = req.file as any;

    if (!fileData.path && !fileData.secure_url) {
      res.status(500).json({ success: false, message: 'File upload failed' });
      return;
    }

    // Calculate expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Determine file URL - use proxy for raw files (PDFs, docs)
    let fileUrl = fileData.path || fileData.secure_url;
    const isImage = fileData.mimetype?.startsWith('image/') && !fileData.mimetype?.includes('pdf');
    const isVideo = fileData.mimetype?.startsWith('video/');
    
    if (!isImage && !isVideo) {
      // For raw files, use the proxy URL
      const urlParts = fileUrl.split('/upload/');
      if (urlParts.length > 1) {
        const afterUpload = urlParts[1];
        const publicId = afterUpload.replace(/^v\d+\//, '');
        const baseUrl = process.env.API_URL || 'http://localhost:5000';
        fileUrl = `${baseUrl}/api/files/proxy/${encodeURIComponent(publicId)}`;
      }
    }

    // Create shared file record
    const sharedFile = await SharedFile.create({
      meetingId,
      uploaderId: userId,
      fileName: fileData.originalname,
      fileUrl: fileUrl,
      publicId: fileData.filename || fileData.public_id,
      resourceType: fileData.resource_type || 'auto',
      fileSize: fileData.size,
      fileType: fileData.mimetype,
      expiresAt
    });

    // Populate uploader info
    await sharedFile.populate('uploaderId', 'firstName lastName profileImage');

    res.json({
      success: true,
      data: sharedFile,
      message: 'File shared successfully'
    });

  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({ success: false, message: 'Failed to share file' });
  }
};

// Get files for a meeting
export const getMeetingFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meetingId } = req.params;

    const files = await SharedFile.find({ 
      meetingId,
      expiresAt: { $gt: new Date() } // Only get non-expired files
    })
    .populate('uploaderId', 'firstName lastName profileImage')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Error fetching meeting files:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch files' });
  }
};

// Proxy endpoint to serve raw files from Cloudinary (bypasses strict security)
export const proxyCloudinaryFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const publicId = decodeURIComponent(req.params.publicId as string);
    
    if (!publicId) {
      res.status(400).json({ success: false, message: 'Public ID is required' });
      return;
    }

    console.log('Proxy request for publicId:', publicId);
    
    // Determine file extension
    const ext = publicId.split('.').pop()?.toLowerCase() || 'pdf';

    // Use Cloudinary's utils to generate a time-limited authenticated URL
    const privateUrl = cloudinary.utils.private_download_url(publicId, ext, {
      resource_type: 'raw',
      type: 'upload',
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
    });

    console.log('Generated private download URL:', privateUrl);

    // Check if client wants redirect or JSON response
    const wantJson = req.query.json === 'true';
    
    if (wantJson) {
      // Return JSON with the URL (for frontend modal embedding)
      res.json({ success: true, url: privateUrl, filename: publicId.split('/').pop() });
    } else {
      // Redirect to the authenticated URL (for direct browser access)
      res.redirect(privateUrl);
    }

  } catch (error) {
    console.error('Error proxying file:', error);
    
    // Fallback: try direct redirect with signed URL
    try {
      const publicId = decodeURIComponent(req.params.publicId as string);
      const signedUrl = cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        sign_url: true,
        secure: true
      });
      console.log('Fallback signed URL:', signedUrl);
      
      if (req.query.json === 'true') {
        res.json({ success: true, url: signedUrl, filename: publicId.split('/').pop() });
      } else {
        res.redirect(signedUrl);
      }
    } catch (fallbackError) {
      res.status(500).json({ success: false, message: 'Failed to fetch file' });
    }
  }
};
