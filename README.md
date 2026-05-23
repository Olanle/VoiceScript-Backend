# VoiceScript — Backend

Express API server that handles audio transcription and transcript formatting for the VoiceScript frontend. All API keys are stored securely as environment variables and never exposed to the client.

## Live API
https://voicescript-api.onrender.com

## Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Check if server is running |
| POST | `/transcribe` | Accepts audio file, returns raw transcript via Groq Whisper |
| POST | `/format` | Accepts raw transcript and model choice, returns formatted transcript |

## Formatting Model Routing
The `/format` endpoint automatically routes to the correct API based on the model selected:
- Models starting with `models/gemini` → Google Gemini API
- All other models → Groq LLM API

## Tech Stack
- Node.js + Express
- Groq API — Whisper large-v3-turbo for transcription, Llama 3.3 70B / 3.1 8B for formatting
- Google Gemini API — Gemini 2.5 Flash / 2.5 Pro for formatting
- Hosted on Render

## Local Setup
```bash
git clone https://github.com/olanle/voicescript-backend.git
cd voicescript-backend
npm install
cp .env.example .env  # add your API keys
node server.js
```

## Environment Variables
| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key from console.groq.com |
| `GEMINI_API_KEY` | Your Gemini API key from aistudio.google.com |

## .env Example
