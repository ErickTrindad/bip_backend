import { z } from 'zod';
export const paymentMethodEnum = z.enum([
    'DINHEIRO',
    'PIX',
    'CARTAO_DEBITO',
    'CARTAO_CREDITO',
    'OUTROS',
    'MULTIPLOS',
]);
export const saleItemInputSchema = z.object({
    productId: z.string().uuid('ID do produto inválido').optional().describe('UUID do produto no catálogo'),
    barcode: z.string().optional().describe('Código de barras do produto (alternativa ao productId)'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero').default(1).describe('Quantidade vendida'),
    unitPrice: z.number().min(0, 'Preço unitário não pode ser negativo').optional().describe('Preço unitário praticado na venda'),
});
export const createSaleSchema = z.object({
    items: z.array(saleItemInputSchema).min(1, 'A venda deve conter ao menos 1 item').describe('Lista de itens vendidos no PDV'),
    paymentMethod: paymentMethodEnum.default('DINHEIRO').describe('Forma de pagamento declaratória'),
    tenantId: z.string().uuid('ID de tenant inválido').optional().describe('Tenant da venda (Super Admin apenas)'),
});
export const saleParamsSchema = z.object({
    id: z.string().uuid('ID da venda inválido').describe('UUID da venda'),
});
export const listSalesQuerySchema = z.object({
    tenantId: z.string().uuid('ID de tenant inválido').optional().describe('Filtrar por tenant (Super Admin apenas)'),
    startDate: z.coerce.date().optional().describe('Data inicial para filtro (respeita janela do plano do tenant)'),
    endDate: z.coerce.date().optional().describe('Data final para filtro'),
    paymentMethod: paymentMethodEnum.optional().describe('Filtrar por forma de pagamento'),
    userId: z.string().uuid('ID de usuário/operador inválido').optional().describe('Filtrar por operador que realizou a venda'),
    limit: z.coerce.number().int().positive().max(200).default(50).describe('Quantidade máxima de registros por página'),
    offset: z.coerce.number().int().min(0).default(0).describe('Deslocamento de paginação'),
});
export const saleItemResponseSchema = z.object({
    id: z.string().uuid(),
    saleId: z.string().uuid(),
    productId: z.string().uuid(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    createdAt: z.date(),
    product: z.object({
        id: z.string().uuid(),
        barcode: z.string(),
        name: z.string(),
        category: z.string().nullable(),
        shelfQty: z.number().int().optional(),
    }).optional(),
});
export const saleResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    totalAmount: z.number(),
    totalItems: z.number().int(),
    paymentMethod: paymentMethodEnum,
    createdAt: z.date(),
    updatedAt: z.date(),
    user: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string(),
    }).nullable().optional(),
    items: z.array(saleItemResponseSchema).optional(),
});
export const updatedProductItemSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    barcode: z.string(),
    soldQty: z.number().int(),
    remainingShelfQty: z.number().int(),
    previousShelfQty: z.number().int().optional(),
    depotQty: z.number().int().optional(),
});
export const createSaleResponseSchema = z.object({
    message: z.string().describe('Mensagem de sucesso da venda'),
    paymentMethod: paymentMethodEnum.describe('Forma de pagamento utilizada'),
    totalItems: z.number().int().describe('Total de itens vendidos'),
    totalAmount: z.number().describe('Valor total da venda'),
    sale: saleResponseSchema.optional(),
    updatedProducts: z.array(updatedProductItemSchema).describe('Produtos com baixa efetuada na gôndola'),
});
export const listSalesResponseSchema = z.object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    planRetention: z.object({
        plan: z.string(),
        maxDaysAllowed: z.number().int(),
        appliedStartDate: z.date(),
        appliedEndDate: z.date(),
    }),
    sales: z.array(saleResponseSchema),
});
export const singleSaleResponseSchema = z.object({
    sale: saleResponseSchema,
});
