-- Rename totalExcludingTax -> totalNetAmount
ALTER TABLE "Invoice" RENAME COLUMN "totalExcludingTax" TO "totalNetAmount";

-- Rename totalIncludingTax -> totalPayableAmount
ALTER TABLE "Invoice" RENAME COLUMN "totalIncludingTax" TO "totalPayableAmount";

-- Add totalDiscountAmount (default 0 for existing rows)
ALTER TABLE "Invoice" ADD COLUMN "totalDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
