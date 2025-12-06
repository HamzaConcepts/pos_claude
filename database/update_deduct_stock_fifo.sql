-- =====================================================
-- UPDATE deduct_stock_fifo FUNCTION FOR NEW SCHEMA
-- This function deducts stock using FIFO and updates aggregated_stock
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id INTEGER,
  p_store_id INTEGER,
  p_quantity INTEGER,
  p_sale_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  batch_id INTEGER,
  quantity_deducted INTEGER,
  cost_price DECIMAL(10, 2)
) AS $$
DECLARE
  remaining_qty INTEGER := p_quantity;
  batch RECORD;
  deduct_qty INTEGER;
BEGIN
  -- Loop through batches in FIFO order (oldest first)
  FOR batch IN 
    SELECT id, quantity_remaining, cost_price AS batch_cost
    FROM stock_batches
    WHERE product_id = p_product_id 
      AND store_id = p_store_id
      AND is_depleted = false
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, id ASC
  LOOP
    EXIT WHEN remaining_qty <= 0;
    
    -- Determine how much to deduct from this batch
    deduct_qty := LEAST(batch.quantity_remaining, remaining_qty);
    
    -- Update batch
    UPDATE stock_batches
    SET quantity_remaining = quantity_remaining - deduct_qty,
        is_depleted = (quantity_remaining - deduct_qty = 0),
        depleted_at = CASE WHEN (quantity_remaining - deduct_qty = 0) THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = batch.id;
    
    -- Return deduction info
    batch_id := batch.id;
    quantity_deducted := deduct_qty;
    cost_price := batch.batch_cost;
    RETURN NEXT;
    
    remaining_qty := remaining_qty - deduct_qty;
  END LOOP;
  
  -- NOTE: No need to manually update aggregated_stock here
  -- The trigger on stock_batches will automatically update it
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deduct_stock_fifo(INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Deducts stock using FIFO (First In, First Out) method. The update_aggregated_stock trigger automatically recalculates aggregated values.';
