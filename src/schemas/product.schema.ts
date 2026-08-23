import { z } from 'zod';

export const productItemSchema = z.object({
  id: z.string().uuid().describe('ID do produto'),
  tenantId: z.string().uuid().describe('ID do tenant'),
  barcode: z.string().describe('Código de barras (EAN/GTIN)'),
  name: z.string().describe('Nome do produto'),
  category: z.string().nullable().describe('Categoria do produto'),
  depotQty: z.number().int().describe('Quantidade no depósito'),
  depotLocation: z.string().nullable().describe('Localização no depósito'),
  shelfQty: z.number().int().describe('Quantidade na gôndola'),
  shelfLocation: z.string().nullable().describe('Localização na gôndola'),
  shelfMinQty: z.number().int().describe('Quantidade mínima de segurança na gôndola'),
  price: z.number().nullable().describe('Preço de venda unitário'),
  createdAt: z.date().describe('Data de criação'),
  updatedAt: z.date().describe('Data de última atualização'),
});

export const criticalProductItemSchema = productItemSchema.extend({
  deficit: z.number().int().describe('Déficit de unidades em relação ao mínimo de gôndola (shelfMinQty - shelfQty)'),
  deficitPercentage: z.number().describe('Percentual de déficit em relação ao estoque mínimo de gôndola (0 a 100%)'),
  needsReplenishment: z.boolean().describe('Indica se o produto necessita reposição urgente'),
});

export const createProductSchema = z.object({
  barcode: z.string().min(1, 'Código de barras é obrigatório').describe('Código de barras (EAN)'),
  name: z.string().min(1, 'Nome do produto é obrigatório').describe('Nome do produto'),
  category: z.string().optional().nullable().describe('Categoria do produto'),
  depotQty: z.number().int().min(0, 'Quantidade do depósito não pode ser negativa').default(0).describe('Quantidade no depósito'),
  depotLocation: z.string().optional().nullable().describe('Localização no depósito (ex: Corredor A, Prateleira 2)'),
  shelfQty: z.number().int().min(0, 'Quantidade da gôndola não pode ser negativa').default(0).describe('Quantidade na gôndola'),
  shelfLocation: z.string().optional().nullable().describe('Localização na gôndola (ex: Gôndola 3, Nível 2)'),
  shelfMinQty: z.number().int().min(0, 'Quantidade mínima não pode ser negativa').default(0).describe('Quantidade mínima recomendada na gôndola'),
  price: z.number().min(0, 'Preço não pode ser negativo').optional().nullable().describe('Preço de venda'),
  tenantId: z.string().uuid('ID de tenant inválido').optional().describe('ID do tenant (opcional, restrito a Super Admin definir para outro tenant)'),
});

export const updateProductSchema = z.object({
  barcode: z.string().min(1, 'Código de barras não pode ser vazio').optional().describe('Código de barras (EAN)'),
  name: z.string().min(1, 'Nome não pode ser vazio').optional().describe('Nome do produto'),
  category: z.string().optional().nullable().describe('Categoria do produto'),
  depotQty: z.number().int().min(0, 'Quantidade do depósito não pode ser negativa').optional().describe('Quantidade no depósito'),
  depotLocation: z.string().optional().nullable().describe('Localização no depósito'),
  shelfQty: z.number().int().min(0, 'Quantidade da gôndola não pode ser negativa').optional().describe('Quantidade na gôndola'),
  shelfLocation: z.string().optional().nullable().describe('Localização na gôndola'),
  shelfMinQty: z.number().int().min(0, 'Quantidade mínima não pode ser negativa').optional().describe('Quantidade mínima recomendada na gôndola'),
  price: z.number().min(0, 'Preço não pode ser negativo').optional().nullable().describe('Preço de venda'),
});

export const productParamsSchema = z.object({
  id: z.string().uuid('ID do produto inválido').describe('UUID do produto'),
});

export const productBarcodeParamsSchema = z.object({
  barcode: z.string().min(1, 'Código de barras é obrigatório').describe('Código de barras (EAN/GTIN)'),
});

export const productListQuerySchema = z.object({
  tenantId: z.string().uuid('ID de tenant inválido').optional().describe('Filtrar por tenant específico (Super Admin apenas)'),
  search: z.string().optional().describe('Busca textual por nome ou código de barras'),
  category: z.string().optional().describe('Filtrar por categoria'),
  limit: z.coerce.number().int().positive().max(100).default(50).optional().describe('Limite de registros retornados'),
  offset: z.coerce.number().int().min(0).default(0).optional().describe('Offset de paginação'),
});

export const transferStockSchema = z.object({
  quantity: z.number().int().positive('Quantidade de transferência deve ser um número inteiro positivo maior que zero').describe('Quantidade a transferir do depósito para a gôndola'),
});

export const posSaleItemSchema = z.object({
  productId: z.string().uuid('ID do produto inválido').optional().describe('UUID do produto no catálogo'),
  barcode: z.string().optional().describe('Código de barras do produto (alternativa ao productId)'),
  quantity: z.number().int().positive('Quantidade deve ser maior que zero').default(1).describe('Quantidade vendida'),
  unitPrice: z.number().min(0, 'Preço unitário não pode ser negativo').optional().describe('Preço unitário praticado na venda'),
});

export const paymentSplitItemSchema = z.object({
  method: z.enum(['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'OUTROS']),
  amount: z.number().min(0, 'Valor de pagamento não pode ser negativo'),
});

export const posSaleSchema = z.object({
  items: z.array(posSaleItemSchema).min(1, 'A venda deve conter ao menos 1 item').describe('Lista de itens vendidos no PDV'),
  paymentMethod: z.enum(['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'OUTROS', 'MULTIPLOS']).default('DINHEIRO').describe('Forma de pagamento declaratória'),
  payments: z.array(paymentSplitItemSchema).optional().describe('Divisão detalhada quando há múltiplos pagamentos'),
  tenantId: z.string().uuid('ID de tenant inválido').optional().describe('Tenant da venda (Super Admin apenas)'),
});
export const openFoodFactsResponseSchema = z.object({
  status: z.number().describe('Status da busca (1 para encontrado, 0 para não encontrado)'),
  statusVerbose: z.string().describe('Mensagem descritiva do status'),
  product: z.object({
    barcode: z.string().describe('Código de barras consultado'),
    name: z.string().describe('Nome/Título do produto obtido na Open Food Facts'),
    category: z.string().nullable().describe('Categoria identificada'),
    brands: z.string().nullable().describe('Marca(s) do produto'),
    imageUrl: z.string().nullable().describe('URL da imagem do produto'),
    quantity: z.string().nullable().describe('Embalagem/Quantidade descritiva (ex: 350ml, 1kg)'),
  }).nullable().describe('Dados do produto na Open Food Facts'),
});

export const singleProductResponseSchema = z.object({
  product: productItemSchema,
});

export const listProductsResponseSchema = z.object({
  total: z.number().int().describe('Total de produtos encontrados'),
  products: z.array(productItemSchema).describe('Lista de produtos'),
});

export const listCriticalProductsResponseSchema = z.object({
  total: z.number().int().describe('Total de produtos em estado crítico de reposição'),
  products: z.array(criticalProductItemSchema).describe('Lista de produtos com gôndola crítica ordenados por urgência/déficit'),
});

export const posSaleResponseSchema = z.object({
  message: z.string().describe('Mensagem de sucesso da venda'),
  paymentMethod: z.string().describe('Forma de pagamento utilizada'),
  totalItems: z.number().int().describe('Total de itens vendidos'),
  totalAmount: z.number().describe('Valor total da venda'),
  updatedProducts: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    barcode: z.string(),
    soldQty: z.number().int(),
    remainingShelfQty: z.number().int(),
  })).describe('Produtos com baixa efetuada na gôndola'),
});
