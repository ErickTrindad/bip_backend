-- CreateEnum
CREATE TYPE "TenantCategory" AS ENUM ('PADARIA', 'MERCEARIA', 'BAR', 'LANCHONETE', 'FARMACIA', 'CONVENIENCIA', 'PET_SHOP', 'MERCADO', 'OUTROS');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "category" "TenantCategory" NOT NULL DEFAULT 'OUTROS';
