import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
// Limite do Plano Free conforme definido no Roadmap MVP (Semana 5 / Freemium - 100 SKUs)
const FREE_TIER_MAX_PRODUCTS = 100;
function formatProductResponse(product) {
    return {
        id: product.id,
        tenantId: product.tenantId,
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        depotQty: product.depotQty,
        depotLocation: product.depotLocation,
        shelfQty: product.shelfQty,
        shelfLocation: product.shelfLocation,
        shelfMinQty: product.shelfMinQty,
        price: product.price ? Number(product.price) : null,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}
export class ProductService {
    /**
     * Helper para resolver o tenant_id efetivo baseado no usuário autenticado e permissões.
     * Conforme policies.txt: Super Admin pode especificar o tenant ou consultar de todos;
     * Usuário comum é estritamente limitado ao seu próprio tenant (tenant_id = public.get_tenant_id()).
     */
    resolveTenantId(user, explicitTenantId) {
        if (user.isSuperAdmin) {
            if (explicitTenantId)
                return explicitTenantId;
            if (user.tenantId)
                return user.tenantId;
            throw new AppError('Tenant não especificado para a operação', 400);
        }
        if (!user.tenantId) {
            throw new AppError('Usuário não possui vínculo com nenhuma empresa/tenant', 403);
        }
        if (explicitTenantId && explicitTenantId !== user.tenantId) {
            throw new AppError('Acesso negado ao tenant especificado', 403);
        }
        return user.tenantId;
    }
    /**
     * Consulta produto externo na API Open Food Facts por código de barras EAN.
     * Conforme Fase 2 do Roadmap do GO PME.
     */
    async lookupOpenFoodFacts(barcode) {
        const cleanBarcode = barcode.trim();
        if (!cleanBarcode) {
            throw new AppError('Código de barras inválido', 400);
        }
        try {
            const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'GOPME-Inventory/1.0 (contact@gopme.com)',
                },
            });
            const data = response.data;
            if (data && data.status === 1 && data.product) {
                const p = data.product;
                const name = p.product_name || p.product_name_pt || p.generic_name_pt || p.generic_name || 'Produto sem nome';
                const category = p.categories_tags?.[0]?.replace(/^[^:]+:/, '') || p.categories || null;
                const brands = p.brands || null;
                const imageUrl = p.image_front_url || p.image_url || null;
                const quantity = p.quantity || null;
                return {
                    status: 1,
                    statusVerbose: 'Produto encontrado na Open Food Facts',
                    product: {
                        barcode: cleanBarcode,
                        name,
                        category,
                        brands,
                        imageUrl,
                        quantity,
                    },
                };
            }
            return {
                status: 0,
                statusVerbose: 'Produto não encontrado na Open Food Facts',
                product: null,
            };
        }
        catch {
            return {
                status: 0,
                statusVerbose: 'Não foi possível consultar a Open Food Facts no momento',
                product: null,
            };
        }
    }
    /**
     * Listagem de produtos com filtros e paginação.
     * Conforme policies.txt (tenant_select_products: tenant_id = public.get_tenant_id() OR public.is_super_admin()).
     */
    async getAll(user, filters = {}) {
        const where = {};
        if (user.isSuperAdmin) {
            if (filters.tenantId) {
                where.tenantId = filters.tenantId;
            }
        }
        else {
            if (!user.tenantId) {
                throw new AppError('Usuário não vinculado a um tenant', 403);
            }
            where.tenantId = user.tenantId;
        }
        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { barcode: { contains: filters.search } },
            ];
        }
        if (filters.category) {
            where.category = { contains: filters.category, mode: 'insensitive' };
        }
        const limit = filters.limit ? Math.min(filters.limit, 100) : 50;
        const offset = filters.offset || 0;
        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
            }),
        ]);
        return {
            total,
            products: products.map(formatProductResponse),
        };
    }
    /**
     * Dashboard de Gôndolas Críticas e Reposição.
     * Conforme Fase 3 do GO PME (Algoritmo de Priorização: shelf_qty <= shelf_min_qty, ordenado por percentual de déficit).
     */
    async getCritical(user, explicitTenantId) {
        const targetTenantId = user.isSuperAdmin && explicitTenantId ? explicitTenantId : user.tenantId;
        if (!user.isSuperAdmin && !user.tenantId) {
            throw new AppError('Usuário não vinculado a um tenant', 403);
        }
        const where = {};
        if (targetTenantId) {
            where.tenantId = targetTenantId;
        }
        // Busca produtos do tenant para calcular os critérios de déficit
        const products = await prisma.product.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        // Filtra produtos onde shelf_qty <= shelf_min_qty
        const criticalList = products
            .filter((product) => product.shelfQty <= product.shelfMinQty)
            .map((product) => {
            const formatted = formatProductResponse(product);
            const deficit = Math.max(0, product.shelfMinQty - product.shelfQty);
            let deficitPercentage = 0;
            if (product.shelfMinQty > 0) {
                deficitPercentage = Number(((deficit / product.shelfMinQty) * 100).toFixed(2));
            }
            else if (product.shelfQty === 0) {
                deficitPercentage = 100;
            }
            return {
                ...formatted,
                deficit,
                deficitPercentage,
                needsReplenishment: true,
            };
        })
            // Ordena decrescente por percentual de déficit e depois por déficit absoluto
            .sort((a, b) => b.deficitPercentage - a.deficitPercentage || b.deficit - a.deficit);
        return {
            total: criticalList.length,
            products: criticalList,
        };
    }
    /**
     * Busca produto por ID.
     * Conforme policies.txt (tenant_select_products).
     */
    async getById(id, user) {
        const product = await prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new AppError('Produto não encontrado', 404);
        }
        if (!user.isSuperAdmin && product.tenantId !== user.tenantId) {
            throw new AppError('Acesso não autorizado a este produto', 403);
        }
        return { product: formatProductResponse(product) };
    }
    /**
     * Busca produto por Código de Barras (EAN).
     * Conforme Fase 2 do GO PME (Bipar produto para consulta rápida no chão de loja/PDV).
     */
    async getByBarcode(barcode, user, explicitTenantId) {
        const tenantId = this.resolveTenantId(user, explicitTenantId);
        const product = await prisma.product.findUnique({
            where: {
                tenantId_barcode: {
                    tenantId,
                    barcode,
                },
            },
        });
        if (!product) {
            throw new AppError('Produto não cadastrado para esta empresa', 404);
        }
        return { product: formatProductResponse(product) };
    }
    /**
     * Cadastro de Produto com Trava Freemium (100 SKUs).
     * Conforme policies.txt (tenant_insert_products) e Fase 5 do GO PME.
     */
    async create(data, user) {
        const tenantId = this.resolveTenantId(user, data.tenantId);
        // Validação de unicidade (tenant_id + barcode)
        const existing = await prisma.product.findUnique({
            where: {
                tenantId_barcode: {
                    tenantId,
                    barcode: data.barcode,
                },
            },
        });
        if (existing) {
            throw new AppError(`Já existe um produto com o código de barras "${data.barcode}" nesta empresa`, 409);
        }
        // Trava de Limites do Plano Free (100 SKUs) - Fase 5 do GO PME
        const currentCount = await prisma.product.count({
            where: { tenantId },
        });
        if (!user.isSuperAdmin && currentCount >= FREE_TIER_MAX_PRODUCTS) {
            throw new AppError(`Limite do Plano Free atingido (${FREE_TIER_MAX_PRODUCTS} produtos cadastrados). Faça upgrade para continuar cadastrando novos itens.`, 403);
        }
        const newProduct = await prisma.product.create({
            data: {
                tenantId,
                barcode: data.barcode,
                name: data.name,
                category: data.category || null,
                depotQty: data.depotQty ?? 0,
                depotLocation: data.depotLocation || null,
                shelfQty: data.shelfQty ?? 0,
                shelfLocation: data.shelfLocation || null,
                shelfMinQty: data.shelfMinQty ?? 0,
                price: data.price !== undefined && data.price !== null ? data.price : null,
            },
        });
        return { product: formatProductResponse(newProduct) };
    }
    /**
     * Atualização de Produto.
     * Conforme policies.txt (tenant_update_products).
     */
    async update(id, data, user) {
        const product = await prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new AppError('Produto não encontrado', 404);
        }
        if (!user.isSuperAdmin && product.tenantId !== user.tenantId) {
            throw new AppError('Acesso não autorizado para editar este produto', 403);
        }
        if (data.barcode && data.barcode !== product.barcode) {
            const barcodeConflict = await prisma.product.findUnique({
                where: {
                    tenantId_barcode: {
                        tenantId: product.tenantId,
                        barcode: data.barcode,
                    },
                },
            });
            if (barcodeConflict && barcodeConflict.id !== id) {
                throw new AppError(`Já existe outro produto cadastrado com o código de barras "${data.barcode}"`, 409);
            }
        }
        const updated = await prisma.product.update({
            where: { id },
            data: {
                barcode: data.barcode,
                name: data.name,
                category: data.category !== undefined ? data.category : undefined,
                depotQty: data.depotQty,
                depotLocation: data.depotLocation !== undefined ? data.depotLocation : undefined,
                shelfQty: data.shelfQty,
                shelfLocation: data.shelfLocation !== undefined ? data.shelfLocation : undefined,
                shelfMinQty: data.shelfMinQty,
                price: data.price !== undefined ? (data.price !== null ? data.price : null) : undefined,
            },
        });
        return { product: formatProductResponse(updated) };
    }
    /**
     * Transferência Atômica Rápida (Depósito -> Gôndola).
     * Conforme Fase 3 do GO PME (Modal de Transferência Rápida: depot_qty - X e shelf_qty + X).
     */
    async transferStock(id, quantity, user) {
        if (quantity <= 0) {
            throw new AppError('Quantidade a transferir deve ser maior que zero', 400);
        }
        const product = await prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new AppError('Produto não encontrado', 404);
        }
        if (!user.isSuperAdmin && product.tenantId !== user.tenantId) {
            throw new AppError('Acesso não autorizado a este produto', 403);
        }
        if (product.depotQty < quantity) {
            throw new AppError(`Estoque no depósito insuficiente para transferência. Disponível no depósito: ${product.depotQty}, Solicitado: ${quantity}`, 400);
        }
        const updatedProduct = await prisma.$transaction(async (tx) => {
            return tx.product.update({
                where: { id },
                data: {
                    depotQty: { decrement: quantity },
                    shelfQty: { increment: quantity },
                },
            });
        });
        return { product: formatProductResponse(updatedProduct) };
    }
    /**
     * PDV Básico / Frente de Caixa (Venda com baixa automática no shelf_qty).
     * Conforme Fase 5 do GO PME (Bipar múltiplos produtos, somar o carrinho e dar baixa no shelf_qty).
     */
    async processSale(data, user) {
        const tenantId = this.resolveTenantId(user, data.tenantId);
        if (!data.items || data.items.length === 0) {
            throw new AppError('Nenhum item informado para a venda', 400);
        }
        return prisma.$transaction(async (tx) => {
            let totalAmount = 0;
            let totalItems = 0;
            const updatedProductsList = [];
            for (const item of data.items) {
                const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
                let product = null;
                if (item.productId) {
                    product = await tx.product.findUnique({
                        where: { id: item.productId },
                    });
                }
                else if (item.barcode) {
                    product = await tx.product.findUnique({
                        where: {
                            tenantId_barcode: {
                                tenantId,
                                barcode: item.barcode,
                            },
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
                const price = item.unitPrice !== undefined ? item.unitPrice : (product.price ? Number(product.price) : 0);
                totalAmount += price * qty;
                totalItems += qty;
                const updated = await tx.product.update({
                    where: { id: product.id },
                    data: {
                        shelfQty: { decrement: qty },
                    },
                });
                updatedProductsList.push({
                    id: updated.id,
                    name: updated.name,
                    barcode: updated.barcode,
                    soldQty: qty,
                    remainingShelfQty: updated.shelfQty,
                });
            }
            return {
                message: 'Venda finalizada com sucesso e estoque de gôndola atualizado',
                paymentMethod: data.paymentMethod || 'DINHEIRO',
                totalItems,
                totalAmount: Number(totalAmount.toFixed(2)),
                updatedProducts: updatedProductsList,
            };
        });
    }
    /**
     * Exclusão de Produto.
     * Conforme policies.txt (tenant_delete_products: tenant_id = public.get_tenant_id() OR public.is_super_admin()).
     */
    async delete(id, user) {
        const product = await prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new AppError('Produto não encontrado', 404);
        }
        if (!user.isSuperAdmin && product.tenantId !== user.tenantId) {
            throw new AppError('Acesso não autorizado para excluir este produto', 403);
        }
        // Não deve ser possível excluir se houver saldo em estoque (depósito ou gôndola)
        const totalStock = (product.depotQty || 0) + (product.shelfQty || 0);
        if (totalStock > 0) {
            throw new AppError(`Não é possível excluir este produto pois ainda há estoque (Depósito: ${product.depotQty}, Gôndola: ${product.shelfQty}). Favor zerar a quantidade antes de excluir.`, 400);
        }
        await prisma.product.delete({
            where: { id },
        });
        return { message: 'Produto excluído com sucesso' };
    }
}
export const productService = new ProductService();
