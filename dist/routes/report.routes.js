import { z } from 'zod';
import { reportController } from '../controllers/report.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { abcReportQuerySchema, matrixReportQuerySchema, replenishmentReportQuerySchema, spaceOptimizationReportQuerySchema, abcReportResponseSchema, matrixReportResponseSchema, replenishmentReportResponseSchema, spaceOptimizationReportResponseSchema, executiveOverviewResponseSchema, } from '../schemas/report.schema.js';
export const reportRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // 1. Visão Geral Executiva de Relatórios e Inteligência
    typedApp.get('/reports/overview', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Relatórios'],
            summary: 'Dashboard Executivo e Métricas Globais',
            description: 'Retorna visão executiva do estoque, valor total do catálogo a preço de venda e custo, margem média consolidada, saúde do giro e alertas rápidos de compras.',
            security: [{ bearerAuth: [] }],
            querystring: z.object({
                tenantId: z.string().uuid().optional().describe('Filtrar por tenant (Super Admin apenas)'),
            }),
            response: {
                200: executiveOverviewResponseSchema,
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, reportController.getOverview.bind(reportController));
    // 2. Relatório de Curva ABC (Giro & Margem & Faturamento)
    typedApp.get('/reports/abc', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Relatórios'],
            summary: 'Relatório da Curva ABC (Giro, Faturamento e Margem)',
            description: 'Classificação analítica dos produtos em Classes A (80% da receita), B (15%) e C (5%) baseada no Princípio de Pareto, com indicadores de velocidade de saída, margem unitária e dias de autonomia de estoque.',
            security: [{ bearerAuth: [] }],
            querystring: abcReportQuerySchema,
            response: {
                200: abcReportResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, reportController.getAbcReport.bind(reportController));
    // 3. Matriz de Rentabilidade x Velocidade de Saída (Giro x Margem)
    typedApp.get('/reports/turnover-margin-matrix', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Relatórios'],
            summary: 'Matriz de Rentabilidade x Giro (Decisão Estratégica)',
            description: 'Matriz 2x2 que segmenta produtos em 4 quadrantes: Estrelas (Alto Giro + Alta Margem), Geradores de Tráfego (Alto Giro + Baixa Margem), Oportunidades de Rentabilidade (Baixo Giro + Alta Margem) e Candidatos à Descontinuação (Baixo Giro + Baixa Margem).',
            security: [{ bearerAuth: [] }],
            querystring: matrixReportQuerySchema,
            response: {
                200: matrixReportResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, reportController.getMatrixReport.bind(reportController));
    // 4. Relatório de Planejamento de Compras e Reposição (ROP)
    typedApp.get('/reports/replenishment-purchasing', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Relatórios'],
            summary: 'Planejamento de Compras e Ponto de Pedido (ROP)',
            description: 'Calcula o Ponto de Pedido (Lead Time + Estoque de Segurança) e sugere lotes de compra ideais para prevenir ruptura e otimizar o capital de giro.',
            security: [{ bearerAuth: [] }],
            querystring: replenishmentReportQuerySchema,
            response: {
                200: replenishmentReportResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, reportController.getReplenishmentReport.bind(reportController));
    // 5. Otimização de Espaço Físico de Exposição (Gôndolas vs Depósito)
    typedApp.get('/reports/space-optimization', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Relatórios'],
            summary: 'Otimização de Espaço Físico de Exposição em Gôndolas',
            description: 'Avalia a eficiência do espaço alocado na gôndola em relação ao faturamento gerado e recomenda ações: Expandir Facings, Manter, Reduzir ou Reavaliar Mix.',
            security: [{ bearerAuth: [] }],
            querystring: spaceOptimizationReportQuerySchema,
            response: {
                200: spaceOptimizationReportResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, reportController.getSpaceOptimizationReport.bind(reportController));
};
