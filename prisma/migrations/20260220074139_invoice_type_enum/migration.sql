-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- DataMigration: convert existing text values to enum-compatible names
UPDATE "Invoice" SET "invoiceType" = 'INVOICE'      WHERE "invoiceType" = 'Invoice';
UPDATE "Invoice" SET "invoiceType" = 'CREDIT_NOTE'   WHERE "invoiceType" = 'Credit Note';
UPDATE "Invoice" SET "invoiceType" = 'DEBIT_NOTE'    WHERE "invoiceType" = 'Debit Note';

-- AlterTable: cast column from TEXT to the new enum type
ALTER TABLE "Invoice" ALTER COLUMN "invoiceType" TYPE "InvoiceType" USING "invoiceType"::"InvoiceType";
