import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { allowedOrigins } from './config/env';
import { logger } from './config/logger';
import { chatRouter } from './routes/chat.routes';
import { ttsRouter } from './routes/tts.routes';
import { transcribeRouter } from './routes/transcribe.routes';
import { healthRouter } from './routes/health.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// When deployed as a single Render service, the built Angular app lives
// alongside this backend (see render.yaml's buildCommand) at
// <repo root>/frontend/dist/frontend/browser. Serving it from here avoids
// needing a second service, a second URL, and any CORS configuration
// between frontend and backend in production. In local dev this directory
// won't exist (frontend runs on its own `ng serve` dev server instead), so
// this is skipped gracefully.
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist/frontend/browser');
const FRONTEND_BUILD_EXISTS = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

// Render automatically injects RENDER_EXTERNAL_URL (the service's own full
// https://... URL) into every web service. Since this backend serves the
// frontend itself in production (see FRONTEND_DIST above), requests from
// the app are same-origin against exactly that URL - trust it in addition
// to whatever ALLOWED_ORIGIN is configured, so deploying doesn't require
// manually copying the assigned Render URL back into an env var.
const runtimeOrigins = [...allowedOrigins, ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : [])];

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow no-origin requests (curl, health checks) and configured origins
        if (!origin || runtimeOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  // Basic rate limiting on the AI-backed endpoints to keep the POC from
  // being trivially abused / running up OpenAI cost.
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/chat', apiLimiter);
  app.use('/api/tts', apiLimiter);
  app.use('/api/transcribe', apiLimiter);

  app.use('/api', healthRouter);
  app.use('/api', chatRouter);
  app.use('/api', ttsRouter);
  app.use('/api', transcribeRouter);

  if (FRONTEND_BUILD_EXISTS) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
    // SPA fallback: any non-API GET request serves index.html so the
    // Angular app's client-side routing (and hard-refreshing on any path)
    // works. Must come after the /api routers above.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  } else {
    logger.warn(`Frontend build not found at ${FRONTEND_DIST} - serving API only.`);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
