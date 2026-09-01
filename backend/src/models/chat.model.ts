import { z } from 'zod';

/** A single turn in the conversation, as sent by the frontend. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Request body for POST /api/chat and /api/chat/stream.
 * The frontend sends a bounded slice of recent history (see
 * ConversationService on the frontend) rather than the full transcript.
 */
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'message must not be empty').max(4000, 'message too long'),
  history: z.array(chatMessageSchema).max(20, 'history too long').optional().default([]),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatResponse {
  reply: string;
  model: string;
}

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type TtsRequest = z.infer<typeof ttsRequestSchema>;
