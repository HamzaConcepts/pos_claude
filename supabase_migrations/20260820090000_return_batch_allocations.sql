-- Preserve FIFO batch usage so customer returns restore the batches that supplied the sale.
CREATE TABLE IF NOT EXISTS sale_item_batch_allocations (
  id SERIAL PRIMARY KEY,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stock_batch_id INTEGER NOT NULL REFERENCES stock_batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_item_batch_allocations_sale_item
  ON sale_item_batch_allocations(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_batch_allocations_sale
  ON sale_item_batch_allocations(sale_id);

ALTER TABLE sale_item_batch_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on sale item batch allocations"
  ON sale_item_batch_allocations;
CREATE POLICY "Service role full access on sale item batch allocations"
  ON sale_item_batch_allocations FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE sale_item_batch_allocations IS
  'FIFO stock batches consumed by each sale item and quantities returned from those batches.';
