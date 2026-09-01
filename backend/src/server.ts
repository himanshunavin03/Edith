import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`EDITH backend listening on http://localhost:${env.PORT}`);
  logger.info(`Allowed origin(s): ${env.ALLOWED_ORIGIN}`);
});
