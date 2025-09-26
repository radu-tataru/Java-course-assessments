/**
 * Submit Assessment API endpoint
 * Handles final submission of completed assessments
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
            SELECT aa.*, a.passing_score, a.total_questions
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            WHERE aa.id = ${attemptId} AND aa.user_id = ${userId} AND aa.status = 'in_progress'
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in validateAttempt:', error);
        throw error;
    }
}

async function calculateFinalScore(attemptId) {
    try {
        // Get all responses for this attempt
        const responses = await sql`
            SELECT qr.*, q.points as max_points
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE qr.attempt_id = ${attemptId}
        `;

        const totalPointsEarned = responses.rows.reduce((sum, r) => sum + (r.points_earned || 0), 0);
        const totalMaxPoints = responses.rows.reduce((sum, r) => sum + (r.max_points || 0), 0);
        const totalTimeSpent = responses.rows.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0);

        const score = totalMaxPoints > 0 ? Math.round((totalPointsEarned / totalMaxPoints) * 100) : 0;

        return {
            totalPointsEarned,
            totalMaxPoints,
            score,
            totalTimeSpent,
            questionsAnswered: responses.rows.length
        };
    } catch (error) {
        console.error('Database error in calculateFinalScore:', error);
        throw error;
    }
}

async function submitAssessment(attemptId, finalScore, timeSpent) {
    try {
        // Get attempt details for pass/fail determination
        const attemptResult = await sql`
            SELECT aa.*, a.passing_score
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            WHERE aa.id = ${attemptId}
        `;

        const attempt = attemptResult.rows[0];
        const isPassed = finalScore.score >= attempt.passing_score;

        // Update the attempt with final submission
        const result = await sql`
            UPDATE assessment_attempts
            SET submitted_at = CURRENT_TIMESTAMP,
                time_spent_seconds = ${timeSpent || finalScore.totalTimeSpent},
                score = ${finalScore.score},
                total_points = ${finalScore.totalPointsEarned},
                percentage = ${finalScore.score},
                status = 'submitted',
                is_passed = ${isPassed}
            WHERE id = ${attemptId}
            RETURNING *
        `;

        return result.rows[0];
    } catch (error) {
        console.error('Database error in submitAssessment:', error);
        throw error;
    }
}

async function getAssessmentSummary(attemptId) {
    try {
        // Get attempt with assessment details
        const attemptResult = await sql`
            SELECT aa.*, a.title, a.step_number, a.passing_score, a.total_questions
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            WHERE aa.id = ${attemptId}
        `;

        const attempt = attemptResult.rows[0];

        // Get question responses summary
        const responsesResult = await sql`
            SELECT
                COUNT(*) as total_answered,
                COUNT(CASE WHEN qr.is_correct = true THEN 1 END) as correct_answers,
                SUM(qr.points_earned) as points_earned,
                SUM(q.points) as total_points
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE qr.attempt_id = ${attemptId}
        `;

        const summary = responsesResult.rows[0];

        return {
            attempt,
            summary: {
                totalQuestions: attempt.total_questions,
                answeredQuestions: parseInt(summary.total_answered),
                correctAnswers: parseInt(summary.correct_answers),
                pointsEarned: parseFloat(summary.points_earned) || 0,
                totalPoints: parseFloat(summary.total_points) || 0,
                score: attempt.score,
                passed: attempt.is_passed,
                passingScore: attempt.passing_score,
                timeSpent: attempt.time_spent_seconds
            }
        };
    } catch (error) {
        console.error('Database error in getAssessmentSummary:', error);
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
        const { attemptId, timeSpent } = req.body;

        // Validation
        if (!attemptId) {
            return res.status(400).json({
                error: 'Attempt ID is required'
            });
        }

        // Validate that this attempt belongs to the user and is in progress
        const attempt = await validateAttempt(user.id, attemptId);
        if (!attempt) {
            return res.status(404).json({
                error: 'Assessment attempt not found or not in progress'
            });
        }

        // Calculate final score
        const finalScore = await calculateFinalScore(attemptId);

        // Submit the assessment
        const submittedAttempt = await submitAssessment(attemptId, finalScore, timeSpent);

        // Get complete summary
        const summary = await getAssessmentSummary(attemptId);

        return res.status(200).json({
            success: true,
            message: 'Assessment submitted successfully',
            attempt: {
                id: submittedAttempt.id,
                submittedAt: submittedAttempt.submitted_at,
                score: submittedAttempt.score,
                passed: submittedAttempt.is_passed,
                timeSpent: submittedAttempt.time_spent_seconds
            },
            summary: summary.summary
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Submit assessment API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};