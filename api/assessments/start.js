/**
 * Start Assessment API endpoint
 * Handles starting a new assessment attempt for a user
 */

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
async function getAssessment(stepNumber) {
    try {
        const result = await sql`
            SELECT * FROM assessments
            WHERE step_number = ${stepNumber} AND is_active = true
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in getAssessment:', error);
        throw error;
    }
}

async function getAssessmentQuestions(assessmentId) {
    try {
        const result = await sql`
            SELECT * FROM questions
            WHERE assessment_id = ${assessmentId}
            ORDER BY order_index ASC
        `;
        return result.rows;
    } catch (error) {
        console.error('Database error in getAssessmentQuestions:', error);
        throw error;
    }
}

async function createAssessmentAttempt(userId, assessmentId) {
    try {
        // Check for existing in-progress attempt
        const existingAttempt = await sql`
            SELECT id FROM assessment_attempts
            WHERE user_id = ${userId}
            AND assessment_id = ${assessmentId}
            AND status = 'in_progress'
        `;

        if (existingAttempt.rows.length > 0) {
            // Return existing attempt
            const attemptResult = await sql`
                SELECT * FROM assessment_attempts
                WHERE id = ${existingAttempt.rows[0].id}
            `;
            return attemptResult.rows[0];
        }

        // Get attempt number
        const attemptCount = await sql`
            SELECT COUNT(*) as count FROM assessment_attempts
            WHERE user_id = ${userId} AND assessment_id = ${assessmentId}
        `;

        const attemptNumber = parseInt(attemptCount.rows[0].count) + 1;

        // Create new attempt
        const result = await sql`
            INSERT INTO assessment_attempts (
                user_id, assessment_id, started_at, status, attempt_number
            ) VALUES (
                ${userId}, ${assessmentId}, CURRENT_TIMESTAMP, 'in_progress', ${attemptNumber}
            ) RETURNING *
        `;

        return result.rows[0];
    } catch (error) {
        console.error('Database error in createAssessmentAttempt:', error);
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
        const user = verifyToken(req);
        const { stepNumber } = req.body;

        // Validation
        if (!stepNumber) {
            return res.status(400).json({
                error: 'Step number is required'
            });
        }

        const step = parseInt(stepNumber);
        if (isNaN(step) || step < 1) {
            return res.status(400).json({
                error: 'Invalid step number'
            });
        }

        // Get assessment
        const assessment = await getAssessment(step);
        if (!assessment) {
            return res.status(404).json({
                error: `Assessment for step ${step} not found`
            });
        }

        // Get questions
        const questions = await getAssessmentQuestions(assessment.id);
        if (questions.length === 0) {
            return res.status(404).json({
                error: 'No questions found for this assessment'
            });
        }

        // Create or get existing attempt
        const attempt = await createAssessmentAttempt(user.id, assessment.id);

        // Prepare questions for frontend (without correct answers)
        const sanitizedQuestions = questions.map(q => ({
            id: q.id,
            question_type: q.question_type,
            question_text: q.question_text,
            code_snippet: q.code_snippet,
            options: q.options,
            points: q.points,
            difficulty: q.difficulty,
            order_index: q.order_index
        }));

        return res.status(200).json({
            success: true,
            assessment: {
                id: assessment.id,
                step_number: assessment.step_number,
                title: assessment.title,
                description: assessment.description,
                duration_minutes: assessment.duration_minutes,
                total_questions: assessment.total_questions,
                passing_score: assessment.passing_score
            },
            attempt: {
                id: attempt.id,
                attempt_number: attempt.attempt_number,
                started_at: attempt.started_at,
                status: attempt.status
            },
            questions: sanitizedQuestions
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Start assessment API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};