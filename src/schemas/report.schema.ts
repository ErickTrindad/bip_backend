import { z } from 'zod';

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const reportCommonQuerySchema = z.object({
  tenantId: z.string().uuid('ID do tenant inválido').optional().describe('Tenant do relatório (apenas Super Admin pode informar)'),
  category: z.string().optional().describe('Filtrar relatório por categoria de produto'),
  startDate: z.coerce.date().optional().describe('Data inicial para análise (respeita janela do plano do tenant)'),
  endDate: z.coerce.date().optional().describe('Data final para análise'),
});

export const abcReportQuerySchema = reportCommonQuerySchema.extend({
  sortBy: z.enum(['revenue', 'margin', 'turnover', 'salesVolume']).default('revenue').describe('Critério de ordenação da Curva ABC'),
  limit: z.coerce.number().int().positive().max(500).default(100).describe('Quantidade máxima de itens no ranking'),
});

export const matrixReportQuerySchema = reportCommonQuerySchema.extend({
  classification: z.enum(['ESTRELA', 'ALTO_GIRO', 'GERADOR_MARGEM', 'LENTO_ABAIXO_MARGEM']).optional().describe('Filtrar quadrante da Matriz BCG / Giro x Margem'),
});

export const replenishmentReportQuerySchema = reportCommonQuerySchema.extend({
  leadTimeDays: z.coerce.number().int().min(1).default(7).describe('Prazo médio de entrega dos fornecedores em dias (Lead Time)'),
  safetyStockDays: z.coerce.number().int().min(0).default(3).describe('Dias de estoque de segurança desejados'),
  status: z.enum(['CRITICO_RUPTURA', 'COMPRA_URGENTE', 'ATENCAO', 'ESTAVEL', 'EXCESSO']).optional().describe('Filtrar por status de reposição'),
});

export const spaceOptimizationReportQuerySchema = reportCommonQuerySchema.extend({
  action: z.enum(['EXPANDIR_GONDOLA', 'MANTER', 'REDUZIR_GONDOLA', 'REAVALIAR_MIX']).optional().describe('Filtrar recomendação de espaço de exposição'),
});

// ==========================================
// ITEM & RESPONSE SCHEMAS
// ==========================================

// 1. Curva ABC (Giro & Faturamento & Margem)
export const abcProductItemSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.number(),
  estimatedCost: z.number(),
  marginUnit: z.number(),
  marginPercentage: z.number(),
  depotQty: z.number().int(),
  shelfQty: z.number().int(),
  totalStockQty: z.number().int(),
  totalUnitsSold: z.number().int().describe('Volume total de unidades vendidas no período analisado'),
  realDailySales: z.number().describe('Média diária real de vendas no período'),
  totalRevenue: z.number().describe('Faturamento real gerado no período'),
  totalGrossProfit: z.number().describe('Lucro bruto real gerado no período'),
  turnoverRatio: z.number().describe('Taxa de giro de estoque'),
  stockDaysRemaining: z.number().describe('Dias de autonomia do estoque atual com base nas vendas reais'),
  revenueSharePercentage: z.number().describe('Participação percentual no faturamento total (%)'),
  accumulatedSharePercentage: z.number().describe('Participação acumulada na Curva ABC (%)'),
  abcClass: z.enum(['A', 'B', 'C']).describe('Classificação na Curva ABC (A: 80% faturamento, B: 15%, C: 5%)'),
  turnoverClass: z.enum(['ALTO', 'MEDIO', 'BAIXO', 'SEM_GIRO']).describe('Velocidade de saída/giro'),
  marginClass: z.enum(['ALTA', 'MEDIA', 'BAIXA']).describe('Rentabilidade da margem'),
});

export const abcReportResponseSchema = z.object({
  planRetention: z.object({
    plan: z.string(),
    maxDaysAllowed: z.number().int(),
    appliedStartDate: z.date(),
    appliedEndDate: z.date(),
    daysInPeriod: z.number().int(),
  }),
  summary: z.object({
    totalProducts: z.number().int(),
    totalStockValue: z.number(),
    totalPeriodRevenue: z.number(),
    totalPeriodProfit: z.number(),
    averageMarginPercentage: z.number(),
    classACount: z.number().int(),
    classBCount: z.number().int(),
    classCCount: z.number().int(),
    classARevenue: z.number(),
    classBRevenue: z.number(),
    classCRevenue: z.number(),
    productsWithSalesCount: z.number().int(),
    zeroSalesCount: z.number().int(),
  }),
  items: z.array(abcProductItemSchema),
});

// 2. Matriz Rentabilidade x Giro (Matriz 2x2 de Decisão)
export const matrixItemSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.number(),
  marginPercentage: z.number(),
  turnoverRatio: z.number(),
  totalPeriodRevenue: z.number(),
  totalPeriodProfit: z.number(),
  totalUnitsSold: z.number().int(),
  quadrant: z.enum(['ESTRELA', 'ALTO_GIRO', 'GERADOR_MARGEM', 'LENTO_ABAIXO_MARGEM']).describe('Quadrante na Matriz Giro x Margem'),
  quadrantLabel: z.string().describe('Nome comercial do quadrante'),
  recommendation: z.string().describe('Recomendação estratégica de estoque e precificação'),
  spaceRecommendation: z.string().describe('Recomendação para espaço físico de gôndola/exposição'),
});

export const matrixReportResponseSchema = z.object({
  planRetention: z.object({
    plan: z.string(),
    maxDaysAllowed: z.number().int(),
    appliedStartDate: z.date(),
    appliedEndDate: z.date(),
  }),
  benchmarks: z.object({
    marginThresholdPercentage: z.number().describe('Linha de corte de margem (%)'),
    turnoverThreshold: z.number().describe('Linha de corte de giro'),
  }),
  distribution: z.object({
    estrelasCount: z.number().int(),
    altoGiroCount: z.number().int(),
    geradorMargemCount: z.number().int(),
    lentoAbaixoMargemCount: z.number().int(),
  }),
  items: z.array(matrixItemSchema),
});

// 3. Planejamento de Compras e Sugestão de Reposição
export const replenishmentItemSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.number(),
  estimatedCost: z.number(),
  depotQty: z.number().int(),
  shelfQty: z.number().int(),
  totalStockQty: z.number().int(),
  shelfMinQty: z.number().int(),
  dailySalesRate: z.number().describe('Média real de vendas por dia'),
  leadTimeDays: z.number().int().describe('Tempo de entrega do fornecedor em dias'),
  safetyStockQty: z.number().int().describe('Estoque de segurança necessário em unidades'),
  reorderPoint: z.number().int().describe('Ponto de Pedido (ROP) calculado'),
  suggestedOrderQty: z.number().int().describe('Quantidade sugerida para compra imediata'),
  estimatedOrderCost: z.number().describe('Investimento financeiro estimado na compra'),
  stockDaysRemaining: z.number().describe('Dias de cobertura do estoque atual'),
  status: z.enum(['CRITICO_RUPTURA', 'COMPRA_URGENTE', 'ATENCAO', 'ESTAVEL', 'EXCESSO']),
  statusLabel: z.string(),
  urgencyLevel: z.enum(['ALTA', 'MEDIA', 'BAIXA', 'NENHUMA']),
});

export const replenishmentReportResponseSchema = z.object({
  planRetention: z.object({
    plan: z.string(),
    maxDaysAllowed: z.number().int(),
    appliedStartDate: z.date(),
    appliedEndDate: z.date(),
  }),
  summary: z.object({
    totalProductsEvaluated: z.number().int(),
    urgentOrdersCount: z.number().int(),
    totalSuggestedInvestment: z.number(),
    leadTimeDaysApplied: z.number().int(),
    safetyStockDaysApplied: z.number().int(),
  }),
  items: z.array(replenishmentItemSchema),
});

// 4. Otimização de Espaço Físico de Exposição (Gôndolas vs Depósito)
export const spaceOptimizationItemSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  shelfLocation: z.string().nullable(),
  depotLocation: z.string().nullable(),
  shelfQty: z.number().int(),
  depotQty: z.number().int(),
  shelfMinQty: z.number().int(),
  shelfSharePercentage: z.number().describe('Percentual da gôndola ocupada/foco'),
  revenueSharePercentage: z.number().describe('Participação no faturamento (%)'),
  spaceEfficiencyScore: z.number().describe('Índice de eficiência de espaço (Faturamento / Espaço)'),
  recommendedAction: z.enum(['EXPANDIR_GONDOLA', 'MANTER', 'REDUZIR_GONDOLA', 'REAVALIAR_MIX']),
  actionLabel: z.string(),
  actionReason: z.string(),
  suggestedShelfCapacity: z.number().int().describe('Capacidade sugerida para a gôndola'),
});

export const spaceOptimizationReportResponseSchema = z.object({
  planRetention: z.object({
    plan: z.string(),
    maxDaysAllowed: z.number().int(),
    appliedStartDate: z.date(),
    appliedEndDate: z.date(),
  }),
  summary: z.object({
    totalProducts: z.number().int(),
    expandGondolaCount: z.number().int(),
    reduceGondolaCount: z.number().int(),
    maintainCount: z.number().int(),
    reassessMixCount: z.number().int(),
  }),
  items: z.array(spaceOptimizationItemSchema),
});

// 5. Visão Geral / Dashboard Executivo de Relatórios
export const executiveOverviewResponseSchema = z.object({
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    plan: z.string(),
  }),
  planRetention: z.object({
    plan: z.string(),
    maxDaysAllowed: z.number().int(),
    appliedStartDate: z.date(),
    appliedEndDate: z.date(),
  }),
  inventoryOverview: z.object({
    totalSKUs: z.number().int(),
    totalPhysicalUnits: z.number().int(),
    totalDepotUnits: z.number().int(),
    totalShelfUnits: z.number().int(),
    totalCatalogValue: z.number(),
    potentialGrossProfit: z.number(),
    averageMarginPercentage: z.number(),
  }),
  salesPerformance: z.object({
    totalPeriodRevenue: z.number(),
    totalPeriodProfit: z.number(),
    totalUnitsSold: z.number().int(),
    averageTicket: z.number(),
    totalSalesCount: z.number().int(),
  }),
  turnoverAndABC: z.object({
    classACount: z.number().int(),
    classBCount: z.number().int(),
    classCCount: z.number().int(),
    highTurnoverSkusCount: z.number().int(),
    criticalStockoutCount: z.number().int(),
  }),
  purchasingAlerts: z.object({
    reorderUrgentCount: z.number().int(),
    estimatedCapitalRequired: z.number(),
  }),
  quickRecommendations: z.array(z.string()),
});
