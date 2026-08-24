import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { normalizeDateRangeForPlan } from '../lib/plan-retention.js';
export class ReportService {
    /**
     * Valida e resolve o ID do tenant para isolamento multi-tenant seguro.
     */
    resolveTenantId(user, explicitTenantId) {
        if (user.isSuperAdmin) {
            if (explicitTenantId)
                return explicitTenantId;
            if (user.tenantId)
                return user.tenantId;
            throw new AppError('TenantId é obrigatório para Super Admin consultar relatórios de uma empresa', 400);
        }
        if (!user.tenantId) {
            throw new AppError('Usuário não vinculado a um tenant', 403);
        }
        return user.tenantId;
    }
    /**
     * Helper para buscar o tenant e seu plano contratado.
     */
    async getTenantWithPlan(tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, category: true, plan: true },
        });
        if (!tenant) {
            throw new AppError('Empresa não encontrada', 404);
        }
        return tenant;
    }
    /**
     * Helper para buscar todos os produtos ativos do tenant com filtro opcional de categoria.
     */
    async getActiveProducts(tenantId, category) {
        return prisma.product.findMany({
            where: {
                tenantId,
                deletedAt: null,
                category: category
                    ? {
                        contains: category,
                        mode: 'insensitive',
                    }
                    : undefined,
            },
            orderBy: { name: 'asc' },
        });
    }
    /**
     * Agrega as vendas reais do tenant por produto a partir da tabela SaleItem dentro do período permitido pelo plano.
     */
    async aggregateProductSales(tenantId, startDate, endDate) {
        const saleItems = await prisma.saleItem.findMany({
            where: {
                sale: {
                    tenantId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            },
            select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
            },
        });
        const salesMap = new Map();
        for (const item of saleItems) {
            const current = salesMap.get(item.productId) || {
                productId: item.productId,
                totalUnitsSold: 0,
                totalRevenue: 0,
                totalCost: 0,
            };
            const itemRevenue = Number(item.totalPrice);
            const estimatedItemCost = itemRevenue * 0.65; // Custo estimado padrão (35% de margem bruta média)
            current.totalUnitsSold += item.quantity;
            current.totalRevenue += itemRevenue;
            current.totalCost += estimatedItemCost;
            salesMap.set(item.productId, current);
        }
        return salesMap;
    }
    /**
     * 1. RELATÓRIO DE CURVA ABC (GIRO & MARGEM & FATURAMENTO REAL)
     * Analisa vendas reais consolidadas de SaleItem com enquadramento de Pareto (80/15/5).
     */
    async getAbcReport(user, params) {
        const tenantId = this.resolveTenantId(user, params.tenantId);
        const tenant = await this.getTenantWithPlan(tenantId);
        const plan = tenant.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan, params.startDate, params.endDate);
        const daysInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const [products, salesMap] = await Promise.all([
            this.getActiveProducts(tenantId, params.category),
            this.aggregateProductSales(tenantId, startDate, endDate),
        ]);
        if (products.length === 0) {
            return {
                planRetention: {
                    plan,
                    maxDaysAllowed,
                    appliedStartDate: startDate,
                    appliedEndDate: endDate,
                    daysInPeriod,
                },
                summary: {
                    totalProducts: 0,
                    totalStockValue: 0,
                    totalPeriodRevenue: 0,
                    totalPeriodProfit: 0,
                    averageMarginPercentage: 0,
                    classACount: 0,
                    classBCount: 0,
                    classCCount: 0,
                    classARevenue: 0,
                    classBRevenue: 0,
                    classCRevenue: 0,
                    productsWithSalesCount: 0,
                    zeroSalesCount: 0,
                },
                items: [],
            };
        }
        let productsWithSalesCount = 0;
        let zeroSalesCount = 0;
        const enrichedProducts = products.map((product) => {
            const price = product.price ? Number(product.price) : 0;
            const estimatedCost = Number((price * 0.65).toFixed(2));
            const marginUnit = Number((price - estimatedCost).toFixed(2));
            const marginPercentage = price > 0 ? Number(((marginUnit / price) * 100).toFixed(2)) : 35;
            const totalStock = product.depotQty + product.shelfQty;
            const salesData = salesMap.get(product.id);
            const totalUnitsSold = salesData ? salesData.totalUnitsSold : 0;
            const totalRevenue = salesData ? Number(salesData.totalRevenue.toFixed(2)) : 0;
            const totalCost = salesData ? Number(salesData.totalCost.toFixed(2)) : 0;
            const totalGrossProfit = Number((totalRevenue - totalCost).toFixed(2));
            if (totalUnitsSold > 0) {
                productsWithSalesCount++;
            }
            else {
                zeroSalesCount++;
            }
            // Média real diária de vendas no período
            const realDailySales = Number((totalUnitsSold / daysInPeriod).toFixed(2));
            // Giro de estoque = Total vendido / Estoque físico atual
            const turnoverRatio = totalStock > 0
                ? Number(((totalUnitsSold / totalStock)).toFixed(2))
                : (totalUnitsSold > 0 ? 99 : 0);
            // Autonomia de estoque em dias com base no ritmo real de vendas
            let stockDaysRemaining = 999;
            if (realDailySales > 0) {
                stockDaysRemaining = Math.round(totalStock / realDailySales);
            }
            else if (totalStock === 0) {
                stockDaysRemaining = 0;
            }
            // Classificação de Margem
            let marginClass = 'MEDIA';
            if (marginPercentage >= 40)
                marginClass = 'ALTA';
            else if (marginPercentage <= 25)
                marginClass = 'BAIXA';
            // Classificação de Giro Real
            let turnoverClass = 'MEDIO';
            if (totalUnitsSold === 0)
                turnoverClass = 'SEM_GIRO';
            else if (turnoverRatio >= 1.5)
                turnoverClass = 'ALTO';
            else if (turnoverRatio <= 0.5)
                turnoverClass = 'BAIXO';
            return {
                id: product.id,
                barcode: product.barcode,
                name: product.name,
                category: product.category,
                price,
                estimatedCost,
                marginUnit,
                marginPercentage,
                depotQty: product.depotQty,
                shelfQty: product.shelfQty,
                totalStockQty: totalStock,
                totalUnitsSold,
                realDailySales,
                totalRevenue,
                totalGrossProfit,
                turnoverRatio,
                stockDaysRemaining,
                marginClass,
                turnoverClass,
            };
        });
        // Critério de ordenação da Curva ABC
        const sortBy = params.sortBy || 'revenue';
        if (sortBy === 'margin') {
            enrichedProducts.sort((a, b) => b.totalGrossProfit - a.totalGrossProfit || b.totalRevenue - a.totalRevenue);
        }
        else if (sortBy === 'turnover') {
            enrichedProducts.sort((a, b) => b.turnoverRatio - a.turnoverRatio || b.totalRevenue - a.totalRevenue);
        }
        else if (sortBy === 'salesVolume') {
            enrichedProducts.sort((a, b) => b.totalUnitsSold - a.totalUnitsSold || b.totalRevenue - a.totalRevenue);
        }
        else {
            enrichedProducts.sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalUnitsSold - a.totalUnitsSold);
        }
        const totalPeriodRevenue = enrichedProducts.reduce((acc, p) => acc + p.totalRevenue, 0);
        const totalPeriodProfit = enrichedProducts.reduce((acc, p) => acc + p.totalGrossProfit, 0);
        const totalStockValue = enrichedProducts.reduce((acc, p) => acc + (p.totalStockQty * p.price), 0);
        const averageMarginPercentage = totalPeriodRevenue > 0
            ? Number(((totalPeriodProfit / totalPeriodRevenue) * 100).toFixed(2))
            : 35;
        let accumulatedRevenue = 0;
        let classACount = 0;
        let classBCount = 0;
        let classCCount = 0;
        let classARevenue = 0;
        let classBRevenue = 0;
        let classCRevenue = 0;
        const classifiedItems = enrichedProducts.map((p) => {
            const revenueSharePercentage = totalPeriodRevenue > 0
                ? Number(((p.totalRevenue / totalPeriodRevenue) * 100).toFixed(2))
                : 0;
            accumulatedRevenue += p.totalRevenue;
            const accumulatedSharePercentage = totalPeriodRevenue > 0
                ? Number(((accumulatedRevenue / totalPeriodRevenue) * 100).toFixed(2))
                : 100;
            let abcClass = 'C';
            // Se o produto não teve vendas no período, ele é automaticamente Classe C
            if (p.totalRevenue === 0) {
                abcClass = 'C';
                classCCount++;
            }
            else if (accumulatedSharePercentage <= 80 || classACount === 0) {
                abcClass = 'A';
                classACount++;
                classARevenue += p.totalRevenue;
            }
            else if (accumulatedSharePercentage <= 95 || classBCount === 0) {
                abcClass = 'B';
                classBCount++;
                classBRevenue += p.totalRevenue;
            }
            else {
                abcClass = 'C';
                classCCount++;
                classCRevenue += p.totalRevenue;
            }
            return {
                ...p,
                revenueSharePercentage,
                accumulatedSharePercentage: Math.min(100, accumulatedSharePercentage),
                abcClass,
            };
        });
        const limit = params.limit || 100;
        const finalItems = classifiedItems.slice(0, limit);
        return {
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
                daysInPeriod,
            },
            summary: {
                totalProducts: products.length,
                totalStockValue: Number(totalStockValue.toFixed(2)),
                totalPeriodRevenue: Number(totalPeriodRevenue.toFixed(2)),
                totalPeriodProfit: Number(totalPeriodProfit.toFixed(2)),
                averageMarginPercentage,
                classACount,
                classBCount,
                classCCount,
                classARevenue: Number(classARevenue.toFixed(2)),
                classBRevenue: Number(classBRevenue.toFixed(2)),
                classCRevenue: Number(classCRevenue.toFixed(2)),
                productsWithSalesCount,
                zeroSalesCount,
            },
            items: finalItems,
        };
    }
    /**
     * 2. MATRIZ DE RENTABILIDADE X VELOCIDADE DE SAÍDA (MATRIZ GIRO X MARGEM)
     * Enquadra produtos com base no histórico real de vendas no período permitido pelo plano.
     */
    async getMatrixReport(user, params) {
        const tenantId = this.resolveTenantId(user, params.tenantId);
        const tenant = await this.getTenantWithPlan(tenantId);
        const plan = tenant.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan, params.startDate, params.endDate);
        const [products, salesMap] = await Promise.all([
            this.getActiveProducts(tenantId, params.category),
            this.aggregateProductSales(tenantId, startDate, endDate),
        ]);
        const marginThreshold = 35; // 35% de margem é a média do varejo
        const turnoverThreshold = 1.0;
        let estrelasCount = 0;
        let altoGiroCount = 0;
        let geradorMargemCount = 0;
        let lentoAbaixoMargemCount = 0;
        const items = products.map((product) => {
            const price = product.price ? Number(product.price) : 0;
            const estimatedCost = Number((price * 0.65).toFixed(2));
            const marginPercentage = price > 0 ? Number((((price - estimatedCost) / price) * 100).toFixed(2)) : 35;
            const totalStock = product.depotQty + product.shelfQty;
            const salesData = salesMap.get(product.id);
            const totalUnitsSold = salesData ? salesData.totalUnitsSold : 0;
            const totalPeriodRevenue = salesData ? Number(salesData.totalRevenue.toFixed(2)) : 0;
            const totalPeriodProfit = salesData ? Number((salesData.totalRevenue - salesData.totalCost).toFixed(2)) : 0;
            const turnoverRatio = totalStock > 0
                ? Number(((totalUnitsSold / totalStock)).toFixed(2))
                : (totalUnitsSold > 0 ? 99 : 0);
            const isHighMargin = marginPercentage >= marginThreshold;
            const isHighTurnover = turnoverRatio >= turnoverThreshold;
            let quadrant;
            let quadrantLabel;
            let recommendation;
            let spaceRecommendation;
            if (isHighMargin && isHighTurnover) {
                quadrant = 'ESTRELA';
                quadrantLabel = 'Estrela (Alto Giro + Alta Margem)';
                recommendation = 'Produto campeão: Prioridade absoluta de estoque. Nunca permitir ruptura e manter negociação contínua de volume com fornecedores.';
                spaceRecommendation = 'Destacar na altura dos olhos e pontas de gôndola (Golden Zone). Aumentar frentes (facings).';
                estrelasCount++;
            }
            else if (!isHighMargin && isHighTurnover) {
                quadrant = 'ALTO_GIRO';
                quadrantLabel = 'Gerador de Tráfego (Alto Giro + Baixa Margem)';
                recommendation = 'Atrai clientes para a loja: Manter abastecimento contínuo e testar pequenas elevações graduais de preço ou vendas combinadas (cross-sell).';
                spaceRecommendation = 'Posicionar estrategicamente no fundo da loja ou gôndolas de passagem para estimular a circulação até outros produtos.';
                altoGiroCount++;
            }
            else if (isHighMargin && !isHighTurnover) {
                quadrant = 'GERADOR_MARGEM';
                quadrantLabel = 'Oportunidade de Rentabilidade (Baixo Giro + Alta Margem)';
                recommendation = 'Alta margem por unidade: Criar promoções visuais, combos e incentivar a equipe de vendas para aumentar a velocidade de saída.';
                spaceRecommendation = 'Posicionar próximo aos produtos de alto giro correlatos (cross-merchandising) para induzir compra por impulso.';
                geradorMargemCount++;
            }
            else {
                quadrant = 'LENTO_ABAIXO_MARGEM';
                quadrantLabel = 'Candidato a Descontinuação / Queima (Baixo Giro + Baixa Margem)';
                recommendation = 'Drena capital de giro e espaço físico: Promover queima de estoque, reduzir lote de reposição ou substituir no mix.';
                spaceRecommendation = 'Reduzir espaço físico na gôndola ao mínimo operacional e alocar a área nobre para itens Estrela.';
                lentoAbaixoMargemCount++;
            }
            return {
                id: product.id,
                barcode: product.barcode,
                name: product.name,
                category: product.category,
                price,
                marginPercentage,
                turnoverRatio,
                totalPeriodRevenue,
                totalPeriodProfit,
                totalUnitsSold,
                quadrant,
                quadrantLabel,
                recommendation,
                spaceRecommendation,
            };
        });
        let filteredItems = items;
        if (params.classification) {
            filteredItems = items.filter((item) => item.quadrant === params.classification);
        }
        filteredItems.sort((a, b) => b.totalPeriodRevenue - a.totalPeriodRevenue);
        return {
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
            },
            benchmarks: {
                marginThresholdPercentage: marginThreshold,
                turnoverThreshold,
            },
            distribution: {
                estrelasCount,
                altoGiroCount,
                geradorMargemCount,
                lentoAbaixoMargemCount,
            },
            items: filteredItems,
        };
    }
    /**
     * 3. RELATÓRIO DE PLANEJAMENTO DE COMPRAS E PONTO DE REPOSIÇÃO (ROP)
     * Baseado nas vendas reais diárias registradas para calibrar compras e evitar rupturas.
     */
    async getReplenishmentReport(user, params) {
        const tenantId = this.resolveTenantId(user, params.tenantId);
        const tenant = await this.getTenantWithPlan(tenantId);
        const plan = tenant.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan, params.startDate, params.endDate);
        const daysInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const [products, salesMap] = await Promise.all([
            this.getActiveProducts(tenantId, params.category),
            this.aggregateProductSales(tenantId, startDate, endDate),
        ]);
        const leadTimeDays = params.leadTimeDays || 7;
        const safetyStockDays = params.safetyStockDays || 3;
        let urgentOrdersCount = 0;
        let totalSuggestedInvestment = 0;
        const items = products.map((product) => {
            const price = product.price ? Number(product.price) : 0;
            const estimatedCost = Number((price * 0.65).toFixed(2));
            const totalStock = product.depotQty + product.shelfQty;
            const salesData = salesMap.get(product.id);
            const totalUnitsSold = salesData ? salesData.totalUnitsSold : 0;
            // Demanda diária real baseada nas vendas do período
            let dailyDemand = Number((totalUnitsSold / daysInPeriod).toFixed(2));
            if (dailyDemand === 0) {
                // Fallback mínimo se ainda não houver vendas
                dailyDemand = Number((Math.max(1, product.shelfMinQty) * 0.1).toFixed(2));
            }
            // Ponto de Pedido (ROP) = (Demanda Diária * Lead Time) + Estoque de Segurança
            const safetyStockQty = Math.ceil(dailyDemand * safetyStockDays);
            const reorderPoint = Math.ceil((dailyDemand * leadTimeDays) + safetyStockQty);
            let stockDays = 999;
            if (dailyDemand > 0) {
                stockDays = Math.round(totalStock / dailyDemand);
            }
            else if (totalStock === 0) {
                stockDays = 0;
            }
            let status;
            let statusLabel;
            let urgencyLevel;
            let suggestedOrderQty = 0;
            const targetStockQty = Math.ceil(dailyDemand * (leadTimeDays + 21));
            if (totalStock === 0 || product.shelfQty === 0) {
                status = 'CRITICO_RUPTURA';
                statusLabel = 'Ruptura / Estoque Zerado';
                urgencyLevel = 'ALTA';
                suggestedOrderQty = Math.max(1, targetStockQty - totalStock);
                urgentOrdersCount++;
            }
            else if (totalStock <= reorderPoint) {
                status = 'COMPRA_URGENTE';
                statusLabel = 'Abaixo do Ponto de Pedido';
                urgencyLevel = 'ALTA';
                suggestedOrderQty = Math.max(1, targetStockQty - totalStock);
                urgentOrdersCount++;
            }
            else if (totalStock <= reorderPoint * 1.3) {
                status = 'ATENCAO';
                statusLabel = 'Atingindo Margem de Segurança';
                urgencyLevel = 'MEDIA';
                suggestedOrderQty = Math.max(0, targetStockQty - totalStock);
            }
            else if (stockDays > 90 && totalStock > 20) {
                status = 'EXCESSO';
                statusLabel = 'Sobrestoque / Capital Parado';
                urgencyLevel = 'NENHUMA';
                suggestedOrderQty = 0;
            }
            else {
                status = 'ESTAVEL';
                statusLabel = 'Estoque Confortável';
                urgencyLevel = 'BAIXA';
                suggestedOrderQty = 0;
            }
            const estimatedOrderCost = Number((suggestedOrderQty * estimatedCost).toFixed(2));
            totalSuggestedInvestment += estimatedOrderCost;
            return {
                id: product.id,
                barcode: product.barcode,
                name: product.name,
                category: product.category,
                price,
                estimatedCost,
                depotQty: product.depotQty,
                shelfQty: product.shelfQty,
                totalStockQty: totalStock,
                shelfMinQty: product.shelfMinQty,
                dailySalesRate: dailyDemand,
                leadTimeDays,
                safetyStockQty,
                reorderPoint,
                suggestedOrderQty,
                estimatedOrderCost,
                stockDaysRemaining: stockDays,
                status,
                statusLabel,
                urgencyLevel,
            };
        });
        let filteredItems = items;
        if (params.status) {
            filteredItems = items.filter((item) => item.status === params.status);
        }
        filteredItems.sort((a, b) => {
            const urgencyScore = { ALTA: 3, MEDIA: 2, BAIXA: 1, NENHUMA: 0 };
            return urgencyScore[b.urgencyLevel] - urgencyScore[a.urgencyLevel] || a.stockDaysRemaining - b.stockDaysRemaining;
        });
        return {
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
            },
            summary: {
                totalProductsEvaluated: products.length,
                urgentOrdersCount,
                totalSuggestedInvestment: Number(totalSuggestedInvestment.toFixed(2)),
                leadTimeDaysApplied: leadTimeDays,
                safetyStockDaysApplied: safetyStockDays,
            },
            items: filteredItems,
        };
    }
    /**
     * 4. OTIMIZAÇÃO DE ESPAÇO FÍSICO DE EXPOSIÇÃO (GÔNDOLAS VS DEPÓSITO)
     * Analisa proporção de faturamento real gerado vs espaço ocupado na gôndola.
     */
    async getSpaceOptimizationReport(user, params) {
        const tenantId = this.resolveTenantId(user, params.tenantId);
        const tenant = await this.getTenantWithPlan(tenantId);
        const plan = tenant.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan, params.startDate, params.endDate);
        const [products, salesMap] = await Promise.all([
            this.getActiveProducts(tenantId, params.category),
            this.aggregateProductSales(tenantId, startDate, endDate),
        ]);
        const totalShelfCapacity = products.reduce((acc, p) => acc + Math.max(1, p.shelfQty || p.shelfMinQty), 0);
        const enriched = products.map((p) => {
            const price = p.price ? Number(p.price) : 0;
            const salesData = salesMap.get(p.id);
            const totalRevenue = salesData ? Number(salesData.totalRevenue.toFixed(2)) : 0;
            const totalUnitsSold = salesData ? salesData.totalUnitsSold : 0;
            const allocatedShelf = Math.max(1, p.shelfQty || p.shelfMinQty);
            const totalStock = p.depotQty + p.shelfQty;
            const turnoverRatio = totalStock > 0 ? Number((totalUnitsSold / totalStock).toFixed(2)) : 0;
            const marginPercentage = 35;
            const shelfSharePercentage = totalShelfCapacity > 0
                ? Number(((allocatedShelf / totalShelfCapacity) * 100).toFixed(2))
                : 0;
            return {
                product: p,
                totalRevenue,
                turnoverRatio,
                marginPercentage,
                allocatedShelf,
                shelfSharePercentage,
            };
        });
        const totalPeriodRevenue = enriched.reduce((acc, item) => acc + item.totalRevenue, 0);
        let expandGondolaCount = 0;
        let reduceGondolaCount = 0;
        let maintainCount = 0;
        let reassessMixCount = 0;
        const items = enriched.map(({ product, totalRevenue, turnoverRatio, marginPercentage, allocatedShelf, shelfSharePercentage }) => {
            const revenueSharePercentage = totalPeriodRevenue > 0
                ? Number(((totalRevenue / totalPeriodRevenue) * 100).toFixed(2))
                : 0;
            const spaceEfficiencyScore = shelfSharePercentage > 0
                ? Number((revenueSharePercentage / shelfSharePercentage).toFixed(2))
                : 1;
            let recommendedAction;
            let actionLabel;
            let actionReason;
            let suggestedShelfCapacity = allocatedShelf;
            if (spaceEfficiencyScore >= 1.5 && turnoverRatio >= 1.0) {
                recommendedAction = 'EXPANDIR_GONDOLA';
                actionLabel = 'Aumentar Espaço / Facings na Gôndola';
                actionReason = `Gera ${revenueSharePercentage}% do faturamento ocupando apenas ${shelfSharePercentage}% da gôndola. Alto giro demanda maior capacidade para reduzir frequência de reposição.`;
                suggestedShelfCapacity = Math.ceil(allocatedShelf * 1.5);
                expandGondolaCount++;
            }
            else if (spaceEfficiencyScore <= 0.5 && turnoverRatio < 0.6) {
                if (marginPercentage < 25) {
                    recommendedAction = 'REAVALIAR_MIX';
                    actionLabel = 'Reavaliar Mix / Queima de Estoque';
                    actionReason = `Baixo retorno financeiro e baixo giro. Ocupa espaço nobre na gôndola que deveria estar alocado para produtos mais rentáveis.`;
                    suggestedShelfCapacity = Math.max(1, Math.floor(allocatedShelf * 0.5));
                    reassessMixCount++;
                }
                else {
                    recommendedAction = 'REDUZIR_GONDOLA';
                    actionLabel = 'Reduzir Frentes na Gôndola';
                    actionReason = `Produto com giro moderado ocupando mais espaço do que sua fatia de faturamento justifica (${shelfSharePercentage}% do espaço vs ${revenueSharePercentage}% de receita).`;
                    suggestedShelfCapacity = Math.max(1, Math.floor(allocatedShelf * 0.7));
                    reduceGondolaCount++;
                }
            }
            else {
                recommendedAction = 'MANTER';
                actionLabel = 'Manter Dimensionamento Atual';
                actionReason = `Espaço alocado na gôndola está em harmonia com o volume de vendas e taxa de reposição.`;
                suggestedShelfCapacity = allocatedShelf;
                maintainCount++;
            }
            return {
                id: product.id,
                barcode: product.barcode,
                name: product.name,
                category: product.category,
                shelfLocation: product.shelfLocation,
                depotLocation: product.depotLocation,
                shelfQty: product.shelfQty,
                depotQty: product.depotQty,
                shelfMinQty: product.shelfMinQty,
                shelfSharePercentage,
                revenueSharePercentage,
                spaceEfficiencyScore,
                recommendedAction,
                actionLabel,
                actionReason,
                suggestedShelfCapacity,
            };
        });
        let filteredItems = items;
        if (params.action) {
            filteredItems = items.filter((item) => item.recommendedAction === params.action);
        }
        filteredItems.sort((a, b) => b.spaceEfficiencyScore - a.spaceEfficiencyScore);
        return {
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
            },
            summary: {
                totalProducts: products.length,
                expandGondolaCount,
                reduceGondolaCount,
                maintainCount,
                reassessMixCount,
            },
            items: filteredItems,
        };
    }
    /**
     * 5. DASHBOARD EXECUTIVO GERAL DE RELATÓRIOS
     * Visão consolidada para tomadores de decisão combinando estoque e vendas reais.
     */
    async getExecutiveOverview(user, explicitTenantId) {
        const tenantId = this.resolveTenantId(user, explicitTenantId);
        const tenant = await this.getTenantWithPlan(tenantId);
        const plan = tenant.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan);
        const [products, salesAggregate, abcReport, replenishmentReport] = await Promise.all([
            this.getActiveProducts(tenantId),
            prisma.sale.aggregate({
                where: {
                    tenantId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _sum: {
                    totalAmount: true,
                    totalItems: true,
                },
                _count: {
                    id: true,
                },
            }),
            this.getAbcReport(user, { tenantId }),
            this.getReplenishmentReport(user, { tenantId }),
        ]);
        let totalPhysicalUnits = 0;
        let totalDepotUnits = 0;
        let totalShelfUnits = 0;
        let totalCatalogValue = 0;
        let totalEstimatedCost = 0;
        for (const p of products) {
            const price = p.price ? Number(p.price) : 0;
            const cost = Number((price * 0.65).toFixed(2));
            const totalUnits = p.depotQty + p.shelfQty;
            totalDepotUnits += p.depotQty;
            totalShelfUnits += p.shelfQty;
            totalPhysicalUnits += totalUnits;
            totalCatalogValue += (totalUnits * price);
            totalEstimatedCost += (totalUnits * cost);
        }
        const potentialGrossProfit = Number((totalCatalogValue - totalEstimatedCost).toFixed(2));
        const averageMargin = totalCatalogValue > 0
            ? Number(((potentialGrossProfit / totalCatalogValue) * 100).toFixed(2))
            : 35;
        const totalSalesCount = salesAggregate._count.id || 0;
        const totalPeriodRevenue = salesAggregate._sum.totalAmount ? Number(salesAggregate._sum.totalAmount) : 0;
        const totalUnitsSold = salesAggregate._sum.totalItems || 0;
        const totalPeriodProfit = Number((totalPeriodRevenue * 0.35).toFixed(2));
        const averageTicket = totalSalesCount > 0 ? Number((totalPeriodRevenue / totalSalesCount).toFixed(2)) : 0;
        const quickRecommendations = [];
        if (replenishmentReport.summary.urgentOrdersCount > 0) {
            quickRecommendations.push(`Identificados ${replenishmentReport.summary.urgentOrdersCount} produtos com risco de ruptura. Necessário investimento de R$ ${replenishmentReport.summary.totalSuggestedInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em reposição.`);
        }
        if (abcReport.summary.classACount > 0) {
            quickRecommendations.push(`Os ${abcReport.summary.classACount} produtos da Curva A concentram R$ ${abcReport.summary.classARevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do faturamento no período.`);
        }
        if (totalDepotUnits > totalShelfUnits * 2) {
            quickRecommendations.push(`Estoque no depósito está elevado (${totalDepotUnits} un no depósito vs ${totalShelfUnits} un na gôndola). Agilize transferências internas.`);
        }
        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                category: tenant.category,
                plan,
            },
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
            },
            inventoryOverview: {
                totalSKUs: products.length,
                totalPhysicalUnits,
                totalDepotUnits,
                totalShelfUnits,
                totalCatalogValue: Number(totalCatalogValue.toFixed(2)),
                potentialGrossProfit,
                averageMarginPercentage: averageMargin,
            },
            salesPerformance: {
                totalPeriodRevenue,
                totalPeriodProfit,
                totalUnitsSold,
                averageTicket,
                totalSalesCount,
            },
            turnoverAndABC: {
                classACount: abcReport.summary.classACount,
                classBCount: abcReport.summary.classBCount,
                classCCount: abcReport.summary.classCCount,
                highTurnoverSkusCount: abcReport.items.filter((i) => i.turnoverClass === 'ALTO').length,
                criticalStockoutCount: products.filter((p) => p.shelfQty <= p.shelfMinQty).length,
            },
            purchasingAlerts: {
                reorderUrgentCount: replenishmentReport.summary.urgentOrdersCount,
                estimatedCapitalRequired: replenishmentReport.summary.totalSuggestedInvestment,
            },
            quickRecommendations,
        };
    }
}
export const reportService = new ReportService();
