/**
 * Judge0 API Integration for Code Execution
 * Handles code compilation and execution with test case validation
 */

class Judge0Integration {
    constructor(apiKey = null) {
        this.apiKey = apiKey || CONFIG.JUDGE0.API_KEY;
        this.baseUrl = CONFIG.JUDGE0.API_URL;
        this.languageId = CONFIG.JUDGE0.JAVA_LANGUAGE_ID;
        this.timeout = CONFIG.JUDGE0.TIMEOUT;
        this.memoryLimit = CONFIG.JUDGE0.MEMORY_LIMIT;
    }

    /**
     * Execute Java code using Judge0 API
     * @param {string} sourceCode - The Java code to execute
     * @param {string} input - Optional input for the program
     * @param {Array} testCases - Optional test cases for validation
     * @returns {Promise<Object>} Execution result
     */
    async executeCode(sourceCode, input = '', testCases = []) {
        try {
            // First, submit the code for execution
            const submissionToken = await this.submitCode(sourceCode, input);

            // Poll for results
            const result = await this.getExecutionResult(submissionToken);

            // If test cases are provided, validate against them
            if (testCases.length > 0) {
                result.testResults = await this.validateTestCases(sourceCode, testCases);
            }

            return result;

        } catch (error) {
            console.error('Judge0 execution error:', error);
            return {
                success: false,
                error: error.message,
                output: '',
                executionTime: null,
                memoryUsage: null
            };
        }
    }

    /**
     * Submit code to Judge0 API
     * @private
     */
    async submitCode(sourceCode, input) {
        const submissionData = {
            source_code: btoa(sourceCode), // Base64 encode
            language_id: this.languageId,
            stdin: btoa(input),
            cpu_time_limit: this.timeout,
            memory_limit: this.memoryLimit,
            wall_time_limit: this.timeout + 5, // Add buffer for wall time
        };

        const response = await this.makeApiRequest('/submissions', 'POST', submissionData);

        if (!response.token) {
            throw new Error('Failed to submit code: No submission token received');
        }

        return response.token;
    }

    /**
     * Get execution result by polling Judge0 API
     * @private
     */
    async getExecutionResult(token, maxAttempts = 10, interval = 1000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.makeApiRequest(`/submissions/${token}`, 'GET');

                // Status codes: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded, etc.
                if (response.status.id <= 2) {
                    // Still processing, wait and retry
                    await this.sleep(interval);
                    continue;
                }

                // Execution completed
                return this.parseExecutionResult(response);

            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                if (attempt === maxAttempts - 1) {
                    throw error;
                }
                await this.sleep(interval);
            }
        }

        throw new Error('Execution timed out - maximum polling attempts exceeded');
    }

    /**
     * Parse Judge0 API response into standardized result
     * @private
     */
    parseExecutionResult(response) {
        const status = response.status;
        const isSuccess = status.id === 3; // Status 3 = Accepted

        let output = '';
        let error = '';

        if (response.stdout) {
            output = atob(response.stdout); // Base64 decode
        }

        if (response.stderr) {
            error = atob(response.stderr);
        }

        if (response.compile_output) {
            const compileError = atob(response.compile_output);
            if (compileError.trim()) {
                error = compileError;
            }
        }

        return {
            success: isSuccess,
            output: output.trim(),
            error: error.trim(),
            status: status.description,
            executionTime: response.time ? parseFloat(response.time) * 1000 : null, // Convert to ms
            memoryUsage: response.memory ? parseInt(response.memory) : null, // In KB
            exitCode: response.exit_code,
            token: response.token
        };
    }

    /**
     * Validate code against multiple test cases
     * @private
     */
    async validateTestCases(sourceCode, testCases) {
        const results = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            try {
                const result = await this.executeCode(sourceCode, testCase.input);

                const testResult = {
                    testCaseIndex: i,
                    input: testCase.input,
                    expectedOutput: testCase.expected,
                    actualOutput: result.output,
                    passed: this.compareOutputs(result.output, testCase.expected),
                    executionTime: result.executionTime,
                    error: result.error
                };

                results.push(testResult);

                // Add delay between test executions to avoid rate limiting
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
     * @private
     */
    compareOutputs(actual, expected) {
        // Normalize whitespace and line endings
        const normalizeOutput = (str) => {
            return str.trim()
                     .replace(/\r\n/g, '\n')
                     .replace(/\r/g, '\n')
                     .replace(/\s+/g, ' ');
        };

        const normalizedActual = normalizeOutput(actual);
        const normalizedExpected = normalizeOutput(expected);

        return normalizedActual === normalizedExpected;
    }

    /**
     * Make HTTP request to Judge0 API
     * @private
     */
    async makeApiRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Add API key if available (for RapidAPI)
        if (this.apiKey) {
            options.headers['X-RapidAPI-Key'] = this.apiKey;
            options.headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Sleep utility for delays
     * @private
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get available programming languages
     */
    async getLanguages() {
        try {
            return await this.makeApiRequest('/languages');
        } catch (error) {
            console.error('Failed to fetch languages:', error);
            return [];
        }
    }

    /**
     * Get system information
     */
    async getSystemInfo() {
        try {
            return await this.makeApiRequest('/system_info');
        } catch (error) {
            console.error('Failed to fetch system info:', error);
            return null;
        }
    }

    /**
     * Validate Java code syntax without execution
     */
    async validateSyntax(sourceCode) {
        try {
            const testCode = `
public class SyntaxTest {
    ${sourceCode}
}`;

            const result = await this.executeCode(testCode, '');

            return {
                isValid: result.success && !result.error,
                errors: result.error || '',
                warnings: []
            };

        } catch (error) {
            return {
                isValid: false,
                errors: error.message,
                warnings: []
            };
        }
    }

    /**
     * Create a complete Java class wrapper for code snippets
     */
    wrapCodeInClass(codeSnippet, className = 'Solution') {
        // Check if code already contains a class definition
        if (codeSnippet.includes('class ') || codeSnippet.includes('public class')) {
            return codeSnippet;
        }

        // Wrap snippet in a basic class structure
        return `
public class ${className} {
    public static void main(String[] args) {
        ${codeSnippet}
    }
}`;
    }

    /**
     * Extract method from code snippet for testing
     */
    extractMethodForTesting(codeSnippet, testInput) {
        // Simple method extraction - can be enhanced
        const methodMatch = codeSnippet.match(/public\s+\w+\s+(\w+)\s*\([^)]*\)/);

        if (methodMatch) {
            const methodName = methodMatch[1];

            return `
public class TestClass {
    ${codeSnippet}

    public static void main(String[] args) {
        TestClass instance = new TestClass();
        System.out.println(instance.${methodName}(${testInput}));
    }
}`;
        }

        return this.wrapCodeInClass(codeSnippet);
    }
}

/**
 * Assessment-specific Judge0 integration
 * Extends base integration with assessment-specific functionality
 */
class AssessmentJudge0 extends Judge0Integration {
    constructor(apiKey = null) {
        super(apiKey);
        this.executionHistory = [];
    }

    /**
     * Execute code in the context of an assessment question
     */
    async executeAssessmentCode(questionData, userCode) {
        try {
            // Prepare code based on question type
            let executableCode = this.prepareExecutableCode(questionData, userCode);

            // Execute code
            const result = await this.executeCode(
                executableCode,
                questionData.input || '',
                questionData.testCases || []
            );

            // Track execution history
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

    /**
     * Prepare executable code based on question requirements
     * @private
     */
    prepareExecutableCode(questionData, userCode) {
        switch (questionData.type) {
            case CONFIG.QUESTION_TYPES.CODING_CHALLENGE:
                return this.prepareCodingChallenge(questionData, userCode);

            case CONFIG.QUESTION_TYPES.CODE_COMPLETION:
                return this.prepareCodeCompletion(questionData, userCode);

            default:
                return this.wrapCodeInClass(userCode);
        }
    }

    /**
     * Prepare coding challenge code
     * @private
     */
    prepareCodingChallenge(questionData, userCode) {
        // If question provides a template, use it
        if (questionData.template) {
            return questionData.template.replace('{{USER_CODE}}', userCode);
        }

        // Otherwise, wrap in basic class structure
        return this.wrapCodeInClass(userCode);
    }

    /**
     * Prepare code completion exercise
     * @private
     */
    prepareCodeCompletion(questionData, userCode) {
        if (questionData.incompleteCode) {
            // Replace placeholder with user code
            return questionData.incompleteCode.replace(/\/\*\s*TODO.*?\*\/|\/\/\s*TODO.*/gi, userCode);
        }

        return userCode;
    }

    /**
     * Format result for assessment display
     * @private
     */
    formatAssessmentResult(result, questionData) {
        let score = 0;
        let feedback = '';

        if (result.success) {
            if (result.testResults && result.testResults.length > 0) {
                // Calculate score based on test results
                const passedTests = result.testResults.filter(test => test.passed).length;
                score = Math.round((passedTests / result.testResults.length) * 100);

                feedback = this.generateTestFeedback(result.testResults);
            } else {
                // No test cases - basic success
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

    /**
     * Generate feedback for test results
     * @private
     */
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

    /**
     * Generate feedback for compilation/runtime errors
     * @private
     */
    generateErrorFeedback(error) {
        if (!error) return 'Unknown error occurred during execution.';

        // Common Java error patterns and helpful messages
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

        // Add helpful hints based on error patterns
        for (const pattern of errorPatterns) {
            if (pattern.pattern.test(error)) {
                feedback += `💡 Hint: ${pattern.message}`;
                break;
            }
        }

        return feedback;
    }

    /**
     * Get execution history for analytics
     */
    getExecutionHistory() {
        return this.executionHistory;
    }

    /**
     * Clear execution history
     */
    clearHistory() {
        this.executionHistory = [];
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.Judge0Integration = Judge0Integration;
    window.AssessmentJudge0 = AssessmentJudge0;
}