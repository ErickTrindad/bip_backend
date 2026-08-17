import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import { prisma } from '../lib/prisma.js';
export async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return reply.status(401).send({ error: 'Token de autorização não fornecido' });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return reply.status(401).send({ error: 'Formato do cabeçalho de autorização inválido. Use "Bearer <token>"' });
    }
    const token = parts[1];
    try {
        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        let userId;
        let appMetadata = {};
        if (jwtSecret) {
            try {
                const decoded = jwt.verify(token, jwtSecret);
                userId = decoded.sub;
                appMetadata = decoded.app_metadata || {};
            }
            catch {
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (error || !user) {
                    return reply.status(401).send({ error: 'Token inválido ou expirado' });
                }
                userId = user.id;
                appMetadata = user.app_metadata || {};
            }
        }
        else {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) {
                return reply.status(401).send({ error: 'Token inválido ou expirado' });
            }
            userId = user.id;
            appMetadata = user.app_metadata || {};
        }
        if (!userId) {
            return reply.status(401).send({ error: 'Usuário não autenticado' });
        }
        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!dbUser) {
            return reply.status(401).send({ error: 'Usuário não encontrado na base de dados' });
        }
        request.user = {
            id: dbUser.id,
            email: dbUser.email,
            isSuperAdmin: dbUser.isSuperAdmin || appMetadata.is_super_admin === true,
            tenantId: dbUser.tenantId || appMetadata.tenant_id || null,
            role: dbUser.role,
        };
    }
    catch {
        return reply.status(401).send({ error: 'Falha na autenticação do token' });
    }
}
export async function superAdminOnlyMiddleware(request, reply) {
    if (!request.user?.isSuperAdmin) {
        return reply.status(403).send({ error: 'Acesso negado. Recurso restrito a Super Administradores' });
    }
}
