require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const fetch    = require('node-fetch');
const FormData = require('form-data');

const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// CORS
const allowedOrigins = [
  'https://olanle.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// System Prompt
const systemPrompt = `You are a professional transcript formatter.
Your task is to take a raw speech-to-text transcript and format it into clean, readable, well-structured text.

Rules:
1. DO NOT remove, skip, or paraphrase ANY words from the transcript.
2. Fix capitalization, punctuation, and paragraph breaks to reflect natural speech flow.
3. Break the text into logical paragraphs based on topic shifts or natural pauses.
4. Correct obvious filler-word placement but keep intentional repetitions.
5. Output ONLY the formatted transcript — no commentary, no preamble, no "Here is..." intro.`;

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /transcribe
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' });
  }

  try {
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: err?.error?.message || 'Groq Whisper API error.'
      });
    }

    const data = await groqRes.json();
    res.json({ transcript: data.text?.trim() || '' });

  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// POST /format
app.post('/format', async (req, res) => {
  const { transcript, model } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'No transcript text received.' });
  }

  const isGemini = model && (model.startsWith('gemini') || model.startsWith('models/gemini'));

  try {
    let formatted;

    if (isGemini) {
      // Gemini API
      const geminiModel = model || 'models/gemini-2.5-flash';

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: `Format this transcript:\n\n${transcript}` }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
            }
          }),
        }
      );

      if (!geminiRes.ok) {
        const err = await geminiRes.json().catch(() => ({}));
        return res.status(geminiRes.status).json({
          error: err?.error?.message || 'Gemini API error.'
        });
      }

      const geminiData = await geminiRes.json();
      formatted = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || transcript;

    } else {
      // Groq API 
      const groqModel = model || 'llama-3.3-70b-versatile';

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: `Format this transcript:\n\n${transcript}` }
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        return res.status(groqRes.status).json({
          error: err?.error?.message || 'Groq LLM API error.'
        });
      }

      const groqData = await groqRes.json();
      formatted = groqData.choices?.[0]?.message?.content?.trim() || transcript;
    }

    res.json({ formatted });

  } catch (err) {
    console.error('Format error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VoiceScript backend running on port ${PORT}`);
});
