-- Migration: Add isFlexiblePrice to products and customName to branches
-- Run: npx prisma migrate deploy

-- Add flexible price flag to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_flexible_price" BOOLEAN NOT NULL DEFAULT false;
