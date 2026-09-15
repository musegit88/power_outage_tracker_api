-- AlterTable: Add archived column to outages
ALTER TABLE "outages" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
