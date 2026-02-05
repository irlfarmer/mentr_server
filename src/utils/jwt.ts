import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = '15m'): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn
  } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: '7d'
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};
