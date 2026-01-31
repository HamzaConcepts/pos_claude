-- Migration: Fix expense amount to use amount_paid and fix new product detection
-- Date: 2026-01-31

-- Step 1: Add amount_paid column to stock_batches table
ALTER TABLE "public"."stock_batches" 
ADD COLUMN IF NOT EXISTS "amount_paid" numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN "public"."stock_batches"."amount_paid" IS 'Amount actually paid to supplier. Used for expense tracking. If less than total cost, remainder goes to supplier_khaata.';

-- Step 2: Update the create_restock_expense function to:
--   a) Fix new product detection (check if first batch for this product)
--   b) Use amount_paid instead of full cost for expense amount
CREATE OR REPLACE FUNCTION public.create_restock_expense()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  product_name TEXT;
  is_new_product BOOLEAN;
  expense_description TEXT;
  batch_count INTEGER;
  expense_amount NUMERIC(10,2);
BEGIN
  -- Only create expense if this is NOT initial stock AND amount_paid > 0
  IF NEW.is_initial_stock = FALSE THEN
    -- Get product name
    SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
    
    -- Check if this is a new product by counting existing batches
    -- (excluding the current one which is being inserted)
    SELECT COUNT(*) INTO batch_count 
    FROM stock_batches 
    WHERE product_id = NEW.product_id 
      AND store_id = NEW.store_id
      AND id != NEW.id;
    
    -- If no other batches exist, this is a new product
    is_new_product := (batch_count = 0);
    
    -- Calculate expense amount: use amount_paid if set, otherwise full cost
    expense_amount := COALESCE(NEW.amount_paid, NEW.cost_price * NEW.quantity_purchased);
    
    -- If amount_paid is 0 but it's not initial stock, use full cost
    -- This handles backwards compatibility
    IF expense_amount = 0 THEN
      expense_amount := NEW.cost_price * NEW.quantity_purchased;
    END IF;
    
    -- Generate description based on whether it's a new product or restock
    IF is_new_product THEN
      expense_description := 'New Product: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    ELSE
      expense_description := 'Restock: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' - Batch #' || NEW.batch_number || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    END IF;
    
    -- Create expense record with payment method
    INSERT INTO expenses (
      store_id,
      category,
      description,
      amount,
      expense_date,
      reference_id,
      payment_method
    ) VALUES (
      NEW.store_id,
      CASE 
        WHEN is_new_product THEN 'new_product'
        ELSE 'inventory_restock'
      END,
      expense_description,
      expense_amount,
      NEW.purchase_date::date,
      NEW.id,
      COALESCE(NEW.payment_method, 'Cash')
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
