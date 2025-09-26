/**
 * Create admin account API endpoint
 * POST /api/create-admin
 *
 * SECURITY WARNING: This endpoint should be used only once to create the initial admin account
 * Consider disabling or removing this endpoint after creating the admin user
 */

const bcrypt = require('bcryptjs');
const { sql } = require('@vercel/postgres');

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
        // Check if any admin already exists
        const existingAdmin = await sql`
            SELECT COUNT(*) as admin_count
            FROM users
            WHERE role = 'admin'
        `;

        if (parseInt(existingAdmin.rows[0].admin_count) > 0) {
            return res.status(400).json({
                error: 'Admin account already exists. Only one admin account can be created via this endpoint.'
            });
        }

        const { email, password, firstName, lastName } = req.body;

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

        // Check if email already exists
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${email.toLowerCase()}
        `;

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create admin user
        const result = await sql`
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (${email.toLowerCase()}, ${passwordHash}, ${firstName}, ${lastName}, 'admin')
            RETURNING id, email, first_name, last_name, role, created_at
        `;

        const newAdmin = result.rows[0];

        return res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            admin: {
                id: newAdmin.id,
                email: newAdmin.email,
                firstName: newAdmin.first_name,
                lastName: newAdmin.last_name,
                role: newAdmin.role,
                createdAt: newAdmin.created_at
            }
        });

    } catch (error) {
        console.error('Create admin error:', error);

        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        return res.status(500).json({
            error: 'Failed to create admin account',
            details: error.message
        });
    }
};