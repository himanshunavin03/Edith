import type { Request, Response, NextFunction } from 'express';
import { openAIService } from '../services/openai.service';
import { ValidationError } from '../utils/errors';

/**
 * POST /api/transcribe - multipart-free binary upload of a recorded audio
 * clip (audio/webm, audio/mp4, etc). Kept as raw body (not multipart) to
 * keep the frontend simple: it just posts the Blob it recorded.
 */
export async function postTranscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audio = req.body as Buffer;
    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      throw new ValidationError('No audio data received');
    }
    const contentType = req.headers['content-type'] || 'audio/webm';
    const text = await openAIService.transcribe(audio, contentType);
    res.json({ text });
  } catch (err) {
    next(err);
  }
}
