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
            error: 'Judge0 API key not configured'
        });
    }

    try {
        if (req.method === 'POST') {
            // Submit code for execution
            const { source_code, language_id, stdin } = req.body;

            const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                },
                body: JSON.stringify({
                    source_code: Buffer.from(source_code).toString('base64'),
                    language_id,
                    stdin: Buffer.from(stdin || '').toString('base64'),
                    cpu_time_limit: 10,
                    memory_limit: 128000,
                    wall_time_limit: 15
                })
            });

            const data = await response.json();
            return res.json(data);

        } else if (req.method === 'GET') {
            // Get execution result
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({
                    error: 'Token parameter required'
                });
            }

            const response = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
                headers: {
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                }
            });

            const data = await response.json();
            return res.json(data);
        }

        return res.status(405).json({
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('Judge0 API error:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}