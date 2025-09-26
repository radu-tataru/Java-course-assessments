/**
 * Database initialization API endpoint
 * Creates tables and populates with initial data
 */

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
        console.log('Initializing database...');

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

        // Check if Step 1 assessment already exists
        const existingAssessment = await sql`
            SELECT * FROM assessments WHERE step_number = 1
        `;

        if (existingAssessment.rows.length === 0) {
            // Create Step 1 assessment
            const assessmentResult = await sql`
                INSERT INTO assessments (step_number, title, description, duration_minutes, total_questions, passing_score)
                VALUES (1, 'Basic File Reading Assessment', 'Test your understanding of file I/O operations in Java', 30, 10, 70.00)
                RETURNING *
            `;

            const assessment = assessmentResult.rows[0];

            // Insert sample questions (simplified for initial testing)
            const questions = [
                {
                    type: 'multiple_choice',
                    question: 'Which Java class is most suitable for reading text files line by line?',
                    options: ['FileReader', 'BufferedReader', 'FileInputStream', 'Scanner'],
                    correct_answer: 'BufferedReader',
                    explanation: 'BufferedReader is the best choice for reading text files line by line because it provides the readLine() method and buffers the input for better performance.',
                    difficulty: 'easy',
                    points: 10
                },
                {
                    type: 'true_false',
                    question: 'The try-with-resources statement automatically closes the BufferedReader even if an exception occurs.',
                    correct_answer: 'true',
                    explanation: 'True. Try-with-resources automatically calls close() on resources that implement AutoCloseable, even if an exception is thrown.',
                    difficulty: 'easy',
                    points: 5
                }
            ];

            // Insert questions
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                await sql`
                    INSERT INTO questions (assessment_id, question_type, question_text, options, correct_answer, explanation, points, difficulty, order_index)
                    VALUES (${assessment.id}, ${q.type}, ${q.question}, ${JSON.stringify(q.options || null)}, ${q.correct_answer}, ${q.explanation}, ${q.points}, ${q.difficulty}, ${i + 1})
                `;
            }

            console.log(`Created Step 1 assessment with ${questions.length} questions`);
        }

        return res.status(200).json({
            success: true,
            message: 'Database initialized successfully',
            tables: ['users', 'assessments', 'questions', 'assessment_attempts', 'question_responses']
        });

    } catch (error) {
        console.error('Database initialization error:', error);
        return res.status(500).json({
            error: 'Failed to initialize database',
            details: error.message
        });
    }
};