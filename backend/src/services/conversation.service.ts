import type { ChatMessage } from '../models/chat.model';

/**
 * Bounds how much history is forwarded to OpenAI per request. The frontend
 * already trims what it sends, but the backend re-enforces the limit so a
 * misbehaving client can't blow up token usage/cost.
 */
const MAX_HISTORY_MESSAGES = 12;

export class ConversationService {
  /** Keep only the most recent N messages, preserving chronological order. */
  trimHistory(history: ChatMessage[]): ChatMessage[] {
    if (history.length <= MAX_HISTORY_MESSAGES) return history;
    return history.slice(history.length - MAX_HISTORY_MESSAGES);
  }
}

export const conversationService = new ConversationService();
