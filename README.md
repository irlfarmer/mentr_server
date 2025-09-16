# Mentr Backend Server

A Node.js/Express backend server for the Mentr mentorship marketplace platform, built with TypeScript and MongoDB.

## 🚀 Features

- **Authentication**: Email/password and LinkedIn OAuth
- **User Management**: Profile creation, verification, and management
- **Real-time Communication**: Socket.io for messaging and notifications
- **Database**: MongoDB with Mongoose ODM
- **Security**: JWT tokens, password hashing, CORS, Helmet
- **TypeScript**: Full type safety and modern JavaScript features

## 🛠 Tech Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, bcryptjs, Passport.js
- **Real-time**: Socket.io
- **Security**: Helmet, CORS
- **File Upload**: Multer, AWS S3
- **Email**: Nodemailer
- **Payments**: Stripe (planned)
- **Video Calls**: Daily.co API (planned)

## 📁 Project Structure

```
src/
├── controllers/     # Request handlers
├── models/          # Database schemas
├── middleware/      # Custom middleware
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── types/           # TypeScript interfaces
└── index.ts         # Server entry point

config/
└── database.ts      # Database configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd mentr/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/mentr
   JWT_SECRET=your-super-secret-jwt-key
   CLIENT_URL=http://localhost:3000
   ```

4. **Development**
   ```bash
   npm run dev
   ```

5. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/linkedin` - LinkedIn OAuth (planned)
- `GET /api/auth/profile/:userId?` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Health Check
- `GET /health` - Server health status

## 🔧 Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (planned)
- `npm run lint` - Run ESLint (planned)

### Database

The server connects to MongoDB using Mongoose. Make sure MongoDB is running locally or update the `MONGODB_URI` in your `.env` file.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/mentr` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

## 🔒 Security

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **CORS**: Configured for frontend communication
- **Helmet**: Security headers
- **Input Validation**: Request body validation (planned)

## 📡 Real-time Features

Socket.io is configured for:
- Real-time messaging
- Live notifications
- Booking status updates
- Video call signaling

## 🚧 Planned Features

- **LinkedIn OAuth**: Profile verification and import
- **File Upload**: Resume, certificates, profile images
- **Payment Integration**: Stripe for session payments
- **Video Calls**: Daily.co integration
- **Email Service**: Nodemailer for notifications
- **Admin Panel**: User management and moderation

## 🤝 Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Update documentation for API changes
4. Test thoroughly before submitting

## 📄 License

MIT License - see LICENSE file for details
