#!/bin/bash

# Java Course Assessment System - Deployment Script
# This script will guide you through the complete deployment process

echo "🚀 Java Course Assessment System - Deployment Script"
echo "=================================================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the java-course-assessment-system directory"
    exit 1
fi

echo "✅ Repository ready for deployment"
echo "📁 Current directory: $(pwd)"
echo

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
else
    echo "✅ Vercel CLI already installed: $(vercel --version | head -n1)"
fi

echo

# Login to Vercel
echo "🔐 Step 1: Login to Vercel"
echo "Please complete the authentication in your browser..."
vercel login

echo

# Deploy to production
echo "🚀 Step 2: Deploying to Vercel production..."
vercel --prod --yes

echo

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "your-app.vercel.app")

echo "✅ Deployment completed!"
echo "🌐 Your application is live at: https://$DEPLOYMENT_URL"
echo

echo "📋 Next Steps:"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Click on your project"
echo "3. Go to Settings → Storage → Create PostgreSQL database"
echo "4. Go to Settings → Environment Variables and add:"
echo "   - JWT_SECRET: $(openssl rand -hex 32 2>/dev/null || echo 'generate-32-char-secret')"
echo "   - JUDGE0_API_KEY: your-rapidapi-key (optional)"
echo "5. Redeploy: vercel --prod"
echo "6. Visit your site and initialize the database"
echo

echo "🎯 Manual Setup Guide:"
echo "https://$DEPLOYMENT_URL"
echo "1. Register a teacher account"
echo "2. Go to Teacher Dashboard"
echo "3. Click 'Initialize Database'"
echo "4. System ready for use!"

echo
echo "✨ Deployment script completed!"