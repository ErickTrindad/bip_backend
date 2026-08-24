import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { normalizeDateRangeForPlan } from '../lib/plan-retention.js';
function formatSaleResponse(sale) {
    return {
        id: sale.id,
        tenantId: sale.tenantId,
        userId: sale.userId,
        totalAmount: Number(sale.totalAmount),
        totalItems: sale.totalItems,
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
        user: sale.user
            ? {
                id: sale.user.id,
                name: sale.user.name,
                email: sale.user.email,
            }
            : null,
        items: sale.items?.map((item) => ({
            id: item.id,
            saleId: item.saleId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            createdAt: item.createdAt,
            product: item.product
                ? {
                    id: item.product.id,
                    barcode: item.product.barcode,
                    name: item.product.name,
                    category: item.product.category,
                    shelfQty: item.product.shelfQty,
                }
                : undefined,
        })),
    };
}
export class SaleService {
    /**
     * Valida e resolve o ID do tenant para isolamento multi-tenant seguro.
     */
    resolveTenantId(user, explicitTenantId) {
        if (user.isSuperAdmin) {
            if (explicitTenantId)
                return explicitTenantId;
            if (user.tenantId)
                return user.tenantId;
            throw new AppError('TenantId é obrigatório para Super Admin realizar operações de venda', 400);
        }
        if (!user.tenantId) {
            throw new AppError('Usuário não vinculado a um tenant', 403);
        }
        return user.tenantId;
    }
    /**
     * Processa uma venda de PDV com persistência atômica em Sale e SaleItem,
     * decrementando o estoque da gôndola (shelfQty).
     */
    async processSale(data, user) {
        const tenantId = this.resolveTenantId(user, data.tenantId);
        if (!data.items || data.items.length === 0) {
            throw new AppError('Nenhum item informado para a venda', 400);
        }
        return prisma.$transaction(async (tx) => {
            let totalAmount = 0;
            let totalItems = 0;
            const saleItemsToCreate = [];
            const updatedProductsList = [];
            for (const item of data.items) {
                const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
                let product = null;
                if (item.productId) {
                    product = await tx.product.findFirst({
                        where: {
                            id: item.productId,
                            deletedAt: null,
                        },
                    });
                }
                else if (item.barcode) {
                    product = await tx.product.findFirst({
                        where: {
                            tenantId,
                            barcode: item.barcode,
                            deletedAt: null,
                        },
                    });
                }
                else {
                    throw new AppError('Cada item de venda deve conter productId ou barcode', 400);
                }
                if (!product || product.tenantId !== tenantId) {
                    throw new AppError(`Produto ${item.productId || item.barcode} não encontrado no catálogo desta empresa`, 404);
                }
                if (product.shelfQty < qty) {
                    throw new AppError(`Estoque na gôndola insuficiente para "${product.name}". Disponível na gôndola: ${product.shelfQty}, Solicitado: ${qty}`, 400);
                }
                const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (product.price ? Number(product.price) : 0);
                const itemTotalPrice = Number((unitPrice * qty).toFixed(2));
                totalAmount += itemTotalPrice;
                totalItems += qty;
                const updated = await tx.product.update({
                    where: { id: product.id },
                    data: {
                        shelfQty: { decrement: qty },
                    },
                });
                saleItemsToCreate.push({
                    productId: product.id,
                    quantity: qty,
                    unitPrice,
                    totalPrice: itemTotalPrice,
                });
                updatedProductsList.push({
                    id: updated.id,
                    name: updated.name,
                    barcode: updated.barcode,
                    soldQty: qty,
                    remainingShelfQty: updated.shelfQty,
                    previousShelfQty: product.shelfQty,
                    depotQty: updated.depotQty,
                });
            }
            // Cria a venda persistida
            const createdSale = await tx.sale.create({
                data: {
                    tenantId,
                    userId: user.id || null,
                    totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
                    totalItems,
                    paymentMethod: data.paymentMethod || 'DINHEIRO',
                    items: {
                        create: saleItemsToCreate.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
                            totalPrice: new Prisma.Decimal(item.totalPrice.toFixed(2)),
                        })),
                    },
                },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            return {
                message: 'Venda processada e registrada com sucesso com baixa automática na gôndola',
                sale: formatSaleResponse(createdSale),
                paymentMethod: createdSale.paymentMethod,
                totalItems,
                totalAmount: Number(createdSale.totalAmount),
                updatedProducts: updatedProductsList,
            };
        });
    }
    /**
     * Consulta histórico de vendas paginado do tenant com filtros de data e método de pagamento.
     * Aplica rigorosamente a janela de corte conforme o plano do tenant (FREE: 30 dias, PRO: 90 dias, PREMIUM: 365 dias).
     */
    async getAll(user, filters = {}) {
        const tenantId = this.resolveTenantId(user, filters.tenantId);
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true },
        });
        const plan = tenant?.plan || 'FREE';
        const { startDate, endDate, maxDaysAllowed } = normalizeDateRangeForPlan(plan, filters.startDate, filters.endDate);
        const where = {
            tenantId,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        };
        if (filters.paymentMethod) {
            where.paymentMethod = filters.paymentMethod;
        }
        if (filters.userId) {
            where.userId = filters.userId;
        }
        const limit = filters.limit ? Math.min(filters.limit, 200) : 50;
        const offset = filters.offset || 0;
        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    barcode: true,
                                    name: true,
                                    category: true,
                                    shelfQty: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);
        return {
            total,
            limit,
            offset,
            planRetention: {
                plan,
                maxDaysAllowed,
                appliedStartDate: startDate,
                appliedEndDate: endDate,
            },
            sales: sales.map(formatSaleResponse),
        };
    }
    /**
     * Busca detalhes de uma venda específica com seus itens e dados do operador.
     */
    async getById(id, user) {
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                barcode: true,
                                name: true,
                                category: true,
                                shelfQty: true,
                            },
                        },
                    },
                },
            },
        });
        if (!sale) {
            throw new AppError('Venda não encontrada', 404);
        }
        if (!user.isSuperAdmin && sale.tenantId !== user.tenantId) {
            throw new AppError('Acesso não autorizado a esta venda', 403);
        }
        return {
            sale: formatSaleResponse(sale),
        };
    }
}
export const saleService = new SaleService();
