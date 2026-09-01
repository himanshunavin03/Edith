import { Injectable } from '@angular/core';

export interface DirectChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_MODEL = 'gpt-4o-mini';
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'alloy';
const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = [
  'You are EDITH, a concise, helpful voice assistant speaking to a user named Rudra.',
  'Keep answers short and conversational (1-3 sentences) since they will be read aloud.',
  'Avoid markdown, bullet points, or code blocks in your replies - plain spoken sentences only.',
].join(' ');

/**
 * Calls the OpenAI API directly from the browser, using a key the user
 * pastes into Settings (persisted only in this browser's localStorage -
 * see SettingsService.EdithSettings.openaiApiKey). This exists so EDITH
 * can run as a plain static site with no backend server at all.
 *
 * This is a different risk profile than shipping a key inside the app's
 * own JS bundle: it's the user's own key, entered into their own browser,
 * sent only from that browser directly to api.openai.com, and never part
 * of the code served to any other visitor. It's still visible to anyone
 * with access to that browser/device, so it's meant for personal-device,
 * personal-use deployments - see the Settings panel hint and README.
 *
 * Prefer EdithService's backend path (Node/Express, see backend/) whenever
 * you control a server: it keeps the key off the browser entirely, and
 * remains the default/fallback whenever no key is set here.
 */
@Injectable({ providedIn: 'root' })
export class OpenAiDirectService {
  private headers(apiKey: string, contentType?: string): HeadersInit {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (contentType) headers['Content-Type'] = contentType;
    return headers;
  }

  private buildMessages(message: string, history: DirectChatMessage[]) {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];
  }

  async chat(message: string, history: DirectChatMessage[], apiKey: string): Promise<{ reply: string; model: string }> {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey, 'application/json'),
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: this.buildMessages(message, history),
        temperature: 0.6,
        max_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res));
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('OpenAI returned an empty response');
    return { reply, model: CHAT_MODEL };
  }

  async *chatStream(
    message: string,
    history: DirectChatMessage[],
    apiKey: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey, 'application/json'),
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: this.buildMessages(message, history),
        temperature: 0.6,
        max_tokens: 300,
        stream: true,
      }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(await this.errorMessage(res));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore a malformed/partial SSE frame rather than aborting the whole stream
        }
      }
    }
  }

  async transcribe(blob: Blob, apiKey: string): Promise<string> {
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('file', blob, `speech.${ext}`);
    form.append('model', TRANSCRIBE_MODEL);

    const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: form,
    });
    if (!res.ok) throw new Error(await this.errorMessage(res));
    const data = await res.json();
    return (data.text ?? '').trim();
  }

  async textToSpeech(text: string, apiKey: string): Promise<Blob> {
    const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: 'POST',
      headers: this.headers(apiKey, 'application/json'),
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: 'mp3' }),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res));
    return res.blob();
  }

  private async errorMessage(res: Response): Promise<string> {
    try {
      const data = await res.json();
      return data.error?.message || `OpenAI request failed (${res.status})`;
    } catch {
      return `OpenAI request failed (${res.status})`;
    }
  }
}
