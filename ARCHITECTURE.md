# AI Meeting Agent Architecture

## System Overview

This document describes the architecture of the AI Meeting Agent implementation.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Meeting Platforms                         │
│                  (Zoom, Teams, Google Meet, etc.)                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ 1. Bot joins meeting
                             ↓
                  ┌──────────────────────┐
                  │    Recall.ai Bot     │
                  │  - Joins meeting     │
                  │  - Captures audio    │
                  │  - Plays audio back  │
                  └──────────┬───────────┘
                             │
                  ┏━━━━━━━━━━┻━━━━━━━━━━┓
                  ┃                      ┃
        2. Audio Stream (WS)   4. Play Audio (HTTP)
                  ┃                      ┃
                  ↓                      ↑
┌─────────────────────────────────────────────────────────────────┐
│                     AI Meeting Agent Server                      │
│                          (This Service)                          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   /listen    │  │  /briefing   │  │   /speak     │          │
│  │  WebSocket   │  │     POST     │  │     POST     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         │                  │                  │                  │
│  ┌──────▼──────────────────▼──────────────────▼───────┐         │
│  │           Transcript Buffer (3 minutes)             │         │
│  │  [{text: "...", timestamp: 123...}, ...]            │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                   │
└──────────────┬────────────────────────┬─────────────────────────┘
               │                        │
     3. STT    │              5. Summary│    6. TTS
               │                        │
               ↓                        ↓
    ┌──────────────────┐    ┌──────────────────┐
    │  Deepgram STT    │    │  Deepgram LLM    │
    │  (Speech → Text) │    │  (Summarization) │
    └──────────────────┘    └──────────────────┘
                                       
                            ┌──────────────────┐
                            │  Deepgram TTS    │
                            │  (Text → Speech) │
                            └──────────────────┘
```

## Data Flow

### 1. Transcription Flow
```
Meeting Audio → Recall.ai → /listen (WS) → Deepgram STT → Transcript Buffer
```

### 2. Summary Flow
```
User Request → /briefing → Transcript Buffer → Deepgram LLM → Summary Response
```

### 3. Speech Flow
```
User Text → /speak → Deepgram TTS → Audio → Recall.ai → Meeting
```

## Component Details

### Server Endpoints

#### GET /
- **Purpose:** Health check and endpoint discovery
- **Response:** Server status and available endpoints
- **Authentication:** None

#### POST /set-bot-id
- **Purpose:** Register Recall.ai bot ID for audio playback
- **Input:** `{ "botId": "bot_xyz123" }`
- **Validation:** Alphanumeric + underscore + hyphen only
- **Security:** Input validation prevents SSRF attacks

#### WebSocket /listen
- **Purpose:** Receive real-time audio from Recall.ai
- **Input:** Binary audio data stream
- **Output:** JSON transcript messages
- **Processing:**
  1. Receives audio chunks
  2. Forwards to Deepgram STT
  3. Stores transcripts in buffer
  4. Sends transcripts back to client

#### POST /briefing
- **Purpose:** Generate conversation summary
- **Input:** None (uses buffer)
- **Output:** `{ "summary": "...", "transcriptLength": 1234, "bufferSize": 15 }`
- **Processing:**
  1. Cleans old transcripts from buffer
  2. Combines buffer into single text
  3. Sends to Deepgram summarization
  4. Returns summary

#### POST /speak
- **Purpose:** Speak text in the meeting
- **Input:** `{ "text": "Hello everyone" }`
- **Output:** `{ "success": true, "audioSize": 48000 }`
- **Processing:**
  1. Validates input
  2. Converts text to speech (Deepgram TTS)
  3. Streams audio to Recall.ai
  4. Returns status

### Transcript Buffer

**Structure:**
```javascript
[
  {
    text: "This is what was said",
    timestamp: 1697564400000
  },
  // ... more entries
]
```

**Characteristics:**
- Rolling 3-minute window
- Automatic cleanup of old entries
- In-memory storage (single instance)
- Can be extended to Redis for multi-instance

### External Services

#### Recall.ai
- **Purpose:** Meeting platform integration
- **API:** REST + WebSocket
- **Key Features:**
  - Bot creation and management
  - Audio streaming
  - Audio playback

#### Deepgram
- **Purpose:** AI services provider
- **API:** REST + WebSocket (for STT)
- **Services Used:**
  1. **STT (Speech-to-Text):** Real-time transcription
  2. **LLM (Language Model):** Text summarization
  3. **TTS (Text-to-Speech):** Voice synthesis (Aura)

## Technology Stack

### Runtime & Framework
- **Node.js** v18+ (Event-driven, non-blocking I/O)
- **Express.js** v4.18+ (Web framework)

### Libraries
- **@deepgram/sdk** v3.2+ (Deepgram integration)
- **ws** v8.17+ (WebSocket support)
- **axios** v1.12+ (HTTP client)
- **dotenv** v16.3+ (Environment configuration)

### Development
- **Jest** v29.7+ (Testing framework)
- **Supertest** v7.1+ (HTTP testing)

### Deployment
- **Docker** (Containerization)

## Security Architecture

### Input Validation
- Bot ID format validation (prevents SSRF)
- Text length limits (prevents DoS)
- JSON schema validation

### Authentication
- API keys via environment variables
- No secrets in code
- .env excluded from version control

### Network Security
- HTTPS for API calls
- WSS for WebSocket connections
- Authorization headers for external APIs

## Scalability Considerations

### Current Architecture (Single Instance)
- One meeting at a time
- In-memory transcript buffer
- Suitable for: Development, testing, single-user

### Scaling Options

#### Horizontal Scaling
```
Load Balancer
    ├─→ Instance 1
    ├─→ Instance 2
    └─→ Instance 3
        ↓
    Redis (Shared Buffer)
        ↓
    PostgreSQL (History)
```

#### Multi-Meeting Support
- Session management per meeting
- Separate buffers per session
- Meeting ID in API requests

## Performance Characteristics

### Latency
- Transcription: ~2-3 seconds
- Summarization: ~3-5 seconds
- Speech synthesis: ~1-2 seconds
- End-to-end (speak): ~4-6 seconds

### Resource Usage
- Memory: ~50MB base + ~1MB per minute of transcript
- CPU: Low (mostly I/O bound)
- Network: Continuous WebSocket connection

### Throughput
- Single instance: 1 concurrent meeting
- With Redis: 100+ concurrent meetings (hardware dependent)

## Error Handling

### Network Errors
- Automatic WebSocket reconnection
- Retry logic for API calls
- Graceful degradation

### API Errors
- Deepgram API failures logged
- Recall.ai failures logged
- User-friendly error messages

### Data Errors
- Empty buffer handling
- Invalid input rejection
- Malformed data sanitization

## Monitoring Points

### Health Checks
- Server uptime
- API endpoint availability
- WebSocket connection status

### Metrics
- Transcription accuracy
- API latency
- Error rates
- Buffer size

### Logging
- Connection events
- Transcription events
- API calls
- Errors and warnings

## Deployment Architecture

### Development
```
Local Machine
├── Node.js runtime
├── npm dependencies
└── .env configuration
```

### Production (Docker)
```
Container Platform (Cloud Run, ECS, etc.)
├── Docker container
│   ├── Node.js runtime
│   ├── Application code
│   └── Dependencies
├── Environment variables (secrets)
└── Health check endpoint
```

### Production (Kubernetes)
```
Kubernetes Cluster
├── Deployment (replicas)
├── Service (load balancer)
├── ConfigMap (config)
├── Secret (API keys)
└── Ingress (HTTPS)
```

## Future Enhancements

### Phase 1
- Redis for shared state
- Database for history
- Authentication middleware
- Rate limiting

### Phase 2
- Multi-meeting support
- User management
- Analytics dashboard
- Recording storage

### Phase 3
- Custom wake words
- Action item extraction
- Calendar integration
- Mobile app support
