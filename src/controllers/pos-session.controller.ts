import { FastifyRequest, FastifyReply } from 'fastify';
import { posSessionService } from '../services/pos-session.service.js';
import { AppError } from '../errors/app-error.js';
import {
  createPosSessionBodySchema,
  validatePosSessionParamsSchema,
  validatePosSessionQuerySchema,
} from '../schemas/pos-session.schema.js';

export class PosSessionController {
  /**
   * POST /pos/sessions/pair
   * Cria uma sessão efêmera de pareamento para o PDV desktop
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseBody = createPosSessionBodySchema.safeParse(request.body || {});

    const explicitTenantId = parseBody.success ? parseBody.data.tenantId : undefined;

    try {
      const result = await posSessionService.createPairingSession(user, explicitTenantId);
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao gerar sessão de pareamento' });
    }
  }

  /**
   * GET /pos/sessions/:sessionId/validate
   * Valida a sessão de pareamento chamada pelo celular via QR Code
   */
  async validate(request: FastifyRequest, reply: FastifyReply) {
    const parseParams = validatePosSessionParamsSchema.safeParse(request.params);
    const parseQuery = validatePosSessionQuerySchema.safeParse(request.query);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'ID de sessão inválido',
        details: parseParams.error.format(),
      });
    }

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Token de pareamento é obrigatório na query string',
        details: parseQuery.error.format(),
      });
    }

    try {
      const result = await posSessionService.validatePairingSession(
        parseParams.data.sessionId,
        parseQuery.data.token
      );
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao validar sessão de pareamento' });
    }
  }

  /**
   * POST /pos/sessions/:sessionId/close
   * Encerra a sessão de pareamento
   */
  async close(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseParams = validatePosSessionParamsSchema.safeParse(request.params);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'ID de sessão inválido',
        details: parseParams.error.format(),
      });
    }

    try {
      const result = await posSessionService.closeSession(parseParams.data.sessionId, user);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao encerrar sessão de pareamento' });
    }
  }
}

export const posSessionController = new PosSessionController();
