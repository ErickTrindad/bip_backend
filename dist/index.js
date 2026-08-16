import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, } from "fastify-type-provider-zod";
import dotenv from "dotenv";
import { authRoutes } from "./routes/auth.routes.js";
import { tenantRoutes } from "./routes/tenant.routes.js";
dotenv.config();
const app = Fastify({
    logger: true,
}).withTypeProvider();
// Validação e serialização com Zod
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
// CORS
await app.register(cors, {
    origin: true,
});
// Swagger / OpenAPI Documentação
await app.register(swagger, {
    openapi: {
        info: {
            title: "GO PME - API Documentation",
            description: "Documentação interativa da API do GO PME (Autenticação Multi-Tenant, Controle de Estoque e PDV).",
            version: "1.0.0",
        },
        servers: [
            {
                url: `http://localhost:${Number(process.env.PORT) || 3333}`,
                description: "Servidor Local de Desenvolvimento",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Insira o token JWT retornado no login ou registro.",
                },
            },
        },
    },
    transform: jsonSchemaTransform,
});
// Interface visual Swagger UI
await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
        docExpansion: "list",
        deepLinking: true,
    },
});
// Health check
app.get("/ping", {
    schema: {
        tags: ["Health Check"],
        summary: "Status do Servidor",
    },
}, async (_request, _reply) => {
    return { message: "pong", timestamp: new Date().toISOString() };
});
// Registrar rotas da aplicação
await app.register(authRoutes);
await app.register(tenantRoutes);
const port = Number(process.env.PORT) || 3333;
try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Documentação Swagger disponível em: http://localhost:${port}/docs`);
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
