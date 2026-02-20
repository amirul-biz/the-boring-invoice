-- Add totalTaxAmount with a temporary default so existing rows are valid
ALTER TABLE "Invoice" ADD COLUMN "totalTaxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill from existing totals
UPDATE "Invoice" SET "totalTaxAmount" = "totalIncludingTax" - "totalExcludingTax";

-- Remove the temporary default
ALTER TABLE "Invoice" ALTER COLUMN "totalTaxAmount" DROP DEFAULT;

-- Drop the old global taxRate column
ALTER TABLE "Invoice" DROP COLUMN "taxRate";
