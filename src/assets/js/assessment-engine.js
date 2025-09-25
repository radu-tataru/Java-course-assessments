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
                    <span class="question-type">${this.formatQuestionType(question.type, question)}</span>
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
     * Generate Code Completion HTML (same interface as coding challenges)
     */
    generateCodeCompletionHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex] || '';

        // Generate the complete template with placeholder for better UX
        const completeTemplate = this.generateCompleteTemplate(question, savedAnswer);

        return `
            <div class="coding-challenge">
                <div class="challenge-requirements">
                    <h5>Requirements:</h5>
                    <div class="requirements-list">
                        ${question.requirements.map(req => `<div class="requirement-item">${req}</div>`).join('')}
                    </div>
                </div>

                <div class="code-editor mt-4">
                    <div class="code-editor-header">
                        <span>Complete the missing code:</span>
                        <div>
                            <button class="btn-execute" data-execute-code>
                                <i class="bi bi-play-fill"></i> Run Code
                            </button>
                        </div>
                    </div>
                    <div class="code-editor-content">
                        <textarea data-question-input rows="15" style="font-family: 'Courier New', monospace; font-size: 14px; display: none;">${completeTemplate}</textarea>
                        <div data-code-editor class="border rounded" style="min-height: 400px;"></div>
                    </div>

                    <div class="execution-result" data-execution-result style="display: none;">
                        <!-- Execution results will be displayed here -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate Coding Challenge HTML
     */
    generateCodingChallengeHtml(question) {
        const savedAnswer = this.userAnswers[this.currentQuestionIndex] || '';

        // Generate the complete template with placeholder for better UX
        const completeTemplate = this.generateCompleteTemplate(question, savedAnswer);

        return `
            <div class="coding-challenge">
                <div class="challenge-requirements">
                    <h5>Requirements:</h5>
                    <div class="requirements-list">
                        ${question.requirements.map(req => `<div class="requirement-item">${req}</div>`).join('')}
                    </div>
                </div>

                <div class="code-editor mt-4">
                    <div class="code-editor-header">
                        <span>Complete the method implementation:</span>
                        <div>
                            <button class="btn-execute" data-execute-code>
                                <i class="bi bi-play-fill"></i> Run Code
                            </button>
                        </div>
                    </div>
                    <div class="code-editor-content">
                        <textarea data-question-input rows="15" style="font-family: 'Courier New', monospace; font-size: 14px; display: none;">${completeTemplate}</textarea>
                        <div data-code-editor class="border rounded" style="min-height: 400px;"></div>
                    </div>
                </div>

                <div class="execution-result" data-execution-result style="display: none;"></div>

                ${question.testCases ? `
                <div class="test-cases mt-3">
                    <h6>Test Cases:</h6>
                    <div class="test-case-list">
                        ${question.testCases.map((testCase, index) => `
                            <div class="alert alert-info">
                                <strong>Test ${index + 1}:</strong> ${testCase.description || ''}
                                <br><strong>Input:</strong> <span class="text-muted">${this.formatTestInput(testCase.input)}</span>
                                <br><strong>Expected Output:</strong> <code class="text-success">${testCase.expected}</code>
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

        // Setup CodeMirror for coding challenges
        this.setupCodeEditor(question);
    }

    /**
     * Setup CodeMirror editor for coding challenges and code completion questions
     */
    setupCodeEditor(question) {
        if (question.type !== CONFIG.QUESTION_TYPES.CODING_CHALLENGE &&
            question.type !== CONFIG.QUESTION_TYPES.CODE_COMPLETION) return;

        const editorContainer = this.container.querySelector('[data-code-editor]');
        const textarea = this.container.querySelector('[data-question-input]');

        if (!editorContainer || !textarea || !window.CodeMirror) return;

        // Create CodeMirror instance
        this.codeEditor = CodeMirror(editorContainer, {
            value: textarea.value,
            mode: 'text/x-java',
            theme: 'default',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            styleActiveLine: true,
            extraKeys: {
                "Tab": "indentMore",
                "Shift-Tab": "indentLess"
            }
        });

        // Sync CodeMirror with textarea for form handling
        this.codeEditor.on('change', () => {
            textarea.value = this.codeEditor.getValue();
            this.handleAnswerChange();
        });

        // Set editor height
        this.codeEditor.setSize(null, 400);
    }

    /**
     * Execute code for coding challenges
     */
    async executeCode(question) {
        // Get code from CodeMirror or fallback to textarea
        let codeContent = '';
        if (this.codeEditor) {
            codeContent = this.codeEditor.getValue();
        } else {
            const textarea = this.container.querySelector('[data-question-input]');
            if (!textarea) return;
            codeContent = textarea.value;
        }

        // Extract only the user's code from the complete template
        const userCode = this.extractUserCode(codeContent.trim(), question);
        if (!userCode || userCode.includes('/* Write your code here */')) {
            this.showExecutionResult('Please write your code in the designated area.', false);
            return;
        }

        // Show loading state
        const executeBtn = this.container.querySelector('[data-execute-code]');
        const originalBtnText = executeBtn.innerHTML;
        executeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Executing...';
        executeBtn.disabled = true;

        try {
            // Initialize Judge0 if not already done
            if (!this.judge0) {
                this.judge0 = new AssessmentJudge0();
            }

            // Execute the code
            const result = await this.judge0.executeAssessmentCode(question, userCode);
            this.showExecutionResult(result.feedback || 'Code executed', result.success, result);

        } catch (error) {
            console.error('Code execution failed:', error);
            this.showExecutionResult('Code execution failed: ' + error.message, false);
        } finally {
            // Restore button state
            executeBtn.innerHTML = originalBtnText;
            executeBtn.disabled = false;
        }
    }

    /**
     * Generate complete template showing full code structure
     */
    generateCompleteTemplate(question, savedAnswer) {
        if (!question.template) {
            return savedAnswer || '/* Write your code here */';
        }

        // Handle both array and string templates
        let templateString;
        if (Array.isArray(question.template)) {
            templateString = question.template.join('\n');
        } else {
            templateString = question.template;
        }

        // If user has existing code, show it
        if (savedAnswer) {
            return templateString.replace('{{USER_CODE}}', savedAnswer);
        }

        // For code completion, check if there's already a specific comment in the template
        // If so, don't add a generic placeholder
        if (question.type === CONFIG.QUESTION_TYPES.CODE_COMPLETION) {
            // Look for comment lines in the template before {{USER_CODE}}
            const beforeUserCode = templateString.split('{{USER_CODE}}')[0];
            const lines = beforeUserCode.split('\n');

            // Check the last few lines for specific instruction comments
            for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
                const line = lines[i].trim();
                if (line.includes('//') && (line.includes('Complete') || line.includes('Extract'))) {
                    // Template already has a specific instruction, use empty placeholder
                    return templateString.replace('{{USER_CODE}}', '');
                }
            }
        }

        // Default placeholder for coding challenges or templates without specific instructions
        const codeContent = `        // Your implementation goes here
        `;

        return templateString.replace('{{USER_CODE}}', codeContent);
    }

    /**
     * Extract only the user's code from the complete template
     */
    extractUserCode(fullTemplate, question) {

        if (!question.template) {
            return fullTemplate;
        }

        // Handle both array and string templates
        let templateString;
        if (Array.isArray(question.template)) {
            templateString = question.template.join('\n');
        } else {
            templateString = question.template;
        }

        // Check if user wrote just the method body (no class/import statements)
        if (!fullTemplate.includes('public class') && !fullTemplate.includes('import ')) {
            return fullTemplate;
        }

        // Look for method signature patterns - be more specific to avoid main method
        const methodPatterns = [
            /\)\s*throws\s+IOException\s*\{/g,  // throws IOException pattern (most specific)
            /\)\s*throws.*?Exception\s*\{/g,    // throws any Exception pattern
            /public\s+(?:int|List<String>|String|void)\s+(?!main)\w+.*?\{/g  // public method but NOT main
        ];

        let methodStart = -1;
        let methodStartPattern = '';

        // Try to find any method signature pattern, preferring target methods over main
        for (const pattern of methodPatterns) {
            const matches = [...fullTemplate.matchAll(pattern)];
            if (matches.length > 0) {
                // For throws patterns, use the first match (target method)
                // For public method patterns, use the first non-main method
                const targetMatch = matches[0];  // Changed from last to first
                methodStart = targetMatch.index + targetMatch[0].length;
                methodStartPattern = targetMatch[0];
                break;
            }
        }

        if (methodStart === -1) {
            // Try to extract based on comment markers
            const commentStart = fullTemplate.indexOf('/* Write your code here */');
            const userCodeStart = fullTemplate.indexOf('{{USER_CODE}}');

            if (commentStart !== -1 || userCodeStart !== -1) {
                const markerPos = commentStart !== -1 ? commentStart : userCodeStart;
                const beforeMarker = fullTemplate.substring(0, markerPos);
                const afterMarker = fullTemplate.substring(markerPos);

                // Look for the opening brace of the method
                const lastBraceIndex = beforeMarker.lastIndexOf('{');
                if (lastBraceIndex !== -1) {
                    const afterBrace = fullTemplate.substring(lastBraceIndex + 1);
                    const nextMethodBrace = afterBrace.indexOf('\n    }');
                    if (nextMethodBrace !== -1) {
                        let methodBody = afterBrace.substring(0, nextMethodBrace).trim();
                        // Clean up placeholders
                        methodBody = methodBody.replace('/* Write your code here */', '').trim();
                        methodBody = methodBody.replace('{{USER_CODE}}', '').trim();
                        return methodBody;
                    }
                }
            }

            return fullTemplate;
        }

        // Find the method body end using brace matching
        let braceCount = 0;
        let methodBodyEnd = -1;

        for (let i = methodStart; i < fullTemplate.length; i++) {
            if (fullTemplate[i] === '{') braceCount++;
            else if (fullTemplate[i] === '}') {
                braceCount--;
                if (braceCount === -1) {
                    methodBodyEnd = i;
                    break;
                }
            }
        }

        if (methodBodyEnd !== -1) {
            let methodBody = fullTemplate.substring(methodStart, methodBodyEnd).trim();

            // Remove placeholders
            methodBody = methodBody.replace(/\/\*\s*Write your code here\s*\*\//, '').trim();
            methodBody = methodBody.replace('{{USER_CODE}}', '').trim();
            methodBody = methodBody.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//, '').trim(); // Remove all comments

            // Special case: If method body still contains class structure,
            // it means student submitted full template - extract the actual implementation
            if (methodBody.includes('public class') || methodBody.includes('import ')) {

                // Find the innermost method with the same signature
                const innerMethodMatch = methodBody.match(/public\s+int\s+countLinesWithWord[^{]*\{([^}]*)\}/);
                if (innerMethodMatch) {
                    const innerCode = innerMethodMatch[1].trim();
                    if (innerCode && innerCode !== '' && !innerCode.includes('{{USER_CODE}}')) {
                        return innerCode;
                    }
                }

                // Alternative: Look for specific patterns in user's actual implementation
                const simpleReturnMatch = methodBody.match(/return\s+\d+\s*;/);
                if (simpleReturnMatch) {
                    return simpleReturnMatch[0].trim();
                }
            }

            // Clean up indentation - remove leading whitespace from each line
            const lines = methodBody.split('\n');
            const cleanedLines = lines.map(line => {
                // Remove up to 8 spaces of indentation (method body indentation)
                return line.replace(/^        /, '');
            });

            const result = cleanedLines.join('\n').trim();

            return result;
        }

        return fullTemplate;
    }

    /**
     * Format test input for better readability
     */
    formatTestInput(input) {
        if (!input) return 'No input';

        // Handle file content descriptions
        if (input.includes('contains:')) {
            const parts = input.split('contains:');
            if (parts.length === 2) {
                const fileName = parts[0].trim();
                let content = parts[1].trim().replace(/^"|"$/g, ''); // Remove quotes

                // Format newline characters for display
                content = content.replace(/\\n/g, '\n');

                return `File "${fileName}" with content:<br><pre class="mt-2 p-2 bg-light border rounded" style="font-size: 12px; max-height: 100px; overflow-y: auto;">${content}</pre>`;
            }
        }

        // For simple inputs, just return as is
        return `<code>${input}</code>`;
    }

    /**
     * Show execution result in the UI
     */
    showExecutionResult(message, isSuccess, fullResult = null) {
        let resultContainer = this.container.querySelector('[data-execution-result]');
        if (!resultContainer) return;

        resultContainer.style.display = 'block';
        resultContainer.className = `execution-result alert ${isSuccess ? 'alert-success' : 'alert-danger'}`;

        // Wrap the message in <pre> to preserve formatting (line breaks, indentation)
        let html = `<strong>${isSuccess ? '✅ Success' : '❌ Error'}</strong><br><pre style="white-space: pre-wrap; font-family: inherit; margin: 0; background: none; border: none; padding: 0;">${message}</pre>`;

        if (fullResult && fullResult.output) {
            html += `<br><strong>Output:</strong><br><pre>${fullResult.output}</pre>`;
        }

        resultContainer.innerHTML = html;
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

            case CONFIG.QUESTION_TYPES.CODE_READING:
                // Code reading questions use the same structure as multiple choice
                if (question.multipleCorrect) {
                    // Handle checkboxes (if any code reading questions have multiple correct answers)
                    answer = [];
                    this.container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                        answer.push(parseInt(checkbox.value));
                    });
                } else {
                    // Handle radio buttons (most common case)
                    const selected = this.container.querySelector('input[type="radio"]:checked');
                    if (selected) {
                        answer = [parseInt(selected.value)];
                    }
                }
                break;

            default:
                // Handle text inputs and coding challenges
                let inputValue = '';
                if (question.type === CONFIG.QUESTION_TYPES.CODING_CHALLENGE && this.codeEditor) {
                    inputValue = this.codeEditor.getValue();
                } else {
                    const textInput = this.container.querySelector('[data-question-input]');
                    if (textInput) {
                        inputValue = textInput.value;
                    }
                }

                if (inputValue) {
                    if (question.type === CONFIG.QUESTION_TYPES.CODING_CHALLENGE) {
                        // Extract only the user's code from the complete template
                        answer = this.extractUserCode(inputValue.trim(), question);
                    } else {
                        answer = inputValue.trim();
                    }
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

        // Notify parent page that assessment is finished (for timer cleanup)
        if (typeof window.clearTimerData === 'function') {
            window.clearTimerData();
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
                } else if (question.type === CONFIG.QUESTION_TYPES.CODE_COMPLETION) {
                    // For code completion, check if user answer matches the expected answer
                    if (userAnswer && question.correctAnswer) {
                        // Normalize both answers for comparison (remove extra whitespace)
                        const normalizedUserAnswer = userAnswer.trim().replace(/\s+/g, ' ');
                        const normalizedCorrectAnswer = question.correctAnswer.trim().replace(/\s+/g, ' ');
                        isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
                        questionScore = isCorrect ? 1 : 0;
                    }
                } else if (question.type === CONFIG.QUESTION_TYPES.CODING_CHALLENGE) {
                    // For coding challenges, we assume they are manually scored or auto-scored elsewhere
                    // For now, give partial credit if user provided an answer
                    if (userAnswer && userAnswer.trim() && !userAnswer.includes('/* Write your code here */')) {
                        questionScore = 0.5; // Partial credit for attempting
                        // In a full implementation, this would be based on test results
                    }
                } else if (question.type === CONFIG.QUESTION_TYPES.CODE_READING) {
                    // Handle code reading questions (similar to multiple choice)
                    if (Array.isArray(question.correctAnswer)) {
                        // Multiple correct answers
                        if (Array.isArray(userAnswer) && userAnswer.length > 0) {
                            const correctSet = new Set(question.correctAnswer);
                            const userSet = new Set(userAnswer);
                            const intersection = new Set([...userSet].filter(x => correctSet.has(x)));
                            questionScore = intersection.size / correctSet.size;
                            isCorrect = questionScore === 1;
                        }
                    } else {
                        // Single correct answer
                        isCorrect = Array.isArray(userAnswer) &&
                                   userAnswer.length === 1 &&
                                   userAnswer[0] === question.correctAnswer;
                        questionScore = isCorrect ? 1 : 0;
                    }
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

    /**
     * Review answers functionality
     */
    reviewAnswers(results) {
        // Go back to the first question and show review mode
        this.reviewMode = true;
        this.currentQuestionIndex = 0;
        this.showQuestionWithReview(results);
    }

    /**
     * Show question in review mode with correct/incorrect indicators
     */
    showQuestionWithReview(results) {
        const question = this.questions[this.currentQuestionIndex];
        const questionResult = results.questionResults[this.currentQuestionIndex];

        const reviewClass = questionResult.isCorrect ? 'correct' : 'incorrect';
        const statusIcon = questionResult.isCorrect ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger';

        const reviewHtml = `
            <div class="question-card review-mode ${reviewClass}">
                <div class="question-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="question-number">Question ${this.currentQuestionIndex + 1} of ${this.questions.length}</span>
                            <span class="question-type">${this.formatQuestionType(question.type, question)}</span>
                        </div>
                        <div class="question-status">
                            <i class="bi ${statusIcon}"></i>
                            ${questionResult.isCorrect ? 'Correct' : 'Incorrect'}
                            <span class="text-muted">(${questionResult.score.toFixed(1)}/${question.points || 1} points)</span>
                        </div>
                    </div>
                </div>

                <div class="question-content">
                    <div class="question-text">${question.question}</div>

                    ${question.requirements ? `
                        <div class="challenge-requirements mt-3">
                            <h6>Requirements:</h6>
                            <div class="requirements-list">
                                ${question.requirements.map(req => `<div class="requirement-item">${req}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${question.code ? `<div class="code-block mt-3"><pre><code>${question.code}</code></pre></div>` : ''}

                    <div class="review-answers mt-4">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-primary">Your Answer:</h6>
                                <div class="user-answer">
                                    ${this.formatAnswerForReview(question, questionResult.userAnswer)}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-success">Correct Answer:</h6>
                                <div class="correct-answer">
                                    ${this.formatAnswerForReview(question, questionResult.correctAnswer)}
                                </div>
                            </div>
                        </div>

                        ${question.explanation ? `
                            <div class="mt-3">
                                <h6 class="text-info">Explanation:</h6>
                                <div class="explanation">${question.explanation}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="assessment-navigation">
                <button class="btn-secondary" ${this.currentQuestionIndex === 0 ? 'disabled' : ''} data-prev-review>
                    <i class="bi bi-arrow-left"></i> Previous
                </button>

                <div class="text-center">
                    <span class="progress-text">Reviewing ${this.currentQuestionIndex + 1} of ${this.questions.length}</span>
                </div>

                ${this.currentQuestionIndex < this.questions.length - 1 ?
                    '<button class="btn-primary" data-next-review><i class="bi bi-arrow-right"></i> Next</button>' :
                    '<button class="btn-secondary" data-back-to-results><i class="bi bi-arrow-left"></i> Back to Results</button>'
                }
            </div>
        `;

        this.container.innerHTML = reviewHtml;
        this.setupReviewNavigation(results);
    }

    /**
     * Format answer for review display
     */
    formatAnswerForReview(question, answer) {
        // Debug logging for Questions 1 and 5 to see what's happening
        if (question.id === 'step1-q1' || question.id === 'step1-q5') {
            console.log(`DEBUG - ${question.id} formatAnswerForReview:`, {
                questionId: question.id,
                questionType: question.type,
                answer: answer,
                answerType: typeof answer,
                answers: question.answers.map((a, i) => `${i}: ${a.text}`),
                expectedText: question.answers[answer]?.text
            });
        }

        if (!answer && answer !== 0) return '<em class="text-muted">No answer provided</em>';

        switch (question.type) {
            case CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE:
                if (Array.isArray(answer)) {
                    return answer.map(index => question.answers[index]?.text || `Option ${index + 1}`).join('<br>');
                }
                return question.answers[answer]?.text || `Option ${answer + 1}`;

            case CONFIG.QUESTION_TYPES.TRUE_FALSE:
                return answer === 'true' ? 'True' : 'False';

            case CONFIG.QUESTION_TYPES.CODE_COMPLETION:
            case CONFIG.QUESTION_TYPES.CODING_CHALLENGE:
                return `<pre class="code-answer">${answer}</pre>`;

            case CONFIG.QUESTION_TYPES.CODE_READING:
                if (Array.isArray(answer)) {
                    return answer.map(index => question.answers[index]?.text || `Option ${index + 1}`).join('<br>');
                }
                return question.answers[answer]?.text || answer;

            default:
                return answer.toString();
        }
    }

    /**
     * Setup navigation for review mode
     */
    setupReviewNavigation(results) {
        const prevBtn = this.container.querySelector('[data-prev-review]');
        const nextBtn = this.container.querySelector('[data-next-review]');
        const backBtn = this.container.querySelector('[data-back-to-results]');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentQuestionIndex > 0) {
                    this.currentQuestionIndex--;
                    this.showQuestionWithReview(results);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    this.currentQuestionIndex++;
                    this.showQuestionWithReview(results);
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.reviewMode = false;
                this.showResults(results);
            });
        }
    }

    // Utility methods
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    formatQuestionType(type, question = null) {
        // Handle multiple choice with more specific labeling
        if (type === CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE && question) {
            if (question.multipleCorrect || Array.isArray(question.correctAnswer)) {
                return 'Multiple Choice';
            } else {
                return 'Single Choice';
            }
        }

        // Handle other question types
        switch (type) {
            case CONFIG.QUESTION_TYPES.CODE_READING:
                return 'Code Reading';
            case CONFIG.QUESTION_TYPES.CODE_COMPLETION:
                return 'Code Completion';
            case CONFIG.QUESTION_TYPES.CODING_CHALLENGE:
                return 'Coding Challenge';
            case CONFIG.QUESTION_TYPES.TRUE_FALSE:
                return 'True/False';
            default:
                return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
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