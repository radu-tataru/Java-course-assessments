/**
 * User management API endpoint
 * Handles CRUD operations for users (admin only)
 */

const bcrypt = require('bcryptjs');
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
async function getAllUsers() {
    try {
        const result = await sql`
            SELECT
                id, email, first_name, last_name, role, student_id, created_at
            FROM users
            ORDER BY created_at DESC
        `;
        return result.rows;
    } catch (error) {
        console.error('Database error in getAllUsers:', error);
        throw error;
    }
}

async function getUserStats() {
    try {
        const result = await sql`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
                COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
            FROM users
        `;

        const stats = result.rows[0];
        return {
            total: parseInt(stats.total),
            students: parseInt(stats.students),
            teachers: parseInt(stats.teachers),
            admins: parseInt(stats.admins)
        };
    } catch (error) {
        console.error('Database error in getUserStats:', error);
        throw error;
    }
}

async function createUser(userData) {
    try {
        // Check if email already exists
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${userData.email.toLowerCase()}
        `;

        if (existingUser.rows.length > 0) {
            throw new Error('Email already exists');
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(userData.password, saltRounds);

        // Create user
        const result = await sql`
            INSERT INTO users (email, password_hash, first_name, last_name, role, student_id)
            VALUES (${userData.email.toLowerCase()}, ${passwordHash}, ${userData.firstName},
                    ${userData.lastName}, ${userData.role}, ${userData.studentId})
            RETURNING id, email, first_name, last_name, role, student_id, created_at
        `;

        return result.rows[0];
    } catch (error) {
        console.error('Database error in createUser:', error);
        throw error;
    }
}

async function deleteUser(userId) {
    try {
        // First get user info for response
        const userResult = await sql`
            SELECT first_name, last_name FROM users WHERE id = ${userId}
        `;

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        // Delete user (CASCADE will handle related records)
        await sql`
            DELETE FROM users WHERE id = ${userId}
        `;

        return userResult.rows[0];
    } catch (error) {
        console.error('Database error in deleteUser:', error);
        throw error;
    }
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const user = verifyToken(req);

        // Only admins can manage users
        if (user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.'
            });
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];

        // Handle different endpoints
        if (lastPart === 'stats') {
            // GET /api/users/stats
            if (req.method !== 'GET') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const stats = await getUserStats();
            return res.status(200).json({
                success: true,
                stats
            });
        }

        // Check if it's a user ID (for DELETE operations)
        const userId = parseInt(lastPart);
        if (!isNaN(userId)) {
            // DELETE /api/users/:id
            if (req.method !== 'DELETE') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            // Prevent admin from deleting themselves
            if (userId === user.id) {
                return res.status(400).json({
                    error: 'Cannot delete your own account'
                });
            }

            const deletedUser = await deleteUser(userId);
            return res.status(200).json({
                success: true,
                message: `User ${deletedUser.first_name} ${deletedUser.last_name} deleted successfully`
            });
        }

        // Base /api/users endpoint
        if (req.method === 'GET') {
            // GET /api/users - get all users
            const users = await getAllUsers();
            return res.status(200).json({
                success: true,
                users
            });

        } else if (req.method === 'POST') {
            // POST /api/users - create new user
            const { firstName, lastName, email, password, role, studentId } = req.body;

            // Validation
            if (!firstName || !lastName || !email || !password || !role) {
                return res.status(400).json({
                    error: 'First name, last name, email, password, and role are required'
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

            // Validate role
            if (!['student', 'teacher', 'admin'].includes(role)) {
                return res.status(400).json({
                    error: 'Invalid role. Must be student, teacher, or admin'
                });
            }

            const newUser = await createUser({
                firstName,
                lastName,
                email,
                password,
                role,
                studentId: studentId || null
            });

            return res.status(201).json({
                success: true,
                message: 'User created successfully',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    role: newUser.role,
                    studentId: newUser.student_id
                }
            });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (error.message === 'Email already exists') {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }

        console.error('Users API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};