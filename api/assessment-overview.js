/**
 * Assessment overview API endpoint
 * GET /api/assessment-overview
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

// Get assessment overview with completion stats
async function getAssessmentOverview() {
    try {
        const result = await sql`
            SELECT
                a.id,
                a.step_number as step,
                a.title,
                COUNT(CASE WHEN aa.status IN ('completed', 'submitted') THEN 1 END) as completed_count,
                ROUND(AVG(CASE WHEN aa.status IN ('completed', 'submitted') THEN aa.score END), 2) as average_score
            FROM assessments a
            LEFT JOIN assessment_attempts aa ON a.id = aa.assessment_id
            GROUP BY a.id, a.step_number, a.title
            ORDER BY a.step_number ASC
        `;

        return result.rows.map(row => ({
            id: row.id,
            step: row.step,
            title: row.title,
            completedCount: parseInt(row.completed_count) || 0,
            averageScore: parseFloat(row.average_score) || 0
        }));
    } catch (error) {
        console.error('Database error in getAssessmentOverview:', error);
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

        // Only teachers and admins can view overview
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const assessments = await getAssessmentOverview();

        return res.status(200).json({
            success: true,
            assessments
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Assessment overview API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch assessment overview',
            details: error.message
        });
    }
};
