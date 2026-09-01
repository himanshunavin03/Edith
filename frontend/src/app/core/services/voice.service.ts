import { Injectable, signal } from '@angular/core';
import type { MicrophonePermission, VoiceStatus } from '../models/voice.model';

/**
 * Speech INPUT + the overall voice state machine.
 *
 * IMPORTANT iOS Safari note: Safari (iOS and macOS) does not implement the
 * Web Speech API's SpeechRecognition interface at all, so this app cannot
 * rely on it for speech-to-text. Instead we record short clips with
 * MediaRecorder + getUserMedia and send them to the backend for
 * transcription (OpenAI). This works consistently across Safari, Chrome,
 * and Android, whereas a SpeechRecognition-only approach would silently
 * fail to record any speech on iPhone.
 *
 * iOS Safari also does not allow continuous background microphone access:
 * a mic stream can only be opened after a direct user gesture (tap), and
 * the browser will suspend/kill it if the tab is backgrounded. The default
 * mode is therefore tap-to-talk: tap to start recording, tap (or auto-stop
 * after maxDurationMs) to stop and send for processing.
 *
 * The one thing iOS DOES allow: once that first tap has granted microphone
 * permission, the page can reopen the mic again without another gesture for
 * the rest of the session. Assistant's optional "Wake word" mode uses this
 * to run a real (not faked) background loop that listens in short chunks
 * for "Hi Edith" and treats hearing it exactly like a tap - see
 * Assistant.passiveWakeListen(). It still requires the tab to stay open and
 * foregrounded; it is not true OS-level background wake-word support.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly status = signal<VoiceStatus>('idle');
  readonly microphonePermission = signal<MicrophonePermission>('unknown');
  readonly isRecording = signal(false);
  readonly error = signal<string | null>(null);
  /**
   * True while status is 'listening' for a short background wake-word
   * chunk (Assistant's passive wake loop) rather than a full question. UI
   * uses this to show "Listening for 'Hi Edith'..." instead of "Listening...".
   */
  readonly passiveListening = signal(false);

  setPassiveListening(value: boolean): void {
    this.passiveListening.set(value);
  }

  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  micSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  }

  private pickMimeType(): string {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type;
    }
    return '';
  }

  /**
   * Starts recording. Must be called directly from a user gesture (tap) on
   * iOS Safari, or getUserMedia will be blocked/silently rejected.
   * Resolves with the recorded audio Blob once stopped (via stop() or the
   * max-duration/silence safety timeout).
   */
  async startRecording(maxDurationMs = 5_000): Promise<Blob> {
    if (!this.micSupported()) {
      this.microphonePermission.set('unsupported');
      this.setError('Microphone recording is not supported in this browser.');
      throw new Error('unsupported');
    }

    this.error.set(null);

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.microphonePermission.set('denied');
      this.status.set('error');
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Enable it in Settings > Safari > Microphone.'
          : 'Could not access the microphone.';
      this.setError(message);
      throw err;
    }

    this.microphonePermission.set('granted');
    this.status.set('listening');
    this.isRecording.set(true);
    this.chunks = [];

    const mimeType = this.pickMimeType();
    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);

    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder not initialized'));
        return;
      }

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onerror = () => {
        this.cleanupStream();
        this.status.set('error');
        this.setError('Recording failed unexpectedly.');
        reject(new Error('MediaRecorder error'));
      };

      this.mediaRecorder.onstop = () => {
        this.cleanupStream();
        const blob = new Blob(this.chunks, { type: mimeType || 'audio/webm' });
        this.chunks = [];
        if (blob.size === 0) {
          this.status.set('error');
          this.setError('No audio was captured. Please try again.');
          reject(new Error('empty audio'));
          return;
        }
        resolve(blob);
      };

      this.mediaRecorder.start();

      // Safety net: auto-stop after maxDurationMs so a stuck recording
      // can't hold the mic open indefinitely.
      this.silenceTimer = setTimeout(() => this.stopRecording(), maxDurationMs);
    });
  }

  /** Stops recording (user tapped Stop, or the safety timeout fired). */
  stopRecording(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);
  }

  /** Cancels recording without producing a result (e.g. user backs out). */
  cancelRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
    }
    this.stopRecording();
    this.cleanupStream();
    this.status.set('idle');
  }

  private cleanupStream(): void {
    // Always stop every track explicitly - otherwise iOS Safari can leave
    // the microphone indicator/session active after recording ends.
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
  }

  setStatus(status: VoiceStatus): void {
    this.status.set(status);
  }

  setError(message: string | null): void {
    this.error.set(message);
    if (message) this.status.set('error');
  }

  reset(): void {
    this.error.set(null);
    this.status.set('idle');
  }
}
