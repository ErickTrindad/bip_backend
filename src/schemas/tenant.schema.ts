import { z } from 'zod';
import { tenantCategoryEnum, employeeRangeEnum } from './auth.schema.js';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres').describe('Nome da empresa'),
  category: tenantCategoryEnum.default('OUTROS').describe('Segmento/Categoria da empresa: PADARIA, MERCEARIA, BAR, LANCHONETE, FARMACIA, CONVENIENCIA, PET_SHOP, MERCADO, OUTROS'),
  employeeRange: employeeRangeEnum.default('solo_1').describe(
    'Faixa de funcionários da empresa:\n' +
    '- `solo_1`: Apenas o proprietário (1 pessoa / autônomo)\n' +
    '- `team_2_5`: Pequena equipe (2 a 5 funcionários)\n' +
    '- `team_6_10`: Média equipe (6 a 10 funcionários)\n' +
    '- `team_11_plus`: Grande equipe (11 ou mais funcionários)'
  ),
  email: z.string().email('E-mail inválido').optional().nullable().describe('E-mail da empresa'),
  phone: z.string().optional().nullable().describe('Telefone da empresa'),
  ownerId: z.string().uuid('ID do proprietário inválido').optional().describe('ID do proprietário (somente Super Admin pode definir)'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres').optional().describe('Nome da empresa'),
  category: tenantCategoryEnum.optional().describe('Segmento/Categoria da empresa'),
  employeeRange: employeeRangeEnum.optional().describe(
    'Faixa de funcionários da empresa:\n' +
    '- `solo_1`: Apenas o proprietário (1 pessoa / autônomo)\n' +
    '- `team_2_5`: Pequena equipe (2 a 5 funcionários)\n' +
    '- `team_6_10`: Média equipe (6 a 10 funcionários)\n' +
    '- `team_11_plus`: Grande equipe (11 ou mais funcionários)'
  ),
  email: z.string().email('E-mail inválido').optional().nullable().describe('E-mail da empresa'),
  phone: z.string().optional().nullable().describe('Telefone da empresa'),
});

export const tenantParamsSchema = z.object({
  id: z.string().uuid('ID de tenant inválido').describe('UUID do tenant'),
});

export const tenantItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: tenantCategoryEnum,
  employeeRange: employeeRangeEnum,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  ownerId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  owner: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
  }).optional(),
  users: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      isSuperAdmin: z.boolean(),
    })
  ).optional(),
  _count: z.object({
    users: z.number().optional(),
    products: z.number().optional(),
  }).optional(),
});

export const listTenantsResponseSchema = z.object({
  tenants: z.array(tenantItemSchema),
});

export const singleTenantResponseSchema = z.object({
  tenant: tenantItemSchema,
});
