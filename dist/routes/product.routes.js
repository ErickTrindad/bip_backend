import { z } from 'zod';
import { productController } from '../controllers/product.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { createProductSchema, updateProductSchema, productParamsSchema, productBarcodeParamsSchema, productListQuerySchema, transferStockSchema, posSaleSchema, openFoodFactsResponseSchema, singleProductResponseSchema, listProductsResponseSchema, listCriticalProductsResponseSchema, posSaleResponseSchema, } from '../schemas/product.schema.js';
export const productRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // 1. Consulta Externa Open Food Facts (Pode ser acessada com autenticação)
    typedApp.get('/products/lookup/:barcode', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Consulta produto na API externa Open Food Facts',
            description: 'Consulta o banco de dados mundial Open Food Facts para autocompletar nome, categoria, marca e imagem ao escanear código de barras EAN.',
            security: [{ bearerAuth: [] }],
            params: productBarcodeParamsSchema,
            response: {
                200: openFoodFactsResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.lookupOpenFoodFacts.bind(productController));
    // 2. Dashboard de Gôndolas Críticas (Chão de Loja / Repositor)
    typedApp.get('/products/critical', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Gôndolas Críticas (Dashboard do Repositor)',
            description: 'Retorna produtos onde a quantidade na gôndola (shelfQty) está abaixo ou igual ao mínimo de segurança (shelfMinQty), ordenados por percentual de urgência e déficit.',
            security: [{ bearerAuth: [] }],
            querystring: z.object({
                tenantId: z.string().uuid().optional().describe('Filtrar por tenant (Super Admin apenas)'),
            }),
            response: {
                200: listCriticalProductsResponseSchema,
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.getCritical.bind(productController));
    // 3. PDV / Frente de Caixa (Venda com baixa na gôndola)
    typedApp.post('/products/pos/sale', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'PDV Declaratório / Frente de Caixa',
            description: 'Permite registrar a venda de múltiplos itens com baixa automática do estoque da gôndola (shelf_qty) e seleção da forma de pagamento.',
            security: [{ bearerAuth: [] }],
            body: posSaleSchema,
            response: {
                200: posSaleResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.processSale.bind(productController));
    // 4. Busca por Código de Barras
    typedApp.get('/products/barcode/:barcode', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Buscar produto por código de barras',
            description: 'Busca rápida de produto no estoque da empresa pelo código de barras escaneado (EAN/GTIN).',
            security: [{ bearerAuth: [] }],
            params: productBarcodeParamsSchema,
            querystring: z.object({
                tenantId: z.string().uuid().optional().describe('Filtrar por tenant (Super Admin apenas)'),
            }),
            response: {
                200: singleProductResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.getByBarcode.bind(productController));
    // 5. Transferência Rápida Depósito -> Gôndola
    typedApp.post('/products/:id/transfer', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Transferência Rápida de Estoque (Depósito -> Gôndola)',
            description: 'Executa operação atômica de reposição: subtrai X unidades de depot_qty e adiciona X unidades a shelf_qty.',
            security: [{ bearerAuth: [] }],
            params: productParamsSchema,
            body: transferStockSchema,
            response: {
                200: singleProductResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.transferStock.bind(productController));
    // 6. Listagem de Produtos
    typedApp.get('/products', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Listar produtos da empresa',
            description: 'Retorna lista paginada de produtos do tenant autenticado, com suporte a busca textual por nome ou código de barras e filtro por categoria.',
            security: [{ bearerAuth: [] }],
            querystring: productListQuerySchema,
            response: {
                200: listProductsResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.getAll.bind(productController));
    // 7. Detalhes de um Produto
    typedApp.get('/products/:id', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Detalhes de um produto',
            description: 'Retorna informações completas de estoque e localização de um produto pelo seu UUID.',
            security: [{ bearerAuth: [] }],
            params: productParamsSchema,
            response: {
                200: singleProductResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.getById.bind(productController));
    // 8. Cadastro de Produto
    typedApp.post('/products', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Cadastrar novo produto',
            description: 'Cadastra um novo produto no tenant com quantidades de depósito, gôndola, estoque mínimo e preço. Valida limite de 100 SKUs no plano Free.',
            security: [{ bearerAuth: [] }],
            body: createProductSchema,
            response: {
                201: singleProductResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                409: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.create.bind(productController));
    // 9. Atualização de Produto
    typedApp.put('/products/:id', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Atualizar dados de um produto',
            description: 'Atualiza informações cadastrais, estoques ou localizações de um produto existente.',
            security: [{ bearerAuth: [] }],
            params: productParamsSchema,
            body: updateProductSchema,
            response: {
                200: singleProductResponseSchema,
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                409: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.update.bind(productController));
    // 10. Exclusão de Produto
    typedApp.delete('/products/:id', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Produtos'],
            summary: 'Excluir produto',
            description: 'Remove definitivamente um produto do catálogo da empresa.',
            security: [{ bearerAuth: [] }],
            params: productParamsSchema,
            response: {
                200: z.object({ message: z.string() }),
                400: z.object({ error: z.string(), details: z.any().optional() }),
                401: z.object({ error: z.string() }),
                403: z.object({ error: z.string() }),
                404: z.object({ error: z.string() }),
                500: z.object({ error: z.string() }),
            },
        },
    }, productController.delete.bind(productController));
};
