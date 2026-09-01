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
  /**
   * Optional personal OpenAI API key, entered by the user in Settings and
   * persisted only in this browser's localStorage (see SettingsService).
   * When set, EdithService/AudioService call OpenAI directly from the
   * browser (OpenAiDirectService) instead of going through the EDITH
   * backend - this is what lets EDITH run as a plain static site with no
   * server at all. Left null, the app falls back to the backend as usual.
   *
   * This is NOT the same risk as embedding a key in the shipped app: it is
   * the user's own key, typed into their own browser, sent only from that
   * browser straight to OpenAI, and never bundled into code served to
   * anyone else. It IS visible to anyone with access to that browser/device
   * (localStorage, network tab), so it should only be used on a personal
   * device for personal use - see the in-app Settings hint and README.
   */
  openaiApiKey: string | null;
}
