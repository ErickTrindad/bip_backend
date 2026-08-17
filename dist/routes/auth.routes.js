import { z } from 'zod';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { registerSchema, superAdminRegisterSchema, loginSchema, forgotPasswordSchema, resetPasswordOtpSchema, authResponseSchema, meResponseSchema, } from '../schemas/auth.schema.js';
export const authRoutes = async (app) => {
    const typedApp = app.withTypeProvider();
    // 1. Registro Comum: Usuário + Criação de Tenant
    typedApp.post('/auth/register', {
        schema: {
            tags: ['Autenticação'],
            summary: 'Cadastro Comum (Usuário + Tenant)',
            description: 'Cadastra um novo usuário e cria a empresa (tenant) dele na mesma transação.',
            body: registerSchema,
            response: {
                201: authResponseSchema,
            },
        },
    }, authController.register.bind(authController));
    // 2. Registro Super Admin
    typedApp.post('/auth/super-admin/register', {
        schema: {
            tags: ['Autenticação'],
            summary: 'Cadastro de Super Admin',
            description: 'Cadastra um Super Administrador validando o adminSecret e cria o tenant System Administration.',
            body: superAdminRegisterSchema,
            response: {
                201: authResponseSchema,
            },
        },
    }, authController.registerSuperAdmin.bind(authController));
    // 3. Login
    typedApp.post('/auth/login', {
        schema: {
            tags: ['Autenticação'],
            summary: 'Login de Usuário',
            description: 'Autentica o usuário pelo Supabase Auth e retorna JWT com dados do tenant.',
            body: loginSchema,
            response: {
                200: authResponseSchema,
            },
        },
    }, authController.login.bind(authController));
    // 4. Solicitação de Recuperação de Senha (Envio de OTP por e-mail)
    typedApp.post('/auth/forgot-password', {
        schema: {
            tags: ['Autenticação'],
            summary: 'Esqueci minha senha (Envio de OTP)',
            description: 'Envia um código OTP numérico (6 a 8 dígitos) para o e-mail cadastrado via Supabase Auth.',
            body: forgotPasswordSchema,
            response: {
                200: z.object({
                    message: z.string(),
                }),
            },
        },
    }, authController.forgotPassword.bind(authController));
    // 5. Redefinição de Senha com OTP
    typedApp.post('/auth/reset-password', {
        schema: {
            tags: ['Autenticação'],
            summary: 'Redefinir senha com OTP (6 a 8 dígitos)',
            description: 'Valida o código OTP de 6 a 8 dígitos recebido por e-mail e aplica a nova senha.',
            body: resetPasswordOtpSchema,
            response: {
                200: z.object({
                    message: z.string(),
                }),
            },
        },
    }, authController.resetPasswordWithOtp.bind(authController));
    // 6. Get Me
    typedApp.get('/auth/me', {
        preHandler: [authMiddleware],
        schema: {
            tags: ['Autenticação'],
            summary: 'Dados do Usuário Autenticado',
            description: 'Retorna perfil, dados do tenant atual e tenants de propriedade do usuário autenticado.',
            security: [{ bearerAuth: [] }],
            response: {
                200: meResponseSchema,
            },
        },
    }, authController.getMe.bind(authController));
};
