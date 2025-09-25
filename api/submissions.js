/**
 * Vercel Serverless Function for Judge0 API Proxy
 * Handles both POST (submit) and GET (result) requests
 */

const fetch = require('node-fetch');

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const apiKey = process.env.JUDGE0_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Judge0 API key not configured. Please set JUDGE0_API_KEY environment variable.',
            configured: false
        });
    }

    try {
        if (req.method === 'POST') {
            // Submit code for execution
            const { source_code, language_id, stdin } = req.body;

            if (!source_code) {
                return res.status(400).json({
                    error: 'source_code is required'
                });
            }


            const submissionBody = {
                source_code: source_code, // Send plain text instead of Base64
                language_id: language_id || 62, // Java
                stdin: stdin || '', // Send plain text stdin too
                cpu_time_limit: 10,
                memory_limit: 128000,
                wall_time_limit: 15
            };


            // First, let's check available languages
            try {
                const langResponse = await fetch('https://ce.judge0.com/languages');
                if (langResponse.ok) {
                    const languages = await langResponse.json();
                }
            } catch (langError) {
            }

            // If language_id is not Java (62), respect the original language
            if (submissionBody.language_id !== 62 && submissionBody.language_id) {

                try {
                    const directResponse = await fetch('https://ce.judge0.com/submissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(submissionBody)
                    });

                    if (directResponse.ok) {
                        const directData = await directResponse.json();
                        return res.json(directData);
                    } else {
                    }
                } catch (directError) {
                }
            }

            // Try different Java language IDs only for Java code
            const javaLanguageIds = [62, 91, 10];

            for (const langId of javaLanguageIds) {
                const testBody = { ...submissionBody, language_id: langId };

                try {
                    const directResponse = await fetch('https://ce.judge0.com/submissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(testBody)
                    });

                    if (directResponse.ok) {
                        const directData = await directResponse.json();
                        return res.json(directData);
                    } else {
                    }
                } catch (directError) {
                }
            }

            // Fallback to RapidAPI
            const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                },
                body: JSON.stringify(submissionBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Judge0 submission error:', response.status, errorText);
                return res.status(response.status).json({
                    error: 'Judge0 API error',
                    details: errorText
                });
            }

            const data = await response.json();
            return res.json(data);

        } else if (req.method === 'GET') {
            // Get execution result
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({
                    error: 'Token parameter is required'
                });
            }


            const response = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
                headers: {
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Judge0 result error:', response.status, errorText);
                return res.status(response.status).json({
                    error: 'Judge0 API error',
                    details: errorText
                });
            }

            const data = await response.json();
            return res.json(data);
        }

        return res.status(405).json({
            error: 'Method not allowed. Use POST to submit code or GET with token to retrieve results.'
        });

    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}