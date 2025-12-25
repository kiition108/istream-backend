# 🎬 iStream Backend

A robust video streaming platform backend built with Node.js, Express, and MongoDB. Features include user authentication (local + Google OAuth), video management with admin approval, subscriptions, comments, and watch history.

---

## ✨ Features

### 👤 User Management
- **Email/Password Authentication** with OTP verification
- **Google OAuth 2.0** integration for seamless login
- JWT-based access & refresh tokens
- Role-based access control (User/Admin)
- Profile management (avatar, cover image, bio)

### 🎥 Video Features
- Video upload with thumbnail support
- Automatic duration extraction using FFmpeg
- Admin approval system for content moderation
- Public/private video toggle
- Video editing (title, description, thumbnail)
- Comment system with nested replies
- View count tracking
- Watch history

### 📺 Channel Features
- User channel profiles
- Subscriber/subscription management
- Paginated video listings
- Channel statistics (subscribers, videos count)

### ☁️ Cloud Integration
- Cloudinary for video & image storage
- Automatic file cleanup after upload

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT, Passport.js (Google OAuth)
- **File Upload:** Multer
- **Cloud Storage:** Cloudinary
- **Video Processing:** FFmpeg
- **Email:** Nodemailer
- **Security:** bcrypt, cookie-parser, CORS

---

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Cloudinary account
- Google OAuth credentials (optional, for OAuth login)
- FFmpeg installed on system

---

## 🚀 Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd istream-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Install FFmpeg
**Windows:**
- Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- Or use the project's included FFmpeg

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 4. Setup environment variables
Create a `.env` file in the root directory:

```env
# Server
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/istream
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# JWT
ACCESS_TOKEN_SECRET=your_access_token_secret_here
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRY=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# CORS
CORS_ORIGIN=http://localhost:3000

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/api/v1/users/auth/google/callback
```

### 5. Run the application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:8000`

---

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api/v1
```

### Authentication Endpoints

#### Register User
```http
POST /users/register
Content-Type: multipart/form-data

Fields:
- fullName: string
- email: string
- username: string
- password: string
- avatar: file (required)
- coverImage: file (optional)
```

#### Verify OTP
```http
POST /users/verify-otp
Content-Type: application/json

{
  "userId": "user_id",
  "otp": "123456"
}
```

#### Login
```http
POST /users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Google OAuth Login
```http
GET /users/auth/google
# Redirects to Google login page
```

#### Google OAuth Callback
```http
GET /users/auth/google/callback
# Handled automatically by Passport
```

#### Logout
```http
POST /users/logout
Authorization: Bearer <access_token>
```

#### Refresh Access Token
```http
POST /users/refresh-token
Cookie: refreshToken=<refresh_token>
```

### User Endpoints

#### Get Current User
```http
GET /users/current-user
Authorization: Bearer <access_token>
```

#### Update Account Details
```http
PATCH /users/update-account
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "fullName": "New Name",
  "username": "newusername",
  "description": "Bio"
}
```

#### Update Avatar
```http
PATCH /users/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

Fields:
- avatar: file
```

#### Get Channel Profile
```http
GET /users/c/:username?page=1&limit=9
```

#### Get Watch History
```http
GET /users/history
Authorization: Bearer <access_token>
```

### Video Endpoints

#### Upload Video
```http
POST /video/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

Fields:
- title: string
- description: string
- videoFile: file
- thumbnail: file
- isPublished: boolean (default: true)
```

#### List Videos
```http
GET /video?page=1&limit=9
Authorization: Bearer <access_token>
```

#### Get Video by ID
```http
GET /video/:id
```

#### Update Video
```http
PUT /video/:id
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

Fields:
- title: string (optional)
- description: string (optional)
- thumbnail: file (optional)
- isPublished: boolean (optional)
```

#### Delete Video
```http
DELETE /video/:id
Authorization: Bearer <access_token>
```

#### Toggle Video Approval (Admin)
```http
PATCH /video/approve/:videoId
Authorization: Bearer <admin_access_token>
```

#### Add Comment
```http
POST /video/:videoId/comment
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "text": "Great video!"
}
```

### Subscription Endpoints

#### Subscribe to Channel
```http
POST /subscriptions/:channelId
Authorization: Bearer <access_token>
```

#### Unsubscribe from Channel
```http
DELETE /subscriptions/:channelId
Authorization: Bearer <access_token>
```

#### Get User Subscriptions
```http
GET /subscriptions/get-subscriptions
Authorization: Bearer <access_token>
```

---

## 📁 Project Structure

```
istream-backend/
├── src/
│   ├── config/
│   │   └── passport.config.js      # Google OAuth configuration
│   ├── controllers/
│   │   ├── user.controller.js      # User auth & profile logic
│   │   ├── video.controller.js     # Video management logic
│   │   └── subscription.controller.js
│   ├── db/
│   │   └── index.js                # MongoDB connection
│   ├── middlewares/
│   │   ├── auth.middleware.js      # JWT verification
│   │   └── multer.middleware.js    # File upload handling
│   ├── models/
│   │   ├── user.model.js           # User schema
│   │   ├── video.model.js          # Video schema
│   │   └── subscription.model.js   # Subscription schema
│   ├── routes/
│   │   ├── user.routes.js          # User API routes
│   │   ├── video.routes.js         # Video API routes
│   │   └── subscription.routes.js
│   ├── utils/
│   │   ├── ApiError.js             # Custom error class
│   │   ├── ApiResponse.js          # Standard response format
│   │   ├── asyncHandler.js         # Async error wrapper
│   │   ├── cloudinary.js           # Cloudinary integration
│   │   ├── sendEmail.js            # Email service
│   │   └── errorHandler.js         # Global error handler
│   ├── app.js                      # Express app configuration
│   └── index.js                    # Server entry point
├── public/
│   └── temp/                       # Temporary upload folder
├── .env                            # Environment variables
├── .gitignore
├── package.json
└── README.md
```

---

## 🔐 Security Features

- **Password Hashing:** bcrypt with salt rounds
- **JWT Tokens:** Secure access & refresh token system
- **HTTP-Only Cookies:** Protection against XSS
- **CORS:** Configured for specific origins
- **Input Validation:** Request body validation
- **File Upload Limits:** 16kb JSON, file size restrictions
- **Role-Based Access:** Admin-only endpoints protected

---

## 🎨 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:8000/api/v1/users/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

For detailed instructions, see [Google OAuth Setup Guide](https://support.google.com/cloud/answer/6158849).

---

## 🧪 Testing

### Manual Testing
Use tools like:
- **Postman** - API testing
- **Thunder Client** (VS Code extension)
- **cURL** - Command line testing

### Test Flow
1. Register a new user
2. Verify OTP
3. Login and receive tokens
4. Upload a video
5. Admin approves video
6. View channel profile with videos
7. Test subscription features

---

## 🌐 Deployment

### Environment Variables
Update these for production:
- Set `NODE_ENV=production`
- Use production MongoDB URI
- Update `CORS_ORIGIN` to production frontend URL
- Set secure API keys and secrets

### Recommended Platforms
- **Render** - Easy Node.js deployment
- **Railway** - Simple setup with MongoDB
- **Heroku** - Classic PaaS
- **AWS EC2** - Full control
- **DigitalOcean** - Droplets or App Platform

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Cloudinary](https://cloudinary.com/)
- [Passport.js](http://www.passportjs.org/)
- [FFmpeg](https://ffmpeg.org/)

---

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Contact via email
- Check existing documentation

---

**Happy Coding! 🚀**
