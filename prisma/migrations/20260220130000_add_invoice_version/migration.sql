-- AlterTable: Add invoiceVersion to BusinessInformation
ALTER TABLE "BusinessInformation" ADD COLUMN "invoiceVersion" TEXT NOT NULL DEFAULT '1.0';

-- AlterTable: Add invoiceVersion to Invoice
ALTER TABLE "Invoice" ADD COLUMN "invoiceVersion" TEXT NOT NULL DEFAULT '1.0';
