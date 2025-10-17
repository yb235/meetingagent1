/**
 * AI Meeting Agent Server
 * 
 * This server provides a real-time AI meeting agent that can:
 * 1. Receive and transcribe live audio from meetings via Recall.ai
 * 2. Generate summaries of conversations on demand
 * 3. Speak text into meetings using text-to-speech
 * 
 * Architecture:
 * - Recall.ai manages meeting connections and audio streams
 * - Deepgram handles STT, LLM summarization, and TTS
 * - This server orchestrates the data flow between services
 */

const express = require('express');
const dotenv = require('dotenv');
const { createClient } = require('@deepgram/sdk');
const WebSocket = require('ws');
const axios = require('axios');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

/**
 * Transcript Buffer
 * Stores the last 3 minutes of conversation with timestamps
 */
let transcriptBuffer = [];
const BUFFER_DURATION_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Bot ID Storage
 * Stores the Recall.ai bot ID for audio playback
 */
let currentBotId = null;

/**
 * Clean old transcripts from buffer
 * Removes entries older than BUFFER_DURATION_MS
 */
function cleanTranscriptBuffer() {
  const now = Date.now();
  transcriptBuffer = transcriptBuffer.filter(
    entry => (now - entry.timestamp) < BUFFER_DURATION_MS
  );
}

/**
 * GET / - Health check endpoint
 */
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'AI Meeting Agent Server is operational',
    endpoints: {
      briefing: 'POST /briefing - Get conversation summary',
      speak: 'POST /speak - Speak text in meeting',
      listen: 'WebSocket /listen - Audio stream endpoint',
      setBotId: 'POST /set-bot-id - Set Recall.ai bot ID'
    }
  });
});

/**
 * POST /set-bot-id - Set the current Recall.ai bot ID
 * Body: { "botId": "bot_abc123" }
 */
app.post('/set-bot-id', (req, res) => {
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId is required' });
  }
  currentBotId = botId;
  res.json({ success: true, botId: currentBotId });
});

/**
 * POST /briefing - Generate a summary of recent conversation
 * 
 * This endpoint:
 * 1. Retrieves the transcript buffer (last 3 minutes)
 * 2. Sends it to Deepgram's summarization API
 * 3. Returns the generated summary
 */
app.post('/briefing', async (req, res) => {
  try {
    // Clean old transcripts
    cleanTranscriptBuffer();

    // Check if we have any transcript data
    if (transcriptBuffer.length === 0) {
      return res.json({ 
        summary: 'No conversation data available yet.',
        transcriptLength: 0
      });
    }

    // Combine transcript buffer into a single text
    const transcriptText = transcriptBuffer
      .map(entry => entry.text)
      .join(' ');

    console.log(`Generating summary for ${transcriptText.length} characters of transcript`);

    // Send to Deepgram for summarization
    // Using the pre-recorded API with summarization feature
    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      {
        url: 'data:text/plain;base64,' + Buffer.from(transcriptText).toString('base64')
      },
      {
        model: 'nova-2',
        summarize: 'v2'
      }
    );

    if (error) {
      console.error('Deepgram summarization error:', error);
      return res.status(500).json({ error: 'Failed to generate summary' });
    }

    // Extract summary from response
    const summary = result?.results?.summary?.short || 'Unable to generate summary';

    res.json({
      summary,
      transcriptLength: transcriptText.length,
      bufferSize: transcriptBuffer.length
    });

  } catch (error) {
    console.error('Error in /briefing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /speak - Convert text to speech and play in meeting
 * Body: { "text": "Hello, this is the AI agent." }
 * 
 * This endpoint:
 * 1. Takes user-provided text
 * 2. Converts it to speech using Deepgram TTS (Aura)
 * 3. Streams the audio to the Recall.ai bot to play in the meeting
 */
app.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input
    if (!text) {
      return res.status(400).json({ error: 'text field is required' });
    }

    if (!currentBotId) {
      return res.status(400).json({ 
        error: 'Bot ID not set. Use POST /set-bot-id first.' 
      });
    }

    console.log(`Converting text to speech: "${text}"`);

    // Generate speech using Deepgram TTS
    const response = await deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en',
        encoding: 'linear16',
        container: 'wav'
      }
    );

    // Get the audio stream
    const stream = await response.getStream();
    if (!stream) {
      throw new Error('Failed to get audio stream from Deepgram');
    }

    // Collect the audio data
    const audioChunks = [];
    for await (const chunk of stream) {
      audioChunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(audioChunks);

    console.log(`Generated ${audioBuffer.length} bytes of audio`);

    // Stream the audio to Recall.ai bot
    // Note: This is a placeholder for the actual Recall.ai API integration
    // In production, you would use the Recall.ai "Play Audio" endpoint here
    // Reference: https://docs.recall.ai/reference/bot#play-audio-into-a-call
    
    try {
      const recallResponse = await axios.post(
        `https://api.recall.ai/api/v1/bot/${currentBotId}/play_audio`,
        audioBuffer,
        {
          headers: {
            'Authorization': `Token ${process.env.RECALLAI_API_KEY}`,
            'Content-Type': 'audio/wav'
          }
        }
      );
      
      console.log('Audio sent to Recall.ai successfully');
      res.json({ 
        success: true, 
        message: 'Text converted to speech and sent to meeting',
        audioSize: audioBuffer.length
      });
    } catch (recallError) {
      console.error('Recall.ai API error:', recallError.message);
      // Even if Recall.ai fails, we still generated the audio successfully
      res.json({
        success: false,
        message: 'Audio generated but failed to send to meeting',
        error: recallError.message,
        audioSize: audioBuffer.length
      });
    }

  } catch (error) {
    console.error('Error in /speak:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * WebSocket Server for /listen endpoint
 * 
 * This endpoint receives real-time audio streams from Recall.ai
 * and transcribes them using Deepgram's live transcription.
 * 
 * Data Flow:
 * 1. Recall.ai bot joins meeting and captures audio
 * 2. Recall.ai streams audio to this WebSocket endpoint
 * 3. Audio is piped to Deepgram for real-time transcription
 * 4. Transcripts are stored in the buffer and logged
 * 
 * How to use:
 * When creating a Recall.ai bot, set the destination_endpoint to:
 * wss://your-server-url.com/listen
 */
const server = app.listen(PORT, () => {
  console.log(`AI Meeting Agent Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/listen`);
});

const wss = new WebSocket.Server({ server, path: '/listen' });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established for audio streaming');

  let deepgramLive = null;

  try {
    // Initialize Deepgram live transcription
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: false,
      punctuate: true
    });

    // Handle transcript results
    deepgramLive.on('transcript', (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      
      if (transcript && transcript.trim().length > 0) {
        console.log('Transcript:', transcript);
        
        // Add to buffer with timestamp
        transcriptBuffer.push({
          text: transcript,
          timestamp: Date.now()
        });

        // Send transcript back to client if needed
        ws.send(JSON.stringify({
          type: 'transcript',
          text: transcript,
          timestamp: Date.now()
        }));
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('Deepgram live transcription error:', error);
    });

    // Handle incoming audio data from WebSocket
    ws.on('message', (data) => {
      // Forward audio data to Deepgram
      if (deepgramLive && data instanceof Buffer) {
        deepgramLive.send(data);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (deepgramLive) {
        deepgramLive.finish();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

  } catch (error) {
    console.error('Error setting up transcription:', error);
    ws.close();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
