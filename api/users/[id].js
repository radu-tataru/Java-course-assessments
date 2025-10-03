/**
 * Dynamic user endpoint for getting/updating/deleting individual users
 * Route: /api/users/:id
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const user = verifyToken(req);
        const userId = parseInt(req.query.id);

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Check permissions based on method
        if (req.method === 'GET') {
            // Teachers and admins can view users
            if (user.role !== 'admin' && user.role !== 'teacher') {
                return res.status(403).json({
                    error: 'Access denied. Teacher or admin privileges required.'
                });
            }

            // GET /api/users/:id - get single user
            const userResult = await sql`
                SELECT
                    u.id, u.email, u.first_name, u.last_name, u.role, u.student_id, u.created_at,
                    COALESCE(u.last_login, u.created_at) as last_login,
                    COALESCE(u.is_active, true) as is_active
                FROM users u
                WHERE u.id = ${userId}
            `;

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({
                success: true,
                user: userResult.rows[0]
            });

        } else if (req.method === 'DELETE') {
            // Only admins can delete users
            if (user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Access denied. Admin privileges required.'
                });
            }

            // Prevent admin from deleting themselves
            if (userId === user.id) {
                return res.status(400).json({
                    error: 'Cannot delete your own account'
                });
            }

            // First get user info for response
            const userResult = await sql`
                SELECT first_name, last_name FROM users WHERE id = ${userId}
            `;

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Delete user (CASCADE will handle related records)
            await sql`
                DELETE FROM users WHERE id = ${userId}
            `;

            const deletedUser = userResult.rows[0];
            return res.status(200).json({
                success: true,
                message: `User ${deletedUser.first_name} ${deletedUser.last_name} deleted successfully`
            });

        } else if (req.method === 'PUT') {
            // Only admins can update users
            if (user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Access denied. Admin privileges required.'
                });
            }

            const { firstName, lastName, email, role, password } = req.body;

            // Validation
            if (!firstName || !lastName || !email || !role) {
                return res.status(400).json({
                    error: 'First name, last name, email, and role are required'
                });
            }

            // If password is provided, validate and hash it
            if (password && password.length < 6) {
                return res.status(400).json({
                    error: 'Password must be at least 6 characters long'
                });
            }

            // Build update query
            if (password && password.length >= 6) {
                const saltRounds = 12;
                const passwordHash = await bcrypt.hash(password, saltRounds);

                const result = await sql`
                    UPDATE users
                    SET first_name = ${firstName},
                        last_name = ${lastName},
                        email = ${email.toLowerCase()},
                        role = ${role},
                        password_hash = ${passwordHash}
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
                const result = await sql`
                    UPDATE users
                    SET first_name = ${firstName},
                        last_name = ${lastName},
                        email = ${email.toLowerCase()},
                        role = ${role}
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
            }

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('User API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};
