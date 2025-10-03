/**
 * Analytics API endpoint - consolidated
 * Handles stats, recent activity, and assessment overview
 *
 * GET /api/analytics?type=stats
 * GET /api/analytics?type=activity
 * GET /api/analytics?type=overview
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

// Get assessment statistics
async function getAssessmentStats() {
    try {
        const studentsResult = await sql`
            SELECT COUNT(*) as total_students
            FROM users
            WHERE role = 'student'
        `;

        const completedResult = await sql`
            SELECT COUNT(*) as completed
            FROM assessment_attempts
            WHERE status IN ('completed', 'submitted')
        `;

        const pendingResult = await sql`
            SELECT COUNT(*) as pending
            FROM assessment_attempts
            WHERE status = 'submitted'
        `;

        const avgScoreResult = await sql`
            SELECT ROUND(AVG(score), 2) as avg_score
            FROM assessment_attempts
            WHERE status IN ('completed', 'submitted') AND score IS NOT NULL
        `;

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

// Get assessment overview
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

        // Only teachers and admins can view analytics
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const type = url.searchParams.get('type') || 'stats';

        let result;
        switch (type) {
            case 'stats':
                result = await getAssessmentStats();
                break;

            case 'activity':
                const [activities, topPerformers] = await Promise.all([
                    getRecentActivity(),
                    getTopPerformers()
                ]);
                result = { activities, topPerformers };
                break;

            case 'overview':
                const assessments = await getAssessmentOverview();
                result = { assessments };
                break;

            default:
                return res.status(400).json({ error: 'Invalid type parameter' });
        }

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Analytics API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch analytics data',
            details: error.message
        });
    }
};
