/**
 * Hybrid Judge0 API Integration
 * Supports both direct API calls (with local config) and backend proxy
 */

class Judge0Integration {
    constructor(apiKey = null) {
        this.apiKey = apiKey || CONFIG.JUDGE0.API_KEY;
        this.baseUrl = CONFIG.JUDGE0.API_URL;
        this.languageId = CONFIG.JUDGE0.JAVA_LANGUAGE_ID;
        this.timeout = CONFIG.JUDGE0.TIMEOUT;
        this.memoryLimit = CONFIG.JUDGE0.MEMORY_LIMIT;

        // Check if we should use backend proxy
        this.useBackend = this.shouldUseBackend();
        this.backendUrl = this.getBackendUrl();
    }

    /**
     * Determine if we should use backend proxy
     */
    shouldUseBackend() {
        // If no API key is configured, try backend
        if (!this.apiKey) {
            return true;
        }

        // If running on GitHub Pages (no local config), use backend
        if (window.location.hostname.includes('github.io')) {
            return true;
        }

        return false;
    }

    /**
     * Get backend URL based on environment
     */
    getBackendUrl() {
        // For local development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }

        // For Vercel deployment - use current domain
        if (window.location.hostname.includes('vercel.app')) {
            return window.location.origin;
        }

        // For GitHub Pages or other deployments with Vercel backend
        // Update this with your actual Vercel URL
        return 'https://java-assesments-backend.vercel.app';
    }

    /**
     * Execute Java code using Judge0 API (direct or via backend)
     */
    async executeCode(sourceCode, input = '', testCases = []) {
        try {
            let result;

            if (this.useBackend) {
                result = await this.executeViaBackend(sourceCode, input);
            } else {
                result = await this.executeDirect(sourceCode, input);
            }

            // If test cases are provided, validate against them
            if (testCases.length > 0) {
                result.testResults = await this.validateTestCases(sourceCode, testCases);
            }

            return result;

        } catch (error) {
            console.error('Judge0 execution error:', error);

            // Enhanced fallback: provide code review instead of execution
            return {
                success: true, // Mark as success so students can proceed
                error: '',
                output: '⚠️ Live code execution is temporarily unavailable.\n\n' +
                        '✅ Your code has been saved and will be reviewed.\n\n' +
                        '💡 Manual Code Review:\n' +
                        this.generateCodeReview(sourceCode),
                executionTime: null,
                memoryUsage: null,
                fallbackMode: true,
                manualReview: true
            };
        }
    }

    /**
     * Execute code via backend proxy
     */
    async executeViaBackend(sourceCode, input) {
        try {
            // Submit code via backend
            const submitResponse = await fetch(`${this.backendUrl}/api/submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_code: sourceCode,
                    language_id: this.languageId,
                    stdin: input
                })
            });

            if (!submitResponse.ok) {
                throw new Error('Failed to submit code via backend');
            }

            const submitData = await submitResponse.json();
            const token = submitData.token;

            // Poll for results via backend
            return await this.getResultViaBackend(token);

        } catch (error) {
            throw new Error(`Backend execution failed: ${error.message}`);
        }
    }

    /**
     * Get execution result via backend
     */
    async getResultViaBackend(token, maxAttempts = 10, interval = 1000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.backendUrl}/api/submissions?token=${token}`);

                if (!response.ok) {
                    throw new Error('Failed to get result from backend');
                }

                const data = await response.json();

                // Status codes: 1=In Queue, 2=Processing, 3=Accepted
                if (data.status.id <= 2) {
                    await this.sleep(interval);
                    continue;
                }

                return this.parseExecutionResult(data);

            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    throw error;
                }
                await this.sleep(interval);
            }
        }

        throw new Error('Execution timed out');
    }

    /**
     * Execute code directly via Judge0 API
     */
    async executeDirect(sourceCode, input) {
        const submissionToken = await this.submitCodeDirect(sourceCode, input);
        return await this.getExecutionResultDirect(submissionToken);
    }

    /**
     * Submit code directly to Judge0 API
     */
    async submitCodeDirect(sourceCode, input) {
        const submissionData = {
            source_code: btoa(sourceCode),
            language_id: this.languageId,
            stdin: btoa(input),
            cpu_time_limit: this.timeout,
            memory_limit: this.memoryLimit,
            wall_time_limit: this.timeout + 5
        };

        const response = await fetch(`${this.baseUrl}/submissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            },
            body: JSON.stringify(submissionData)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.token;
    }

    /**
     * Get execution result directly from Judge0
     */
    async getExecutionResultDirect(token, maxAttempts = 10, interval = 1000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/submissions/${token}`, {
                    headers: {
                        'X-RapidAPI-Key': this.apiKey,
                        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                    }
                });

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status}`);
                }

                const data = await response.json();

                if (data.status.id <= 2) {
                    await this.sleep(interval);
                    continue;
                }

                return this.parseExecutionResult(data);

            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    throw error;
                }
                await this.sleep(interval);
            }
        }

        throw new Error('Execution timed out');
    }

    /**
     * Parse Judge0 API response
     */
    parseExecutionResult(response) {
        const status = response.status;
        const isSuccess = status.id === 3;

        let output = '';
        let error = '';

        // Safely decode Base64, handle both encoded and plain text
        const safeDecode = (str) => {
            if (!str) return '';
            try {
                // Check if it looks like Base64 (only alphanumeric + / + = characters)
                if (/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
                    return atob(str);
                } else {
                    // Already decoded or not Base64
                    return str;
                }
            } catch (e) {
                console.warn('Failed to decode Base64, using raw string:', str);
                return str;
            }
        };

        if (response.stdout) {
            output = safeDecode(response.stdout);
        }

        if (response.stderr) {
            error = safeDecode(response.stderr);
        }

        if (response.compile_output) {
            const compileError = safeDecode(response.compile_output);
            if (compileError.trim()) {
                error = compileError;
            }
        }

        return {
            success: isSuccess,
            output: output.trim(),
            error: error.trim(),
            status: status.description,
            executionTime: response.time ? parseFloat(response.time) * 1000 : null,
            memoryUsage: response.memory ? parseInt(response.memory) : null,
            exitCode: response.exit_code,
            token: response.token
        };
    }

    /**
     * Validate code against test cases
     */
    async validateTestCases(sourceCode, testCases) {
        const results = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            try {
                const result = await this.executeCode(sourceCode, testCase.input);

                results.push({
                    testCaseIndex: i,
                    input: testCase.input,
                    expectedOutput: testCase.expected,
                    actualOutput: result.output,
                    passed: this.compareOutputs(result.output, testCase.expected),
                    executionTime: result.executionTime,
                    error: result.error
                });

                if (i < testCases.length - 1) {
                    await this.sleep(500);
                }

            } catch (error) {
                results.push({
                    testCaseIndex: i,
                    input: testCase.input,
                    expectedOutput: testCase.expected,
                    actualOutput: '',
                    passed: false,
                    executionTime: null,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Compare expected vs actual output
     */
    compareOutputs(actual, expected) {
        const normalize = (str) => {
            return str.trim()
                     .replace(/\r\n/g, '\n')
                     .replace(/\r/g, '\n')
                     .replace(/\s+/g, ' ');
        };

        return normalize(actual) === normalize(expected);
    }

    /**
     * Validate and fix common user code issues
     */
    validateAndFixUserCode(userCode, questionData) {
        let fixedCode = userCode;

        // Fix common indentation issues for method bodies
        if (questionData.type === CONFIG.QUESTION_TYPES.CODING_CHALLENGE) {
            // First, normalize all line endings and remove extra whitespace
            fixedCode = fixedCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Split into lines and fix indentation
            const lines = fixedCode.split('\n');
            const fixedLines = lines.map((line, index) => {
                const trimmedLine = line.trim();

                // Skip empty lines
                if (!trimmedLine) return '';

                // Ensure proper indentation for method body content
                // All content should be indented at least 8 spaces (2 levels)
                return '        ' + trimmedLine;
            });

            // Remove empty lines at start and end
            while (fixedLines.length > 0 && fixedLines[0] === '') {
                fixedLines.shift();
            }
            while (fixedLines.length > 0 && fixedLines[fixedLines.length - 1] === '') {
                fixedLines.pop();
            }

            fixedCode = fixedLines.join('\n');

            // Validate brace matching
            const openBraces = (fixedCode.match(/\{/g) || []).length;
            const closeBraces = (fixedCode.match(/\}/g) || []).length;

            console.log('Code validation:', {
                originalLines: lines.length,
                fixedLines: fixedLines.length,
                openBraces: openBraces,
                closeBraces: closeBraces,
                braceBalance: openBraces - closeBraces,
                fixedCodePreview: fixedCode.substring(0, 200) + '...'
            });
        }

        return fixedCode;
    }

    /**
     * Generate a basic code review when execution is unavailable
     */
    generateCodeReview(sourceCode) {
        const reviews = [];

        // Basic Java syntax checks
        if (sourceCode.includes('try (') && sourceCode.includes('BufferedReader')) {
            reviews.push('✅ Good use of try-with-resources for file handling');
        }

        if (sourceCode.includes('.toLowerCase()')) {
            reviews.push('✅ Proper case-insensitive string comparison');
        }

        if (sourceCode.includes('return ')) {
            reviews.push('✅ Method returns a value as expected');
        }

        if (sourceCode.includes('IOException')) {
            reviews.push('✅ Proper exception handling declared');
        }

        // Check for common issues
        if (!sourceCode.includes('{') || !sourceCode.includes('}')) {
            reviews.push('⚠️ Check your braces - ensure all blocks are properly closed');
        }

        if (sourceCode.trim().length < 10) {
            reviews.push('⚠️ Your solution seems very short - make sure it\'s complete');
        }

        if (reviews.length === 0) {
            reviews.push('👀 Code structure looks basic - ensure it meets all requirements');
        }

        return reviews.join('\n');
    }

    /**
     * Test Judge0 with Python to verify service is working
     */
    async testWithPython() {
        console.log('Testing Judge0 with Python...');

        // Test 1: Direct to ce.judge0.com with plain text
        try {
            console.log('Testing direct Judge0 with plain text Python...');
            const pythonCode = 'print("Hello from Python")';
            const directResponse = await fetch('https://ce.judge0.com/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_code: pythonCode,
                    language_id: 71, // Python 3
                    stdin: ''
                })
            });

            if (directResponse.ok) {
                const directData = await directResponse.json();
                console.log('Direct Python test successful:', directData);

                // Check result after delay
                setTimeout(async () => {
                    try {
                        const resultResponse = await fetch(`https://ce.judge0.com/submissions/${directData.token}`);
                        if (resultResponse.ok) {
                            const result = await resultResponse.json();
                            console.log('Direct Python result:', result);
                        }
                    } catch (e) {
                        console.log('Direct Python result check failed:', e);
                    }
                }, 3000);
            } else {
                console.log('Direct Python test failed:', await directResponse.text());
            }
        } catch (error) {
            console.log('Direct Python test error:', error);
        }

        // Test 2: Via our backend (existing test)
        try {
            const pythonCode = 'print("Hello from Python")';
            const response = await fetch(`${this.backendUrl}/api/submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_code: pythonCode,
                    language_id: 71, // Python 3
                    stdin: ''
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Python test submission successful:', data);

                // Check result after a delay
                setTimeout(async () => {
                    try {
                        const resultResponse = await fetch(`${this.backendUrl}/api/submissions?token=${data.token}`);
                        if (resultResponse.ok) {
                            const result = await resultResponse.json();
                            console.log('Python test result:', result);
                        }
                    } catch (e) {
                        console.log('Python result check failed:', e);
                    }
                }, 2000);
            } else {
                console.log('Python test failed:', await response.text());
            }
        } catch (error) {
            console.log('Python test error:', error);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            mode: this.useBackend ? 'backend' : 'direct',
            apiKey: this.apiKey ? 'configured' : 'missing',
            backendUrl: this.backendUrl,
            ready: this.useBackend || !!this.apiKey
        };
    }
}

// Also create a backward-compatible version
class AssessmentJudge0 extends Judge0Integration {
    constructor(apiKey = null) {
        super(apiKey);
        this.executionHistory = [];
    }

    async executeAssessmentCode(questionData, userCode) {
        try {
            let executableCode = this.prepareExecutableCode(questionData, userCode);
            const result = await this.executeCode(
                executableCode,
                questionData.input || '',
                questionData.testCases || []
            );

            this.executionHistory.push({
                timestamp: new Date().toISOString(),
                questionId: questionData.id,
                userCode: userCode,
                result: result
            });

            return this.formatAssessmentResult(result, questionData);

        } catch (error) {
            console.error('Assessment code execution failed:', error);

            return {
                success: false,
                output: '',
                error: `Execution failed: ${error.message}`,
                testResults: [],
                score: 0,
                feedback: 'Code execution encountered an error. Please check your syntax and try again.'
            };
        }
    }

    prepareExecutableCode(questionData, userCode) {
        console.log('prepareExecutableCode called with:', {
            questionType: questionData.type,
            hasTemplate: !!questionData.template,
            userCodeLength: userCode.length
        });

        switch (questionData.type) {
            case CONFIG.QUESTION_TYPES.CODING_CHALLENGE:
                if (questionData.template) {
                    // Clean the user code - remove any extra whitespace/newlines
                    const cleanUserCode = userCode.trim();

                    // Handle both string and array templates
                    let templateString;
                    if (Array.isArray(questionData.template)) {
                        templateString = questionData.template.join('\n');
                    } else {
                        templateString = questionData.template;
                    }

                    // For debugging: try different approaches
                    if (cleanUserCode.trim() === 'return 2;') {
                        // Test with Python instead of Java to verify Judge0 is working
                        this.testWithPython();

                        // Still try Java but with different formatting
                        const testCode = `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}`;
                        console.log('Using formatted debug test code:', testCode);
                        return testCode;
                    }

                    // Validate and fix common user code issues
                    const validatedUserCode = this.validateAndFixUserCode(cleanUserCode, questionData);
                    const preparedCode = templateString.replace('{{USER_CODE}}', validatedUserCode);

                    console.log('Template replacement:', {
                        templateType: Array.isArray(questionData.template) ? 'array' : 'string',
                        templateLength: templateString.length,
                        originalUserCode: cleanUserCode,
                        validatedUserCode: validatedUserCode,
                        preparedCodeLength: preparedCode.length,
                        preparedCodePreview: preparedCode.substring(0, 400) + '...'
                    });

                    return preparedCode;
                }
                return this.wrapCodeInClass(userCode);

            case CONFIG.QUESTION_TYPES.CODE_COMPLETION:
                if (questionData.incompleteCode) {
                    return questionData.incompleteCode.replace(/\/\*\s*TODO.*?\*\/|\/\/\s*TODO.*/gi, userCode);
                }
                return userCode;

            default:
                return this.wrapCodeInClass(userCode);
        }
    }

    wrapCodeInClass(codeSnippet, className = 'Solution') {
        if (codeSnippet.includes('class ') || codeSnippet.includes('public class')) {
            return codeSnippet;
        }

        return `
public class ${className} {
    public static void main(String[] args) {
        ${codeSnippet}
    }
}`;
    }

    formatAssessmentResult(result, questionData) {
        let score = 0;
        let feedback = '';

        if (result.fallbackMode) {
            return {
                ...result,
                score: 0,
                feedback: 'Code execution is not available. Please review your code manually.',
                maxScore: 100
            };
        }

        if (result.success) {
            if (result.testResults && result.testResults.length > 0) {
                const passedTests = result.testResults.filter(test => test.passed).length;
                score = Math.round((passedTests / result.testResults.length) * 100);
                feedback = this.generateTestFeedback(result.testResults);
            } else {
                score = 100;
                feedback = 'Code compiled and executed successfully!';
            }
        } else {
            score = 0;
            feedback = this.generateErrorFeedback(result.error);
        }

        return {
            ...result,
            score: score,
            feedback: feedback,
            maxScore: 100
        };
    }

    generateTestFeedback(testResults) {
        const totalTests = testResults.length;
        const passedTests = testResults.filter(test => test.passed).length;

        let feedback = `Passed ${passedTests} out of ${totalTests} test cases.\n\n`;

        testResults.forEach((test, index) => {
            const status = test.passed ? '✅' : '❌';
            feedback += `Test ${index + 1} ${status}\n`;
            feedback += `Input: ${test.input}\n`;
            feedback += `Expected: ${test.expectedOutput}\n`;
            feedback += `Got: ${test.actualOutput}\n\n`;
        });

        if (passedTests === totalTests) {
            feedback += '🎉 Excellent! All test cases passed.';
        } else if (passedTests > 0) {
            feedback += '💪 Good progress! Review the failed test cases and adjust your solution.';
        } else {
            feedback += '🤔 No test cases passed. Review the requirements and try again.';
        }

        return feedback;
    }

    generateErrorFeedback(error) {
        if (!error) return 'Unknown error occurred during execution.';

        const errorPatterns = [
            {
                pattern: /cannot find symbol/i,
                message: 'Variable or method not found. Check your variable names and method declarations.'
            },
            {
                pattern: /';' expected/i,
                message: 'Missing semicolon. Make sure each statement ends with a semicolon.'
            },
            {
                pattern: /class.*public/i,
                message: 'Class declaration issue. Make sure your class name matches the filename.'
            },
            {
                pattern: /array.*out.*bounds/i,
                message: 'Array index out of bounds. Check your array indices.'
            },
            {
                pattern: /null.*pointer/i,
                message: 'Null pointer exception. Make sure objects are initialized before use.'
            }
        ];

        let feedback = 'Compilation/Runtime Error:\n\n' + error + '\n\n';

        for (const pattern of errorPatterns) {
            if (pattern.pattern.test(error)) {
                feedback += `💡 Hint: ${pattern.message}`;
                break;
            }
        }

        return feedback;
    }

    getExecutionHistory() {
        return this.executionHistory;
    }

    clearHistory() {
        this.executionHistory = [];
    }
}

// Export for both Node.js and browser
if (typeof window !== 'undefined') {
    window.Judge0Integration = Judge0Integration;
    window.AssessmentJudge0 = AssessmentJudge0;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Judge0Integration, AssessmentJudge0 };
}