import { z } from 'zod';
import { aiController } from '../controllers/ai.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { groqTranscribeBodySchema, groqPromptBodySchema, groqVoiceCommandBodySchema, groqTranscribeResponseSchema, groqPromptResponseSchema, groqVoiceCommandResponseSchema, } from '../schemas/ai.schema.js';
export const aiRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // 0. Lista de modelos disponíveis na Groq Cloud
    typedApp.get('/ai/models', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Inteligência Artificial (Groq)'],
            summary: 'Listar modelos disponíveis na conta Groq',
            description: 'Retorna a lista de todos os modelos de áudio e LLMs ativos na conta.',
            security: [{ bearerAuth: [] }],
            response: {
                200: z.object({
                    models: z.array(z.object({
                        id: z.string(),
                        object: z.string(),
                        owned_by: z.string(),
                        active: z.boolean(),
                    })),
                }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
                502: z.object({ error: z.string() }),
            },
        },
    }, aiController.listModels.bind(aiController));
    // 1. Transcrição de áudio via JSON base64 (Whisper Large v3)
    typedApp.post('/ai/transcribe', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Inteligência Artificial (Groq)'],
            summary: 'Transcrever áudio via Whisper Large v3 (Base64)',
            description: 'Envia áudio codificado em base64 para o modelo Whisper Large v3 na Groq Cloud. Otimizado para português brasileiro com ruído ambiente de mercado/varejo.',
            security: [{ bearerAuth: [] }],
            body: groqTranscribeBodySchema,
            response: {
                200: groqTranscribeResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
                502: z.object({ error: z.string() }),
            },
        },
    }, aiController.transcribe.bind(aiController));
    // 2. Transcrição de áudio via upload de arquivo (multipart/form-data)
    typedApp.post('/ai/transcribe/upload', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Inteligência Artificial (Groq)'],
            summary: 'Transcrever áudio via Whisper Large v3 (Upload Multipart)',
            description: 'Envia arquivo de áudio direto do microfone do navegador/celular via multipart/form-data para transcrição imediata.',
            security: [{ bearerAuth: [] }],
            response: {
                200: groqTranscribeResponseSchema,
                400: z.object({ error: z.string() }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
                502: z.object({ error: z.string() }),
            },
        },
    }, aiController.transcribeFile.bind(aiController));
    // 3. Consulta de IA e inferência ultra-rápida (Llama)
    typedApp.post('/ai/chat', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Inteligência Artificial (Groq)'],
            summary: 'Inferência com Llama (< 500ms)',
            description: 'Executa prompt no modelo Llama em hardware Groq (LPU) com fallback automático em cascata. Suporta modo JSON estruturado.',
            security: [{ bearerAuth: [] }],
            body: groqPromptBodySchema,
            response: {
                200: groqPromptResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
                502: z.object({ error: z.string() }),
            },
        },
    }, aiController.chatPrompt.bind(aiController));
    // 4. Comando de Voz Chão de Loja (Whisper + Llama + Ação de Estoque/PDV)
    typedApp.post('/ai/voice-command', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Inteligência Artificial (Groq)'],
            summary: 'Comando de Voz para Chão de Loja (Whisper + Llama)',
            description: 'Pipeline inteligente para repositores e caixas: transcreve a fala do operador com Whisper Large v3, extrai a intenção estruturada com Llama e opcionalmente executa movimentações de estoque ou vendas automaticamente.',
            security: [{ bearerAuth: [] }],
            body: groqVoiceCommandBodySchema,
            response: {
                200: groqVoiceCommandResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
                502: z.object({ error: z.string() }),
            },
        },
    }, aiController.voiceCommand.bind(aiController));
};
