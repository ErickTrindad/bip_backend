import type { z } from 'zod';
import type {
  groqVoiceCommandResponseSchema,
  actionItemResponseSchema,
  groqVoiceCommandBodySchema,
  voiceIntentEnum,
  actionTypeEnum,
} from '../schemas/ai.schema.js';

export type VoiceIntent = z.infer<typeof voiceIntentEnum>;
export type ActionType = z.infer<typeof actionTypeEnum>;
export type ActionItem = z.infer<typeof actionItemResponseSchema>;
export type VoiceCommandResponse = z.infer<typeof groqVoiceCommandResponseSchema>;
export type VoiceCommandBody = z.infer<typeof groqVoiceCommandBodySchema>;
