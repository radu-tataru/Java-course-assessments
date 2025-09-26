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

        let assessment;
        if (existingAssessment.rows.length === 0) {
            // Create Step 1 assessment
            const assessmentResult = await sql`
                INSERT INTO assessments (step_number, title, description, duration_minutes, total_questions, passing_score)
                VALUES (1, 'Basic File Reading Assessment', 'Test your understanding of file I/O operations in Java', 30, 10, 70.00)
                RETURNING *
            `;

            assessment = assessmentResult.rows[0];
        } else {
            // Use existing assessment but update questions
            assessment = existingAssessment.rows[0];

            // Delete existing questions for this assessment
            await sql`
                DELETE FROM questions WHERE assessment_id = ${assessment.id}
            `;

            // Update assessment with correct question count
            await sql`
                UPDATE assessments
                SET total_questions = 10,
                    passing_score = 70.00
                WHERE id = ${assessment.id}
            `;

            console.log(`Updating existing Step 1 assessment with new questions`);
        }

        // Insert comprehensive questions for Step 1 assessment
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
                },
                {
                    type: 'multiple_choice',
                    question: 'What exception should you catch when reading files that might not exist?',
                    options: ['IOException', 'FileNotFoundException', 'RuntimeException', 'Exception'],
                    correct_answer: 'FileNotFoundException',
                    explanation: 'FileNotFoundException is thrown when trying to open a file that doesn\'t exist. It\'s a subclass of IOException.',
                    difficulty: 'easy',
                    points: 10
                },
                {
                    type: 'multiple_choice',
                    question: 'Which method is used to check if there are more lines to read in a BufferedReader?',
                    options: ['hasNext()', 'ready()', 'readLine() != null', 'available()'],
                    correct_answer: 'readLine() != null',
                    explanation: 'You check if readLine() returns null to determine if you\'ve reached the end of the file.',
                    difficulty: 'medium',
                    points: 15
                },
                {
                    type: 'true_false',
                    question: 'FileReader automatically handles character encoding conversion.',
                    correct_answer: 'true',
                    explanation: 'True. FileReader converts bytes to characters using the default character encoding of the platform.',
                    difficulty: 'medium',
                    points: 10
                },
                {
                    type: 'multiple_choice',
                    question: 'What is the correct way to create a BufferedReader for reading a text file?',
                    options: ['new BufferedReader("file.txt")', 'new BufferedReader(new FileReader("file.txt"))', 'new BufferedReader(new File("file.txt"))', 'BufferedReader.create("file.txt")'],
                    correct_answer: 'new BufferedReader(new FileReader("file.txt"))',
                    explanation: 'BufferedReader wraps another Reader, typically FileReader for reading text files.',
                    difficulty: 'medium',
                    points: 15
                },
                {
                    type: 'code_completion',
                    question: 'Complete the code to read all lines from a file and print them:\n\n```java\ntry (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {\n    String line;\n    while ((line = ______) != null) {\n        System.out.println(line);\n    }\n}\n```',
                    correct_answer: 'br.readLine()',
                    explanation: 'The readLine() method reads a line of text and returns null when the end of file is reached.',
                    difficulty: 'medium',
                    points: 20
                },
                {
                    type: 'multiple_choice',
                    question: 'Which of the following is NOT a valid way to handle file reading exceptions?',
                    options: ['try-catch block', 'throws declaration', 'try-with-resources', 'ignore them'],
                    correct_answer: 'ignore them',
                    explanation: 'File I/O exceptions must be handled either with try-catch or declared with throws. Ignoring them will cause compilation errors.',
                    difficulty: 'easy',
                    points: 10
                },
                {
                    type: 'true_false',
                    question: 'Scanner class can be used to read files and automatically parse different data types.',
                    correct_answer: 'true',
                    explanation: 'True. Scanner can read from files and provides methods like nextInt(), nextDouble(), etc. for parsing different data types.',
                    difficulty: 'medium',
                    points: 10
                },
                {
                    type: 'coding_challenge',
                    question: 'Write a method that reads a text file and returns the number of lines in the file. Handle any potential exceptions appropriately.',
                    correct_answer: 'public static int countLines(String filename) throws IOException {\n    try (BufferedReader br = new BufferedReader(new FileReader(filename))) {\n        int count = 0;\n        while (br.readLine() != null) {\n            count++;\n        }\n        return count;\n    }\n}',
                    explanation: 'This method uses try-with-resources to automatically close the BufferedReader and counts lines by reading until readLine() returns null.',
                    difficulty: 'hard',
                    points: 25
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

        console.log(`Step 1 assessment updated with ${questions.length} questions`);

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