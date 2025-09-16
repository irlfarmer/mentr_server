import { v2 as cloudinary } from 'cloudinary';

export const uploadToCloudinary = async (file: any, folder: string): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: `mentr/${folder}`,
        public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as { secure_url: string; public_id: string });
      }
    );
    uploadStream.end(file.buffer);
  });
};
