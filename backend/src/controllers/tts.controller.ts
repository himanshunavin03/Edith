import type { Request, Response, NextFunction } from 'express';
import { openAIService } from '../services/openai.service';
import type { TtsRequest } from '../models/chat.model';

/** POST /api/tts - optional server-side speech synthesis (OpenAI TTS). */
export async function postTts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { text } = req.body as TtsRequest;
    const audio = await openAIService.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err) {
    next(err);
  }
}
