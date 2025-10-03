/**
 * Recent activity and top performers API endpoint
 * GET /api/recent-activity
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

// Get recent activity
async function getRecentActivity() {
    try {
        const result = await sql`
            SELECT
                u.first_name || ' ' || u.last_name as student_name,
                a.title as assessment_title,
                aa.status,
                aa.score,
                aa.started_at as timestamp,
                aa.submitted_at
            FROM assessment_attempts aa
            JOIN users u ON aa.user_id = u.id
            JOIN assessments a ON aa.assessment_id = a.id
            ORDER BY aa.started_at DESC
            LIMIT 10
        `;

        return result.rows.map(row => {
            let action = '';
            if (row.status === 'in_progress') {
                action = `Started ${row.assessment_title}`;
            } else if (row.status === 'completed' || row.status === 'submitted') {
                action = `Completed ${row.assessment_title} - Score: ${row.score || 0}%`;
            }

            return {
                studentName: row.student_name,
                action,
                timestamp: row.timestamp
            };
        });
    } catch (error) {
        console.error('Database error in getRecentActivity:', error);
        throw error;
    }
}

// Get top performers
async function getTopPerformers() {
    try {
        const result = await sql`
            SELECT
                u.id,
                u.first_name || ' ' || u.last_name as name,
                COUNT(CASE WHEN aa.status IN ('completed', 'submitted') THEN 1 END) as completed_assessments,
                ROUND(AVG(CASE WHEN aa.status IN ('completed', 'submitted') THEN aa.score END), 2) as average_score
            FROM users u
            LEFT JOIN assessment_attempts aa ON u.id = aa.user_id
            WHERE u.role = 'student'
            GROUP BY u.id, u.first_name, u.last_name
            HAVING COUNT(CASE WHEN aa.status IN ('completed', 'submitted') THEN 1 END) > 0
            ORDER BY average_score DESC, completed_assessments DESC
            LIMIT 10
        `;

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            completedAssessments: parseInt(row.completed_assessments),
            averageScore: parseFloat(row.average_score) || 0
        }));
    } catch (error) {
        console.error('Database error in getTopPerformers:', error);
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

        // Only teachers and admins can view activity
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const [activities, topPerformers] = await Promise.all([
            getRecentActivity(),
            getTopPerformers()
        ]);

        return res.status(200).json({
            success: true,
            activities,
            topPerformers
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Recent activity API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch recent activity',
            details: error.message
        });
    }
};
