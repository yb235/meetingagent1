# Usage Examples

This document provides practical examples for using the AI Meeting Agent.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Using with Recall.ai

### Step 1: Create a Meeting Bot

Use Recall.ai's API to create a bot and configure it to stream audio to your server:

```bash
curl -X POST https://api.recall.ai/api/v1/bot/ \
  -H "Authorization: Token YOUR_RECALLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_url": "https://zoom.us/j/123456789",
    "bot_name": "AI Meeting Assistant",
    "transcription_options": {
      "provider": "webhook"
    },
    "destination_endpoint": "wss://your-server-url.com/listen"
  }'
```

The response will include a `bot_id` that you'll need for the next steps.

### Step 2: Register the Bot ID

Tell your server about the bot:

```bash
curl -X POST http://localhost:8080/set-bot-id \
  -H "Content-Type: application/json" \
  -d '{"botId": "bot_abc123xyz"}'
```

## API Usage Examples

### Get a Meeting Summary

Request a summary of the last 3 minutes of conversation:

```bash
curl -X POST http://localhost:8080/briefing
```

**Response:**
```json
{
  "summary": "The team discussed the upcoming product launch and assigned action items.",
  "transcriptLength": 1247,
  "bufferSize": 15
}
```

### Speak in the Meeting

Send text for the AI agent to speak in the meeting:

```bash
curl -X POST http://localhost:8080/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Thank you everyone. I will send the meeting notes shortly."}'
```

**Response:**
```json
{
  "success": true,
  "message": "Text converted to speech and sent to meeting",
  "audioSize": 48000
}
```

### Check Server Status

```bash
curl http://localhost:8080/
```

**Response:**
```json
{
  "status": "running",
  "message": "AI Meeting Agent Server is operational",
  "endpoints": {
    "briefing": "POST /briefing - Get conversation summary",
    "speak": "POST /speak - Speak text in meeting",
    "listen": "WebSocket /listen - Audio stream endpoint",
    "setBotId": "POST /set-bot-id - Set Recall.ai bot ID"
  }
}
```

## Testing the WebSocket Connection

You can test the WebSocket connection using a tool like `wscat`:

```bash
npm install -g wscat
wscat -c ws://localhost:8080/listen
```

The connection will start transcribing any audio data you send to it.

## Integration Example (JavaScript)

Here's a simple example of integrating with the agent:

```javascript
const axios = require('axios');

const SERVER_URL = 'http://localhost:8080';

async function setupBot(botId) {
  const response = await axios.post(`${SERVER_URL}/set-bot-id`, { botId });
  console.log('Bot registered:', response.data);
}

async function getSummary() {
  const response = await axios.post(`${SERVER_URL}/briefing`);
  console.log('Summary:', response.data.summary);
  return response.data;
}

async function speakInMeeting(text) {
  const response = await axios.post(`${SERVER_URL}/speak`, { text });
  console.log('Speech sent:', response.data);
  return response.data;
}

// Usage
(async () => {
  await setupBot('bot_abc123');
  await speakInMeeting('Hello everyone, the meeting will begin shortly.');
  
  // Wait for some conversation...
  setTimeout(async () => {
    const summary = await getSummary();
    console.log('Current summary:', summary);
  }, 180000); // 3 minutes
})();
```

## Deployment

### Deploy to Cloud Run (Google Cloud)

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/meeting-agent

# Deploy
gcloud run deploy meeting-agent \
  --image gcr.io/YOUR_PROJECT/meeting-agent \
  --platform managed \
  --region us-central1 \
  --set-env-vars DEEPGRAM_API_KEY=your_key,RECALLAI_API_KEY=your_key
```

### Deploy to Heroku

```bash
# Create app
heroku create your-meeting-agent

# Set environment variables
heroku config:set DEEPGRAM_API_KEY=your_key
heroku config:set RECALLAI_API_KEY=your_key

# Deploy
git push heroku main
```

## Troubleshooting

### Bot ID Not Set Error

If you get "Bot ID not set" error when calling `/speak`:
1. Make sure you've called `/set-bot-id` first
2. Verify the bot ID is correctly formatted (alphanumeric, underscores, hyphens only)

### No Transcript Data

If `/briefing` returns no data:
1. Ensure the Recall.ai bot is properly connected to `/listen` endpoint
2. Check server logs for transcription errors
3. Verify your Deepgram API key is valid

### Audio Not Playing in Meeting

If `/speak` succeeds but audio doesn't play:
1. Verify the Recall.ai bot is still active in the meeting
2. Check Recall.ai API response for errors
3. Ensure your Recall.ai API key has proper permissions
