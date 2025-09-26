/**
 * Database initialization and data migration script
 * Populates the database with assessments and questions from JSON files
 */

import {
    initializeDatabase,
    createAssessment,
    createQuestion,
    getAssessmentByStep
} from './db.js';

const step1QuestionsData = {
  "stepNumber": 1,
  "stepTitle": "Basic File Reading Assessment",
  "description": "Test your understanding of file I/O operations in Java",
  "timeLimit": 30,
  "passingScore": 70,
  "questions": [
    {
      "id": "step1-q1",
      "type": "multiple_choice",
      "question": "Which Java class is most suitable for reading text files line by line?",
      "answers": [
        { "text": "FileReader", "explanation": "FileReader reads characters but doesn't provide line-by-line reading" },
        { "text": "BufferedReader", "explanation": "Correct! BufferedReader provides the readLine() method for efficient line reading" },
        { "text": "FileInputStream", "explanation": "FileInputStream is for reading raw bytes, not suitable for text files" },
        { "text": "Scanner", "explanation": "Scanner can read lines but BufferedReader is more efficient for simple text reading" }
      ],
      "correctAnswer": 1,
      "explanation": "BufferedReader is the best choice for reading text files line by line because it provides the readLine() method and buffers the input for better performance.",
      "difficulty": "beginner",
      "points": 10
    },
    {
      "id": "step1-q2",
      "type": "code_reading",
      "question": "What does this code do?",
      "code": "try (BufferedReader reader = new BufferedReader(new FileReader(\"data.txt\"))) {\n    String line;\n    while ((line = reader.readLine()) != null) {\n        System.out.println(line);\n    }\n} catch (IOException e) {\n    System.err.println(\"Error: \" + e.getMessage());\n}",
      "answers": [
        { "text": "Reads the first line of data.txt and prints it" },
        { "text": "Reads all lines from data.txt and prints each line to the console" },
        { "text": "Creates a new file called data.txt" },
        { "text": "Counts the number of lines in data.txt" }
      ],
      "correctAnswer": 1,
      "explanation": "This code uses a try-with-resources statement to read all lines from 'data.txt' and print each line to the console. The BufferedReader is automatically closed when the try block exits.",
      "difficulty": "beginner",
      "points": 10
    },
    {
      "id": "step1-q3",
      "type": "true_false",
      "question": "The try-with-resources statement automatically closes the BufferedReader even if an exception occurs.",
      "correctAnswer": "true",
      "explanation": "True. Try-with-resources automatically calls close() on resources that implement AutoCloseable, even if an exception is thrown.",
      "difficulty": "beginner",
      "points": 5
    },
    {
      "id": "step1-q4",
      "type": "code_completion",
      "question": "Complete the missing code to read all lines from a file and return them as a List<String>:",
      "requirements": [
        "📝 WHAT TO WRITE: Complete the missing while loop code",
        "❌ DON'T WRITE: class definitions, import statements, or method signatures",
        "✅ DO WRITE: The while loop condition and body to read all lines",
        "💡 HINT: Use readLine() in a while loop condition and add each line to the list"
      ],
      "template": [
        "import java.io.*;",
        "import java.util.*;",
        "",
        "public class Main {",
        "    public List<String> readAllLines(String filePath) throws IOException {",
        "        List<String> lines = new ArrayList<>();",
        "        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {",
        "            String line;",
        "            // Complete the while loop to read all lines",
        "            {{USER_CODE}}",
        "        }",
        "        return lines;",
        "    }",
        "}"
      ],
      "correctAnswer": "while ((line = reader.readLine()) != null) {\n    lines.add(line);\n}",
      "difficulty": "intermediate",
      "points": 15
    },
    {
      "id": "step1-q5",
      "type": "multiple_choice",
      "question": "What happens if you try to read from a file that doesn't exist using FileReader?",
      "answers": [
        { "text": "The program continues normally but returns null" },
        { "text": "A FileNotFoundException is thrown" },
        { "text": "An empty string is returned" },
        { "text": "The file is automatically created" }
      ],
      "correctAnswer": 1,
      "explanation": "FileNotFoundException (which extends IOException) is thrown when trying to open a file that doesn't exist.",
      "difficulty": "beginner",
      "points": 10
    },
    {
      "id": "step1-q6",
      "type": "code_reading",
      "question": "What's wrong with this CSV reading code?",
      "code": "String line = \"Apple,Orange,Banana\";\nString[] parts = line.split(\",\");\nSystem.out.println(\"First fruit: \" + parts[3]);",
      "answers": [
        { "text": "Nothing is wrong, it will print 'Banana'" },
        { "text": "Array index out of bounds - should use parts[2] for the third fruit" },
        { "text": "Should use parts[0] to get the first fruit" },
        { "text": "The split() method is incorrect" }
      ],
      "correctAnswer": 1,
      "explanation": "Arrays are zero-indexed in Java. The array has indices 0, 1, 2 for the three fruits, so parts[3] would cause an ArrayIndexOutOfBoundsException.",
      "difficulty": "intermediate",
      "points": 15
    },
    {
      "id": "step1-q7",
      "type": "coding_challenge",
      "question": "Complete the method body that reads a CSV file and counts how many lines contain a specific word.",
      "requirements": [
        "📝 WHAT TO WRITE: Only write the method body code (what goes inside the { } braces)",
        "❌ DON'T WRITE: class definitions, import statements, or method signatures",
        "✅ DO WRITE: Variable declarations, loops, conditions, return statements",
        "📚 TECHNICAL REQUIREMENTS:",
        "Use BufferedReader to read the file line by line",
        "Return an int representing the count of lines containing the search word",
        "Handle IOException with try-catch block",
        "Search should be case-insensitive (use toLowerCase())",
        "💡 EXAMPLE: If you were completing 'public int add(int a, int b) { ... }', you would write:",
        "    return a + b;",
        "🎯 TIP: Focus on the core logic - file reading, counting, and error handling"
      ],
      "template": [
        "import java.io.*;",
        "import java.nio.file.*;",
        "import java.util.*;",
        "",
        "public class Main {",
        "    public int countLinesWithWord(String filePath, String searchWord) throws IOException {",
        "        {{USER_CODE}}",
        "    }",
        "    ",
        "    public static void main(String[] args) {",
        "        Main solution = new Main();",
        "        try {",
        "            // Test with sample data",
        "            int result = solution.countLinesWithWord(\"test.csv\", \"Apple\");",
        "            System.out.println(result);",
        "        } catch (IOException e) {",
        "            System.err.println(\"Error: \" + e.getMessage());",
        "        }",
        "    }",
        "}"
      ],
      "testCases": [
        {
          "input": "test.csv contains: \"Apple,Red\\nBanana,Yellow\\nApple,Green\\nOrange,Orange\"",
          "expected": "2",
          "description": "Should find 2 lines containing 'Apple'"
        }
      ],
      "difficulty": "intermediate",
      "points": 20
    },
    {
      "id": "step1-q8",
      "type": "multiple_choice",
      "question": "When parsing JSON in Java using org.json library, which class represents a JSON array?",
      "answers": [
        { "text": "JSONList" },
        { "text": "JSONArray" },
        { "text": "JsonArray" },
        { "text": "JSONCollection" }
      ],
      "correctAnswer": 1,
      "explanation": "JSONArray is the correct class in the org.json library for representing JSON arrays.",
      "difficulty": "beginner",
      "points": 10
    },
    {
      "id": "step1-q9",
      "type": "code_completion",
      "question": "Complete the code to extract the 'name' field from each JSON object in an array:",
      "requirements": [
        "📝 WHAT TO WRITE: Code to extract and print the name field",
        "❌ DON'T WRITE: class definitions, import statements, or method signatures",
        "✅ DO WRITE: Variable declaration and print statement for the name field",
        "💡 HINT: Use getString() method to extract the 'name' field from the JSONObject"
      ],
      "template": [
        "import org.json.*;",
        "",
        "public class Main {",
        "    public static void main(String[] args) {",
        "        String jsonString = \"[{\\\"name\\\":\\\"John\\\", \\\"age\\\":25}, {\\\"name\\\":\\\"Jane\\\", \\\"age\\\":30}]\";",
        "        JSONArray jsonArray = new JSONArray(jsonString);",
        "        for (int i = 0; i < jsonArray.length(); i++) {",
        "            JSONObject obj = jsonArray.getJSONObject(i);",
        "            // Extract and print the name",
        "            {{USER_CODE}}",
        "        }",
        "    }",
        "}"
      ],
      "correctAnswer": "String name = obj.getString(\"name\");\nSystem.out.println(name);",
      "difficulty": "intermediate",
      "points": 15
    },
    {
      "id": "step1-q10",
      "type": "coding_challenge",
      "question": "Complete the method body that reads a JSON file containing an array of objects with 'url' and 'name' fields, and returns a List of just the URLs.",
      "requirements": [
        "📝 WHAT TO WRITE: Only write the method body code (what goes inside the { } braces)",
        "❌ DON'T WRITE: class definitions, import statements, or method signatures",
        "✅ DO WRITE: Variable declarations, file reading code, JSON parsing, return statements",
        "📚 TECHNICAL REQUIREMENTS:",
        "Use Files.readAllBytes() to read the file content",
        "Parse JSON using JSONArray and JSONObject classes",
        "Return List<String> containing all URLs from the JSON array",
        "Handle exceptions with try-catch block",
        "💡 EXAMPLE: If you were completing 'public List<String> getNames() { ... }', you would write:",
        "    List<String> names = new ArrayList<>();",
        "    // your logic here",
        "    return names;",
        "🎯 TIP: Read file → parse JSON → extract URLs → return list"
      ],
      "template": [
        "import java.io.*;",
        "import java.nio.file.*;",
        "import java.util.*;",
        "import org.json.*;",
        "",
        "public class Main {",
        "    public List<String> extractUrlsFromJsonFile(String filePath) throws IOException {",
        "        // Write your implementation here",
        "        {{USER_CODE}}",
        "    }",
        "    ",
        "    public static void main(String[] args) {",
        "        Main solution = new Main();",
        "        try {",
        "            List<String> urls = solution.extractUrlsFromJsonFile(\"test.json\");",
        "            System.out.println(urls);",
        "        } catch (IOException e) {",
        "            System.err.println(\"Error: \" + e.getMessage());",
        "        }",
        "    }",
        "}"
      ],
      "testCases": [
        {
          "input": "JSON file contains: [{\"name\":\"Google\",\"url\":\"https://google.com\"},{\"name\":\"GitHub\",\"url\":\"https://github.com\"}]",
          "expected": "[\"https://google.com\", \"https://github.com\"]",
          "description": "Should extract both URLs from the JSON array"
        }
      ],
      "difficulty": "advanced",
      "points": 25
    }
  ]
};

export default async function handler(req, res) {
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
        console.log('Initializing database...');

        // Initialize database structure
        await initializeDatabase();
        console.log('Database structure created successfully');

        // Check if Step 1 assessment already exists
        const existingAssessment = await getAssessmentByStep(1);
        if (existingAssessment) {
            return res.status(200).json({
                success: true,
                message: 'Database already initialized',
                assessment: existingAssessment
            });
        }

        // Create Step 1 assessment
        const assessmentData = {
            step_number: step1QuestionsData.stepNumber,
            title: step1QuestionsData.stepTitle,
            description: step1QuestionsData.description,
            duration_minutes: step1QuestionsData.timeLimit,
            total_questions: step1QuestionsData.questions.length,
            passing_score: step1QuestionsData.passingScore
        };

        const newAssessment = await createAssessment(assessmentData);
        console.log('Assessment created:', newAssessment);

        // Create questions
        let questionsCreated = 0;
        for (let i = 0; i < step1QuestionsData.questions.length; i++) {
            const questionData = step1QuestionsData.questions[i];

            // Map question types
            let questionType = questionData.type;
            if (questionType === 'true_false') questionType = 'true_false';

            // Prepare options for multiple choice questions
            let options = null;
            if (questionData.answers && Array.isArray(questionData.answers)) {
                options = questionData.answers;
            } else if (questionData.template && Array.isArray(questionData.template)) {
                options = {
                    template: questionData.template,
                    requirements: questionData.requirements
                };
            }

            // Prepare test cases for coding challenges
            let testCases = null;
            if (questionData.testCases) {
                testCases = questionData.testCases;
            }

            // Get correct answer
            let correctAnswer = questionData.correctAnswer;
            if (typeof correctAnswer === 'number' && questionData.answers) {
                // For multiple choice, store the correct answer text
                correctAnswer = questionData.answers[correctAnswer].text;
            }

            const dbQuestionData = {
                assessment_id: newAssessment.id,
                question_type: questionType,
                question_text: questionData.question,
                code_snippet: questionData.code || null,
                options: options,
                correct_answer: correctAnswer.toString(),
                explanation: questionData.explanation,
                test_cases: testCases,
                points: questionData.points,
                difficulty: questionData.difficulty,
                order_index: i + 1
            };

            await createQuestion(dbQuestionData);
            questionsCreated++;
        }

        console.log(`Created ${questionsCreated} questions for Step 1 assessment`);

        return res.status(200).json({
            success: true,
            message: 'Database initialized successfully',
            data: {
                assessment: newAssessment,
                questionsCreated
            }
        });

    } catch (error) {
        console.error('Database initialization error:', error);
        return res.status(500).json({
            error: 'Failed to initialize database',
            details: error.message
        });
    }
}

// Function to initialize all planned assessments (for future use)
export async function initializeAllAssessments() {
    const assessments = [
        {
            step_number: 2,
            title: "Desktop API Integration",
            description: "System integration capabilities, cross-platform browser opening, and Desktop API usage patterns",
            duration_minutes: 25,
            total_questions: 8,
            passing_score: 70
        },
        {
            step_number: 3,
            title: "OOP Architecture",
            description: "Professional code architecture, interface design, Factory pattern, and modular design principles",
            duration_minutes: 45,
            total_questions: 12,
            passing_score: 70
        },
        {
            step_number: 4,
            title: "Design Patterns",
            description: "Singleton pattern, application-wide logging, thread-safe global services, and centralized state management",
            duration_minutes: 35,
            total_questions: 10,
            passing_score: 70
        },
        {
            step_number: 5,
            title: "Testing Automation",
            description: "JUnit 5 and TestNG integration, Maven test lifecycle management, and CI/CD pipeline preparation",
            duration_minutes: 40,
            total_questions: 10,
            passing_score: 70
        }
    ];

    for (const assessmentData of assessments) {
        const existing = await getAssessmentByStep(assessmentData.step_number);
        if (!existing) {
            await createAssessment(assessmentData);
        }
    }
}