/**
 * Authentication API endpoints
 * Handles user registration, login, and JWT token management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('@vercel/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Database utility functions
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

// Middleware to verify JWT token
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Route based on URL path
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.split('/').pop();

    try {
        switch (endpoint) {
            case 'register':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleRegister(req, res);

            case 'login':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleLogin(req, res);

            case 'verify':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleVerifyToken(req, res);

            case 'profile':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleGetProfile(req, res);

            default:
                return res.status(404).json({ error: 'Endpoint not found' });
        }
    } catch (error) {
        console.error('Auth API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

async function handleRegister(req, res) {
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
            error: 'Registration failed. Please try again.'
        });
    }
}

async function handleLogin(req, res) {
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
            error: 'Login failed. Please try again.'
        });
    }
}

async function handleVerifyToken(req, res) {
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
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
}

async function handleGetProfile(req, res) {
    try {
        const decoded = verifyToken(req);

        const user = await getUserById(decoded.id);
        if (!user) {
            return res.status(404).json({
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
                studentId: user.student_id,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }
}