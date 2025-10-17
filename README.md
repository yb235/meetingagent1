# AI Meeting Agent - Setup

## Overview
A real-time AI meeting agent that can join live meetings (Zoom, Teams, etc.), provide real-time summaries, and speak on command using Recall.ai and Deepgram.

## Prerequisites

1.  **Install Node.js:** Ensure you have Node.js (v18 or newer) installed.
2.  **Create API Keys:**
    *   **Deepgram:** Sign up at [deepgram.com](https://deepgram.com) and create an API Key. Ensure it has admin privileges.
    *   **Recall.ai:** Sign up at [recall.ai](https://recall.ai) and get your API Key from the dashboard.

## Setup Instructions

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Create Environment File:** Create a file named `.env` in the project root and add your secret keys. **This file must not be committed to version control.**
    ```env
    DEEPGRAM_API_KEY="YOUR_DEEPGRAM_API_KEY"
    RECALLAI_API_KEY="YOUR_RECALLAI_API_KEY"
    PORT=8080
    ```

## Running the Server

```bash
node server.js
```

The server will start on the port specified in your `.env` file (default: 8080).

## API Endpoints

### POST /briefing
Returns a summary of the recent conversation (last 3 minutes).

**Example Request:**
```bash
curl -X POST http://localhost:8080/briefing
```

### POST /speak
Sends text to be spoken by the AI agent in the meeting.

**Example Request:**
```bash
curl -X POST http://localhost:8080/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is the AI agent."}'
```

### WebSocket /listen
WebSocket endpoint for receiving real-time audio streams from Recall.ai and transcribing them using Deepgram.

## Architecture

The agent uses:
- **Recall.ai** for meeting connectivity and audio stream management
- **Deepgram** for:
  - Real-time Speech-to-Text (STT)
  - Text summarization (LLM)
  - Text-to-Speech (TTS with Aura)

## Development Notes

- Transcripts are buffered for the last 3 minutes of conversation
- Audio streams flow from Recall.ai → Deepgram STT → Server → Deepgram TTS → Recall.ai
