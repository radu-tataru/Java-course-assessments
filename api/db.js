/**
 * Database connection and utility functions
 * Using Vercel PostgreSQL for data persistence
 */

import { sql } from '@vercel/postgres';

// Database initialization
export async function initializeDatabase() {
    try {
        // Create users table
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
                student_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create assessments table
        await sql`
            CREATE TABLE IF NOT EXISTS assessments (
                id SERIAL PRIMARY KEY,
                step_number INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                duration_minutes INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                passing_score DECIMAL(5,2) DEFAULT 70.00,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create questions table
        await sql`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
                question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple_choice', 'code_reading', 'code_completion', 'coding_challenge', 'true_false')),
                question_text TEXT NOT NULL,
                code_snippet TEXT,
                options JSONB,
                correct_answer TEXT,
                explanation TEXT,
                test_cases JSONB,
                points DECIMAL(5,2) DEFAULT 10.00,
                difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
                order_index INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create assessment_attempts table
        await sql`
            CREATE TABLE IF NOT EXISTS assessment_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                submitted_at TIMESTAMP,
                time_spent_seconds INTEGER,
                score DECIMAL(5,2),
                total_points DECIMAL(5,2),
                percentage DECIMAL(5,2),
                status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
                answers JSONB,
                is_passed BOOLEAN,
                attempt_number INTEGER DEFAULT 1
            )
        `;

        // Create question_responses table
        await sql`
            CREATE TABLE IF NOT EXISTS question_responses (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER REFERENCES assessment_attempts(id) ON DELETE CASCADE,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
                user_answer TEXT,
                is_correct BOOLEAN,
                points_earned DECIMAL(5,2),
                time_spent_seconds INTEGER,
                code_execution_result JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create indexes for better performance
        await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user ON assessment_attempts(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON assessment_attempts(assessment_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_questions_assessment ON questions(assessment_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_question_responses_attempt ON question_responses(attempt_id)`;

        console.log('Database initialized successfully');
        return { success: true };
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

// User management functions
export async function createUser(userData) {
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

export async function getUserByEmail(email) {
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

export async function getUserById(id) {
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

// Assessment management functions
export async function createAssessment(assessmentData) {
    try {
        const result = await sql`
            INSERT INTO assessments (step_number, title, description, duration_minutes, total_questions, passing_score)
            VALUES (${assessmentData.step_number}, ${assessmentData.title}, ${assessmentData.description},
                   ${assessmentData.duration_minutes}, ${assessmentData.total_questions}, ${assessmentData.passing_score})
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

export async function getAssessmentById(id) {
    try {
        const result = await sql`
            SELECT * FROM assessments
            WHERE id = ${id} AND is_active = true
        `;
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

export async function getAssessmentByStep(stepNumber) {
    try {
        const result = await sql`
            SELECT * FROM assessments
            WHERE step_number = ${stepNumber} AND is_active = true
        `;
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

export async function getAllAssessments() {
    try {
        const result = await sql`
            SELECT * FROM assessments
            WHERE is_active = true
            ORDER BY step_number
        `;
        return result.rows;
    } catch (error) {
        throw error;
    }
}

// Question management functions
export async function createQuestion(questionData) {
    try {
        const result = await sql`
            INSERT INTO questions (assessment_id, question_type, question_text, code_snippet,
                                 options, correct_answer, explanation, test_cases, points,
                                 difficulty, order_index)
            VALUES (${questionData.assessment_id}, ${questionData.question_type}, ${questionData.question_text},
                   ${questionData.code_snippet}, ${JSON.stringify(questionData.options)},
                   ${questionData.correct_answer}, ${questionData.explanation},
                   ${JSON.stringify(questionData.test_cases)}, ${questionData.points},
                   ${questionData.difficulty}, ${questionData.order_index})
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

export async function getQuestionsByAssessment(assessmentId) {
    try {
        const result = await sql`
            SELECT * FROM questions
            WHERE assessment_id = ${assessmentId}
            ORDER BY order_index, id
        `;
        return result.rows;
    } catch (error) {
        throw error;
    }
}

// Assessment attempt functions
export async function createAssessmentAttempt(userId, assessmentId) {
    try {
        // Check if there's an in-progress attempt
        const existingAttempt = await sql`
            SELECT id FROM assessment_attempts
            WHERE user_id = ${userId} AND assessment_id = ${assessmentId} AND status = 'in_progress'
        `;

        if (existingAttempt.rows.length > 0) {
            return existingAttempt.rows[0];
        }

        // Get attempt number
        const attemptCount = await sql`
            SELECT COUNT(*) as count FROM assessment_attempts
            WHERE user_id = ${userId} AND assessment_id = ${assessmentId}
        `;

        const attemptNumber = parseInt(attemptCount.rows[0].count) + 1;

        const result = await sql`
            INSERT INTO assessment_attempts (user_id, assessment_id, attempt_number)
            VALUES (${userId}, ${assessmentId}, ${attemptNumber})
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

export async function getAssessmentAttempt(attemptId) {
    try {
        const result = await sql`
            SELECT aa.*, a.title, a.duration_minutes, u.first_name, u.last_name, u.email
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            JOIN users u ON aa.user_id = u.id
            WHERE aa.id = ${attemptId}
        `;
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

export async function updateAssessmentAttempt(attemptId, updateData) {
    try {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            fields.push(`${key} = $${fields.length + 1}`);
            values.push(updateData[key]);
        });

        const result = await sql`
            UPDATE assessment_attempts
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${attemptId}
            RETURNING *
        `.apply(null, values);

        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

// Question response functions
export async function saveQuestionResponse(responseData) {
    try {
        const result = await sql`
            INSERT INTO question_responses (attempt_id, question_id, user_answer, is_correct,
                                          points_earned, time_spent_seconds, code_execution_result)
            VALUES (${responseData.attempt_id}, ${responseData.question_id}, ${responseData.user_answer},
                   ${responseData.is_correct}, ${responseData.points_earned},
                   ${responseData.time_spent_seconds}, ${JSON.stringify(responseData.code_execution_result)})
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET
                user_answer = EXCLUDED.user_answer,
                is_correct = EXCLUDED.is_correct,
                points_earned = EXCLUDED.points_earned,
                time_spent_seconds = EXCLUDED.time_spent_seconds,
                code_execution_result = EXCLUDED.code_execution_result
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

// Analytics functions for teacher dashboard
export async function getStudentProgress(userId = null) {
    try {
        let query = sql`
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.student_id,
                COUNT(DISTINCT aa.assessment_id) as assessments_taken,
                AVG(aa.percentage) as avg_score,
                MAX(aa.submitted_at) as last_submission
            FROM users u
            LEFT JOIN assessment_attempts aa ON u.id = aa.user_id AND aa.status = 'submitted'
            WHERE u.role = 'student'
        `;

        if (userId) {
            query = sql`
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    COUNT(DISTINCT aa.assessment_id) as assessments_taken,
                    AVG(aa.percentage) as avg_score,
                    MAX(aa.submitted_at) as last_submission
                FROM users u
                LEFT JOIN assessment_attempts aa ON u.id = aa.user_id AND aa.status = 'submitted'
                WHERE u.role = 'student' AND u.id = ${userId}
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id
            `;
        } else {
            query = sql`
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.student_id,
                    COUNT(DISTINCT aa.assessment_id) as assessments_taken,
                    AVG(aa.percentage) as avg_score,
                    MAX(aa.submitted_at) as last_submission
                FROM users u
                LEFT JOIN assessment_attempts aa ON u.id = aa.user_id AND aa.status = 'submitted'
                WHERE u.role = 'student'
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.student_id
                ORDER BY u.last_name, u.first_name
            `;
        }

        const result = await query;
        return result.rows;
    } catch (error) {
        throw error;
    }
}

export async function getAssessmentStats() {
    try {
        const result = await sql`
            SELECT
                a.id,
                a.step_number,
                a.title,
                COUNT(DISTINCT aa.user_id) as total_attempts,
                COUNT(CASE WHEN aa.is_passed = true THEN 1 END) as passed_attempts,
                AVG(aa.percentage) as avg_score,
                AVG(aa.time_spent_seconds) as avg_time_seconds
            FROM assessments a
            LEFT JOIN assessment_attempts aa ON a.id = aa.assessment_id AND aa.status = 'submitted'
            WHERE a.is_active = true
            GROUP BY a.id, a.step_number, a.title
            ORDER BY a.step_number
        `;
        return result.rows;
    } catch (error) {
        throw error;
    }
}