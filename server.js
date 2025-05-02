require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { OpenAI } = require('openai');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = {
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID
};

// Check for missing environment variables
const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Audio folder
const audioDir = path.join(__dirname, 'audio');
fs.mkdir(audioDir, { recursive: true }).catch(console.error);

// Helpers
function generateFilename() {
    return `audio_${Date.now()}.mp3`;
}

function handleApiError(res, error) {
    console.error('🧨 API Error:', error);
    console.error('🧵 Stack Trace:', error.stack);
    res.status(500).json({ 
        error: 'Failed to process request', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
}

// === Narrate Endpoint ===
app.post('/api/narrate', async (req, res) => {
  try {
    const { thread } = req.body;
    if (!thread) return res.status(400).json({ error: 'Thread text is required' });

    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    console.log("🎙️ Sending raw thread to ElevenLabs...");
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: thread,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) throw new Error(`ElevenLabs API error: ${response.statusText}`);

    const audioBuffer = await response.buffer();
    const filename = generateFilename();
    await fs.writeFile(path.join(audioDir, filename), audioBuffer);

    console.log("✅ Narration complete:", filename);
    res.json({ audioUrl: `http://localhost:${port}/audio/${filename}` });
  } catch (error) {
    handleApiError(res, error);
  }
});

// === Podcastify Endpoint ===
app.post('/api/podcastify', async (req, res) => {
    try {
        const { thread } = req.body;
        console.log("📩 Received thread:", thread?.substring(0, 100) + '...');

        if (!thread) return res.status(400).json({ error: 'Thread text is required' });

        // Step 1: Generate podcast script using OpenAI
        console.log("⏳ Sending to OpenAI...");
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a podcast script writer. Create engaging, conversational scripts that maintain the key points of the original content."
                },
                {
                    role: "user",
                    content: `Summarize this thread in a natural podcast script under 5 minutes. Keep it conversational and informative:\n\n${thread}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });

        const podcastScript = completion.choices[0].message.content;
        console.log("✅ Got response from OpenAI");
        console.log("📝 Podcast Script:", podcastScript?.substring(0, 100) + '...');

        // Step 2: Generate audio using ElevenLabs
        const voiceId = process.env.ELEVENLABS_VOICE_ID;
        console.log("🎙️ Sending script to ElevenLabs...");
        console.log("🔑 Using voice ID:", voiceId);
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: podcastScript,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ElevenLabs API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`ElevenLabs API error: ${response.statusText} - ${errorText}`);
        }

        const audioBuffer = await response.buffer();
        const filename = generateFilename();
        await fs.writeFile(path.join(audioDir, filename), audioBuffer);

        console.log("✅ Podcast narration complete:", filename);
        res.json({ audioUrl: `http://localhost:${port}/audio/${filename}` });
    } catch (error) {
        handleApiError(res, error);
    }
});

// Serve local audio
app.use('/audio', express.static(audioDir));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        env: {
            hasOpenAIKey: !!openai.apiKey,
            hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
            hasVoiceId: !!process.env.ELEVENLABS_VOICE_ID
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log('✅ Environment check:', {
        hasOpenAIKey: !!openai.apiKey,
        hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
        hasVoiceId: !!process.env.ELEVENLABS_VOICE_ID
    });
});
