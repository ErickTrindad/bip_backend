import dns from "node:dns";
import dotenv from "dotenv";
dotenv.config();
// Ignorar validação de certificados TLS/SSL (evita erros em proxy/firewall corporativo)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// Configura ordem de resolução DNS para IPv4 e adiciona servidores públicos como fallback
try {
    dns.setDefaultResultOrder("ipv4first");
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}
catch (error) {
    console.warn("Aviso ao configurar servidores DNS personalizados:", error);
}
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, } from "fastify-type-provider-zod";
import { authRoutes } from "./routes/auth.routes.js";
import { tenantRoutes } from "./routes/tenant.routes.js";
import { productRoutes } from "./routes/product.routes.js";
const app = Fastify({
    logger: true,
}).withTypeProvider();
// Validação e serialização com Zod
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
// CORS
await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept']
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
await app.register(productRoutes);
const port = Number(process.env.PORT) || 3333;
try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Documentação Swagger disponível em: http://localhost:${port}/docs`);
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
