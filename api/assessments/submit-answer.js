/**
 * Submit Answer API endpoint
 * Handles submitting individual question answers during an assessment
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
async function validateAttempt(userId, attemptId) {
    try {
        const result = await sql`
            SELECT * FROM assessment_attempts
            WHERE id = ${attemptId} AND user_id = ${userId} AND status = 'in_progress'
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in validateAttempt:', error);
        throw error;
    }
}

async function getQuestion(questionId) {
    try {
        const result = await sql`
            SELECT * FROM questions
            WHERE id = ${questionId}
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in getQuestion:', error);
        throw error;
    }
}

async function saveQuestionResponse(attemptId, questionId, userAnswer, timeSpent) {
    try {
        // Get question details for scoring
        const question = await getQuestion(questionId);
        if (!question) {
            throw new Error('Question not found');
        }

        // Determine if answer is correct
        let isCorrect = false;
        let pointsEarned = 0;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
            isCorrect = userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
            pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'code_completion' || question.question_type === 'coding_challenge') {
            // For coding questions, we'll mark as partially correct for now
            // This should be enhanced with proper code execution and testing
            isCorrect = userAnswer && userAnswer.trim().length > 0;
            pointsEarned = isCorrect ? question.points * 0.5 : 0; // Partial credit
        }

        // Check if response already exists
        const existingResponse = await sql`
            SELECT id FROM question_responses
            WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
        `;

        if (existingResponse.rows.length > 0) {
            // Update existing response
            const result = await sql`
                UPDATE question_responses
                SET user_answer = ${userAnswer},
                    is_correct = ${isCorrect},
                    points_earned = ${pointsEarned},
                    time_spent_seconds = ${timeSpent}
                WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
                RETURNING *
            `;
            return result.rows[0];
        } else {
            // Create new response
            const result = await sql`
                INSERT INTO question_responses (
                    attempt_id, question_id, user_answer, is_correct,
                    points_earned, time_spent_seconds
                ) VALUES (
                    ${attemptId}, ${questionId}, ${userAnswer}, ${isCorrect},
                    ${pointsEarned}, ${timeSpent}
                ) RETURNING *
            `;
            return result.rows[0];
        }
    } catch (error) {
        console.error('Database error in saveQuestionResponse:', error);
        throw error;
    }
}

async function updateAttemptProgress(attemptId) {
    try {
        // Get current responses for this attempt
        const responses = await sql`
            SELECT qr.*, q.points as max_points
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE qr.attempt_id = ${attemptId}
        `;

        const totalPointsEarned = responses.rows.reduce((sum, r) => sum + (r.points_earned || 0), 0);
        const totalMaxPoints = responses.rows.reduce((sum, r) => sum + (r.max_points || 0), 0);
        const totalTimeSpent = responses.rows.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0);

        // Update attempt with current progress
        await sql`
            UPDATE assessment_attempts
            SET total_points = ${totalPointsEarned},
                time_spent_seconds = ${totalTimeSpent},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${attemptId}
        `;

        return {
            totalPointsEarned,
            totalMaxPoints,
            totalTimeSpent,
            questionsAnswered: responses.rows.length
        };
    } catch (error) {
        console.error('Database error in updateAttemptProgress:', error);
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
        const { attemptId, questionId, answer, timeSpent } = req.body;

        // Validation
        if (!attemptId || !questionId || answer === undefined) {
            return res.status(400).json({
                error: 'Attempt ID, question ID, and answer are required'
            });
        }

        // Validate that this attempt belongs to the user and is in progress
        const attempt = await validateAttempt(user.id, attemptId);
        if (!attempt) {
            return res.status(404).json({
                error: 'Assessment attempt not found or not in progress'
            });
        }

        // Save the question response
        const response = await saveQuestionResponse(
            attemptId,
            questionId,
            answer,
            timeSpent || 0
        );

        // Update attempt progress
        const progress = await updateAttemptProgress(attemptId);

        return res.status(200).json({
            success: true,
            response: {
                id: response.id,
                isCorrect: response.is_correct,
                pointsEarned: response.points_earned
            },
            progress
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Submit answer API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};