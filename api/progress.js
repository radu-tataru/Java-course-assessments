/**
 * Student progress API endpoint
 * GET /api/progress
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

// Database function to get student progress
async function getStudentProgress(userId = null) {
    try {
        if (userId) {
            // Get progress for specific user
            const result = await sql`
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    u.created_at as registered_at,
                    COUNT(DISTINCT aa.id) as total_attempts,
                    COUNT(DISTINCT CASE WHEN aa.status = 'submitted' THEN aa.id END) as completed_attempts,
                    COALESCE(AVG(CASE WHEN aa.status = 'submitted' THEN aa.percentage END), 0) as avg_score,
                    MAX(aa.submitted_at) as last_activity
                FROM users u
                LEFT JOIN assessment_attempts aa ON u.id = aa.user_id
                WHERE u.id = ${userId} AND u.role = 'student'
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id, u.created_at
            `;

            return result.rows.map(row => ({
                id: row.id,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                student_id: row.student_id,
                registered_at: row.registered_at,
                assessments_taken: parseInt(row.total_attempts),
                completed_attempts: parseInt(row.completed_attempts),
                avg_score: parseFloat(row.avg_score).toFixed(1),
                last_submission: row.last_activity
            }));
        } else {
            // Get progress for all students - first get basic user data
            const result = await sql`
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    u.created_at as registered_at
                FROM users u
                WHERE u.role = 'student'
                ORDER BY u.last_name, u.first_name
            `;

            // For now, return basic student data with zero attempts
            // TODO: Implement assessment_attempts table join when it has data
            return result.rows.map(row => ({
                id: row.id,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                student_id: row.student_id,
                registered_at: row.registered_at,
                assessments_taken: 0,
                completed_attempts: 0,
                avg_score: '0.0',
                last_submission: null
            }));
        }
    } catch (error) {
        console.error('Database error in getStudentProgress:', error);
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

        const url = new URL(req.url, `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId');

        // Students can only view their own progress
        const targetUserId = (user.role === 'student') ? user.id : (userId ? parseInt(userId) : null);

        const progress = await getStudentProgress(targetUserId);

        return res.status(200).json({
            success: true,
            progress
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get progress error:', error);
        return res.status(500).json({
            error: 'Failed to fetch progress',
            details: error.message
        });
    }
};