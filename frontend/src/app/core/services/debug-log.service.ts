import { Injectable, signal } from '@angular/core';

export interface DebugLogEntry {
  time: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_ENTRIES = 150;

/**
 * Lightweight on-screen debug log. Exists so issues can be diagnosed on a
 * device with no attached debugger (e.g. an iPad with no Mac nearby for
 * Safari's Web Inspector) - the Assistant pipeline logs each step here, and
 * any truly uncaught error/rejection is also captured automatically.
 * Purely in-memory, per-session; nothing is sent anywhere.
 */
@Injectable({ providedIn: 'root' })
export class DebugLogService {
  readonly entries = signal<DebugLogEntry[]>([]);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => this.log(`Uncaught error: ${e.message}`, 'error'));
    window.addEventListener('unhandledrejection', (e) =>
      this.log(`Unhandled rejection: ${this.stringify(e.reason)}`, 'error'),
    );
  }

  log(message: string, level: DebugLogEntry['level'] = 'info'): void {
    this.entries.update((e) => [...e, { time: Date.now(), level, message }].slice(-MAX_ENTRIES));
  }

  clear(): void {
    this.entries.set([]);
  }

  private stringify(reason: unknown): string {
    if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
}
