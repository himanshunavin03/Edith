import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../environments/environment';
import { SettingsService } from './settings.service';
import { OpenAiDirectService } from './openai-direct.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

/** Result of checking a transcript against local (no-AI-call) commands. */
export interface LocalCommandResult {
  handled: boolean;
  response?: string;
}

const GREETING_PHRASES = new Set(['hi edith', 'hey edith', 'hello edith']);

/**
 * EdithService owns:
 *  - deterministic local command handling ("Hi Edith" -> canned greeting,
 *    no AI call, no token cost), designed so more local commands can be
 *    added to handleLocalCommand later.
 *  - talking to the EDITH backend for everything else (non-streaming and
 *    streaming chat completions, transcription). The OpenAI API key never
 *    touches the browser in this mode — only backend URLs are called.
 *  - OPTIONALLY, if the user has entered their own key in Settings
 *    (SettingsService.settings().openaiApiKey), calling OpenAI directly
 *    from the browser instead (OpenAiDirectService), so EDITH can run
 *    with no backend at all (e.g. as a plain static site). This is the
 *    exception to "the key never touches the browser" - see
 *    OpenAiDirectService's doc comment for why that's an accepted
 *    per-user tradeoff here, not the default.
 */
@Injectable({ providedIn: 'root' })
export class EdithService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly direct = inject(OpenAiDirectService);
  private readonly baseUrl = environment.apiBaseUrl;

  private get directApiKey(): string | null {
    const key = this.settings.settings().openaiApiKey;
    return key && key.trim() ? key.trim() : null;
  }

  /** Normalizes a raw transcript for matching against local commands. */
  private normalize(transcript: string): string {
    return transcript
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks the transcript against known local commands before anything is
   * sent to the AI backend. Extend this switch/table to add more commands
   * (e.g. "stop", "clear conversation") without spending AI tokens.
   */
  handleLocalCommand(transcript: string): LocalCommandResult {
    const normalized = this.normalize(transcript);

    if (GREETING_PHRASES.has(normalized)) {
      return { handled: true, response: 'Hi Rudra! How can I help you?' };
    }

    return { handled: false };
  }

  /** Non-streaming chat call. */
  async chat(message: string, history: ChatMessage[]): Promise<ChatResponse> {
    const apiKey = this.directApiKey;
    if (apiKey) return this.direct.chat(message, history, apiKey);

    return await new Promise<ChatResponse>((resolve, reject) => {
      this.http.post<ChatResponse>(`${this.baseUrl}/chat`, { message, history }).subscribe({
        next: resolve,
        error: reject,
      });
    });
  }

  /**
   * Streaming chat call via Server-Sent Events. Uses fetch() directly
   * (HttpClient doesn't natively support SSE) and yields text deltas as
   * they arrive so the UI can render the answer incrementally.
   */
  async *chatStream(message: string, history: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    const apiKey = this.directApiKey;
    if (apiKey) {
      yield* this.direct.chatStream(message, history, apiKey, signal);
      return;
    }

    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
      signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`Chat stream failed (${response.status}): ${body || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const { event, data } = this.parseSseFrame(frame);
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === 'delta' && typeof parsed.text === 'string') {
          yield parsed.text;
        } else if (event === 'error') {
          throw new Error(parsed.message || 'Stream error');
        }
      }
    }
  }

  /** Uploads a recorded audio clip and returns its transcription. */
  async transcribe(blob: Blob): Promise<string> {
    const apiKey = this.directApiKey;
    if (apiKey) return this.direct.transcribe(blob, apiKey);

    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Transcription failed (${response.status}): ${body || response.statusText}`);
    }
    const data = (await response.json()) as { text: string };
    return data.text;
  }

  private parseSseFrame(frame: string): { event: string; data: string } {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    return { event, data: dataLines.join('\n') };
  }
}
