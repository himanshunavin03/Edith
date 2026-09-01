import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { EdithService } from './edith.service';
import { SettingsService } from './settings.service';
import { OpenAiDirectService } from './openai-direct.service';

describe('EdithService.handleLocalCommand', () => {
  let service: EdithService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(EdithService);
  });

  it('handles "Hi Edith" with the canned greeting', () => {
    const result = service.handleLocalCommand('Hi Edith');
    expect(result.handled).toBe(true);
    expect(result.response).toBe('Hi Rudra! How can I help you?');
  });

  it('handles "Hey Edith" case-insensitively with trailing punctuation', () => {
    const result = service.handleLocalCommand('hey edith!');
    expect(result.handled).toBe(true);
    expect(result.response).toBe('Hi Rudra! How can I help you?');
  });

  it('handles "Hello Edith"', () => {
    const result = service.handleLocalCommand('  Hello, Edith.  ');
    expect(result.handled).toBe(true);
    expect(result.response).toBe('Hi Rudra! How can I help you?');
  });

  it('does not handle a normal question locally', () => {
    const result = service.handleLocalCommand('What is the biggest planet?');
    expect(result.handled).toBe(false);
    expect(result.response).toBeUndefined();
  });

  it('does not falsely match a phrase that merely contains "edith"', () => {
    const result = service.handleLocalCommand('Edith, what is the weather tomorrow?');
    expect(result.handled).toBe(false);
  });
});

describe('EdithService direct-vs-backend routing', () => {
  let service: EdithService;
  let settings: SettingsService;
  let direct: OpenAiDirectService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(EdithService);
    settings = TestBed.inject(SettingsService);
    direct = TestBed.inject(OpenAiDirectService);
  });

  it('calls OpenAiDirectService when a personal API key is set in Settings', async () => {
    settings.update({ openaiApiKey: 'sk-personal-test-key' });
    const spy = vi.spyOn(direct, 'chat').mockResolvedValue({ reply: 'Jupiter.', model: 'gpt-4o-mini' });

    const result = await service.chat('What is the biggest planet?', []);

    expect(spy).toHaveBeenCalledWith('What is the biggest planet?', [], 'sk-personal-test-key');
    expect(result.reply).toBe('Jupiter.');
  });

  it('does not call OpenAiDirectService when no key is set (falls back to the backend)', async () => {
    settings.update({ openaiApiKey: null });
    const spy = vi.spyOn(direct, 'chat');

    // The backend call itself will fail in this unit test (no server running),
    // which is fine - we only need to confirm the direct path was NOT taken.
    await service.chat('hello', []).catch(() => undefined);

    expect(spy).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only key the same as no key', async () => {
    settings.update({ openaiApiKey: '   ' });
    const spy = vi.spyOn(direct, 'chat');

    await service.chat('hello', []).catch(() => undefined);

    expect(spy).not.toHaveBeenCalled();
  });
});
