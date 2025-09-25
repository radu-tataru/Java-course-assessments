// Test with the actual student submission from the debug output

// Copy the improved extraction logic
function extractUserCode(fullTemplate, question) {
    console.log('=== extractUserCode Debug ===');
    console.log('Input template length:', fullTemplate.length);
    console.log('First 200 chars:', fullTemplate.substring(0, 200));

    if (!question.template) {
        return fullTemplate;
    }

    // Check if user wrote just the method body (no class/import statements)
    if (!fullTemplate.includes('public class') && !fullTemplate.includes('import ')) {
        console.log('Detected method body only, returning as-is');
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
            const targetMatch = matches[0];  // Use first match (target method)
            methodStart = targetMatch.index + targetMatch[0].length;
            methodStartPattern = targetMatch[0];
            console.log('Found method pattern:', methodStartPattern);
            break;
        }
    }

    if (methodStart === -1) {
        console.log('No method signature found, trying comment extraction');
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
        console.log('Raw method body:', methodBody.length, 'chars');
        console.log('Raw method body content:', methodBody);

        // Remove placeholders
        methodBody = methodBody.replace(/\/\*\s*Write your code here\s*\*\//, '').trim();
        methodBody = methodBody.replace('{{USER_CODE}}', '').trim();
        methodBody = methodBody.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//, '').trim();

        // Special case: If method body still contains class structure,
        // it means student submitted full template - extract the actual implementation
        if (methodBody.includes('public class') || methodBody.includes('import ')) {
            console.log('Method body contains full template structure, extracting actual user code...');

            // Find the innermost method with the same signature
            const innerMethodMatch = methodBody.match(/public\s+int\s+countLinesWithWord[^{]*\{([^}]*)\}/);
            if (innerMethodMatch) {
                const innerCode = innerMethodMatch[1].trim();
                console.log('Found inner method implementation:', innerCode.length, 'chars');
                if (innerCode && innerCode !== '' && !innerCode.includes('{{USER_CODE}}')) {
                    return innerCode;
                }
            }

            // Alternative: Look for specific patterns in user's actual implementation
            const simpleReturnMatch = methodBody.match(/return\s+\d+\s*;/);
            if (simpleReturnMatch) {
                console.log('Found simple return statement:', simpleReturnMatch[0]);
                return simpleReturnMatch[0].trim();
            }
        }

        // Clean up indentation
        const lines = methodBody.split('\n');
        const cleanedLines = lines.map(line => line.replace(/^        /, ''));
        const result = cleanedLines.join('\n').trim();

        console.log('Final extracted code:', result.length, 'chars');
        console.log('Extracted content:', result);
        return result;
    }

    console.log('No extraction possible, returning full template');
    return fullTemplate;
}

// Test with the actual student submission
console.log('🧪 Testing Real Student Submission');
const realStudentCode = `import java.io.*;
import java.nio.file.*;
import java.util.*;

public class Main {
    public int countLinesWithWord(String filePath, String searchWord) throws IOException {
       return 2;
    }

    public static void main(String[] args) {
Main solution = new Main();
try {
    // Test with sample data
    int result = solution.countLinesWithWord("test.csv", "Apple");
    System.out.println(result);
} catch (IOException e) {
    System.err.println("Error: " + e.getMessage());
}
    }
}`;

const question = {
    template: ["template array"]
};

const extracted = extractUserCode(realStudentCode, question);

console.log('\n📝 RESULT:');
console.log('Should extract "return 2;" - Actual result:', JSON.stringify(extracted));
console.log('Length:', extracted.length, 'chars');
console.log('Success:', extracted === 'return 2;');