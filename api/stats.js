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

        // Get completed assessments count
        const completedResult = await sql`
            SELECT COUNT(*) as completed
            FROM assessment_attempts
            WHERE status IN ('completed', 'submitted')
        `;

        // Get pending reviews count (completed but not yet reviewed)
        const pendingResult = await sql`
            SELECT COUNT(*) as pending
            FROM assessment_attempts
            WHERE status = 'submitted'
        `;

        // Get average score
        const avgScoreResult = await sql`
            SELECT ROUND(AVG(score), 2) as avg_score
            FROM assessment_attempts
            WHERE status IN ('completed', 'submitted') AND score IS NOT NULL
        `;

        // Get score distribution
        const distributionResult = await sql`
            SELECT
                COUNT(CASE WHEN score >= 90 THEN 1 END) as excellent,
                COUNT(CASE WHEN score >= 80 AND score < 90 THEN 1 END) as good,
                COUNT(CASE WHEN score >= 70 AND score < 80 THEN 1 END) as satisfactory,
                COUNT(CASE WHEN score < 70 THEN 1 END) as needs_improvement
            FROM assessment_attempts
            WHERE status IN ('completed', 'submitted') AND score IS NOT NULL
        `;

        const totalStudents = parseInt(studentsResult.rows[0].total_students) || 0;
        const completedAssessments = parseInt(completedResult.rows[0].completed) || 0;
        const pendingReviews = parseInt(pendingResult.rows[0].pending) || 0;
        const averageScore = parseFloat(avgScoreResult.rows[0].avg_score) || 0;

        const distribution = distributionResult.rows[0] || {
            excellent: 0,
            good: 0,
            satisfactory: 0,
            needs_improvement: 0
        };

        return {
            totalStudents,
            completedAssessments,
            pendingReviews,
            averageScore,
            scoreDistribution: {
                excellent: parseInt(distribution.excellent),
                good: parseInt(distribution.good),
                satisfactory: parseInt(distribution.satisfactory),
                needsImprovement: parseInt(distribution.needs_improvement)
            }
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