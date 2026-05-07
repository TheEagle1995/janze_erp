-- Add source column to orders table
-- 'ORDER' = created from Orders section (feeds analytics & dashboard)
-- 'POS'   = created from POS terminal (tracked separately, not in analytics)

ALTER TABLE "orders" ADD COLUMN "source" VARCHAR(10) NOT NULL DEFAULT 'ORDER';

-- Existing orders are treated as ORDER-sourced (correct historical default)
-- No data update needed — DEFAULT 'ORDER' covers all existing rows.

-- Index for fast source-filtered queries
CREATE INDEX "orders_source_idx" ON "orders"("source");
