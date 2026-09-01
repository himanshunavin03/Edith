"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
// Mock the OpenAI service module before importing the app so the controller
// picks up the mock instance. No real network/API calls happen in tests.
vitest_1.vi.mock('../src/services/openai.service', () => {
    return {
        openAIService: {
            chat: vitest_1.vi.fn().mockResolvedValue({ reply: 'The biggest planet is Jupiter.', model: 'gpt-4o-mini' }),
            chatStream: vitest_1.vi.fn(async function* () {
                yield 'The biggest ';
                yield 'planet is Jupiter.';
            }),
            textToSpeech: vitest_1.vi.fn(),
        },
    };
});
(0, vitest_1.describe)('POST /api/chat', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('returns a reply for a valid message', async () => {
        const { createApp } = await Promise.resolve().then(() => __importStar(require('../src/app')));
        const app = createApp();
        const res = await (0, supertest_1.default)(app).post('/api/chat').send({ message: 'What is the biggest planet?', history: [] });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.reply).toContain('Jupiter');
    });
    (0, vitest_1.it)('rejects an empty message', async () => {
        const { createApp } = await Promise.resolve().then(() => __importStar(require('../src/app')));
        const app = createApp();
        const res = await (0, supertest_1.default)(app).post('/api/chat').send({ message: '' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('rejects a missing body', async () => {
        const { createApp } = await Promise.resolve().then(() => __importStar(require('../src/app')));
        const app = createApp();
        const res = await (0, supertest_1.default)(app).post('/api/chat').send({});
        (0, vitest_1.expect)(res.status).toBe(400);
    });
});
(0, vitest_1.describe)('GET /api/health', () => {
    (0, vitest_1.it)('returns ok', async () => {
        const { createApp } = await Promise.resolve().then(() => __importStar(require('../src/app')));
        const app = createApp();
        const res = await (0, supertest_1.default)(app).get('/api/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.status).toBe('ok');
    });
});
//# sourceMappingURL=chat.api.test.js.map