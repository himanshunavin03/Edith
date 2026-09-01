import { Injectable, computed, signal } from '@angular/core';
import type { ChatMessage } from './edith.service';
import type { ConversationTurn } from '../models/voice.model';

/**
 * Owns the on-screen conversation transcript and derives the bounded
 * message history sent to the backend on each request. Keeping the two
 * concerns separate means the UI can show the full transcript while the
 * network payload/token usage stays small.
 */
const MAX_HISTORY_TURNS = 12;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly turns = signal<ConversationTurn[]>([]);
  readonly conversationHistory = this.turns.asReadonly();
  readonly isEmpty = computed(() => this.turns().length === 0);

  addUserTurn(text: string): ConversationTurn {
    const turn: ConversationTurn = { id: crypto.randomUUID(), role: 'user', text, timestamp: Date.now() };
    this.turns.update((t) => [...t, turn]);
    return turn;
  }

  /** Adds a placeholder assistant turn that will be filled in as tokens stream. */
  addPendingAssistantTurn(): string {
    const id = crypto.randomUUID();
    this.turns.update((t) => [...t, { id, role: 'assistant', text: '', timestamp: Date.now(), pending: true }]);
    return id;
  }

  appendToTurn(id: string, delta: string): void {
    this.turns.update((t) => t.map((turn) => (turn.id === id ? { ...turn, text: turn.text + delta } : turn)));
  }

  completeTurn(id: string, finalText?: string): void {
    this.turns.update((t) =>
      t.map((turn) => (turn.id === id ? { ...turn, text: finalText ?? turn.text, pending: false } : turn)),
    );
  }

  addAssistantTurn(text: string): void {
    this.turns.update((t) => [...t, { id: crypto.randomUUID(), role: 'assistant', text, timestamp: Date.now() }]);
  }

  clear(): void {
    this.turns.set([]);
  }

  /**
   * Recent history formatted for the backend, bounded to the last
   * MAX_HISTORY_TURNS turns so token usage/cost stays predictable.
   * The backend re-enforces its own cap defensively.
   */
  historyForApi(): ChatMessage[] {
    const completed = this.turns().filter((t) => !t.pending && t.text.trim().length > 0);
    const recent = completed.slice(-MAX_HISTORY_TURNS);
    return recent.map((t) => ({ role: t.role, content: t.text }));
  }
}
