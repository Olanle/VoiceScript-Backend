# VoiceScript — Backend

Express API server that handles audio transcription and transcript formatting for the VoiceScript frontend.

## Live API
https://voicescript-api.onrender.com

## Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Check if server is running |
| POST | `/transcribe` | Accepts audio file, returns raw transcript |
| POST | `/format` | Accepts raw transcript text, returns formatted transcript |

## Tech Stack
- Node.js + Express
- Groq API (Whisper large-v3-turbo for transcription, Llama 3.3 70B for formatting)
- Hosted on Render

## Local Setup
```bash
git clone https://github.com/olanle/voicescript-backend.git
cd voicescript-backend
npm install
cp .env.example .env  # add your Groq API key
node server.js
```

## Environment Variables
| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key from console.groq.com |

## Related
- Frontend repo: https://github.com/olanle/VoiceScript-Frontend
