import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { EdithService } from './edith.service';

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
