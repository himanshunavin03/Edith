import { Router } from 'express';
import express from 'express';
import { postTranscribe } from '../controllers/transcribe.controller';

export const transcribeRouter = Router();

// Raw binary body (the frontend posts the recorded Blob directly).
// 10mb covers several minutes of compressed webm/opus audio, well beyond
// what a tap-to-talk POC utterance needs.
transcribeRouter.post('/transcribe', express.raw({ type: '*/*', limit: '10mb' }), postTranscribe);
