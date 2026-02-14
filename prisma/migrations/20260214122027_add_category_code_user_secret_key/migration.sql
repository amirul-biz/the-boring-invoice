/*
  Warnings:

  - Added the required column `categoryCode` to the `BusinessInformation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userSecretKey` to the `BusinessInformation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BusinessInformation" ADD COLUMN     "categoryCode" TEXT NOT NULL,
ADD COLUMN     "userSecretKey" TEXT NOT NULL;
