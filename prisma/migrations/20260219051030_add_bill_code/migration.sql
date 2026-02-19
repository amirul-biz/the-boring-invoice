-- AlterTable
ALTER TABLE "BusinessInformation" ALTER COLUMN "msicCode" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billCode" TEXT;
