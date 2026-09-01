import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/openai.service', () => {
  return {
    openAIService: {
      chat: vi.fn(),
      chatStream: vi.fn(),
      textToSpeech: vi.fn(),
      transcribe: vi.fn().mockResolvedValue('hi edith'),
    },
  };
});

describe('POST /api/transcribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transcribed text for a posted audio buffer', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app)
      .post('/api/transcribe')
      .set('Content-Type', 'audio/webm')
      .send(Buffer.from([1, 2, 3, 4]));
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('hi edith');
  });

  it('rejects an empty body', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const res = await request(app).post('/api/transcribe').set('Content-Type', 'audio/webm').send(Buffer.alloc(0));
    expect(res.status).toBe(400);
  });
});
