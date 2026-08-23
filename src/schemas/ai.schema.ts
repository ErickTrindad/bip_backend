import { z } from 'zod';

export const groqTranscribeBodySchema = z.object({
  audioBase64: z.string().min(1, 'Áudio em base64 é obrigatório'),
  filename: z.string().default('audio.m4a'),
  language: z.string().default('pt'),
  prompt: z.string().optional().describe('Contexto prévio de termos do varejo ou nomes de produtos'),
  temperature: z.number().min(0).max(1).optional().default(0),
});

export const groqPromptBodySchema = z.object({
  prompt: z.string().min(1, 'Prompt ou comando de texto é obrigatório'),
  systemPrompt: z
    .string()
    .optional()
    .describe('Instrução de sistema para o modelo (ex: assistente de estoque/varejo)'),
  model: z.string().optional().describe('Modelo LLM a utilizar (opcional, detectado dinamicamente)'),
  temperature: z.number().min(0).max(2).optional().default(0.1),
  jsonMode: z.boolean().optional().default(false).describe('Forçar saída em formato JSON'),
});

export const groqVoiceCommandBodySchema = z.object({
  audioBase64: z.string().min(1, 'Áudio em base64 é obrigatório'),
  filename: z.string().default('audio.m4a'),
  systemPrompt: z
    .string()
    .optional()
    .describe('Instrução opcional para guiar a interpretação da intenção'),
  autoExecute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Executar as ações no banco automaticamente se identificadas (suporta ações compostas: atualizar preço + transferir estoque)'),
});

export const groqTranscribeResponseSchema = z.object({
  text: z.string(),
  model: z.string(),
  duration: z.number().optional(),
});

export const groqPromptResponseSchema = z.object({
  result: z.string(),
  parsedJson: z.unknown().optional(),
  model: z.string(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      total_time: z.number().optional(),
    })
    .optional(),
});

export const groqVoiceCommandResponseSchema = z.object({
  transcription: z.string(),
  intent: z.enum([
    'UPDATE_PRODUCT',
    'STOCK_ENTRY',
    'TRANSFER_STOCK',
    'POS_SALE',
    'CHECK_STOCK',
    'REGISTER_PRODUCT',
    'COMPOUND_ACTION',
    'UNKNOWN',
  ]),
  extractedData: z.record(z.string(), z.unknown()),
  actions: z
    .array(
      z.object({
        action: z.enum([
          'UPDATE_PRODUCT',
          'STOCK_ENTRY',
          'TRANSFER_STOCK',
          'POS_SALE',
          'CHECK_STOCK',
          'REGISTER_PRODUCT',
        ]),
        productQuery: z.string().nullable().optional(),
        price: z.number().nullable().optional(),
        quantity: z.number().nullable().optional(),
        from: z.enum(['depot', 'shelf']).nullable().optional(),
        to: z.enum(['depot', 'shelf']).nullable().optional(),
        destination: z.enum(['depot', 'shelf']).nullable().optional(),
        executed: z.boolean().optional(),
        result: z.unknown().optional(),
      })
    )
    .optional(),
  matchedProduct: z
    .object({
      id: z.string(),
      name: z.string(),
      barcode: z.string(),
      price: z.number().nullable().optional(),
      depotQty: z.number(),
      shelfQty: z.number(),
    })
    .nullable()
    .optional(),
  explanation: z.string(),
  executed: z.boolean(),
  executionResult: z.unknown().optional(),
});
