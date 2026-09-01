/** Voice interaction state machine. See VoiceService. */
export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export type MicrophonePermission = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  /** true while an assistant turn is still streaming in */
  pending?: boolean;
}

export type TtsProvider = 'browser' | 'openai';

export interface EdithSettings {
  ttsProvider: TtsProvider;
  ttsVoiceURI: string | null;
  ttsRate: number;
  wakeWordEnabled: boolean;
  streamingEnabled: boolean;
  /**
   * When true, EDITH automatically starts listening again after speaking
   * each response, so only the FIRST question of a conversation needs a
   * tap. Relies on the microphone permission already having been granted
   * via an earlier tap in this page session - iOS Safari only requires the
   * user gesture for that first grant, not for every subsequent
   * getUserMedia() call. Off by default so V1's baseline is still the
   * explicit, always-reliable tap-to-talk loop.
   */
  continuousMode: boolean;
}
