import { describe, it, expect } from 'vitest';
import { ConversationService } from '../src/services/conversation.service';
import type { ChatMessage } from '../src/models/chat.model';

describe('ConversationService.trimHistory', () => {
  const svc = new ConversationService();

  it('returns history unchanged when under the limit', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    expect(svc.trimHistory(history)).toEqual(history);
  });

  it('trims to the most recent messages when over the limit', () => {
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg-${i}`,
    }));
    const trimmed = svc.trimHistory(history);
    expect(trimmed.length).toBe(12);
    expect(trimmed[trimmed.length - 1].content).toBe('msg-19');
  });
});
