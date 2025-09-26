# Java Course Assessment System

A comprehensive, full-stack assessment platform for the Java QA Engineer course with database persistence, JWT authentication, and role-based access control.

## 🚀 Live Demo

**Production URL:** [https://java-course-assessments.vercel.app/](https://java-course-assessments.vercel.app/)

## 📋 Features

### 🔐 Authentication & Security
- **JWT-based authentication** with bcrypt password hashing
- **Role-based access control** (Student, Teacher, Admin)
- **Session management** with automatic token refresh
- **Protected routes** - all pages require authentication

### 👨‍🎓 Student Features
- **Interactive assessments** with multiple question types
- **Real-time code execution** using Judge0 API
- **Progress tracking** with auto-save functionality
- **Timed assessments** with visual countdown
- **Responsive design** for mobile and desktop

### 👨‍🏫 Teacher Dashboard
- **Student management** with registration tracking
- **Progress analytics** and performance metrics
- **Assessment statistics** and completion rates
- **User administration** capabilities

### 🗄️ Database Integration
- **PostgreSQL database** hosted on Vercel
- **Persistent data storage** for users, assessments, and results
- **Comprehensive schema** with proper relationships
- **Database initialization** with seeded assessment data

## 🏗️ Architecture

### Frontend
- **Vanilla JavaScript** with modern ES6+ features
- **Bootstrap 5** for responsive UI components
- **CodeMirror** for code editing interface
- **Client-side routing** with authentication guards

### Backend
- **Node.js serverless functions** on Vercel
- **RESTful API endpoints** with proper error handling
- **JWT authentication middleware**
- **PostgreSQL integration** with @vercel/postgres

### Deployment
- **Vercel hosting** with automatic deployments
- **Environment variable management**
- **CORS configuration** for cross-origin requests

## 📁 Project Structure

```
├── index.html                 # Login page (main entry point)
├── home.html                  # Authenticated home dashboard
├── package.json               # Dependencies and scripts
├── vercel.json               # Vercel deployment configuration
│
├── api/                      # Serverless API endpoints
│   ├── auth/
│   │   ├── login.js         # User authentication
│   │   ├── register.js      # User registration
│   │   └── verify.js        # Token verification
│   ├── init-db.js           # Database initialization
│   ├── stats.js             # Assessment statistics
│   ├── progress.js          # Student progress data
│   ├── assessments.js       # Assessment management
│   └── submissions.js       # Assessment submissions
│
├── src/
│   ├── assets/
│   │   ├── css/
│   │   │   └── assessment-styles.css
│   │   └── js/
│   │       └── auth-utils.js # Authentication utilities
│   │
│   ├── auth/                # Authentication pages
│   │   ├── login.html      # Login interface
│   │   └── register.html   # Registration interface
│   │
│   ├── assessments/        # Student assessment pages
│   │   └── step1-assessment.html
│   │
│   └── teacher-dashboard/  # Teacher interface
│       └── dashboard.html  # Main teacher dashboard
```

## 🗃️ Database Schema

### Core Tables
- **users** - User accounts with roles and authentication
- **assessments** - Assessment definitions and metadata
- **questions** - Question bank with multiple types
- **assessment_attempts** - Student attempt tracking
- **question_responses** - Individual question answers

## 🔧 Installation & Development

### Prerequisites
- Node.js 18.0.0 or higher
- Vercel account for deployment
- PostgreSQL database (Vercel Postgres recommended)

### Environment Variables
Create a `.env.local` file with:
```env
POSTGRES_URL=your_postgres_connection_string
JWT_SECRET=your_jwt_secret_key
JUDGE0_API_KEY=your_judge0_api_key
```

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Deploy to Vercel
vercel --prod
```

### Database Setup
1. Initialize the database schema by visiting `/api/init-db` (POST request)
2. This creates all tables and seeds initial assessment data
3. Database will be ready for user registration and assessments

## 🔐 Authentication Flow

1. **Landing Page**: `index.html` - Login interface
2. **Registration**: Create student/teacher accounts
3. **Authentication**: JWT tokens stored in localStorage
4. **Protected Access**: All pages redirect to login if not authenticated
5. **Role-based Features**: Teachers access dashboard, students access assessments

## 🎯 Assessment Types

### Multiple Choice
- Single correct answer selection
- Randomized option order
- Immediate feedback

### Code Reading
- Code snippet analysis
- Understanding output/behavior
- Multiple choice or text input

### Coding Challenges
- Full Java code implementation
- Judge0 API execution and testing
- Test case validation
- Real-time code editor with syntax highlighting

## 📊 Analytics & Reporting

### Student Progress
- Assessment completion rates
- Score tracking and averages
- Time spent analysis
- Last activity monitoring

### Teacher Dashboard
- Class-wide statistics
- Individual student progress
- Assessment performance metrics
- User management tools

## 🚀 Deployment

The application is deployed on Vercel with:
- **Automatic deployments** from main branch
- **Environment variable management** in Vercel dashboard
- **Serverless functions** for API endpoints
- **PostgreSQL integration** with connection pooling

## 🤝 Contributing

This is an educational project for the Java QA Engineer course. Features and assessments are continuously being added and improved.

## 📝 License

This project is for educational purposes as part of the Java QA Engineer course curriculum.

---

**Built with ❤️ for Java QA Engineer students**