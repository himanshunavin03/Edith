import 'dotenv/config';
import { z } from 'zod';

/**
 * Validates required environment configuration at process startup.
 * Fails fast with a clear message instead of limping along without
 * a usable OPENAI_API_KEY.
 */
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGIN: z.string().min(1).default('http://localhost:4200'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_TTS_MODEL: z.string().min(1).default('gpt-4o-mini-tts'),
  OPENAI_TTS_VOICE: z.string().min(1).default('alloy'),
  OPENAI_TRANSCRIBE_MODEL: z.string().min(1).default('gpt-4o-mini-transcribe'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[EDITH] Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the required values.\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const allowedOrigins = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
