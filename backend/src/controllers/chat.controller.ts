import type { Request, Response, NextFunction } from 'express';
import { openAIService } from '../services/openai.service';
import { conversationService } from '../services/conversation.service';
import { logger } from '../config/logger';
import type { ChatRequest } from '../models/chat.model';

/** POST /api/chat - non-streaming reply. */
export async function postChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message, history } = req.body as ChatRequest;
    const trimmed = conversationService.trimHistory(history);
    const { reply, model } = await openAIService.chat(message, trimmed);
    res.json({ reply, model });
  } catch (err) {
    next(err);
  }
}

/** POST /api/chat/stream - Server-Sent Events streaming reply. */
export async function postChatStream(req: Request, res: Response): Promise<void> {
  const { message, history } = req.body as ChatRequest;
  const trimmed = conversationService.trimHistory(history);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onClose = () => {
    // client (e.g. user tapped stop) disconnected; nothing further to do
  };
  req.on('close', onClose);

  try {
    for await (const delta of openAIService.chatStream(message, trimmed)) {
      send('delta', { text: delta });
    }
    send('done', {});
    res.end();
  } catch (err) {
    logger.error({ err }, 'Chat stream failed');
    send('error', { message: err instanceof Error ? err.message : 'Stream failed' });
    res.end();
  } finally {
    req.off('close', onClose);
  }
}
