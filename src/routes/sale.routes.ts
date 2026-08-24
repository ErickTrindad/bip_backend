import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { saleController } from '../controllers/sale.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  createSaleSchema,
  createSaleResponseSchema,
  saleParamsSchema,
  listSalesQuerySchema,
  listSalesResponseSchema,
  singleSaleResponseSchema,
} from '../schemas/sale.schema.js';
export const saleRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // 1. Registra venda PDV (/sales)
  typedApp.post(
    '/sales',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['Vendas / PDV'],
        summary: 'Registrar venda no PDV com baixa na gôndola',
        description:
          'Registra atomicamente a venda com baixa no estoque da gôndola (shelfQty) e persistência definitiva em Sale e SaleItem.',
        security: [{ bearerAuth: [] }],
        body: createSaleSchema,
        response: {
          201: createSaleResponseSchema,
          400: z.object({ error: z.string(), details: z.any().optional() }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
          500: z.object({ error: z.string() }),
        },
      },
    },
    saleController.create.bind(saleController)
  );

  // 2. Histórico de Vendas (/sales)
  typedApp.get(
    '/sales',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['Vendas / PDV'],
        summary: 'Histórico de vendas com filtros e janela por plano',
        description:
          'Listagem paginada de vendas do tenant autenticado. A data inicial respeita a janela máxima permitida pelo plano (FREE: 30 dias, PRO: 90 dias, PREMIUM: 365 dias).',
        security: [{ bearerAuth: [] }],
        querystring: listSalesQuerySchema,
        response: {
          200: listSalesResponseSchema,
          400: z.object({ error: z.string(), details: z.any().optional() }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          500: z.object({ error: z.string() }),
        },
      },
    },
    saleController.getAll.bind(saleController)
  );

  // 3. Detalhes de uma venda (/sales/:id)
  typedApp.get(
    '/sales/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['Vendas / PDV'],
        summary: 'Detalhes de uma venda com itens e operador',
        description:
          'Retorna os dados completos de uma venda e seus itens associados garantindo isolamento multi-tenant.',
        security: [{ bearerAuth: [] }],
        params: saleParamsSchema,
        response: {
          200: singleSaleResponseSchema,
          400: z.object({ error: z.string(), details: z.any().optional() }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
          500: z.object({ error: z.string() }),
        },
      },
    },
    saleController.getById.bind(saleController)
  );
};
