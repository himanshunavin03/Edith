import { TestBed } from '@angular/core/testing';
import { VoiceService } from './voice.service';

describe('VoiceService state machine', () => {
  let service: VoiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VoiceService);
  });

  it('starts idle', () => {
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
  });

  it('setStatus transitions through listening -> processing -> speaking -> idle', () => {
    service.setStatus('listening');
    expect(service.status()).toBe('listening');

    service.setStatus('processing');
    expect(service.status()).toBe('processing');

    service.setStatus('speaking');
    expect(service.status()).toBe('speaking');

    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
  });

  it('setError puts the machine into the error state and records the message', () => {
    service.setError('Microphone permission was denied.');
    expect(service.status()).toBe('error');
    expect(service.error()).toBe('Microphone permission was denied.');
  });

  it('reset() clears an error state back to idle', () => {
    service.setError('boom');
    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
  });
});
