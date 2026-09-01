import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { VoiceService } from '../../core/services/voice.service';
import { AudioService } from '../../core/services/audio.service';
import { EdithService } from '../../core/services/edith.service';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsService } from '../../core/services/settings.service';
import { OnlineStatusService } from '../../core/services/online-status.service';
import { SettingsPanel } from '../settings/settings-panel';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [SettingsPanel],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class Assistant {
  protected readonly voice = inject(VoiceService);
  protected readonly audio = inject(AudioService);
  protected readonly edith = inject(EdithService);
  protected readonly conversation = inject(ConversationService);
  protected readonly settings = inject(SettingsService);
  protected readonly online = inject(OnlineStatusService);

  protected readonly settingsOpen = signal(false);

  protected readonly statusLabel = computed(() => {
    switch (this.voice.status()) {
      case 'idle':
        return 'Ready';
      case 'listening':
        return this.voice.passiveListening() ? `Listening for "Hi Edith"...` : 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return this.voice.error() ?? 'Something went wrong';
    }
  });

  private readonly scrollAnchor = viewChild<ElementRef<HTMLDivElement>>('scrollAnchor');
  private abortController: AbortController | null = null;
  /**
   * True once the user has started a conversation with Continuous mode on.
   * Lets us auto-relisten after each spoken reply without a fresh tap, while
   * still stopping the loop the moment the user taps Stop/mutes.
   */
  private continuousActive = false;
  /**
   * True once the user has tapped in with Wake word mode on. Drives
   * passiveWakeListen(): short background recording chunks that are
   * transcribed and checked ONLY against local commands (e.g. "Hi Edith")
   * - never sent to the AI - until one matches. This is a real, working
   * implementation (per the brief's "optional progressive enhancement"),
   * not a faked always-on listener: it still requires the page to be open
   * and foregrounded, and the very first chunk still needs the initial tap
   * to obtain microphone permission.
   */
  private wakeLoopActive = false;

  constructor() {
    // Auto-scroll the transcript into view as new turns/deltas arrive.
    effect(() => {
      this.conversation.conversationHistory();
      queueMicrotask(() => this.scrollAnchor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    });
  }

  protected async onMicTap(): Promise<void> {
    if (this.voice.status() === 'listening') {
      // Mid wake-word/continuous loop, a tap means "end the session"
      // (same as Stop) rather than just cutting off the current chunk.
      if (this.wakeLoopActive || this.continuousActive) {
        this.onStop();
      } else {
        this.voice.stopRecording();
      }
      return;
    }
    if (this.voice.status() === 'speaking') {
      this.audio.stop();
      this.voice.reset();
      return;
    }
    if (this.voice.status() === 'processing') {
      return;
    }

    const s = this.settings.settings();
    if (s.wakeWordEnabled) {
      // Wake-word mode: this one tap is the ONLY tap needed for the whole
      // session. From here EDITH listens in short background chunks for
      // "Hi Edith" and treats hearing it exactly like another tap.
      this.wakeLoopActive = true;
      await this.passiveWakeListen();
      return;
    }

    this.continuousActive = s.continuousMode;
    await this.listenOnce();
  }

  protected onStop(): void {
    this.continuousActive = false;
    this.wakeLoopActive = false;
    this.abortController?.abort();
    this.voice.stopRecording();
    this.voice.setPassiveListening(false);
    this.audio.stop();
    this.voice.reset();
  }

  /** Records one utterance and processes it. Used by the initial tap, the continuous-mode auto-relisten loop, and after a wake word fires. */
  private async listenOnce(): Promise<void> {
    this.voice.reset();
    try {
      const blob = await this.voice.startRecording();
      await this.handleRecordedAudio(blob);
    } catch {
      // error state already set by VoiceService; stop the continuous loop rather than retrying blindly
      this.continuousActive = false;
    }
  }

  /**
   * Background wake-word loop: repeatedly records a short (4s) clip,
   * transcribes it, and checks ONLY for local commands like "Hi Edith" -
   * never sends these silent/ambient chunks to the AI backend. The instant
   * a wake phrase is heard, it's handled exactly like a manual tap would
   * be, and the session switches to fully hands-free (continuousActive)
   * for the rest of the conversation.
   */
  private async passiveWakeListen(): Promise<void> {
    if (!this.wakeLoopActive) return;

    this.voice.reset();
    this.voice.setPassiveListening(true);

    let blob: Blob;
    try {
      blob = await this.voice.startRecording(4_000);
    } catch {
      this.voice.setPassiveListening(false);
      // A real failure (permission denied/unsupported) stops the loop and
      // surfaces the error VoiceService already set. A transient hiccup
      // (e.g. an empty short clip) just retries quietly.
      const permission = this.voice.microphonePermission();
      if (permission === 'denied' || permission === 'unsupported') {
        this.wakeLoopActive = false;
        return;
      }
      this.voice.reset();
      await this.passiveWakeListen();
      return;
    }
    this.voice.setPassiveListening(false);

    let transcript = '';
    try {
      transcript = await this.edith.transcribe(blob);
    } catch {
      // Network/API hiccup - stay in the loop rather than surfacing an
      // error banner for a background listen the user didn't explicitly ask for.
    }

    const local = this.edith.handleLocalCommand(transcript);
    if (local.handled && local.response) {
      this.voice.reset();
      this.conversation.addUserTurn(transcript);
      this.conversation.addAssistantTurn(local.response);
      this.continuousActive = true; // hands-free from here on - no need to say "Hi Edith" again
      await this.speak(local.response);
      return;
    }

    if (this.wakeLoopActive) {
      await this.passiveWakeListen();
    }
  }

  protected onClearConversation(): void {
    this.conversation.clear();
  }

  protected onToggleSettings(): void {
    this.settingsOpen.update((v) => !v);
  }

  private async handleRecordedAudio(blob: Blob): Promise<void> {
    this.voice.setStatus('processing');
    let transcript: string;
    try {
      transcript = await this.edith.transcribe(blob);
    } catch (err) {
      this.voice.setError(this.describeError(err, 'Could not transcribe your speech.'));
      return;
    }

    if (!transcript || !transcript.trim()) {
      this.voice.setError('No speech was detected. Please try again.');
      return;
    }

    this.conversation.addUserTurn(transcript);

    // Deterministic local commands (e.g. "Hi Edith") never hit the AI backend.
    const local = this.edith.handleLocalCommand(transcript);
    if (local.handled && local.response) {
      this.conversation.addAssistantTurn(local.response);
      await this.speak(local.response);
      return;
    }

    await this.askAssistant(transcript);
  }

  private async askAssistant(message: string): Promise<void> {
    const history = this.conversation.historyForApi().slice(0, -1); // exclude the just-added user turn
    this.abortController = new AbortController();

    if (this.settings.settings().streamingEnabled) {
      const turnId = this.conversation.addPendingAssistantTurn();
      let full = '';
      try {
        for await (const delta of this.edith.chatStream(message, history, this.abortController.signal)) {
          full += delta;
          this.conversation.appendToTurn(turnId, delta);
        }
        this.conversation.completeTurn(turnId);
      } catch (err) {
        this.conversation.completeTurn(turnId, full || '(no response)');
        this.voice.setError(this.describeError(err, 'EDITH could not reach the AI backend.'));
        return;
      }
      if (full.trim()) await this.speak(full);
      else this.voice.reset();
      return;
    }

    try {
      const { reply } = await this.edith.chat(message, history);
      this.conversation.addAssistantTurn(reply);
      await this.speak(reply);
    } catch (err) {
      this.voice.setError(this.describeError(err, 'EDITH could not reach the AI backend.'));
    }
  }

  private async speak(text: string): Promise<void> {
    this.voice.setStatus('speaking');
    const s = this.settings.settings();
    try {
      await this.audio.speak(text, { provider: s.ttsProvider, voiceURI: s.ttsVoiceURI, rate: s.ttsRate });
      this.voice.reset();
    } catch (err) {
      this.voice.setError(this.describeError(err, 'Speech playback failed.'));
      this.continuousActive = false;
      return;
    }

    // Continuous mode: automatically start listening for the next question
    // instead of waiting for another tap. Only the very first recording of
    // the conversation needed the tap's user gesture.
    if (this.continuousActive) {
      await this.listenOnce();
    }
  }

  private describeError(err: unknown, fallback: string): string {
    if (!this.online.isOnline()) return 'You appear to be offline. Check your network connection.';
    if (err instanceof Error) {
      if (err.name === 'AbortError') return 'Cancelled.';
      return err.message || fallback;
    }
    return fallback;
  }
}
