// Test the improved extractUserCode logic

function extractUserCode(fullTemplate, question) {
    console.log('=== extractUserCode Debug ===');
    console.log('Input template length:', fullTemplate.length);
    console.log('First 200 chars:', fullTemplate.substring(0, 200));

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
            // For throws patterns, use the first match (target method)
            // For public method patterns, use the first non-main method
            const targetMatch = matches[0];  // Changed from last to first
            methodStart = targetMatch.index + targetMatch[0].length;
            methodStartPattern = targetMatch[0];
            console.log('Found method pattern:', methodStartPattern);
            break;
        }
    }

    if (methodStart === -1) {
        console.log('No method signature found, trying comment extraction');
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
                    console.log('Extracted via comment markers:', methodBody.length, 'chars');
                    return methodBody;
                }
            }
        }

        console.log('Fallback: returning full template');
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

        // Remove placeholders
        methodBody = methodBody.replace(/\/\*\s*Write your code here\s*\*\//, '').trim();
        methodBody = methodBody.replace('{{USER_CODE}}', '').trim();
        methodBody = methodBody.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//, '').trim(); // Remove all comments

        // Clean up indentation - remove leading whitespace from each line
        const lines = methodBody.split('\n');
        const cleanedLines = lines.map(line => {
            // Remove up to 8 spaces of indentation (method body indentation)
            return line.replace(/^        /, '');
        });

        const result = cleanedLines.join('\n').trim();
        console.log('Final extracted code:', result.length, 'chars');
        console.log('Extracted content:', result.substring(0, 150) + (result.length > 150 ? '...' : ''));

        return result;
    }

    console.log('No extraction possible, returning full template');
    return fullTemplate;
}

// Test Case 1: Full template with user code (throws IOException pattern)
console.log('\n🧪 TEST 1: Full template with throws IOException');
const fullTemplate1 = `import java.io.*;
import java.nio.file.*;
import java.util.*;

public class Main {
    public int countLinesWithWord(String filePath, String searchWord) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            int count = 0;
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.toLowerCase().contains(searchWord.toLowerCase())) {
                    count++;
                }
            }
            return count;
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
            return 0;
        }
    }

    public static void main(String[] args) {
        Main solution = new Main();
        try {
            int result = solution.countLinesWithWord("test.csv", "Apple");
            System.out.println(result);
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}`;

const question1 = {
    template: [
        "import java.io.*;",
        "public class Main {",
        "    public int countLinesWithWord(String filePath, String searchWord) throws IOException {",
        "        {{USER_CODE}}",
        "    }",
        "}"
    ]
};

const result1 = extractUserCode(fullTemplate1, question1);

console.log('\n🧪 TEST 2: Different method signature (no throws)');
const fullTemplate2 = `import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.json.*;

public class Main {
    public List<String> extractUrlsFromJsonFile(String filePath) throws IOException {
        try {
            byte[] jsonData = Files.readAllBytes(Paths.get(filePath));
            String jsonString = new String(jsonData);
            JSONArray jsonArray = new JSONArray(jsonString);
            List<String> urls = new ArrayList<>();
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                urls.add(obj.getString("url"));
            }
            return urls;
        } catch (Exception e) {
            throw new IOException("Failed to parse JSON", e);
        }
    }

    public static void main(String[] args) {
        Main solution = new Main();
        try {
            List<String> urls = solution.extractUrlsFromJsonFile("test.json");
            System.out.println(urls);
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}`;

const question2 = {
    template: [
        "import java.io.*;",
        "public class Main {",
        "    public List<String> extractUrlsFromJsonFile(String filePath) throws IOException {",
        "        {{USER_CODE}}",
        "    }",
        "}"
    ]
};

const result2 = extractUserCode(fullTemplate2, question2);

console.log('\n📝 SUMMARY:');
console.log('Test 1 result length:', result1.length, 'chars');
console.log('Test 2 result length:', result2.length, 'chars');

// Expected: both should extract just the method body content, not the full template
console.log('\nTest 1 should extract method body only:', !result1.includes('public class'));
console.log('Test 2 should extract method body only:', !result2.includes('public class'));