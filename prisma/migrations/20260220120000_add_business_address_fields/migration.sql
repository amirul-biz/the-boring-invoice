-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('BRN', 'NRIC', 'PASSPORT', 'ARMY');

-- AlterTable
ALTER TABLE "BusinessInformation" ADD COLUMN "idType" "IdType";
ALTER TABLE "BusinessInformation" ADD COLUMN "sstRegistrationNumber" TEXT;
ALTER TABLE "BusinessInformation" ADD COLUMN "address" JSONB;
