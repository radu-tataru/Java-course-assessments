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
async function getAllUsers(roleFilter = null) {
    try {
        // First, try to add missing columns if they don't exist (safe operation)
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`;
        } catch (altError) {
            // Ignore errors - columns might already exist
            console.log('Column addition info:', altError.message);
        }

        let query;
        if (roleFilter) {
            query = sql`
                SELECT
                    u.id, u.email, u.first_name, u.last_name, u.role, u.student_id, u.created_at,
                    COALESCE(u.last_login, u.created_at) as last_login,
                    COALESCE(u.is_active, true) as is_active,
                    COUNT(CASE WHEN aa.status = 'completed' THEN 1 END) as completed_assessments,
                    COUNT(CASE WHEN aa.status = 'in_progress' THEN 1 END) as in_progress_assessments,
                    ROUND(AVG(CASE WHEN aa.status = 'completed' THEN aa.score END), 2) as average_score
                FROM users u
                LEFT JOIN assessment_attempts aa ON u.id = aa.user_id
                WHERE u.role = ${roleFilter}
                GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.student_id, u.created_at, u.last_login, u.is_active
                ORDER BY u.created_at DESC
            `;
        } else {
            query = sql`
                SELECT
                    u.id, u.email, u.first_name, u.last_name, u.role, u.student_id, u.created_at,
                    COALESCE(u.last_login, u.created_at) as last_login,
                    COALESCE(u.is_active, true) as is_active,
                    COUNT(CASE WHEN aa.status = 'completed' THEN 1 END) as completed_assessments,
                    COUNT(CASE WHEN aa.status = 'in_progress' THEN 1 END) as in_progress_assessments,
                    ROUND(AVG(CASE WHEN aa.status = 'completed' THEN aa.score END), 2) as average_score
                FROM users u
                LEFT JOIN assessment_attempts aa ON u.id = aa.user_id
                GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.student_id, u.created_at, u.last_login, u.is_active
                ORDER BY u.created_at DESC
            `;
        }

        const result = await query;
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const user = verifyToken(req);

        // Check permissions based on endpoint and method
        if (req.method === 'GET') {
            // Teachers and admins can view users
            if (user.role !== 'admin' && user.role !== 'teacher') {
                return res.status(403).json({
                    error: 'Access denied. Teacher or admin privileges required.'
                });
            }
        } else {
            // Only admins can create/delete users
            if (user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Access denied. Admin privileges required.'
                });
            }
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

        // Check if it's a user ID (for DELETE/PUT operations)
        const userId = parseInt(lastPart);
        if (!isNaN(userId)) {
            if (req.method === 'DELETE') {
                // DELETE /api/users/:id
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
            } else if (req.method === 'PUT') {
                // PUT /api/users/:id - update user
                const { firstName, lastName, email, role, password } = req.body;

                // Validation
                if (!firstName || !lastName || !email || !role) {
                    return res.status(400).json({
                        error: 'First name, last name, email, and role are required'
                    });
                }

                // Build update query
                let updateFields = `
                    first_name = ${firstName},
                    last_name = ${lastName},
                    email = ${email.toLowerCase()},
                    role = ${role}
                `;

                // If password is provided, hash and update it
                if (password && password.length >= 6) {
                    const saltRounds = 12;
                    const passwordHash = await bcrypt.hash(password, saltRounds);
                    updateFields += `, password_hash = ${passwordHash}`;
                } else if (password && password.length < 6) {
                    return res.status(400).json({
                        error: 'Password must be at least 6 characters long'
                    });
                }

                const result = await sql`
                    UPDATE users
                    SET first_name = ${firstName},
                        last_name = ${lastName},
                        email = ${email.toLowerCase()},
                        role = ${role}
                        ${password ? sql`, password_hash = ${await bcrypt.hash(password, 12)}` : sql``}
                    WHERE id = ${userId}
                    RETURNING id, email, first_name, last_name, role
                `;

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                return res.status(200).json({
                    success: true,
                    message: 'User updated successfully',
                    user: result.rows[0]
                });
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        }

        // Base /api/users endpoint
        if (req.method === 'GET') {
            // GET /api/users - get all users, optionally filtered by role
            const roleFilter = url.searchParams.get('role');

            // Teachers can only view students
            if (user.role === 'teacher' && roleFilter && roleFilter !== 'student') {
                return res.status(403).json({
                    error: 'Teachers can only view student users'
                });
            }

            // If teacher doesn't specify role, default to students
            const actualRoleFilter = user.role === 'teacher' ? 'student' : roleFilter;

            const users = await getAllUsers(actualRoleFilter);
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