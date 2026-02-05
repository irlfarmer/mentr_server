import { Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { LoginCredentials, RegisterData } from '../types';
import emailService from '../services/emailService';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, userType }: RegisterData = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
      return;
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      userType,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });

    await user.save();

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const emailSent = await emailService.sendVerificationEmail({
      name: user.firstName,
      email: user.email,
      verificationLink
    });

    // Generate tokens
    const accessToken = generateToken({
      userId: (user._id as any).toString(),
      email: user.email,
      userType: user.userType
    });
    
    const refreshToken = generateRefreshToken((user._id as any).toString());
    
    // Save refresh token
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      token: refreshToken,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      createdByIp: req.ip
    });
    
    await user.save();

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified,
          isOnboarded: user.isOnboarded
        },
        token: accessToken,
        refreshToken
      },
      message: emailSent 
        ? 'User registered successfully. Please check your email to verify your account.'
        : 'User registered successfully. Please check your email to verify your account. (Note: Email delivery may be delayed)'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginCredentials = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Generate tokens
    const accessToken = generateToken({
      userId: (user._id as any).toString(),
      email: user.email,
      userType: user.userType
    });

    const refreshToken = generateRefreshToken((user._id as any).toString());
    
    // Save refresh token
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      token: refreshToken,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      createdByIp: req.ip
    });

    // Limit number of refresh tokens (e.g., max 5 devices) (prevent infinite growth)
    if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        user,
        token: accessToken,
        refreshToken
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId || (req as any).user?._id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required'
      });
      return;
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id;
    const updateData = req.body;

    // Remove sensitive fields from update
    delete updateData.password;
    delete updateData.email;
    delete updateData.linkedinId;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
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

// LinkedIn OAuth - initiate login
export const linkedInAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_CALLBACK_URL;
    const clientUrl = process.env.CLIENT_URL;

    if (!clientId || !redirectUri) {
      res.status(500).json({
        success: false,
        error: 'LinkedIn OAuth not configured'
      });
      return;
    }

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store state in session or return it to client
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent('r_liteprofile r_emailaddress w_member_social')}`;

    res.status(200).json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error) {
    console.error('LinkedIn auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};


// Submit LinkedIn profile for manual verification
export const verifyLinkedInProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id;
    const { linkedinProfileUrl } = req.body;

    if (!linkedinProfileUrl) {
      res.status(400).json({
        success: false,
        error: 'LinkedIn profile URL is required'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Update user with LinkedIn data
    user.linkedinProfileUrl = linkedinProfileUrl;
    // Note: LinkedIn verification doesn't automatically grant the paid badge (isVerified)
    user.verificationScore = 0;
    user.verificationDate = new Date();
    
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        user,
        verification: {
          isVerified: user.isVerified,
          verificationScore: user.verificationScore,
          reasons: ['LinkedIn profile submitted for verification']
        }
      },
      message: 'LinkedIn profile submitted for admin verification'
    });
  } catch (error) {
    console.error('LinkedIn verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit LinkedIn profile for verification'
    });
  }
};

// Forgot password - send reset email
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const emailSent = await emailService.sendPasswordResetEmail({
      name: user.firstName,
      email: user.email,
      resetLink
    });

    res.status(200).json({
      success: true,
      message: emailSent 
        ? 'Password reset link sent to your email'
        : 'Password reset link sent to your email (Note: Email delivery may be delayed)'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Verify reset token
export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Reset token is required'
      });
      return;
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Reset token is valid'
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: 'Reset token and password are required'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
      return;
    }

    // Update user password and clear reset token
    // Pre-save hook will handle hashing
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Refresh Token Logic
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'Refresh token required' });
      return;
    }

    // Verify token
    const decoded = verifyToken(refreshToken);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    // Check if token exists in DB
    const tokenIndex = user.refreshTokens.findIndex(t => t.token === refreshToken);
    
    if (tokenIndex === -1) {
      // Token reuse detection could allow invalidating ALL tokens here for security
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Remove old token (Rotation)
    user.refreshTokens.splice(tokenIndex, 1);

    // Generate new tokens
    const newAccessToken = generateToken({
      userId: (user._id as any).toString(),
      email: user.email,
      userType: user.userType
    });
    
    const newRefreshToken = generateRefreshToken((user._id as any).toString());

    // Add new token
    user.refreshTokens.push({
      token: newRefreshToken,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      createdByIp: req.ip
    });

    await user.save();

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const userId = (req as any).user?._id;

    if (userId) {
       const user = await User.findById(userId);
       if (user) {
         if (refreshToken) {
             user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
             await user.save();
         }
       }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
};
