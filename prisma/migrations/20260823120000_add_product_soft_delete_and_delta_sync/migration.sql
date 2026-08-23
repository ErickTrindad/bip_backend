-- AlterTable
ALTER TABLE "products" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_products_tenant_updated_at" ON "products"("tenant_id", "updated_at");
