import { Injectable, signal } from '@angular/core';
import type { EdithSettings } from '../models/voice.model';

const STORAGE_KEY = 'edith.settings.v1';

const DEFAULT_SETTINGS: EdithSettings = {
  ttsProvider: 'browser',
  ttsVoiceURI: null,
  ttsRate: 1,
  wakeWordEnabled: false,
  streamingEnabled: true,
  continuousMode: false,
  openaiApiKey: null,
};

/** Persists lightweight user preferences in localStorage. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<EdithSettings>(this.load());

  private load(): EdithSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  update(patch: Partial<EdithSettings>): void {
    this.settings.update((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private mode etc) - preference just won't persist
      }
      return next;
    });
  }
}
