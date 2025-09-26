/**
 * User login API endpoint
 * POST /api/auth/login
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('@vercel/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Helper function to generate JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Database function to get user by email
async function getUserByEmail(email) {
    try {
        const result = await sql`
            SELECT id, email, password_hash, first_name, last_name, role, student_id, created_at
            FROM users
            WHERE email = ${email}
        `;
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = await getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                studentId: user.student_id
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Login failed. Please try again.',
            details: error.message
        });
    }
};