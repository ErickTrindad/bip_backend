import { productService } from '../services/product.service.js';
import { AppError } from '../errors/app-error.js';
import { createProductSchema, updateProductSchema, productParamsSchema, productBarcodeParamsSchema, productListQuerySchema, transferStockSchema, posSaleSchema, } from '../schemas/product.schema.js';
export class ProductController {
    async getAll(request, reply) {
        const user = request.user;
        const parseQuery = productListQuerySchema.safeParse(request.query);
        if (!parseQuery.success) {
            return reply.status(400).send({
                error: 'Parâmetros de busca inválidos',
                details: parseQuery.error.format(),
            });
        }
        try {
            const result = await productService.getAll(user, parseQuery.data);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao listar produtos' });
        }
    }
    async getCritical(request, reply) {
        const user = request.user;
        const query = request.query;
        try {
            const result = await productService.getCritical(user, query?.tenantId);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao consultar gôndolas críticas' });
        }
    }
    async lookupOpenFoodFacts(request, reply) {
        const parseParams = productBarcodeParamsSchema.safeParse(request.params);
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'Código de barras inválido',
                details: parseParams.error.format(),
            });
        }
        try {
            const result = await productService.lookupOpenFoodFacts(parseParams.data.barcode);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao consultar Open Food Facts' });
        }
    }
    async getByBarcode(request, reply) {
        const user = request.user;
        const parseParams = productBarcodeParamsSchema.safeParse(request.params);
        const query = request.query;
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'Código de barras inválido',
                details: parseParams.error.format(),
            });
        }
        try {
            const result = await productService.getByBarcode(parseParams.data.barcode, user, query?.tenantId);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao buscar produto por código de barras' });
        }
    }
    async getById(request, reply) {
        const user = request.user;
        const parseParams = productParamsSchema.safeParse(request.params);
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'ID inválido',
                details: parseParams.error.format(),
            });
        }
        try {
            const result = await productService.getById(parseParams.data.id, user);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao buscar produto' });
        }
    }
    async create(request, reply) {
        const user = request.user;
        const parseBody = createProductSchema.safeParse(request.body);
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados de criação de produto inválidos',
                details: parseBody.error.format(),
            });
        }
        try {
            const result = await productService.create(parseBody.data, user);
            return reply.status(201).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao criar produto' });
        }
    }
    async update(request, reply) {
        const user = request.user;
        const parseParams = productParamsSchema.safeParse(request.params);
        const parseBody = updateProductSchema.safeParse(request.body);
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'ID de produto inválido',
                details: parseParams.error.format(),
            });
        }
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados de atualização inválidos',
                details: parseBody.error.format(),
            });
        }
        try {
            const result = await productService.update(parseParams.data.id, parseBody.data, user);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao atualizar produto' });
        }
    }
    async transferStock(request, reply) {
        const user = request.user;
        const parseParams = productParamsSchema.safeParse(request.params);
        const parseBody = transferStockSchema.safeParse(request.body);
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'ID de produto inválido',
                details: parseParams.error.format(),
            });
        }
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Quantidade de transferência inválida',
                details: parseBody.error.format(),
            });
        }
        try {
            const result = await productService.transferStock(parseParams.data.id, parseBody.data.quantity, user);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao transferir estoque' });
        }
    }
    async processSale(request, reply) {
        const user = request.user;
        const parseBody = posSaleSchema.safeParse(request.body);
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados de venda do PDV inválidos',
                details: parseBody.error.format(),
            });
        }
        try {
            const result = await productService.processSale(parseBody.data, user);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao processar venda no PDV' });
        }
    }
    async delete(request, reply) {
        const user = request.user;
        const parseParams = productParamsSchema.safeParse(request.params);
        if (!parseParams.success) {
            return reply.status(400).send({
                error: 'ID inválido',
                details: parseParams.error.format(),
            });
        }
        try {
            const result = await productService.delete(parseParams.data.id, user);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao excluir produto' });
        }
    }
}
export const productController = new ProductController();
