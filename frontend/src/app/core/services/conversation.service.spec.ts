import { TestBed } from '@angular/core/testing';
import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConversationService);
  });

  it('starts empty', () => {
    expect(service.isEmpty()).toBe(true);
    expect(service.conversationHistory()).toEqual([]);
  });

  it('records a user turn then an assistant turn in order', () => {
    service.addUserTurn('Hi Edith');
    service.addAssistantTurn('Hi Rudra! How can I help you?');

    const history = service.conversationHistory();
    expect(history.length).toBe(2);
    expect(history[0]).toMatchObject({ role: 'user', text: 'Hi Edith' });
    expect(history[1]).toMatchObject({ role: 'assistant', text: 'Hi Rudra! How can I help you?' });
    expect(service.isEmpty()).toBe(false);
  });

  it('streams deltas into a pending turn and completes it', () => {
    const id = service.addPendingAssistantTurn();
    service.appendToTurn(id, 'The biggest ');
    service.appendToTurn(id, 'planet is Jupiter.');
    service.completeTurn(id);

    const turn = service.conversationHistory().find((t) => t.id === id);
    expect(turn?.text).toBe('The biggest planet is Jupiter.');
    expect(turn?.pending).toBe(false);
  });

  it('clear() empties the transcript', () => {
    service.addUserTurn('hello');
    service.clear();
    expect(service.conversationHistory()).toEqual([]);
  });

  it('historyForApi() excludes pending turns and caps at 12 messages', () => {
    for (let i = 0; i < 20; i++) {
      service.addUserTurn(`msg-${i}`);
    }
    const api = service.historyForApi();
    expect(api.length).toBe(12);
    expect(api[api.length - 1].content).toBe('msg-19');
  });
});
