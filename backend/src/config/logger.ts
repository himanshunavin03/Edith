import pino from 'pino';
import { env } from './env';

/**
 * Central logger. Never log request bodies verbatim (they may contain
 * user speech transcripts) and never log secrets/API keys.
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', '*.OPENAI_API_KEY', '*.apiKey'],
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
