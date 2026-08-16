-- CreateEnum
CREATE TYPE "EmployeeRange" AS ENUM ('solo_1', 'team_2_5', 'team_6_10', 'team_11_plus');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "employee_range" "EmployeeRange" NOT NULL DEFAULT 'solo_1';
