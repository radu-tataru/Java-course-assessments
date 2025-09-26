/**
 * Consolidated Assessment Handler API
 * Handles all assessment-related operations to reduce function count
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

// Assessment functions
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
            const attemptResult = await sql`
                SELECT * FROM assessment_attempts
                WHERE id = ${existingAttempt.rows[0].id}
            `;
            return attemptResult.rows[0];
        }

        const attemptCount = await sql`
            SELECT COUNT(*) as count FROM assessment_attempts
            WHERE user_id = ${userId} AND assessment_id = ${assessmentId}
        `;

        const attemptNumber = parseInt(attemptCount.rows[0].count) + 1;

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
        const question = await getQuestion(questionId);
        if (!question) {
            throw new Error('Question not found');
        }

        let isCorrect = false;
        let pointsEarned = 0;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
            isCorrect = userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
            pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'code_completion' || question.question_type === 'coding_challenge') {
            isCorrect = userAnswer && userAnswer.trim().length > 0;
            pointsEarned = isCorrect ? question.points * 0.5 : 0;
        }

        const existingResponse = await sql`
            SELECT id FROM question_responses
            WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
        `;

        if (existingResponse.rows.length > 0) {
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

async function calculateFinalScore(attemptId) {
    try {
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
        const attemptResult = await sql`
            SELECT aa.*, a.passing_score
            FROM assessment_attempts aa
            JOIN assessments a ON aa.assessment_id = a.id
            WHERE aa.id = ${attemptId}
        `;

        const attempt = attemptResult.rows[0];
        const isPassed = finalScore.score >= attempt.passing_score;

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

// Handler for different assessment operations
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const user = verifyToken(req);
        const url = new URL(req.url, `http://${req.headers.host}`);
        const action = url.searchParams.get('action');

        switch (action) {
            case 'start':
                return await handleStartAssessment(req, res, user);
            case 'submit-answer':
                return await handleSubmitAnswer(req, res, user);
            case 'submit-assessment':
                return await handleSubmitAssessment(req, res, user);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Assessment handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};

async function handleStartAssessment(req, res, user) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { stepNumber } = req.body;

    if (!stepNumber) {
        return res.status(400).json({ error: 'Step number is required' });
    }

    const step = parseInt(stepNumber);
    if (isNaN(step) || step < 1) {
        return res.status(400).json({ error: 'Invalid step number' });
    }

    const assessment = await getAssessment(step);
    if (!assessment) {
        return res.status(404).json({ error: `Assessment for step ${step} not found` });
    }

    const questions = await getAssessmentQuestions(assessment.id);
    if (questions.length === 0) {
        return res.status(404).json({ error: 'No questions found for this assessment' });
    }

    const attempt = await createAssessmentAttempt(user.id, assessment.id);

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
}

async function handleSubmitAnswer(req, res, user) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { attemptId, questionId, answer, timeSpent } = req.body;

    if (!attemptId || !questionId || answer === undefined) {
        return res.status(400).json({
            error: 'Attempt ID, question ID, and answer are required'
        });
    }

    const attempt = await validateAttempt(user.id, attemptId);
    if (!attempt) {
        return res.status(404).json({
            error: 'Assessment attempt not found or not in progress'
        });
    }

    const response = await saveQuestionResponse(attemptId, questionId, answer, timeSpent || 0);
    const progress = await calculateFinalScore(attemptId);

    return res.status(200).json({
        success: true,
        response: {
            id: response.id,
            isCorrect: response.is_correct,
            pointsEarned: response.points_earned
        },
        progress
    });
}

async function handleSubmitAssessment(req, res, user) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { attemptId, timeSpent } = req.body;

    if (!attemptId) {
        return res.status(400).json({ error: 'Attempt ID is required' });
    }

    const attempt = await validateAttempt(user.id, attemptId);
    if (!attempt) {
        return res.status(404).json({
            error: 'Assessment attempt not found or not in progress'
        });
    }

    const finalScore = await calculateFinalScore(attemptId);
    const submittedAttempt = await submitAssessment(attemptId, finalScore, timeSpent);

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
        summary: {
            totalQuestions: attempt.total_questions,
            answeredQuestions: finalScore.questionsAnswered,
            pointsEarned: finalScore.totalPointsEarned,
            totalPoints: finalScore.totalMaxPoints,
            score: finalScore.score,
            passed: submittedAttempt.is_passed,
            passingScore: attempt.passing_score,
            timeSpent: finalScore.totalTimeSpent
        }
    });
}