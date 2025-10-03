/**
 * Java Course Assessment System - Database-Integrated Engine
 * Handles assessment management with authentication and database persistence
 */

class DatabaseAssessmentEngine {
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

        this.apiUrl = '/api';
        this.currentQuestionIndex = 0;
        this.questions = [];
        this.userAnswers = {};
        this.assessmentData = null;
        this.attemptData = null;
        this.startTime = null;
        this.endTime = null;
        this.autoSaveTimer = null;
        this.timeTracker = {};

        this.init();
    }

    async init() {
        if (!this.container) {
            console.error('Assessment container not found');
            return;
        }

        // Check authentication
        if (!authUtils.isAuthenticated()) {
            this.redirectToLogin();
            return;
        }

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Start assessment by step number
     */
    async startAssessment(stepNumber) {
        try {
            this.showLoading('Preparing your assessment...');

            // Start assessment session
            const response = await fetch(`${this.apiUrl}/assessment-handler?action=start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authUtils.getToken()}`
                },
                body: JSON.stringify({ stepNumber })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.attemptData = data.attempt;
                this.assessmentData = data.assessment;
                this.questions = data.questions || [];

                // Store questions with proper formatting
                this.questions = this.questions.map((q, index) => ({
                    ...q,
                    index: index,
                    timeStarted: null,
                    timeSpent: 0
                }));

                // Initialize timer if time limit is set
                if (this.assessmentData.duration_minutes) {
                    this.initializeTimer(this.assessmentData.duration_minutes * 60); // Convert to seconds
                }

                // Start auto-save if enabled
                if (this.options.autoSave) {
                    this.setupAutoSave();
                }

                this.startTime = new Date();
                this.showBottomNav();
                this.renderCurrentQuestion();

            } else {
                throw new Error(data.error || 'Failed to start assessment');
            }

        } catch (error) {
            console.error('Start assessment error:', error);
            this.showError('Failed to start assessment: ' + error.message);
        }
    }

    /**
     * Load questions from database
     */
    async loadQuestions() {
        try {
            const response = await authUtils.apiRequest(
                `${this.apiUrl}/assessments/questions?assessmentId=${this.assessmentData.id}&attemptId=${this.attemptData.id}`
            );

            const data = await response.json();

            if (data.success) {
                this.questions = data.questions;

                // Shuffle questions if option is enabled
                if (this.options.shuffleQuestions) {
                    this.shuffleArray(this.questions);
                }

                // Initialize time tracking for each question
                this.questions.forEach((_, index) => {
                    this.timeTracker[index] = 0;
                });

                // Shuffle answers if option is enabled
                if (this.options.shuffleAnswers) {
                    this.shuffleQuestionAnswers();
                }

            } else {
                throw new Error(data.error || 'Failed to load questions');
            }

        } catch (error) {
            console.error('Load questions error:', error);
            this.showError('Failed to load questions: ' + error.message);
        }
    }

    /**
     * Render current question
     */
    renderCurrentQuestion() {
        if (this.questions.length === 0) {
            this.showError('No questions available');
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        const questionNumber = this.currentQuestionIndex + 1;

        this.hideLoading();

        // Track time spent on this question
        this.startQuestionTimer();

        // Render based on question type
        switch (question.question_type) {
            case 'multiple_choice':
                this.renderMultipleChoice(question, questionNumber);
                break;
            case 'code_reading':
                this.renderCodeReading(question, questionNumber);
                break;
            case 'true_false':
                this.renderTrueFalse(question, questionNumber);
                break;
            case 'code_completion':
                this.renderCodeCompletion(question, questionNumber);
                break;
            case 'coding_challenge':
                this.renderCodingChallenge(question, questionNumber);
                break;
            default:
                this.showError('Unknown question type: ' + question.question_type);
        }

        // Update progress indicator
        this.updateProgressIndicator();

        // Update bottom navigation buttons
        this.updateBottomNav();
    }

    /**
     * Render multiple choice question
     */
    renderMultipleChoice(question, questionNumber) {
        const options = question.options || [];
        const savedAnswer = this.userAnswers[question.id];

        const html = `
            <div class="assessment-question">
                <div class="question-header mb-4">
                    <div class="question-meta d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">Question ${questionNumber} of ${this.questions.length}</span>
                        <span class="badge bg-secondary">${question.difficulty || 'Medium'}</span>
                        <span class="badge bg-info">${question.points || 10} points</span>
                    </div>
                    <h3 class="question-text">${question.question_text}</h3>
                </div>

                <div class="question-options">
                    ${options.map((option, index) => {
                        // Handle both string and object formats for options
                        const optionText = typeof option === 'string' ? option : option.text;
                        return `
                        <div class="form-check mb-3">
                            <input class="form-check-input"
                                   type="radio"
                                   name="question_${question.id}"
                                   id="option_${index}"
                                   value="${optionText}"
                                   ${savedAnswer === optionText ? 'checked' : ''}>
                            <label class="form-check-label" for="option_${index}">
                                ${optionText}
                            </label>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="question-actions mt-4">
                    ${this.renderNavigationButtons()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupQuestionEventListeners(question);
    }

    /**
     * Render code reading question
     */
    renderCodeReading(question, questionNumber) {
        const options = question.options || [];
        const savedAnswer = this.userAnswers[question.id];

        const html = `
            <div class="assessment-question">
                <div class="question-header mb-4">
                    <div class="question-meta d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">Question ${questionNumber} of ${this.questions.length}</span>
                        <span class="badge bg-secondary">${question.difficulty || 'Medium'}</span>
                        <span class="badge bg-info">${question.points || 10} points</span>
                    </div>
                    <h3 class="question-text">${question.question_text}</h3>
                </div>

                ${question.code_snippet ? `
                    <div class="code-snippet mb-4">
                        <pre><code class="language-java">${this.escapeHtml(question.code_snippet)}</code></pre>
                    </div>
                ` : ''}

                <div class="question-options">
                    ${options.map((option, index) => {
                        // Handle both string and object formats for options
                        const optionText = typeof option === 'string' ? option : option.text;
                        return `
                        <div class="form-check mb-3">
                            <input class="form-check-input"
                                   type="radio"
                                   name="question_${question.id}"
                                   id="option_${index}"
                                   value="${optionText}"
                                   ${savedAnswer === optionText ? 'checked' : ''}>
                            <label class="form-check-label" for="option_${index}">
                                ${optionText}
                            </label>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="question-actions mt-4">
                    ${this.renderNavigationButtons()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupQuestionEventListeners(question);
    }

    /**
     * Render true/false question
     */
    renderTrueFalse(question, questionNumber) {
        const savedAnswer = this.userAnswers[question.id];

        const html = `
            <div class="assessment-question">
                <div class="question-header mb-4">
                    <div class="question-meta d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">Question ${questionNumber} of ${this.questions.length}</span>
                        <span class="badge bg-secondary">${question.difficulty || 'Medium'}</span>
                        <span class="badge bg-info">${question.points || 5} points</span>
                    </div>
                    <h3 class="question-text">${question.question_text}</h3>
                </div>

                <div class="question-options">
                    <div class="form-check mb-3">
                        <input class="form-check-input"
                               type="radio"
                               name="question_${question.id}"
                               id="true_option"
                               value="true"
                               ${savedAnswer === 'true' ? 'checked' : ''}>
                        <label class="form-check-label" for="true_option">
                            True
                        </label>
                    </div>
                    <div class="form-check mb-3">
                        <input class="form-check-input"
                               type="radio"
                               name="question_${question.id}"
                               id="false_option"
                               value="false"
                               ${savedAnswer === 'false' ? 'checked' : ''}>
                        <label class="form-check-label" for="false_option">
                            False
                        </label>
                    </div>
                </div>

                <div class="question-actions mt-4">
                    ${this.renderNavigationButtons()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupQuestionEventListeners(question);
    }

    /**
     * Render code completion question
     */
    renderCodeCompletion(question, questionNumber) {
        const template = question.options?.template || [];
        const requirements = question.options?.requirements || [];
        const savedAnswer = this.userAnswers[question.id] || '';

        // Generate complete template with user code
        const completeTemplate = this.generateCompleteTemplate(template, savedAnswer);

        const html = `
            <div class="assessment-question">
                <div class="question-header mb-4">
                    <div class="question-meta d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">Question ${questionNumber} of ${this.questions.length}</span>
                        <span class="badge bg-secondary">${question.difficulty || 'Medium'}</span>
                        <span class="badge bg-info">${question.points || 15} points</span>
                    </div>
                    <h3 class="question-text">${question.question_text}</h3>
                </div>

                ${requirements.length > 0 ? `
                    <div class="requirements-section mb-4">
                        <h6>Requirements:</h6>
                        <ul class="list-unstyled">
                            ${requirements.map(req => `<li><small class="text-muted">${req}</small></li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="code-editor-section">
                    <div class="code-editor-container mb-3" data-code-editor></div>
                    <textarea class="d-none"
                              data-question-input
                              name="question_${question.id}">${completeTemplate}</textarea>
                </div>

                <div class="question-actions mt-4">
                    ${this.renderNavigationButtons()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupCodeEditor();
        this.setupQuestionEventListeners(question);
    }

    /**
     * Render coding challenge question
     */
    renderCodingChallenge(question, questionNumber) {
        const template = question.options?.template || [];
        const requirements = question.options?.requirements || [];
        const testCases = question.test_cases || [];
        const savedAnswer = this.userAnswers[question.id] || '';

        // Generate complete template with user code
        const completeTemplate = this.generateCompleteTemplate(template, savedAnswer);

        const html = `
            <div class="assessment-question">
                <div class="question-header mb-4">
                    <div class="question-meta d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">Question ${questionNumber} of ${this.questions.length}</span>
                        <span class="badge bg-secondary">${question.difficulty || 'Medium'}</span>
                        <span class="badge bg-info">${question.points || 20} points</span>
                    </div>
                    <h3 class="question-text">${question.question_text}</h3>
                </div>

                ${requirements.length > 0 ? `
                    <div class="requirements-section mb-4">
                        <h6>Requirements:</h6>
                        <ul class="list-unstyled">
                            ${requirements.map(req => `<li><small class="text-muted">${req}</small></li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${testCases.length > 0 ? `
                    <div class="test-cases-section mb-4">
                        <h6>Test Cases:</h6>
                        ${testCases.map(tc => `
                            <div class="test-case mb-2">
                                <small class="text-muted">${tc.description}</small>
                                <div class="text-monospace small">Expected: ${tc.expected}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="code-editor-section">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6>Your Code:</h6>
                        <button class="btn btn-success btn-sm" data-execute-code>
                            <i class="bi bi-play-circle"></i> Test & Execute
                        </button>
                    </div>
                    <div class="code-editor-container mb-3" data-code-editor></div>
                    <textarea class="d-none"
                              data-question-input
                              name="question_${question.id}">${completeTemplate}</textarea>
                </div>

                <div class="execution-result mb-4" data-execution-result style="display: none;"></div>

                <div class="question-actions mt-4">
                    ${this.renderNavigationButtons()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupCodeEditor();
        this.setupQuestionEventListeners(question);
    }

    /**
     * Submit answer for current question
     */
    async submitAnswer(question, answer) {
        try {
            const timeSpent = this.getQuestionTimeSpent();

            const response = await authUtils.apiRequest(`${this.apiUrl}/assessment-handler?action=submit-answer`, {
                method: 'POST',
                body: JSON.stringify({
                    attemptId: this.attemptData.id,
                    questionId: question.id,
                    answer: answer,
                    timeSpent: timeSpent,
                    executionResult: this.lastExecutionResult || null
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // Store answer locally
                this.userAnswers[question.id] = answer;

                // Show feedback if provided
                if (data.explanation && data.isCorrect) {
                    this.showAnswerFeedback(data.explanation, data.isCorrect, data.pointsEarned);
                }

                return data;
            } else {
                throw new Error(data.error || 'Failed to submit answer');
            }

        } catch (error) {
            console.error('Submit answer error:', error);
            this.showError('Failed to submit answer: ' + error.message);
            return null;
        }
    }

    /**
     * Submit complete assessment
     */
    async submitAssessment() {
        try {
            this.showLoading('Submitting your assessment...');

            const totalTimeSpent = this.getTotalTimeSpent();

            const response = await authUtils.apiRequest(`${this.apiUrl}/assessment-handler?action=submit-assessment`, {
                method: 'POST',
                body: JSON.stringify({
                    attemptId: this.attemptData.id,
                    timeSpent: totalTimeSpent
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.endTime = new Date();
                this.showResults(data.results);
            } else {
                throw new Error(data.error || 'Failed to submit assessment');
            }

        } catch (error) {
            console.error('Submit assessment error:', error);
            this.showError('Failed to submit assessment: ' + error.message);
        }
    }

    /**
     * Utility methods
     */
    generateCompleteTemplate(template, userCode) {
        if (Array.isArray(template)) {
            const templateString = template.join('\n');
            return templateString.replace('{{USER_CODE}}', userCode || '/* Write your code here */');
        }
        return userCode || '/* Write your code here */';
    }

    setupCodeEditor() {
        // Implementation would be similar to the original assessment engine
        // Using CodeMirror or similar syntax highlighter
    }

    renderNavigationButtons() {
        const isFirst = this.currentQuestionIndex === 0;
        const isLast = this.currentQuestionIndex === this.questions.length - 1;

        return `
            <div class="d-flex justify-content-between">
                <button class="btn btn-outline-secondary"
                        ${isFirst ? 'disabled' : ''}
                        data-prev-question>
                    <i class="bi bi-arrow-left"></i> Previous
                </button>

                <div class="text-center">
                    <button class="btn btn-success" data-save-answer>
                        <i class="bi bi-check-circle"></i> Save Answer
                    </button>
                </div>

                ${isLast ? `
                    <button class="btn btn-primary" data-submit-assessment>
                        <i class="bi bi-check-square"></i> Submit Assessment
                    </button>
                ` : `
                    <button class="btn btn-primary" data-next-question>
                        Next <i class="bi bi-arrow-right"></i>
                    </button>
                `}
            </div>
        `;
    }

    setupQuestionEventListeners(question) {
        // Previous/Next navigation
        const prevBtn = this.container.querySelector('[data-prev-question]');
        const nextBtn = this.container.querySelector('[data-next-question]');
        const saveBtn = this.container.querySelector('[data-save-answer]');
        const submitBtn = this.container.querySelector('[data-submit-assessment]');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPreviousQuestion());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToNextQuestion());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentAnswer(question));
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.confirmSubmission());
        }

        // Answer change listeners
        const radioInputs = this.container.querySelectorAll('input[type="radio"]');
        radioInputs.forEach(input => {
            input.addEventListener('change', () => this.handleAnswerChange());
        });

        // Code execution for coding challenges
        const executeBtn = this.container.querySelector('[data-execute-code]');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeCode(question));
        }
    }

    async saveCurrentAnswer(question) {
        const answer = this.getCurrentAnswer();
        if (answer) {
            await this.submitAnswer(question, answer);
        }
    }

    getCurrentAnswer() {
        const radioBtn = this.container.querySelector('input[type="radio"]:checked');
        if (radioBtn) {
            return radioBtn.value;
        }

        const textarea = this.container.querySelector('[data-question-input]');
        if (textarea) {
            return textarea.value;
        }

        return null;
    }

    // Timer management
    initializeTimer(totalSeconds) {
        // Implementation for countdown timer
    }

    startQuestionTimer() {
        this.questionStartTime = Date.now();
    }

    getQuestionTimeSpent() {
        if (!this.questionStartTime) return 0;
        return Math.floor((Date.now() - this.questionStartTime) / 1000);
    }

    getTotalTimeSpent() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }

    // UI helpers
    showLoading(message = 'Loading...') {
        this.container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <div class="h5">${message}</div>
            </div>
        `;
    }

    hideLoading() {
        // Loading will be hidden when next content is rendered
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }

    showResults(results) {
        // Ensure results object has all required properties
        const score = results?.score ?? 0;
        const totalPoints = results?.totalPoints ?? 100;
        const percentage = results?.percentage ?? 0;
        const isPassed = results?.isPassed ?? false;

        this.container.innerHTML = `
            <div class="assessment-results text-center py-5">
                <h2>Assessment Complete!</h2>
                <div class="results-summary mt-4">
                    <div class="row justify-content-center">
                        <div class="col-md-8">
                            <div class="card">
                                <div class="card-body">
                                    <h3 class="mb-4">Your Results</h3>
                                    <div class="row text-center">
                                        <div class="col-md-3">
                                            <div class="h4">${score}</div>
                                            <div class="text-muted">Points Earned</div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="h4">${totalPoints}</div>
                                            <div class="text-muted">Total Points</div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="h4">${percentage.toFixed(1)}%</div>
                                            <div class="text-muted">Score</div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="h4 ${isPassed ? 'text-success' : 'text-danger'}">
                                                ${isPassed ? 'PASSED' : 'NOT PASSED'}
                                            </div>
                                            <div class="text-muted">Status</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    redirectToLogin() {
        window.location.href = '/src/auth/login.html';
    }

    // Event setup
    setupEventListeners() {
        // Window beforeunload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.attemptData && this.attemptData.status === 'in_progress') {
                e.preventDefault();
                e.returnValue = '';
                return 'Are you sure you want to leave? Your progress will be saved.';
            }
        });
    }

    setupAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            // Auto-save current answer if exists
            const currentQuestion = this.questions[this.currentQuestionIndex];
            if (currentQuestion) {
                const answer = this.getCurrentAnswer();
                if (answer && answer !== this.userAnswers[currentQuestion.id]) {
                    this.submitAnswer(currentQuestion, answer);
                }
            }
        }, this.options.autoSaveInterval);
    }

    // Navigation
    goToNextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderCurrentQuestion();
        }
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderCurrentQuestion();
        }
    }

    confirmSubmission() {
        if (confirm('Are you sure you want to submit your assessment? This action cannot be undone.')) {
            this.submitAssessment();
        }
    }

    handleAnswerChange() {
        // Optional: immediate save or validation
    }

    updateProgressIndicator() {
        // Update progress bar if exists
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressPercent = document.getElementById('progressPercent');

        const progressPercentage = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;

        if (progressFill) {
            progressFill.style.width = progressPercentage + '%';
        }

        if (progressText) {
            progressText.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
        }

        if (progressPercent) {
            progressPercent.textContent = Math.round(progressPercentage) + '%';
        }
    }

    showBottomNav() {
        const bottomNavBar = document.getElementById('bottomNavBar');
        if (bottomNavBar) {
            bottomNavBar.style.display = 'block';
            document.body.classList.add('assessment-active');
        }
    }

    hideBottomNav() {
        const bottomNavBar = document.getElementById('bottomNavBar');
        if (bottomNavBar) {
            bottomNavBar.style.display = 'none';
            document.body.classList.remove('assessment-active');
        }
    }

    updateBottomNav() {
        const navContainer = document.getElementById('navigationButtons');
        if (!navContainer) return;

        const isFirst = this.currentQuestionIndex === 0;
        const isLast = this.currentQuestionIndex === this.questions.length - 1;
        const question = this.questions[this.currentQuestionIndex];

        navContainer.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <button class="btn btn-outline-secondary ${isFirst ? 'invisible' : ''}"
                        ${isFirst ? 'disabled' : ''}
                        data-prev-question>
                    <i class="bi bi-arrow-left"></i> Previous
                </button>

                <div class="text-center">
                    <button class="btn btn-success" data-save-answer>
                        <i class="bi bi-check-circle"></i> Save Answer
                    </button>
                </div>

                ${isLast ? `
                    <button class="btn btn-primary" data-submit-assessment>
                        <i class="bi bi-check-square"></i> Submit Assessment
                    </button>
                ` : `
                    <button class="btn btn-primary" data-next-question>
                        Next <i class="bi bi-arrow-right"></i>
                    </button>
                `}
            </div>
        `;

        this.setupQuestionEventListeners(question);
    }

    // Utility methods
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    shuffleQuestionAnswers() {
        // Implementation for shuffling answer options while maintaining correct answer mapping
    }

    executeCode(question) {
        // Implementation for Judge0 integration (similar to original engine)
    }

    showAnswerFeedback(explanation, isCorrect, points) {
        // Show feedback to user after answer submission
    }
}

// Global instance for easy access
window.DatabaseAssessmentEngine = DatabaseAssessmentEngine;