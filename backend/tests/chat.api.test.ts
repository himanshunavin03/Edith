import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock the OpenAI service module before importing the app so the controller
// picks up the mock instance. No real network/API calls happen in tests.
vi.mock('../src/services/openai.service', () => {
  return {
    openAIService: {
      chat: vi.fn().mockResolvedValue({ reply: 'The biggest planet is Jupiter.', model: 'gpt-4o-mini' }),
      chatStream: vi.fn(async function* () {
        yield 'The biggest ';
        yield 'planet is Jupiter.';
      }),
      textToSpeech: vi.fn(),
    },
  };
});

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a reply for a valid message', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app).post('/api/chat').send({ message: 'What is the biggest planet?', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Jupiter');
  });

  it('rejects an empty message', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app).post('/api/chat').send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing body', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
