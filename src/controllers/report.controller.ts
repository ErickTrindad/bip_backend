import { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from '../services/report.service.js';
import { AppError } from '../errors/app-error.js';
import {
  abcReportQuerySchema,
  matrixReportQuerySchema,
  replenishmentReportQuerySchema,
  spaceOptimizationReportQuerySchema,
} from '../schemas/report.schema.js';

export class ReportController {
  /**
   * GET /reports/overview
   * Visão Geral Executiva do Tenant
   */
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const query = request.query as { tenantId?: string };

    try {
      const data = await reportService.getExecutiveOverview(user, query.tenantId);
      return reply.status(200).send(data);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao gerar visão geral executiva' });
    }
  }

  /**
   * GET /reports/abc
   * Relatório de Curva ABC (Giro & Margem & Faturamento)
   */
  async getAbcReport(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseQuery = abcReportQuerySchema.safeParse(request.query);

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Parâmetros de filtro da Curva ABC inválidos',
        details: parseQuery.error.format(),
      });
    }

    try {
      const data = await reportService.getAbcReport(user, parseQuery.data);
      return reply.status(200).send(data);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar relatório da Curva ABC' });
    }
  }

  /**
   * GET /reports/turnover-margin-matrix
   * Matriz de Decisão: Rentabilidade x Velocidade de Saída (Giro x Margem)
   */
  async getMatrixReport(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseQuery = matrixReportQuerySchema.safeParse(request.query);

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Parâmetros de filtro da Matriz Giro x Margem inválidos',
        details: parseQuery.error.format(),
      });
    }

    try {
      const data = await reportService.getMatrixReport(user, parseQuery.data);
      return reply.status(200).send(data);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar Matriz de Giro x Margem' });
    }
  }

  /**
   * GET /reports/replenishment-purchasing
   * Relatório de Planejamento de Compras e Ponto de Pedido (ROP / Sugestão de Reposição)
   */
  async getReplenishmentReport(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseQuery = replenishmentReportQuerySchema.safeParse(request.query);

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Parâmetros de filtro do relatório de compras inválidos',
        details: parseQuery.error.format(),
      });
    }

    try {
      const data = await reportService.getReplenishmentReport(user, parseQuery.data);
      return reply.status(200).send(data);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar relatório de compras e reposição' });
    }
  }

  /**
   * GET /reports/space-optimization
   * Otimização de Espaço Físico de Exposição (Gôndola vs Depósito / Eficiência de Área)
   */
  async getSpaceOptimizationReport(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseQuery = spaceOptimizationReportQuerySchema.safeParse(request.query);

    if (!parseQuery.success) {
      return reply.status(400).send({
        error: 'Parâmetros de filtro do relatório de otimização de espaço inválidos',
        details: parseQuery.error.format(),
      });
    }

    try {
      const data = await reportService.getSpaceOptimizationReport(user, parseQuery.data);
      return reply.status(200).send(data);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar relatório de otimização de espaço' });
    }
  }
}

export const reportController = new ReportController();
