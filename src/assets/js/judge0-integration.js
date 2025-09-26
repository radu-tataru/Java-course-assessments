/**
 * Judge0 Integration for Java Code Execution
 * Handles code compilation and execution through Judge0 API
 */

class Judge0Client {
    constructor() {
        this.baseUrl = 'https://ce.judge0.com';
        this.languageId = 62; // Java (OpenJDK 13.0.1)
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Submit Java code for execution
     * @param {string} code - Java source code
     * @param {string} input - Input data for the program
     * @returns {Promise<Object>} Execution result
     */
    async executeCode(code, input = '') {
        try {
            console.log('Submitting code to Judge0...');

            const submission = {
                source_code: btoa(code), // Base64 encode
                language_id: this.languageId,
                stdin: btoa(input || ''), // Base64 encode input
                wait: true,
                cpu_time_limit: 5,
                memory_limit: 128000
            };

            const response = await fetch(`${this.baseUrl}/submissions?base64_encoded=true&wait=true`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Host': 'ce.judge0.com'
                },
                body: JSON.stringify(submission)
            });

            if (!response.ok) {
                throw new Error(`Judge0 API error: ${response.status}`);
            }

            const result = await response.json();
            return this.processResult(result);

        } catch (error) {
            console.error('Judge0 execution error:', error);
            return {
                success: false,
                error: 'Code execution failed: ' + error.message,
                stdout: '',
                stderr: error.message,
                executionTime: 0,
                memoryUsage: 0
            };
        }
    }

    /**
     * Process Judge0 API response
     * @param {Object} result - Raw Judge0 response
     * @returns {Object} Processed result
     */
    processResult(result) {
        const processedResult = {
            success: result.status?.id === 3, // Accepted
            stdout: result.stdout ? atob(result.stdout) : '',
            stderr: result.stderr ? atob(result.stderr) : '',
            compileOutput: result.compile_output ? atob(result.compile_output) : '',
            executionTime: result.time || 0,
            memoryUsage: result.memory || 0,
            statusId: result.status?.id,
            statusDescription: result.status?.description || 'Unknown',
            error: null
        };

        // Handle different status codes
        switch (result.status?.id) {
            case 3: // Accepted
                processedResult.success = true;
                break;
            case 4: // Wrong Answer
                processedResult.success = false;
                processedResult.error = 'Wrong Answer';
                break;
            case 5: // Time Limit Exceeded
                processedResult.success = false;
                processedResult.error = 'Time Limit Exceeded';
                break;
            case 6: // Compilation Error
                processedResult.success = false;
                processedResult.error = 'Compilation Error: ' + processedResult.compileOutput;
                break;
            case 7: // Runtime Error (SIGSEGV)
            case 8: // Runtime Error (SIGXFSZ)
            case 9: // Runtime Error (SIGFPE)
            case 10: // Runtime Error (SIGABRT)
            case 11: // Runtime Error (NZEC)
            case 12: // Runtime Error (Other)
                processedResult.success = false;
                processedResult.error = 'Runtime Error: ' + processedResult.stderr;
                break;
            case 13: // Internal Error
                processedResult.success = false;
                processedResult.error = 'Internal Error';
                break;
            case 14: // Exec Format Error
                processedResult.success = false;
                processedResult.error = 'Execution Format Error';
                break;
            default:
                processedResult.success = false;
                processedResult.error = `Unknown status: ${result.status?.description}`;
        }

        return processedResult;
    }

    /**
     * Test specific test cases against code
     * @param {string} code - Java source code
     * @param {Array} testCases - Array of test case objects
     * @returns {Promise<Array>} Array of test results
     */
    async runTestCases(code, testCases) {
        const results = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`Running test case ${i + 1}/${testCases.length}`);

            try {
                const result = await this.executeCode(code, testCase.input || '');

                const testResult = {
                    ...result,
                    testCaseIndex: i,
                    input: testCase.input || '',
                    expectedOutput: testCase.expectedOutput || testCase.output || '',
                    actualOutput: result.stdout.trim(),
                    passed: false
                };

                // Check if output matches expected
                if (result.success) {
                    const expectedOutput = (testCase.expectedOutput || testCase.output || '').trim();
                    const actualOutput = result.stdout.trim();
                    testResult.passed = this.compareOutputs(actualOutput, expectedOutput);
                }

                results.push(testResult);

                // Add delay between requests to avoid rate limiting
                if (i < testCases.length - 1) {
                    await this.delay(this.retryDelay);
                }

            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    testCaseIndex: i,
                    input: testCase.input || '',
                    expectedOutput: testCase.expectedOutput || testCase.output || '',
                    actualOutput: '',
                    passed: false
                });
            }
        }

        return results;
    }

    /**
     * Compare actual and expected outputs
     * @param {string} actual - Actual output
     * @param {string} expected - Expected output
     * @returns {boolean} True if outputs match
     */
    compareOutputs(actual, expected) {
        // Normalize whitespace and line endings
        const normalizeOutput = (str) => str
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim()
            .replace(/\s+$/gm, ''); // Remove trailing whitespace from each line

        return normalizeOutput(actual) === normalizeOutput(expected);
    }

    /**
     * Utility method to add delay
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get available programming languages from Judge0
     * @returns {Promise<Array>} Array of supported languages
     */
    async getLanguages() {
        try {
            const response = await fetch(`${this.baseUrl}/languages`);
            if (!response.ok) {
                throw new Error(`Failed to fetch languages: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to get languages:', error);
            return [];
        }
    }

    /**
     * Check Judge0 system information
     * @returns {Promise<Object>} System information
     */
    async getSystemInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/system_info`);
            if (!response.ok) {
                throw new Error(`Failed to fetch system info: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to get system info:', error);
            return null;
        }
    }
}

// Create global instance
window.judge0Client = new Judge0Client();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Judge0Client;
}