/**
 * User attempts API endpoint
 * Handles fetching user's assessment attempts
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

// Database functions
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

        // Users can only view their own attempts
        const attempts = await getUserAttempts(user.id);

        return res.status(200).json({
            success: true,
            attempts
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('User attempts API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};