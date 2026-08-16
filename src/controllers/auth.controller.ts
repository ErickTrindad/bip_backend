import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { AppError } from '../errors/app-error.js';
import {
  registerSchema,
  superAdminRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordOtpSchema,
} from '../schemas/auth.schema.js';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.register(parseResult.data);
      return reply.status(201).send({
        message: 'Cadastro realizado com sucesso',
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async registerSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = superAdminRegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.registerSuperAdmin(parseResult.data);
      return reply.status(201).send({
        message: 'Super Admin cadastrado com sucesso',
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.login(parseResult.data);
      return reply.status(200).send({
        message: 'Login realizado com sucesso',
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = forgotPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.forgotPassword(parseResult.data);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async resetPasswordWithOtp(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = resetPasswordOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        issues: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await authService.resetPasswordWithOtp(parseResult.data);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const currentAuthUser = request.user!;

    try {
      const result = await authService.getMe(currentAuthUser.id);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }
}

export const authController = new AuthController();
