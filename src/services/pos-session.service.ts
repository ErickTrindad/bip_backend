import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../middlewares/auth.js';
import { AppError } from '../errors/app-error.js';

const SESSION_TTL_MINUTES = 30;

export class PosSessionService {
  /**
   * Valida e resolve o ID do tenant do operador autenticado.
   */
  private resolveTenantId(user: AuthUser, explicitTenantId?: string): string {
    if (user.isSuperAdmin) {
      if (explicitTenantId) return explicitTenantId;
      if (user.tenantId) return user.tenantId;
      throw new AppError('TenantId é obrigatório para Super Admin criar sessão de pareamento', 400);
    }

    if (!user.tenantId) {
      throw new AppError('Usuário não vinculado a um tenant', 403);
    }

    return user.tenantId;
  }

  /**
   * Cria uma nova sessão efêmera de pareamento para o PDV desktop.
   * Invalida sessões ativas anteriores do mesmo usuário e tenant.
   */
  async createPairingSession(user: AuthUser, explicitTenantId?: string) {
    const tenantId = this.resolveTenantId(user, explicitTenantId);

    // 1. Expira sessões anteriores abertas pelo mesmo usuário neste tenant
    await prisma.posSession.updateMany({
      where: {
        tenantId,
        userId: user.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // 2. Gera token criptográfico seguro e canal único
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const channel = `pos_sess_${sessionId.replace(/-/g, '')}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MINUTES * 60 * 1000);
    const expiresInSeconds = SESSION_TTL_MINUTES * 60;

    // 3. Persiste a nova sessão no banco
    const session = await prisma.posSession.create({
      data: {
        id: sessionId,
        tenantId,
        userId: user.id,
        token,
        channel,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    const qrCodeUrl = `/scanner-remote?session=${session.id}&token=${session.token}`;

    return {
      message: 'Sessão de pareamento para scanner remoto criada com sucesso',
      sessionId: session.id,
      token: session.token,
      channel: session.channel,
      status: session.status as 'ACTIVE',
      expiresAt: session.expiresAt,
      expiresInSeconds,
      qrCodeUrl,
    };
  }

  /**
   * Valida a sessão de pareamento chamada pelo celular através do QR Code.
   */
  async validatePairingSession(sessionId: string, token: string) {
    const session = await prisma.posSession.findUnique({
      where: { id: sessionId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!session) {
      throw new AppError('Sessão de pareamento não encontrada', 404);
    }

    if (session.token !== token) {
      throw new AppError('Token de pareamento inválido', 401);
    }

    const now = new Date();
    if (session.status !== 'ACTIVE' || session.expiresAt <= now) {
      if (session.status === 'ACTIVE') {
        await prisma.posSession.update({
          where: { id: sessionId },
          data: { status: 'EXPIRED' },
        });
      }
      throw new AppError('Sessão de pareamento inválida ou expirada', 401);
    }

    const remainingSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      valid: true,
      sessionId: session.id,
      channel: session.channel,
      status: session.status as 'ACTIVE',
      expiresAt: session.expiresAt,
      remainingSeconds,
      tenant: {
        id: session.tenant.id,
        name: session.tenant.name,
        category: session.tenant.category,
      },
      operator: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    };
  }

  /**
   * Encerra a sessão de pareamento quando o PDV for finalizado no desktop.
   */
  async closeSession(sessionId: string, user: AuthUser) {
    const session = await prisma.posSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AppError('Sessão não encontrada', 404);
    }

    if (!user.isSuperAdmin && session.tenantId !== user.tenantId) {
      throw new AppError('Acesso não autorizado para encerrar esta sessão', 403);
    }

    await prisma.posSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
      },
    });

    return {
      message: 'Sessão de pareamento encerrada com sucesso',
      sessionId: session.id,
      status: 'CLOSED' as const,
    };
  }
}

export const posSessionService = new PosSessionService();
