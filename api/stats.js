/**
 * Assessment statistics API endpoint
 * GET /api/stats
 */

const jwt = require('jsonwebtoken');
const { sql } = require('@vercel/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Function to verify JWT token
function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No token provided');
    }

    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        throw new Error('Invalid token');
    }
}

// Database function to get assessment statistics
async function getAssessmentStats() {
    try {
        // Get total students
        const studentsResult = await sql`
            SELECT COUNT(*) as total_students
            FROM users
            WHERE role = 'student'
        `;

        // Get total assessments
        const assessmentsResult = await sql`
            SELECT COUNT(*) as total_assessments
            FROM assessments
        `;

        // Get total attempts
        const attemptsResult = await sql`
            SELECT COUNT(*) as total_attempts
            FROM assessment_attempts
        `;

        // Get completed attempts
        const completedResult = await sql`
            SELECT COUNT(*) as completed_attempts
            FROM assessment_attempts
            WHERE status = 'submitted'
        `;

        return {
            totalStudents: parseInt(studentsResult.rows[0].total_students),
            totalAssessments: parseInt(assessmentsResult.rows[0].total_assessments),
            totalAttempts: parseInt(attemptsResult.rows[0].total_attempts),
            completedAttempts: parseInt(completedResult.rows[0].completed_attempts)
        };
    } catch (error) {
        console.error('Database error in getAssessmentStats:', error);
        throw error;
    }
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = verifyToken(req);

        // Only teachers and admins can view stats
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const stats = await getAssessmentStats();

        return res.status(200).json({
            success: true,
            stats
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get stats error:', error);
        return res.status(500).json({
            error: 'Failed to fetch statistics',
            details: error.message
        });
    }
};