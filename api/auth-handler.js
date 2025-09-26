/**
 * Consolidated Authentication Handler API
 * Handles login, register, and verify operations
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('@vercel/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Database functions
async function findUserByEmail(email) {
    try {
        const result = await sql`
            SELECT * FROM users WHERE email = ${email.toLowerCase()}
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in findUserByEmail:', error);
        throw error;
    }
}

async function createUser(userData) {
    try {
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${userData.email.toLowerCase()}
        `;

        if (existingUser.rows.length > 0) {
            throw new Error('Email already exists');
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(userData.password, saltRounds);

        const result = await sql`
            INSERT INTO users (email, password_hash, first_name, last_name, role, student_id)
            VALUES (${userData.email.toLowerCase()}, ${passwordHash}, ${userData.firstName},
                    ${userData.lastName}, ${userData.role || 'student'}, ${userData.studentId || null})
            RETURNING id, email, first_name, last_name, role, student_id, created_at
        `;

        return result.rows[0];
    } catch (error) {
        console.error('Database error in createUser:', error);
        throw error;
    }
}

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

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

// Main handler
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const action = url.searchParams.get('action');

        switch (action) {
            case 'login':
                return await handleLogin(req, res);
            case 'register':
                return await handleRegister(req, res);
            case 'verify':
                return await handleVerify(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        console.error('Auth handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};

async function handleLogin(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    try {
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const token = generateToken(user);

        // Update last login
        try {
            await sql`
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${user.id}
            `;
        } catch (updateError) {
            console.log('Failed to update last login:', updateError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
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
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

async function handleRegister(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { firstName, lastName, email, password, studentId } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({
            error: 'First name, last name, email, and password are required'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters long'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Please provide a valid email address'
        });
    }

    try {
        const newUser = await createUser({
            firstName,
            lastName,
            email,
            password,
            role: 'student',
            studentId
        });

        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                studentId: newUser.student_id
            }
        });

    } catch (error) {
        if (error.message === 'Email already exists') {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        console.error('Registration error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

async function handleVerify(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = verifyToken(req);

        const dbUser = await sql`
            SELECT id, email, first_name, last_name, role, student_id, created_at
            FROM users WHERE id = ${user.id}
        `;

        if (dbUser.rows.length === 0) {
            return res.status(401).json({
                error: 'User not found'
            });
        }

        const userData = dbUser.rows[0];

        return res.status(200).json({
            valid: true,
            user: {
                id: userData.id,
                email: userData.email,
                firstName: userData.first_name,
                lastName: userData.last_name,
                role: userData.role,
                studentId: userData.student_id
            }
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({
                valid: false,
                error: 'Invalid or expired token'
            });
        }

        console.error('Token verification error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}