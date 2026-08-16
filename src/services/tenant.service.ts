import { TenantCategory, EmployeeRange } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../middlewares/auth.js';
import { AppError } from '../errors/app-error.js';
import { EmployeeRangeType } from '../schemas/auth.schema.js';

export interface CreateTenantInput {
  name: string;
  category?: TenantCategory;
  employeeRange?: EmployeeRangeType;
  email?: string | null;
  phone?: string | null;
  ownerId?: string;
}

export interface UpdateTenantInput {
  name?: string;
  category?: TenantCategory;
  employeeRange?: EmployeeRangeType;
  email?: string | null;
  phone?: string | null;
}

function mapEmployeeRangeToDb(range?: EmployeeRangeType): EmployeeRange | undefined {
  if (!range) return undefined;
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

function mapEmployeeRangeToResponse<T extends { employeeRange: EmployeeRange }>(tenant: T): Omit<T, 'employeeRange'> & { employeeRange: EmployeeRangeType } {
  let mappedRange: EmployeeRangeType = 'solo_1';
  switch (tenant.employeeRange) {
    case EmployeeRange.SOLO_1:
      mappedRange = 'solo_1';
      break;
    case EmployeeRange.TEAM_2_5:
      mappedRange = 'team_2_5';
      break;
    case EmployeeRange.TEAM_6_10:
      mappedRange = 'team_6_10';
      break;
    case EmployeeRange.TEAM_11_PLUS:
      mappedRange = 'team_11_plus';
      break;
  }
  return {
    ...tenant,
    employeeRange: mappedRange,
  };
}

export class TenantService {
  async getAll(user: AuthUser) {
    if (user.isSuperAdmin) {
      const tenants = await prisma.tenant.findMany({
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              users: true,
              products: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return tenants.map(mapEmployeeRangeToResponse);
    }

    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          ...(user.tenantId ? [{ id: user.tenantId }] : []),
          { ownerId: user.id },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            products: true,
          },
        },
      },
    });

    return tenants.map(mapEmployeeRangeToResponse);
  }

  async getById(id: string, user: AuthUser) {
    if (!user.isSuperAdmin && user.tenantId !== id) {
      const isOwner = await prisma.tenant.findFirst({
        where: { id, ownerId: user.id },
      });

      if (!isOwner) {
        throw new AppError('Acesso negado a esta empresa', 403);
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isSuperAdmin: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Empresa (tenant) não encontrada', 404);
    }

    return mapEmployeeRangeToResponse(tenant);
  }

  async create(data: CreateTenantInput, user: AuthUser) {
    const { name, category, employeeRange, email, phone, ownerId } = data;
    const assignedOwnerId = user.isSuperAdmin && ownerId ? ownerId : user.id;

    const owner = await prisma.user.findUnique({
      where: { id: assignedOwnerId },
    });

    if (!owner) {
      throw new AppError('Usuário proprietário não encontrado', 404);
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        category: category || 'OUTROS',
        employeeRange: mapEmployeeRangeToDb(employeeRange) || EmployeeRange.SOLO_1,
        email: email || owner.email,
        phone: phone || null,
        ownerId: assignedOwnerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return mapEmployeeRangeToResponse(tenant);
  }

  async update(id: string, data: UpdateTenantInput, user: AuthUser) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new AppError('Empresa (tenant) não encontrada', 404);
    }

    const hasPermission =
      user.isSuperAdmin ||
      existingTenant.ownerId === user.id ||
      (user.tenantId === id && user.role === 'ADMIN');

    if (!hasPermission) {
      throw new AppError('Sem permissão para alterar esta empresa', 403);
    }

    const { name, category, employeeRange, email, phone } = data;
    const dbEmployeeRange = mapEmployeeRangeToDb(employeeRange);

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(dbEmployeeRange !== undefined ? { employeeRange: dbEmployeeRange } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    });

    return mapEmployeeRangeToResponse(updatedTenant);
  }

  async delete(id: string) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new AppError('Empresa (tenant) não encontrada', 404);
    }

    await prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Empresa (tenant) excluída com sucesso' };
  }
}

export const tenantService = new TenantService();
