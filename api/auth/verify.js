/**
 * Token verification API endpoint
 * GET /api/auth/verify
 */

const jwt = require('jsonwebtoken');
const { sql } = require('@vercel/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Database function to get user by ID
async function getUserById(id) {
    try {
        const result = await sql`
            SELECT id, email, first_name, last_name, role, student_id, created_at
            FROM users
            WHERE id = ${id}
        `;
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

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
        const decoded = verifyToken(req);

        // Get fresh user data
        const user = await getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({
                error: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                studentId: user.student_id
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
};