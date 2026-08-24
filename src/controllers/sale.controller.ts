import { FastifyRequest, FastifyReply } from 'fastify';
import { saleService } from '../services/sale.service.js';
import { AppError } from '../errors/app-error.js';
import {
  createSaleSchema,
  saleParamsSchema,
  listSalesQuerySchema,
} from '../schemas/sale.schema.js';

export class SaleController {
  /**
   * POST /sales
   * Registra uma nova venda de PDV
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseBody = createSaleSchema.safeParse(request.body);

    if (!parseBody.success) {
      return reply.status(400).send({
        error: 'Dados de venda do PDV inválidos',
        details: parseBody.error.format(),
      });
    }

    try {
      const result = await saleService.processSale(parseBody.data, user);
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar venda no PDV' });
    }
  }

  /**
   * GET /sales
   * Histórico de vendas paginado do tenant com filtros de data por plano
   */
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseQuery = listSalesQuerySchema.safeParse(request.query);

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Parâmetros de consulta inválidos',
        details: parseQuery.error.format(),
      });
    }

    try {
      const result = await saleService.getAll(user, parseQuery.data);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao buscar histórico de vendas' });
    }
  }

  /**
   * GET /sales/:id
   * Detalhes de uma venda específica
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseParams = saleParamsSchema.safeParse(request.params);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'ID de venda inválido',
        details: parseParams.error.format(),
      });
    }

    try {
      const result = await saleService.getById(parseParams.data.id, user);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao buscar detalhes da venda' });
    }
  }
}

export const saleController = new SaleController();
