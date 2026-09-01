import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';
import { AudioService } from '../../core/services/audio.service';
import type { TtsProvider } from '../../core/models/voice.model';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  protected readonly settingsService = inject(SettingsService);
  protected readonly audio = inject(AudioService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected onProviderChange(provider: TtsProvider): void {
    this.settingsService.update({ ttsProvider: provider });
  }

  protected onVoiceChange(voiceURI: string): void {
    this.settingsService.update({ ttsVoiceURI: voiceURI || null });
  }

  protected onRateChange(rate: number): void {
    this.settingsService.update({ ttsRate: rate });
  }

  protected onStreamingToggle(enabled: boolean): void {
    this.settingsService.update({ streamingEnabled: enabled });
  }

  protected onContinuousModeToggle(enabled: boolean): void {
    this.settingsService.update({ continuousMode: enabled });
  }

  protected onWakeWordToggle(enabled: boolean): void {
    this.settingsService.update({ wakeWordEnabled: enabled });
  }

  protected close(): void {
    this.closed.emit();
  }
}
