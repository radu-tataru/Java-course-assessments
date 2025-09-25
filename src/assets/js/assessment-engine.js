/**
 * Java Course Assessment System - Core Engine
 * Handles question rendering, user interactions, and score calculation
 */

class AssessmentEngine {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showProgress: true,
            allowSkip: true,
            shuffleQuestions: false,
            shuffleAnswers: false,
            timeLimit: null,
            autoSave: true,
            autoSaveInterval: 30000,
            ...options
        };

        this.currentQuestionIndex = 0;
        this.questions = [];
        this.userAnswers = {};
        this.startTime = null;
        this.endTime = null;
        this.autoSaveTimer = null;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Assessment container not found');
            return;
        }

        // Load saved progress if available
        this.loadProgress();

        // Setup auto-save if enabled
        if (this.options.autoSave) {
            this.setupAutoSave();
        }

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Load questions from JSON data
     */
    async loadQuestions(questionsData) {
        try {
            this.questions = Array.isArray(questionsData) ? questionsData : questionsData.questions;

            // Shuffle questions if option is enabled
            if (this.options.shuffleQuestions) {
                this.shuffleArray(this.questions);
            }

            // Shuffle answers for each question if option is enabled
            if (this.options.shuffleAnswers) {
                this.questions.forEach(question => {
                    if (question.type === CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE && question.answers) {
                        this.shuffleArray(question.answers);
                    }
                });
            }

            this.startTime = new Date();
            this.renderQuestion();

        } catch (error) {
            console.error('Error loading questions:', error);
            this.showError('Failed to load assessment questions');
        }
    }

    /**
     * Render the current question
     */
    renderQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        if (!question) return;

        const questionHtml = this.generateQuestionHtml(question);
        this.container.innerHTML = questionHtml;

        // Setup question-specific event handlers
        this.setupQuestionHandlers(question);

        // Update progress if enabled
        if (this.options.showProgress) {
            this.updateProgress();
        }

        // Apply animations
        this.container.querySelector('.question-card').classList.add('fade-in');
    }

    /**
     * Generate HTML for different question types
     */
    generateQuestionHtml(question) {
        const baseHtml = `
            <div class="question-card">
                <div class="question-header">
                    <span class="question-number">Question ${this.currentQuestionIndex + 1}</span>
                    <span class="question-type">${this.formatQuestionType(question.type)}</span>
                </div>
                <div class="question-content">
                    <div class="question-text">${question.question}</div>
                    ${this.generateQuestionContent(question)}
                </div>
            </div>
            ${this.generateNavigationHtml()}
        `;

        return baseHtml;
    }

    /**
     * Generate content based on question type
     */
    generateQuestionContent(question) {
        switch (question.type) {
            case CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE:
                return this.generateMultipleChoiceHtml(question);

            case CONFIG.QUESTION_TYPES.CODE_READING:
                return this.generateCodeReadingHtml(question);

            case CONFIG.QUESTION_TYPES.CODE_COMPLETION:
                return this.generateCodeCompletionHtml(question);

            case CONFIG.QUESTION_TYPES.CODING_CHALLENGE:
                return this.generateCodingChallengeHtml(question);

            case CONFIG.QUESTION_TYPES.TRUE_FALSE:
                return this.generateTrueFalseHtml(question);

            default:
                return '<p class="text-danger">Unknown question type</p>';
        }
    }

    /**
     * Generate Multiple Choice HTML
     */
    generateMultipleChoiceHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex];

        let html = '<ul class="answer-options">';

        question.answers.forEach((answer, index) => {
            const isSelected = savedAnswer && savedAnswer.includes(index);
            const inputType = question.multipleCorrect ? 'checkbox' : 'radio';
            const inputName = `question-${this.currentQuestionIndex}`;

            html += `
                <li class="answer-option ${isSelected ? 'selected' : ''}">
                    <label>
                        <input type="${inputType}" name="${inputName}" value="${index}" ${isSelected ? 'checked' : ''}>
                        ${answer.text}
                    </label>
                </li>
            `;
        });

        html += '</ul>';
        return html;
    }

    /**
     * Generate Code Reading HTML
     */
    generateCodeReadingHtml(question) {
        let html = `
            <div class="code-block">
                <pre><code class="language-java">${question.code}</code></pre>
            </div>
            <div class="question-text">What does this code do/output?</div>
        `;

        // Add multiple choice answers if provided
        if (question.answers) {
            html += this.generateMultipleChoiceHtml(question);
        } else {
            // Text area for open-ended response
            const savedAnswer = this.userAnswers[this.currentQuestionIndex] || '';
            html += `
                <div class="form-group">
                    <textarea class="form-control" rows="4" placeholder="Explain what this code does..."
                              data-question-input>${savedAnswer}</textarea>
                </div>
            `;
        }

        return html;
    }

    /**
     * Generate Code Completion HTML
     */
    generateCodeCompletionHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex] || '';

        return `
            <div class="code-block">
                <pre><code class="language-java">${question.incompleteCode}</code></pre>
            </div>
            <div class="form-group">
                <label>Complete the missing code:</label>
                <textarea class="form-control code-input" rows="3"
                          placeholder="Write your code here..."
                          data-question-input>${savedAnswer}</textarea>
            </div>
            <div class="mt-3">
                <small class="text-muted">
                    <i class="bi bi-info-circle"></i>
                    ${question.hint || 'Focus on the specific functionality being tested.'}
                </small>
            </div>
        `;
    }

    /**
     * Generate Coding Challenge HTML
     */
    generateCodingChallengeHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex] || '';

        return `
            <div class="coding-challenge">
                <div class="challenge-requirements">
                    <h5>Requirements:</h5>
                    <ul>
                        ${question.requirements.map(req => `<li>${req}</li>`).join('')}
                    </ul>
                </div>

                <div class="code-editor mt-4">
                    <div class="code-editor-header">
                        <span>Write your Java code:</span>
                        <div>
                            <button class="btn-execute" data-execute-code>
                                <i class="bi bi-play-fill"></i> Run Code
                            </button>
                        </div>
                    </div>
                    <div class="code-editor-content">
                        <textarea data-question-input placeholder="// Write your Java code here\\npublic class Solution {\\n    \\n}">${savedAnswer}</textarea>
                    </div>
                </div>

                <div class="execution-result" data-execution-result style="display: none;"></div>

                ${question.testCases ? `
                <div class="test-cases mt-3">
                    <h6>Test Cases:</h6>
                    <div class="test-case-list">
                        ${question.testCases.map((testCase, index) => `
                            <div class="alert alert-info">
                                <strong>Test ${index + 1}:</strong>
                                Input: <code>${testCase.input}</code> →
                                Expected: <code>${testCase.expected}</code>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Generate True/False HTML
     */
    generateTrueFalseHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex];

        return `
            <ul class="answer-options">
                <li class="answer-option ${savedAnswer === 'true' ? 'selected' : ''}">
                    <label>
                        <input type="radio" name="question-${this.currentQuestionIndex}" value="true" ${savedAnswer === 'true' ? 'checked' : ''}>
                        True
                    </label>
                </li>
                <li class="answer-option ${savedAnswer === 'false' ? 'selected' : ''}">
                    <label>
                        <input type="radio" name="question-${this.currentQuestionIndex}" value="false" ${savedAnswer === 'false' ? 'checked' : ''}>
                        False
                    </label>
                </li>
            </ul>
            ${question.explanation ? `
                <div class="mt-3">
                    <small class="text-muted">
                        <i class="bi bi-lightbulb"></i>
                        ${question.explanation}
                    </small>
                </div>
            ` : ''}
        `;
    }

    /**
     * Generate navigation HTML
     */
    generateNavigationHtml() {
        const isFirst = this.currentQuestionIndex === 0;
        const isLast = this.currentQuestionIndex === this.questions.length - 1;

        return `
            <div class="assessment-navigation">
                <button class="btn-secondary" ${isFirst ? 'disabled' : ''} data-prev-question>
                    <i class="bi bi-arrow-left"></i> Previous
                </button>

                <div class="question-counter">
                    ${this.currentQuestionIndex + 1} of ${this.questions.length}
                </div>

                <button class="btn-primary" data-next-question>
                    ${isLast ? '<i class="bi bi-check-circle"></i> Finish Assessment' : 'Next <i class="bi bi-arrow-right"></i>'}
                </button>
            </div>
        `;
    }

    /**
     * Setup question-specific event handlers
     */
    setupQuestionHandlers(question) {
        // Handle multiple choice/true-false selections
        this.container.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                this.handleAnswerChange();
            });
        });

        // Handle text inputs
        this.container.querySelectorAll('[data-question-input]').forEach(input => {
            input.addEventListener('input', () => {
                this.handleAnswerChange();
            });
        });

        // Handle code execution
        const executeBtn = this.container.querySelector('[data-execute-code]');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                this.executeCode(question);
            });
        }
    }

    /**
     * Handle answer changes and save progress
     */
    handleAnswerChange() {
        const question = this.questions[this.currentQuestionIndex];
        let answer = null;

        switch (question.type) {
            case CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE:
                if (question.multipleCorrect) {
                    // Handle checkboxes
                    answer = [];
                    this.container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                        answer.push(parseInt(checkbox.value));
                    });
                } else {
                    // Handle radio buttons
                    const selected = this.container.querySelector('input[type="radio"]:checked');
                    if (selected) {
                        answer = [parseInt(selected.value)];
                    }
                }
                break;

            case CONFIG.QUESTION_TYPES.TRUE_FALSE:
                const selectedRadio = this.container.querySelector('input[type="radio"]:checked');
                if (selectedRadio) {
                    answer = selectedRadio.value;
                }
                break;

            default:
                // Handle text inputs
                const textInput = this.container.querySelector('[data-question-input]');
                if (textInput) {
                    answer = textInput.value.trim();
                }
                break;
        }

        // Save answer
        if (answer !== null && answer !== '' && !(Array.isArray(answer) && answer.length === 0)) {
            this.userAnswers[this.currentQuestionIndex] = answer;
        } else {
            delete this.userAnswers[this.currentQuestionIndex];
        }

        // Update UI to show selection
        this.updateSelectionUI();

        // Auto-save progress
        if (this.options.autoSave) {
            this.saveProgress();
        }
    }

    /**
     * Update UI to reflect current selection
     */
    updateSelectionUI() {
        this.container.querySelectorAll('.answer-option').forEach(option => {
            option.classList.remove('selected');
        });

        this.container.querySelectorAll('input:checked').forEach(input => {
            input.closest('.answer-option').classList.add('selected');
        });
    }

    /**
     * Setup general event listeners
     */
    setupEventListeners() {
        // Use event delegation for dynamic content
        this.container.addEventListener('click', (e) => {
            if (e.target.matches('[data-next-question]')) {
                this.nextQuestion();
            } else if (e.target.matches('[data-prev-question]')) {
                this.prevQuestion();
            }
        });
    }

    /**
     * Navigate to next question or finish assessment
     */
    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderQuestion();
        } else {
            this.finishAssessment();
        }
    }

    /**
     * Navigate to previous question
     */
    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderQuestion();
        }
    }

    /**
     * Finish assessment and show results
     */
    finishAssessment() {
        this.endTime = new Date();
        const results = this.calculateResults();
        this.showResults(results);

        // Save final results
        this.saveFinalResults(results);

        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
    }

    /**
     * Calculate assessment results
     */
    calculateResults() {
        let totalQuestions = this.questions.length;
        let correctAnswers = 0;
        let partialAnswers = 0;
        let questionResults = [];

        this.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            let questionScore = 0;
            let isCorrect = false;

            if (question.correctAnswer !== undefined) {
                if (question.type === CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE) {
                    if (Array.isArray(question.correctAnswer)) {
                        // Multiple correct answers
                        if (Array.isArray(userAnswer) && userAnswer.length > 0) {
                            const correctSet = new Set(question.correctAnswer);
                            const userSet = new Set(userAnswer);

                            // Calculate partial credit
                            const intersection = new Set([...userSet].filter(x => correctSet.has(x)));
                            const union = new Set([...userSet, ...correctSet]);

                            questionScore = intersection.size / correctSet.size;
                            isCorrect = questionScore === 1;

                            if (questionScore > 0 && questionScore < 1) {
                                partialAnswers++;
                            }
                        }
                    } else {
                        // Single correct answer
                        isCorrect = Array.isArray(userAnswer) &&
                                   userAnswer.length === 1 &&
                                   userAnswer[0] === question.correctAnswer;
                        questionScore = isCorrect ? 1 : 0;
                    }
                } else if (question.type === CONFIG.QUESTION_TYPES.TRUE_FALSE) {
                    isCorrect = userAnswer === question.correctAnswer.toString();
                    questionScore = isCorrect ? 1 : 0;
                }
            }

            if (isCorrect) {
                correctAnswers++;
            }

            questionResults.push({
                questionIndex: index,
                question: question.question,
                userAnswer: userAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect: isCorrect,
                score: questionScore,
                type: question.type
            });
        });

        const totalScore = questionResults.reduce((sum, result) => sum + result.score, 0);
        const percentage = Math.round((totalScore / totalQuestions) * 100);
        const duration = this.endTime - this.startTime;

        return {
            totalQuestions,
            correctAnswers,
            partialAnswers,
            incorrectAnswers: totalQuestions - correctAnswers - partialAnswers,
            totalScore,
            percentage,
            duration,
            questionResults,
            passed: percentage >= CONFIG.COURSE.PASSING_SCORE
        };
    }

    /**
     * Show assessment results
     */
    showResults(results) {
        const resultsHtml = `
            <div class="results-summary fade-in">
                <div class="score-display">
                    <div class="score-number">${results.percentage}%</div>
                    <div class="score-label">Final Score</div>
                    <div class="mt-2">
                        <span class="badge ${results.passed ? 'bg-success' : 'bg-danger'}">
                            ${results.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                        </span>
                    </div>
                </div>

                <div class="score-breakdown">
                    <div class="score-item">
                        <div class="score-item-number" style="color: var(--success-color);">${results.correctAnswers}</div>
                        <div class="score-item-label">Correct</div>
                    </div>
                    <div class="score-item">
                        <div class="score-item-number" style="color: var(--warning-color);">${results.partialAnswers}</div>
                        <div class="score-item-label">Partial</div>
                    </div>
                    <div class="score-item">
                        <div class="score-item-number" style="color: var(--danger-color);">${results.incorrectAnswers}</div>
                        <div class="score-item-label">Incorrect</div>
                    </div>
                    <div class="score-item">
                        <div class="score-item-number">${this.formatDuration(results.duration)}</div>
                        <div class="score-item-label">Time Taken</div>
                    </div>
                </div>

                <div class="assessment-navigation mt-4">
                    <button class="btn-secondary" data-review-answers>
                        <i class="bi bi-eye"></i> Review Answers
                    </button>
                    <button class="btn-primary" data-restart-assessment>
                        <i class="bi bi-arrow-clockwise"></i> Retake Assessment
                    </button>
                </div>
            </div>
        `;

        this.container.innerHTML = resultsHtml;

        // Setup results event handlers
        this.container.querySelector('[data-review-answers]').addEventListener('click', () => {
            this.reviewAnswers(results);
        });

        this.container.querySelector('[data-restart-assessment]').addEventListener('click', () => {
            this.restartAssessment();
        });
    }

    // Utility methods
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    formatQuestionType(type) {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDuration(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        const progressBar = this.container.querySelector('.progress-fill');
        const progressText = this.container.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
        }
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${message}
            </div>
        `;
    }

    // Progress management
    saveProgress() {
        const progressData = {
            currentQuestionIndex: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            startTime: this.startTime,
            questions: this.questions
        };

        localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ASSESSMENT, JSON.stringify(progressData));
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ASSESSMENT);
            if (saved) {
                const progressData = JSON.parse(saved);
                this.currentQuestionIndex = progressData.currentQuestionIndex || 0;
                this.userAnswers = progressData.userAnswers || {};
                this.startTime = progressData.startTime ? new Date(progressData.startTime) : new Date();

                if (progressData.questions) {
                    this.questions = progressData.questions;
                }
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }

    setupAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            this.saveProgress();
        }, this.options.autoSaveInterval);
    }

    saveFinalResults(results) {
        const submissionData = {
            timestamp: new Date().toISOString(),
            stepNumber: this.options.stepNumber || 1,
            studentId: this.options.studentId || 'anonymous',
            results: results
        };

        // Save to localStorage for teacher dashboard
        let submissions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SUBMISSIONS) || '[]');
        submissions.push(submissionData);
        localStorage.setItem(CONFIG.STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));

        // Clear current assessment progress
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_ASSESSMENT);
    }

    restartAssessment() {
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.startTime = new Date();
        this.endTime = null;

        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_ASSESSMENT);

        if (this.questions.length > 0) {
            this.renderQuestion();
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AssessmentEngine = AssessmentEngine;
}