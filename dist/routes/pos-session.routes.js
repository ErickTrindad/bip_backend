import { z } from 'zod';
import { posSessionController } from '../controllers/pos-session.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { createPosSessionBodySchema, createPosSessionResponseSchema, validatePosSessionParamsSchema, validatePosSessionQuerySchema, validatePosSessionResponseSchema, closePosSessionResponseSchema, } from '../schemas/pos-session.schema.js';
export const posSessionRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // 1. POST /pos/sessions/pair - Inicia sessão de pareamento para o PDV desktop
    typedApp.post('/pos/sessions/pair', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['PDV / Scanner Remoto'],
            summary: 'Criar sessão de pareamento para scanner remoto (QR Code)',
            description: 'Gera um token efêmero de 30 minutos e canal Realtime único para que a câmera do celular se conecte como leitor de código de barras.',
            security: [{ bearerAuth: [] }],
            body: createPosSessionBodySchema.optional(),
            response: {
                201: createPosSessionResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, posSessionController.create.bind(posSessionController));
    // 2. GET /pos/sessions/:sessionId/validate - Valida a sessão lida pelo QR Code no mobile
    typedApp.get('/pos/sessions/:sessionId/validate', {
        schema: {
            tags: ['PDV / Scanner Remoto'],
            summary: 'Validar sessão de pareamento no mobile',
            description: 'Usado pelo celular ao abrir o link do QR Code para checar se a sessão está ativa e obter os metadados do canal de broadcast antes de ativar a câmera.',
            params: validatePosSessionParamsSchema,
            querystring: validatePosSessionQuerySchema,
            response: {
                200: validatePosSessionResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, posSessionController.validate.bind(posSessionController));
    // 3. POST /pos/sessions/:sessionId/close - Encerra a sessão de pareamento
    typedApp.post('/pos/sessions/:sessionId/close', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['PDV / Scanner Remoto'],
            summary: 'Encerrar sessão de pareamento',
            description: 'Finaliza a sessão de pareamento no fechamento do PDV desktop.',
            security: [{ bearerAuth: [] }],
            params: validatePosSessionParamsSchema,
            response: {
                200: closePosSessionResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, posSessionController.close.bind(posSessionController));
};
