/**
 * User registration API endpoint
 * POST /api/auth/register
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

// Database function to create user
async function createUser(userData) {
    try {
        const result = await sql`
            INSERT INTO users (email, password_hash, first_name, last_name, role, student_id)
            VALUES (${userData.email}, ${userData.password_hash}, ${userData.first_name},
                   ${userData.last_name}, ${userData.role || 'student'}, ${userData.student_id})
            RETURNING id, email, first_name, last_name, role, student_id, created_at
        `;
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new Error('Email already exists');
        }
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
        const { email, password, firstName, lastName, studentId, role = 'student' } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: 'Email, password, first name, and last name are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Please provide a valid email address'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const userData = {
            email: email.toLowerCase(),
            password_hash: passwordHash,
            first_name: firstName,
            last_name: lastName,
            role: role,
            student_id: studentId || null
        };

        const newUser = await createUser(userData);

        // Generate token
        const token = generateToken(newUser);

        // Return success response (don't include password hash)
        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                studentId: newUser.student_id
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);

        if (error.message === 'Email already exists') {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        return res.status(500).json({
            error: 'Registration failed. Please try again.',
            details: error.message
        });
    }
};