import { Router } from 'express';
import { postTts } from '../controllers/tts.controller';
import { validateBody } from '../middleware/validate';
import { ttsRequestSchema } from '../models/chat.model';

export const ttsRouter = Router();

ttsRouter.post('/tts', validateBody(ttsRequestSchema), postTts);
