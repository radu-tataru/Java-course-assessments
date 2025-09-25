# Java Assessment System - Deployment Guide

## Deployment Options

### Option 1: GitHub Pages (Static Hosting) ⭐ RECOMMENDED FOR EDUCATION

**Perfect for:** Classroom use, student access, basic functionality

**Features Available:**
- ✅ All question types (Multiple Choice, Code Reading, Code Completion, True/False)
- ✅ Student assessment interface
- ✅ Teacher dashboard and analytics
- ✅ Progress tracking and auto-save
- ⚠️ Coding challenges work but **no automatic testing** (manual review required)

**Setup Steps:**
1. **Enable GitHub Pages:**
   - Go to https://github.com/radu-tataru/java-assesments
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: Select `gh-pages`
   - Save

2. **Access Your Site:**
   - URL: https://radu-tataru.github.io/java-assesments/
   - Ready immediately - no configuration needed!

**Student Experience:**
- Take full assessments with immediate feedback
- Write code for coding challenges (submitted for teacher review)
- All progress tracking and analytics work perfectly

---

### Option 2: Full Functionality with Backend

**Perfect for:** Production use, automatic code testing, enterprise deployment

**Features Available:**
- ✅ Everything from GitHub Pages PLUS
- ✅ **Live code execution** with Judge0 API
- ✅ **Automatic test case validation**
- ✅ **Real-time compilation feedback**

## Backend Deployment Options

### A. Local Development Server

**Setup:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your Judge0 API key
npm start
```

**Access:** http://localhost:3000

### B. Heroku Deployment (FREE)

1. **Create Heroku App:**
```bash
heroku create your-java-assessment-backend
```

2. **Set Environment Variables:**
```bash
heroku config:set JUDGE0_API_KEY=your-rapidapi-key-here
```

3. **Deploy:**
```bash
git add backend/
git commit -m "Add backend for secure API deployment"
git subtree push --prefix backend heroku main
```

### C. Vercel Deployment (RECOMMENDED)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy Backend:**
```bash
cd backend
vercel
# Follow prompts, add JUDGE0_API_KEY as environment variable
```

3. **Update Frontend:**
   - Update `getBackendUrl()` in `judge0-integration-hybrid.js`
   - Replace with your Vercel URL

### D. Railway/Render.com

Similar process to Heroku but with different platforms.

---

## Security Best Practices

### ✅ What's Secure
- **GitHub Pages**: No API keys exposed (static files only)
- **Backend Deployment**: API keys stored as environment variables
- **Git Repository**: All sensitive data properly gitignored

### ⚠️ What NOT to Do
- **NEVER** put API keys in frontend JavaScript
- **NEVER** commit `.env` files to git
- **NEVER** expose Judge0 API key in client-side code

---

## Recommended Deployment Strategy

### For Educational Use (Most Common)
1. **Deploy to GitHub Pages** (5 minutes setup)
2. **Tell students**: "Code execution is for learning - write your best code"
3. **Teachers**: Review coding challenges manually
4. **Result**: 95% functionality with zero cost and complexity

### For Production Use
1. **GitHub Pages** for the frontend
2. **Vercel/Heroku** for the backend with API keys
3. **Update frontend** to use backend URL
4. **Result**: 100% functionality with secure API management

---

## Current Status

### ✅ Ready for GitHub Pages
- **Branch**: `gh-pages` created and pushed
- **URL**: https://radu-tataru.github.io/java-assesments/
- **Status**: Fully functional for educational use

### ✅ Ready for Backend Deployment
- **Node.js Backend**: Complete and tested
- **Environment Config**: Secure API key management
- **Hybrid Frontend**: Automatically detects and uses backend when available

---

## Quick Start

### Option 1: Educational Use (5 minutes)
1. Go to your GitHub repository settings
2. Enable Pages from `gh-pages` branch
3. Share the GitHub Pages URL with students
4. Done! ✨

### Option 2: Full Production (30 minutes)
1. Deploy backend to Vercel/Heroku
2. Update frontend backend URL
3. Deploy frontend to GitHub Pages
4. Full functionality with secure API keys

---

## Cost Analysis

| Option | Cost | Features | Setup Time | Maintenance |
|--------|------|----------|------------|-------------|
| GitHub Pages Only | **FREE** | 90% | 5 min | None |
| GitHub Pages + Backend | **FREE** (with free tiers) | 100% | 30 min | Minimal |
| Custom Server | $5-20/month | 100% | 2+ hours | Regular |

## Support

- **Documentation**: Complete in PROJECT_CONTEXT.md
- **Issues**: Track in GitHub Issues
- **Updates**: Regular commits with clear history

**Recommendation**: Start with GitHub Pages for immediate use, add backend later if needed.