import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Usado pelo Prisma CLI para comandos de schema/migração (prisma migrate / prisma db push)
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
