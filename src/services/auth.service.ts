import { TenantCategory, EmployeeRange } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../errors/app-error.js';
import { EmployeeRangeType } from '../schemas/auth.schema.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  tenantCategory?: TenantCategory;
  tenantEmployeeRange?: EmployeeRangeType;
  tenantEmail?: string;
  tenantPhone?: string;
}

export interface SuperAdminRegisterInput {
  name: string;
  email: string;
  password: string;
  adminSecret: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordOtpInput {
  email: string;
  token: string;
  newPassword: string;
}

function mapEmployeeRangeToDb(range?: EmployeeRangeType): EmployeeRange {
  if (!range) return EmployeeRange.SOLO_1;
  switch (range) {
    case 'solo_1':
      return EmployeeRange.SOLO_1;
    case 'team_2_5':
      return EmployeeRange.TEAM_2_5;
    case 'team_6_10':
      return EmployeeRange.TEAM_6_10;
    case 'team_11_plus':
      return EmployeeRange.TEAM_11_PLUS;
  }
}

function mapEmployeeRangeToApi(range: EmployeeRange): EmployeeRangeType {
  switch (range) {
    case EmployeeRange.SOLO_1:
      return 'solo_1';
    case EmployeeRange.TEAM_2_5:
      return 'team_2_5';
    case EmployeeRange.TEAM_6_10:
      return 'team_6_10';
    case EmployeeRange.TEAM_11_PLUS:
      return 'team_11_plus';
  }
}

export class AuthService {
  async register(data: RegisterInput) {
    const { name, email, password, tenantName, tenantCategory, tenantEmployeeRange, tenantEmail, tenantPhone } = data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Usuário já cadastrado com este e-mail', 409);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      throw new AppError(authError?.message || 'Falha ao registrar usuário no provedor de autenticação', 400);
    }

    const userId = authData.user.id;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: userId,
            name,
            email,
            role: 'ADMIN',
            isSuperAdmin: false,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            category: tenantCategory || 'OUTROS',
            employeeRange: mapEmployeeRangeToDb(tenantEmployeeRange),
            email: tenantEmail || email,
            phone: tenantPhone || null,
            ownerId: user.id,
          },
        });

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            tenantId: tenant.id,
          },
        });

        return { user: updatedUser, tenant };
      });

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          tenant_id: result.tenant.id,
          is_super_admin: false,
        },
      });

      const { data: loginData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          isSuperAdmin: result.user.isSuperAdmin,
          tenantId: result.tenant.id,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          category: result.tenant.category,
          employeeRange: mapEmployeeRangeToApi(result.tenant.employeeRange),
          email: result.tenant.email,
          phone: result.tenant.phone,
        },
        session: loginData.session || null,
      };
    } catch (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw dbError;
    }
  }

  async registerSuperAdmin(data: SuperAdminRegisterInput) {
    const { name, email, password, adminSecret } = data;

    const envAdminSecret = process.env.ADMIN_SECRET;
    if (!envAdminSecret || adminSecret !== envAdminSecret) {
      throw new AppError('Admin secret inválido ou não autorizado', 403);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Usuário já cadastrado com este e-mail', 409);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      throw new AppError(authError?.message || 'Falha ao registrar Super Admin no provedor de autenticação', 400);
    }

    const userId = authData.user.id;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: userId,
            name,
            email,
            role: 'SUPER_ADMIN',
            isSuperAdmin: true,
          },
        });

        const systemTenant = await tx.tenant.create({
          data: {
            name: 'System Administration',
            category: 'OUTROS',
            employeeRange: EmployeeRange.SOLO_1,
            email: 'admin@system.local',
            phone: null,
            ownerId: user.id,
          },
        });

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            tenantId: systemTenant.id,
          },
        });

        return { user: updatedUser, tenant: systemTenant };
      });

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          tenant_id: result.tenant.id,
          is_super_admin: true,
        },
      });

      const { data: loginData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          isSuperAdmin: result.user.isSuperAdmin,
          tenantId: result.tenant.id,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          category: result.tenant.category,
          employeeRange: mapEmployeeRangeToApi(result.tenant.employeeRange),
          email: result.tenant.email,
          phone: result.tenant.phone,
        },
        session: loginData.session || null,
      };
    } catch (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw dbError;
    }
  }

  async login(data: LoginInput) {
    const { email, password } = data;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      throw new AppError(authError?.message || 'E-mail ou senha inválidos', 401);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authData.user.id },
      include: {
        tenant: true,
      },
    });

    if (!dbUser) {
      throw new AppError('Perfil do usuário não encontrado', 404);
    }

    return {
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        isSuperAdmin: dbUser.isSuperAdmin,
        tenantId: dbUser.tenantId,
      },
      tenant: dbUser.tenant
        ? {
            id: dbUser.tenant.id,
            name: dbUser.tenant.name,
            category: dbUser.tenant.category,
            employeeRange: mapEmployeeRangeToApi(dbUser.tenant.employeeRange),
            email: dbUser.tenant.email,
            phone: dbUser.tenant.phone,
          }
        : null,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
      },
    };
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const { email } = data;

    // Dispara envio do código OTP de recuperação de senha por email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw new AppError(error.message || 'Falha ao solicitar recuperação de senha', 400);
    }

    return {
      message: 'Código OTP de recuperação de senha enviado com sucesso para o e-mail informado',
    };
  }

  async resetPasswordWithOtp(data: ResetPasswordOtpInput) {
    const { email, token, newPassword } = data;

    // 1. Valida o código OTP de 6 dígitos recebido por e-mail para o tipo recovery
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (verifyError || !verifyData.user) {
      throw new AppError(verifyError?.message || 'Código OTP inválido ou expirado', 400);
    }

    const userId = verifyData.user.id;

    // 2. Atualiza a senha do usuário com privilégio de admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      throw new AppError(updateError.message || 'Falha ao redefinir a nova senha', 400);
    }

    return {
      message: 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.',
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        ownedTenants: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tenant: user.tenant
        ? {
            ...user.tenant,
            employeeRange: mapEmployeeRangeToApi(user.tenant.employeeRange),
          }
        : null,
      ownedTenants: user.ownedTenants.map((t) => ({
        ...t,
        employeeRange: mapEmployeeRangeToApi(t.employeeRange),
      })),
    };
  }
}

export const authService = new AuthService();
