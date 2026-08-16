import { FastifyRequest, FastifyReply } from 'fastify';
import { tenantService } from '../services/tenant.service.js';
import { AppError } from '../errors/app-error.js';
import {
  createTenantSchema,
  updateTenantSchema,
  tenantParamsSchema,
} from '../schemas/tenant.schema.js';

export class TenantController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;

    try {
      const tenants = await tenantService.getAll(user);
      return reply.send({ tenants });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseParams = tenantParamsSchema.safeParse(request.params);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'Parâmetro ID inválido',
        issues: parseParams.error.flatten().fieldErrors,
      });
    }

    try {
      const tenant = await tenantService.getById(parseParams.data.id, user);
      return reply.send({ tenant });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseBody = createTenantSchema.safeParse(request.body);

    if (!parseBody.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseBody.error.flatten().fieldErrors,
      });
    }

    try {
      const tenant = await tenantService.create(parseBody.data, user);
      return reply.status(201).send({
        message: 'Empresa (tenant) criada com sucesso',
        tenant,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parseParams = tenantParamsSchema.safeParse(request.params);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'Parâmetro ID inválido',
        issues: parseParams.error.flatten().fieldErrors,
      });
    }

    const parseBody = updateTenantSchema.safeParse(request.body);
    if (!parseBody.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseBody.error.flatten().fieldErrors,
      });
    }

    try {
      const updatedTenant = await tenantService.update(parseParams.data.id, parseBody.data, user);
      return reply.send({
        message: 'Empresa (tenant) atualizada com sucesso',
        tenant: updatedTenant,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const parseParams = tenantParamsSchema.safeParse(request.params);

    if (!parseParams.success) {
      return reply.status(400).send({
        error: 'Parâmetro ID inválido',
        issues: parseParams.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await tenantService.delete(parseParams.data.id);
      return reply.send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }
}

export const tenantController = new TenantController();
