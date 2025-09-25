/**
 * Simple Node.js backend for Java Assessment System
 * Handles Judge0 API calls securely with environment variables
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (your assessment system)
app.use(express.static('../'));

// Judge0 API proxy endpoint
app.post('/api/judge0/submissions', async (req, res) => {
    try {
        const { source_code, language_id, stdin } = req.body;

        const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
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
        res.json(data);

    } catch (error) {
        console.error('Judge0 submission error:', error);
        res.status(500).json({ error: 'Failed to submit code' });
    }
});

// Judge0 get result endpoint
app.get('/api/judge0/submissions/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const response = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
            headers: {
                'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Judge0 result error:', error);
        res.status(500).json({ error: 'Failed to get result' });
    }
});

app.listen(PORT, () => {
    console.log(`Assessment System Backend running on port ${PORT}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
});

module.exports = app;