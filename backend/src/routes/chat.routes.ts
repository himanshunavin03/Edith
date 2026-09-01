import { Router } from 'express';
import { postChat, postChatStream } from '../controllers/chat.controller';
import { validateBody } from '../middleware/validate';
import { chatRequestSchema } from '../models/chat.model';

export const chatRouter = Router();

chatRouter.post('/chat', validateBody(chatRequestSchema), postChat);
chatRouter.post('/chat/stream', validateBody(chatRequestSchema), postChatStream);
