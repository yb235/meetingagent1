/**
 * Basic test suite for AI Meeting Agent Server
 * 
 * This file contains simple tests to validate the server endpoints
 * without requiring actual API keys or live connections.
 */

const request = require('supertest');

// Mock environment variables for testing
process.env.DEEPGRAM_API_KEY = 'test_key';
process.env.RECALLAI_API_KEY = 'test_key';
process.env.PORT = '0'; // Use random port

const app = require('./server');

describe('AI Meeting Agent Server', () => {
  describe('GET /', () => {
    test('should return server status and available endpoints', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('running');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.briefing).toBeDefined();
      expect(response.body.endpoints.speak).toBeDefined();
      expect(response.body.endpoints.listen).toBeDefined();
    });
  });

  describe('POST /set-bot-id', () => {
    test('should accept and store bot ID', async () => {
      const response = await request(app)
        .post('/set-bot-id')
        .send({ botId: 'test_bot_123' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.botId).toBe('test_bot_123');
    });

    test('should return error when botId is missing', async () => {
      const response = await request(app)
        .post('/set-bot-id')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should reject invalid botId format', async () => {
      const response = await request(app)
        .post('/set-bot-id')
        .send({ botId: 'invalid/../../../etc/passwd' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid botId format');
    });
  });

  describe('POST /briefing', () => {
    test('should return no data message when buffer is empty', async () => {
      const response = await request(app).post('/briefing');
      
      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.transcriptLength).toBe(0);
    });
  });

  describe('POST /speak', () => {
    test('should return error when text is missing', async () => {
      const response = await request(app)
        .post('/speak')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should return error when bot ID is not set', async () => {
      const response = await request(app)
        .post('/speak')
        .send({ text: 'Hello world' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Bot ID not set');
    });
  });
});
