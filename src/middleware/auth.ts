import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';

// Re-export AuthRequest for use in other modules
export { AuthRequest };

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'User account is deactivated'
      });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({
        success: false,
        error: 'User account has been banned'
      });
      return;
    }

    req.user = user as any;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive && !user.isBanned) {
      req.user = user as any;
    }
    
    next();
  } catch (error) {
    // If token is invalid, just proceed as guest
    next();
  }
};

export const requireVerified = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: 'Account verification required'
    });
    return;
  }
  next();
};

export const requireMentor = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.userType !== 'mentor' && req.user.userType !== 'both')) {
    res.status(403).json({
      success: false,
      error: 'Mentor access required'
    });
    return;
  }
  next();
};

export const requireStudent = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.userType !== 'student' && req.user.userType !== 'both')) {
    res.status(403).json({
      success: false,
      error: 'Student access required'
    });
    return;
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.userType !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }
  next();
};
