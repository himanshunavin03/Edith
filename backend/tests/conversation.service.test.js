"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const conversation_service_1 = require("../src/services/conversation.service");
(0, vitest_1.describe)('ConversationService.trimHistory', () => {
    const svc = new conversation_service_1.ConversationService();
    (0, vitest_1.it)('returns history unchanged when under the limit', () => {
        const history = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ];
        (0, vitest_1.expect)(svc.trimHistory(history)).toEqual(history);
    });
    (0, vitest_1.it)('trims to the most recent messages when over the limit', () => {
        const history = Array.from({ length: 20 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `msg-${i}`,
        }));
        const trimmed = svc.trimHistory(history);
        (0, vitest_1.expect)(trimmed.length).toBe(12);
        (0, vitest_1.expect)(trimmed[trimmed.length - 1].content).toBe('msg-19');
    });
});
//# sourceMappingURL=conversation.service.test.js.map