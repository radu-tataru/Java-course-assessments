/**
 * Student data API endpoint - consolidated
 * Handles user attempts and progress data
 *
 * GET /api/student-data?type=attempts&userId=123
 * GET /api/student-data?type=progress&userId=123
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

// Get user attempts
async function getUserAttempts(userId) {
    try {
        const result = await sql`
            SELECT
                aa.id,
                aa.assessment_id,
                aa.started_at,
                aa.submitted_at,
                aa.time_spent_seconds as duration,
                aa.score,
                aa.status,
                a.step_number as assessment_step,
                a.title as assessment_title
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            WHERE aa.user_id = ${userId}
            ORDER BY aa.started_at DESC
        `;
        return result.rows;
    } catch (error) {
        console.error('Database error in getUserAttempts:', error);
        throw error;
    }
}

// Get student progress
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
            // Get progress for all students
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
        const type = url.searchParams.get('type') || 'attempts';
        const requestedUserId = url.searchParams.get('userId');

        let targetUserId = user.id; // Default to logged-in user

        // Teachers and admins can view other users' data
        if (requestedUserId && (user.role === 'teacher' || user.role === 'admin')) {
            targetUserId = parseInt(requestedUserId);
        } else if (requestedUserId && user.role === 'student') {
            // Students can only view their own data
            return res.status(403).json({
                error: 'Access denied. You can only view your own data.'
            });
        }

        let result;
        switch (type) {
            case 'attempts':
                const attempts = await getUserAttempts(targetUserId);
                result = { attempts };
                break;

            case 'progress':
                const progress = await getStudentProgress(targetUserId);
                result = { progress };
                break;

            default:
                return res.status(400).json({ error: 'Invalid type parameter. Use: attempts or progress' });
        }

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Student data API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch student data',
            details: error.message
        });
    }
};
