import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { TimeoutAppError, UpstreamError } from '../utils/errors';
import type { ChatMessage } from '../models/chat.model';

/**
 * Thin wrapper around the OpenAI SDK. Kept isolated behind an interface-like
 * shape so it can be mocked in tests without hitting the real API, and so
 * the rest of the app doesn't depend on the SDK directly.
 *
 * Uses the Chat Completions API (gpt-4o-mini by default) — the simplest
 * currently-supported architecture for a text-in/text-out assistant POC.
 * The OpenAI Realtime API (speech-to-speech) is intentionally NOT used for
 * V1: it adds WebRTC/WebSocket session complexity that isn't needed to get
 * the basic voice loop working. See README "Future Architecture".
 */
export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string = env.OPENAI_API_KEY) {
    this.client = new OpenAI({ apiKey, timeout: 20_000 });
  }

  private systemPrompt(): string {
    return [
      "You are EDITH, a concise, helpful voice assistant speaking to a user named Rudra.",
      'Keep answers short and conversational (1-3 sentences) since they will be read aloud.',
      'Avoid markdown, bullet points, or code blocks in your replies — plain spoken sentences only.',
    ].join(' ');
  }

  private buildMessages(message: string, history: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      ...history.map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.ChatCompletionMessageParam),
      { role: 'user', content: message },
    ];
  }

  /** Non-streaming completion, used by POST /api/chat. */
  async chat(message: string, history: ChatMessage[]): Promise<{ reply: string; model: string }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: this.buildMessages(message, history),
        temperature: 0.6,
        max_tokens: 300,
      });
      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) throw new UpstreamError('OpenAI returned an empty response');
      return { reply, model: env.OPENAI_MODEL };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Streaming completion, used by POST /api/chat/stream (SSE). */
  async *chatStream(message: string, history: ChatMessage[]): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: this.buildMessages(message, history),
        temperature: 0.6,
        max_tokens: 300,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /**
   * Speech-to-text. iOS Safari has no usable SpeechRecognition API, so the
   * frontend records audio with MediaRecorder and posts the clip here for
   * transcription via OpenAI's audio transcription model.
   */
  async transcribe(audio: Buffer, contentType: string): Promise<string> {
    try {
      const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : 'webm';
      const file = await OpenAI.toFile(audio, `speech.${ext}`, { type: contentType });
      const result = await this.client.audio.transcriptions.create({
        file,
        model: env.OPENAI_TRANSCRIBE_MODEL,
      });
      return result.text.trim();
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Optional server-side TTS (alternative to browser SpeechSynthesis). */
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: env.OPENAI_TTS_MODEL,
        voice: env.OPENAI_TTS_VOICE as OpenAI.Audio.Speech.SpeechCreateParams['voice'],
        input: text,
        response_format: 'mp3',
      });
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): Error {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 408 || err.code === 'ETIMEDOUT') {
        return new TimeoutAppError();
      }
      logger.error({ status: err.status, code: err.code }, 'OpenAI API error');
      return new UpstreamError(`OpenAI request failed (${err.status ?? 'unknown'})`);
    }
    if (err instanceof Error && err.name === 'APIConnectionTimeoutError') {
      return new TimeoutAppError();
    }
    logger.error({ err }, 'Unexpected OpenAI error');
    return new UpstreamError('OpenAI request failed');
  }
}

export const openAIService = new OpenAIService();
