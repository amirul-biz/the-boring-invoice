-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "recipientRegistrationNo" TEXT NOT NULL,
    "recipient" JSONB NOT NULL,
    "supplierRegistrationNo" TEXT NOT NULL,
    "supplier" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "totalExcludingTax" DECIMAL(18,2) NOT NULL,
    "totalIncludingTax" DECIMAL(18,2) NOT NULL,
    "billUrl" TEXT,
    "transactionId" TEXT,
    "transactionTime" TIMESTAMP(3),
    "lhdnMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNo_idx" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_recipientRegistrationNo_idx" ON "Invoice"("recipientRegistrationNo");

-- CreateIndex
CREATE INDEX "Invoice_supplierRegistrationNo_idx" ON "Invoice"("supplierRegistrationNo");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issuedDate_idx" ON "Invoice"("issuedDate");
