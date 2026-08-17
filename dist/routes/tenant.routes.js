import { z } from 'zod';
import { tenantController } from '../controllers/tenant.controller.js';
import { authMiddleware, superAdminOnlyMiddleware } from '../middlewares/auth.js';
import { createTenantSchema, updateTenantSchema, tenantParamsSchema, listTenantsResponseSchema, singleTenantResponseSchema, tenantItemSchema, } from '../schemas/tenant.schema.js';
export const tenantRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // Todas as rotas de tenant exigem autenticação
    typedApp.addHook('preHandler', authMiddleware);
    // 1. GET ALL
    typedApp.get('/tenants', {
        schema: {
            tags: ['Tenants'],
            summary: 'Listar empresas (Tenants)',
            description: 'Super Admin visualiza todas as empresas. Usuário comum visualiza apenas a sua.',
            security: [{ bearerAuth: [] }],
            response: {
                200: listTenantsResponseSchema,
            },
        },
    }, tenantController.getAll.bind(tenantController));
    // 2. GET ONE
    typedApp.get('/tenants/:id', {
        schema: {
            tags: ['Tenants'],
            summary: 'Buscar empresa por ID',
            description: 'Retorna detalhes completos do tenant com lista de membros e contagem de produtos.',
            params: tenantParamsSchema,
            security: [{ bearerAuth: [] }],
            response: {
                200: singleTenantResponseSchema,
            },
        },
    }, tenantController.getById.bind(tenantController));
    // 3. POST
    typedApp.post('/tenants', {
        schema: {
            tags: ['Tenants'],
            summary: 'Criar nova empresa (Tenant)',
            description: 'Cria uma empresa associada ao usuário autenticado ou ao ownerId fornecido por Super Admin.',
            body: createTenantSchema,
            security: [{ bearerAuth: [] }],
            response: {
                201: z.object({
                    message: z.string(),
                    tenant: tenantItemSchema,
                }),
            },
        },
    }, tenantController.create.bind(tenantController));
    // 4. PUT
    typedApp.put('/tenants/:id', {
        schema: {
            tags: ['Tenants'],
            summary: 'Atualizar dados da empresa',
            description: 'Atualiza informações do tenant (Super Admin, Proprietário ou Administrador).',
            params: tenantParamsSchema,
            body: updateTenantSchema,
            security: [{ bearerAuth: [] }],
            response: {
                200: z.object({
                    message: z.string(),
                    tenant: tenantItemSchema,
                }),
            },
        },
    }, tenantController.update.bind(tenantController));
    // 5. DELETE
    typedApp.delete('/tenants/:id', {
        preHandler: [superAdminOnlyMiddleware],
        schema: {
            tags: ['Tenants'],
            summary: 'Excluir empresa (Tenant)',
            description: 'Exclui definitivamente uma empresa (Restrito estritamente a Super Administrador).',
            params: tenantParamsSchema,
            security: [{ bearerAuth: [] }],
            response: {
                200: z.object({
                    message: z.string(),
                }),
            },
        },
    }, tenantController.delete.bind(tenantController));
};
