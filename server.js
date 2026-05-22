require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const fetch    = require('node-fetch');
const FormData = require('form-data');

const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// ── CORS ───────────────────────────────────────────────────────
// Allow your GitHub Pages domain + localhost for development
const allowedOrigins = [
  'https://yourname.github.io',   // replace with your actual GitHub Pages URL
  'http://localhost:3000',
  'http://127.0.0.1:5500',        // VS Code Live Server
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g. curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin} is not allowed`));
  },
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// ── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /transcribe ───────────────────────────────────────────
// Receives audio file, sends to Groq Whisper, returns raw transcript
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

// ── POST /format ───────────────────────────────────────────────
// Receives raw transcript text, sends to Groq LLM, returns formatted transcript
app.post('/format', async (req, res) => {
  const { transcript, model } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'No transcript text received.' });
  }

  const groqModel = model || 'llama-3.3-70b-versatile';

  const systemPrompt = `You are a professional transcript formatter.
Your task is to take a raw speech-to-text transcript and format it into clean, readable, well-structured text.

Rules:
1. DO NOT remove, skip, or paraphrase ANY words from the transcript.
2. Fix capitalization, punctuation, and paragraph breaks to reflect natural speech flow.
3. Break the text into logical paragraphs based on topic shifts or natural pauses.
4. Correct obvious filler-word placement but keep intentional repetitions.
5. Output ONLY the formatted transcript — no commentary, no preamble, no "Here is..." intro.`;

  try {
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

    const data = await groqRes.json();
    res.json({ formatted: data.choices?.[0]?.message?.content?.trim() || transcript });

  } catch (err) {
    console.error('Format error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VoiceScript backend running on port ${PORT}`);
});