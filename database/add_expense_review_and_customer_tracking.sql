-- Add mark for review functionality to expenses table
-- Similar to sales table implementation

-- 1. Add mark_for_review columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_note TEXT,
ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS marked_by VARCHAR(255);

-- 2. Add customer_id to sales table to link sales with customers
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES partial_payment_customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS customer_cnic VARCHAR(20);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_marked_for_review 
ON public.expenses(marked_for_review) 
WHERE marked_for_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_sales_customer_id 
ON public.sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_customer_phone 
ON public.sales(customer_phone);

-- 4. Add comments
COMMENT ON COLUMN expenses.marked_for_review IS 'Flag indicating if cashier marked this expense for manager review';
COMMENT ON COLUMN expenses.review_note IS 'Note explaining why the expense was marked for review';
COMMENT ON COLUMN expenses.marked_at IS 'Timestamp when the expense was marked for review';
COMMENT ON COLUMN expenses.marked_by IS 'ID of the cashier who marked the expense';

COMMENT ON COLUMN sales.customer_id IS 'Reference to partial_payment_customers table (for tracking all customer sales, not just partial payments)';
COMMENT ON COLUMN sales.customer_name IS 'Customer name for quick reference';
COMMENT ON COLUMN sales.customer_phone IS 'Customer phone for quick reference and searching';
COMMENT ON COLUMN sales.customer_cnic IS 'Customer CNIC for identification';
