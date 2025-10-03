/**
 * Assessment API endpoints
 * Handles assessment management, attempts, and submissions
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

// Database helper functions
async function getAllAssessments() {
    try {
        const result = await sql`
            SELECT
                id,
                step_number,
                title,
                description,
                duration_minutes,
                total_questions,
                passing_score,
                is_active,
                created_at
            FROM assessments
            ORDER BY step_number ASC
        `;
        return result.rows;
    } catch (error) {
        console.error('Database error in getAllAssessments:', error);
        throw error;
    }
}

async function getAssessmentById(assessmentId) {
    try {
        const result = await sql`
            SELECT * FROM assessments WHERE id = ${assessmentId}
        `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('Database error in getAssessmentById:', error);
        throw error;
    }
}

async function getAssessmentByStep(stepNumber) {
    try {
        const result = await sql`
            SELECT * FROM assessments WHERE step_number = ${stepNumber}
        `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('Database error in getAssessmentByStep:', error);
        throw error;
    }
}

async function createAssessmentAttempt(userId, assessmentId) {
    try {
        const result = await sql`
            INSERT INTO assessment_attempts (user_id, assessment_id, status, started_at)
            VALUES (${userId}, ${assessmentId}, 'in_progress', NOW())
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in createAssessmentAttempt:', error);
        throw error;
    }
}

async function getAssessmentAttempt(attemptId) {
    try {
        const result = await sql`
            SELECT * FROM assessment_attempts WHERE id = ${attemptId}
        `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('Database error in getAssessmentAttempt:', error);
        throw error;
    }
}

async function updateAssessmentAttempt(attemptId, updateData) {
    try {
        const result = await sql`
            UPDATE assessment_attempts
            SET
                status = ${updateData.status || 'in_progress'},
                completed_at = ${updateData.submitted_at || null},
                time_spent_seconds = ${updateData.time_spent_seconds || 0},
                score = ${updateData.score || 0}
            WHERE id = ${attemptId}
            RETURNING *
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Database error in updateAssessmentAttempt:', error);
        throw error;
    }
}

async function getQuestionsByAssessment(assessmentId) {
    try {
        const result = await sql`
            SELECT * FROM questions
            WHERE assessment_id = ${assessmentId}
            ORDER BY id ASC
        `;
        return result.rows;
    } catch (error) {
        console.error('Database error in getQuestionsByAssessment:', error);
        throw error;
    }
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // For simplicity, let's handle direct endpoint calls
    const url = new URL(req.url, `http://${req.headers.host}`);
    const searchParams = url.searchParams;
    const endpoint = searchParams.get('endpoint') || 'list';

    try {
        // Initialize database on first request
        if (req.headers['x-init-db'] === 'true') {
            await initializeDatabase();
        }

        switch (endpoint) {
            case 'list':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleGetAssessments(req, res);

            case 'start':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleStartAssessment(req, res);

            case 'questions':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleGetQuestions(req, res, searchParams);

            case 'submit-answer':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleSubmitAnswer(req, res);

            case 'submit-assessment':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleSubmitAssessment(req, res);

            case 'attempt':
                if (req.method === 'GET') {
                    return await handleGetAttempt(req, res, searchParams);
                }
                return res.status(405).json({ error: 'Method not allowed' });

            case 'progress':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleGetProgress(req, res, searchParams);

            case 'stats':
                if (req.method !== 'GET') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleGetStats(req, res);

            default:
                return res.status(404).json({ error: 'Endpoint not found' });
        }
    } catch (error) {
        console.error('Assessment API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleGetAssessments(req, res) {
    try {
        const assessments = await getAllAssessments();
        return res.status(200).json({
            success: true,
            assessments
        });
    } catch (error) {
        console.error('Get assessments error:', error);
        return res.status(500).json({ error: 'Failed to fetch assessments' });
    }
}

async function handleStartAssessment(req, res) {
    try {
        const user = verifyToken(req);
        const { assessmentId, stepNumber } = req.body;

        let assessment;
        if (assessmentId) {
            assessment = await getAssessmentById(assessmentId);
        } else if (stepNumber) {
            assessment = await getAssessmentByStep(stepNumber);
        } else {
            return res.status(400).json({
                error: 'Assessment ID or step number is required'
            });
        }

        if (!assessment) {
            return res.status(404).json({
                error: 'Assessment not found'
            });
        }

        // Create or get existing attempt
        const attempt = await createAssessmentAttempt(user.id, assessment.id);

        return res.status(200).json({
            success: true,
            attempt: {
                id: attempt.id,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                durationMinutes: assessment.duration_minutes,
                totalQuestions: assessment.total_questions,
                startedAt: attempt.started_at,
                status: attempt.status
            }
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Start assessment error:', error);
        return res.status(500).json({ error: 'Failed to start assessment' });
    }
}

async function handleGetQuestions(req, res, searchParams) {
    try {
        const user = verifyToken(req);
        const assessmentId = searchParams.get('assessmentId');
        const attemptId = searchParams.get('attemptId');

        if (!assessmentId) {
            return res.status(400).json({
                error: 'Assessment ID is required'
            });
        }

        // Verify user has access to this assessment
        if (attemptId) {
            const attempt = await getAssessmentAttempt(attemptId);
            if (!attempt || attempt.user_id !== user.id) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
        }

        const questions = await getQuestionsByAssessment(assessmentId);

        // Remove correct answers and explanations for students during assessment
        const sanitizedQuestions = questions.map(question => ({
            id: question.id,
            question_type: question.question_type,
            question_text: question.question_text,
            code_snippet: question.code_snippet,
            options: question.options,
            points: question.points,
            difficulty: question.difficulty,
            order_index: question.order_index,
            // Don't include correct_answer, explanation, or test_cases for students during assessment
            ...(user.role === 'teacher' && {
                correct_answer: question.correct_answer,
                explanation: question.explanation,
                test_cases: question.test_cases
            })
        }));

        return res.status(200).json({
            success: true,
            questions: sanitizedQuestions
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get questions error:', error);
        return res.status(500).json({ error: 'Failed to fetch questions' });
    }
}

async function handleSubmitAnswer(req, res) {
    try {
        const user = verifyToken(req);
        const { attemptId, questionId, answer, timeSpent, executionResult } = req.body;

        if (!attemptId || !questionId || answer === undefined) {
            return res.status(400).json({
                error: 'Attempt ID, question ID, and answer are required'
            });
        }

        // Verify user owns this attempt
        const attempt = await getAssessmentAttempt(attemptId);
        if (!attempt || attempt.user_id !== user.id) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        if (attempt.status !== 'in_progress') {
            return res.status(400).json({
                error: 'Assessment is no longer in progress'
            });
        }

        // Get question details for scoring
        const questions = await getQuestionsByAssessment(attempt.assessment_id);
        const question = questions.find(q => q.id === questionId);

        if (!question) {
            return res.status(404).json({
                error: 'Question not found'
            });
        }

        // Calculate score
        let isCorrect = false;
        let pointsEarned = 0;

        if (question.question_type === 'coding_challenge') {
            // For coding challenges, check against test cases
            if (executionResult && executionResult.success) {
                isCorrect = true;
                pointsEarned = question.points;
            }
        } else {
            // For other question types, compare answer
            isCorrect = answer.toString().toLowerCase() === question.correct_answer.toLowerCase();
            pointsEarned = isCorrect ? question.points : 0;
        }

        // Save response
        const responseData = {
            attempt_id: attemptId,
            question_id: questionId,
            user_answer: answer,
            is_correct: isCorrect,
            points_earned: pointsEarned,
            time_spent_seconds: timeSpent || 0,
            code_execution_result: executionResult || null
        };

        await saveQuestionResponse(responseData);

        return res.status(200).json({
            success: true,
            isCorrect,
            pointsEarned,
            explanation: isCorrect ? question.explanation : null // Only show explanation if correct
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Submit answer error:', error);
        return res.status(500).json({ error: 'Failed to submit answer' });
    }
}

async function handleSubmitAssessment(req, res) {
    try {
        const user = verifyToken(req);
        const { attemptId, totalTimeSpent } = req.body;

        if (!attemptId) {
            return res.status(400).json({
                error: 'Attempt ID is required'
            });
        }

        // Verify user owns this attempt
        const attempt = await getAssessmentAttempt(attemptId);
        if (!attempt || attempt.user_id !== user.id) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        if (attempt.status !== 'in_progress') {
            return res.status(400).json({
                error: 'Assessment is already submitted'
            });
        }

        // Calculate final score
        // This would typically involve querying question_responses for this attempt
        // For now, we'll use placeholder values
        const totalPoints = 100; // This should be calculated from actual responses
        const earnedPoints = 75;  // This should be calculated from actual responses
        const percentage = (earnedPoints / totalPoints) * 100;
        const isPassed = percentage >= 70; // Assuming 70% pass rate

        // Update attempt with final results
        const updateData = {
            submitted_at: new Date().toISOString(),
            time_spent_seconds: totalTimeSpent || 0,
            score: earnedPoints,
            total_points: totalPoints,
            percentage: percentage,
            status: 'submitted',
            is_passed: isPassed
        };

        await updateAssessmentAttempt(attemptId, updateData);

        return res.status(200).json({
            success: true,
            results: {
                score: earnedPoints,
                totalPoints,
                percentage,
                isPassed,
                timeSpent: totalTimeSpent
            }
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Submit assessment error:', error);
        return res.status(500).json({ error: 'Failed to submit assessment' });
    }
}

async function handleGetAttempt(req, res, searchParams) {
    try {
        const user = verifyToken(req);
        const attemptId = searchParams.get('id');

        if (!attemptId) {
            return res.status(400).json({
                error: 'Attempt ID is required'
            });
        }

        const attempt = await getAssessmentAttempt(attemptId);

        if (!attempt) {
            return res.status(404).json({
                error: 'Attempt not found'
            });
        }

        // Students can only view their own attempts, teachers can view all
        if (user.role === 'student' && attempt.user_id !== user.id) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        return res.status(200).json({
            success: true,
            attempt
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get attempt error:', error);
        return res.status(500).json({ error: 'Failed to fetch attempt' });
    }
}

async function handleGetProgress(req, res, searchParams) {
    try {
        const user = verifyToken(req);
        const userId = searchParams.get('userId');

        // Students can only view their own progress
        const targetUserId = (user.role === 'student') ? user.id : (userId ? parseInt(userId) : null);

        const progress = await getStudentProgress(targetUserId);

        return res.status(200).json({
            success: true,
            progress
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get progress error:', error);
        return res.status(500).json({ error: 'Failed to fetch progress' });
    }
}

async function handleGetStats(req, res) {
    try {
        const user = verifyToken(req);

        // Only teachers and admins can view stats
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const stats = await getAssessmentStats();

        return res.status(200).json({
            success: true,
            stats
        });

    } catch (error) {
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.error('Get stats error:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
}