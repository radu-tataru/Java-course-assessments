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

            console.log('Submitting code to Judge0...');

            const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                },
                body: JSON.stringify({
                    source_code: Buffer.from(source_code).toString('base64'),
                    language_id: language_id || 62, // Java
                    stdin: Buffer.from(stdin || '').toString('base64'),
                    cpu_time_limit: 10,
                    memory_limit: 128000,
                    wall_time_limit: 15
                })
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
            console.log('Code submitted, token:', data.token);
            return res.json(data);

        } else if (req.method === 'GET') {
            // Get execution result
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({
                    error: 'Token parameter is required'
                });
            }

            console.log('Getting result for token:', token);

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
            console.log('Result retrieved, status:', data.status?.description || 'unknown');
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