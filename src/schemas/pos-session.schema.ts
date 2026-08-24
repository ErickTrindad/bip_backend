import { z } from 'zod';

export const posSessionStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']);
export type PosSessionStatus = z.infer<typeof posSessionStatusEnum>;

export const createPosSessionBodySchema = z.object({
  tenantId: z.string().uuid('ID de tenant inválido').optional().describe('Tenant da sessão (Super Admin apenas)'),
});

export const createPosSessionResponseSchema = z.object({
  message: z.string().describe('Mensagem de sucesso'),
  sessionId: z.string().uuid().describe('UUID da sessão de pareamento'),
  token: z.string().describe('Token de autenticação do scanner mobile'),
  channel: z.string().describe('Canal Realtime/WebSocket (ex: pos_sess_<uuid>)'),
  status: posSessionStatusEnum.describe('Status da sessão'),
  expiresAt: z.date().describe('Data/hora limite de expiração (30 minutos)'),
  expiresInSeconds: z.number().int().describe('Tempo restante de validade em segundos'),
  qrCodeUrl: z.string().describe('URL completa formatada para carregar no QR Code do mobile'),
});

export const validatePosSessionParamsSchema = z.object({
  sessionId: z.string().uuid('ID da sessão inválido').describe('UUID da sessão de pareamento'),
});

export const validatePosSessionQuerySchema = z.object({
  token: z.string().min(1, 'Token de pareamento é obrigatório').describe('Token secreto da sessão'),
});

export const validatePosSessionResponseSchema = z.object({
  valid: z.boolean().describe('Indica se a sessão é válida e está ativa'),
  sessionId: z.string().uuid().describe('UUID da sessão de pareamento'),
  channel: z.string().describe('Nome do canal Realtime/WebSocket para broadcast de leituras'),
  status: posSessionStatusEnum.describe('Status atual da sessão'),
  expiresAt: z.date().describe('Data/hora de expiração'),
  remainingSeconds: z.number().int().describe('Tempo restante em segundos'),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
  }).describe('Dados da loja conectada'),
  operator: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
  }).describe('Dados do operador do checkout'),
});

export const closePosSessionResponseSchema = z.object({
  message: z.string().describe('Mensagem de encerramento da sessão'),
  sessionId: z.string().uuid().describe('UUID da sessão fechada'),
  status: z.literal('CLOSED').describe('Status final'),
});
