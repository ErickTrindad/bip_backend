import { z } from 'zod';

export const tenantCategoryEnum = z.enum([
  'PADARIA',
  'MERCEARIA',
  'BAR',
  'LANCHONETE',
  'FARMACIA',
  'CONVENIENCIA',
  'PET_SHOP',
  'MERCADO',
  'OUTROS',
]);

export type TenantCategoryType = z.infer<typeof tenantCategoryEnum>;

export const employeeRangeEnum = z.enum([
  'solo_1',
  'team_2_5',
  'team_6_10',
  'team_11_plus',
]);

export type EmployeeRangeType = z.infer<typeof employeeRangeEnum>;

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').describe('Nome do usuário'),
  email: z.string().email('E-mail inválido').describe('E-mail do usuário'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').describe('Senha do usuário'),
  tenantName: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres').describe('Nome da empresa/mercado'),
  tenantCategory: tenantCategoryEnum.default('OUTROS').describe('Segmento/Categoria da empresa: PADARIA, MERCEARIA, BAR, LANCHONETE, FARMACIA, CONVENIENCIA, PET_SHOP, MERCADO, OUTROS'),
  tenantEmployeeRange: employeeRangeEnum.default('solo_1').describe(
    'Faixa de funcionários da empresa:\n' +
    '- `solo_1`: Apenas o proprietário (1 pessoa / autônomo)\n' +
    '- `team_2_5`: Pequena equipe (2 a 5 funcionários)\n' +
    '- `team_6_10`: Média equipe (6 a 10 funcionários)\n' +
    '- `team_11_plus`: Grande equipe (11 ou mais funcionários)'
  ),
  tenantEmail: z.string().email('E-mail da empresa inválido').optional().describe('E-mail institucional da empresa'),
  tenantPhone: z.string().optional().describe('Telefone/WhatsApp da empresa'),
});

export const superAdminRegisterSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').describe('Nome do Super Admin'),
  email: z.string().email('E-mail inválido').describe('E-mail do Super Admin'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').describe('Senha do Super Admin'),
  adminSecret: z.string().min(1, 'Admin secret é obrigatório').describe('Chave secreta para autorização de Super Admin'),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').describe('E-mail cadastrado'),
  password: z.string().min(1, 'Senha é obrigatória').describe('Senha do usuário'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido').describe('E-mail do usuário para envio do código OTP de recuperação'),
});

export const resetPasswordOtpSchema = z.object({
  email: z.string().email('E-mail inválido').describe('E-mail do usuário'),
  token: z.string().regex(/^\d{6,8}$/, 'O código OTP deve conter entre 6 e 8 dígitos numéricos').describe('Código OTP de 6 a 8 dígitos recebido por e-mail'),
  newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres').describe('Nova senha do usuário'),
});

export const authResponseSchema = z.object({
  message: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    isSuperAdmin: z.boolean(),
    tenantId: z.string().uuid().nullable(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: tenantCategoryEnum,
    employeeRange: employeeRangeEnum,
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }).nullable(),
  session: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
    token_type: z.string(),
  }).nullable(),
});

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    isSuperAdmin: z.boolean(),
    tenantId: z.string().uuid().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: tenantCategoryEnum,
    employeeRange: employeeRangeEnum,
    email: z.string().nullable(),
    phone: z.string().nullable(),
    ownerId: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }).nullable(),
  ownedTenants: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      category: tenantCategoryEnum,
      employeeRange: employeeRangeEnum,
      email: z.string().nullable(),
      phone: z.string().nullable(),
      ownerId: z.string().uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});
