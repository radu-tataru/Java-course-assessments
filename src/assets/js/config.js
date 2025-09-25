/**
 * Configuration file for Java Course Assessment System
 */

const CONFIG = {
    // Judge0 API Configuration
    JUDGE0: {
        API_URL: 'https://judge0-ce.p.rapidapi.com',
        API_KEY: '', // Set this in config.local.js or environment
        JAVA_LANGUAGE_ID: 62, // Java (OpenJDK 13.0.1)
        TIMEOUT: 10, // seconds
        MEMORY_LIMIT: 128000 // KB
    },

    // Course Configuration
    COURSE: {
        TOTAL_STEPS: 9,
        PASSING_SCORE: 70, // percentage
        MAX_ATTEMPTS: 3
    },

    // Assessment Types
    QUESTION_TYPES: {
        MULTIPLE_CHOICE: 'multiple_choice',
        CODE_READING: 'code_reading',
        CODE_COMPLETION: 'code_completion',
        CODING_CHALLENGE: 'coding_challenge',
        TRUE_FALSE: 'true_false'
    },

    // Local Storage Keys
    STORAGE_KEYS: {
        STUDENT_PROGRESS: 'jcas_student_progress',
        CURRENT_ASSESSMENT: 'jcas_current_assessment',
        TEACHER_DATA: 'jcas_teacher_data',
        SUBMISSIONS: 'jcas_submissions'
    },

    // UI Configuration
    UI: {
        THEME: 'bootstrap',
        ANIMATION_DURATION: 300,
        AUTO_SAVE_INTERVAL: 30000 // 30 seconds
    }
};

// Check for local configuration overrides
if (typeof LOCAL_CONFIG !== 'undefined') {
    Object.assign(CONFIG, LOCAL_CONFIG);
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}