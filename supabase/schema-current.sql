


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_restock_expense"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  product_name TEXT;
  is_new_product BOOLEAN;
  expense_description TEXT;
  batch_count INTEGER;
  expense_amount NUMERIC(10,2);
BEGIN
  IF NEW.is_initial_stock = FALSE THEN
    SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
    
    SELECT COUNT(*) INTO batch_count 
    FROM stock_batches 
    WHERE product_id = NEW.product_id 
      AND store_id = NEW.store_id
      AND id != NEW.id;
    
    is_new_product := (batch_count = 0);
    
    expense_amount := COALESCE(NEW.amount_paid, NEW.cost_price * NEW.quantity_purchased);
    
    IF expense_amount = 0 THEN
      expense_amount := NEW.cost_price * NEW.quantity_purchased;
    END IF;
    
    IF is_new_product THEN
      expense_description := 'New Product: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    ELSE
      expense_description := 'Restock: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' - Batch #' || NEW.batch_number || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    END IF;
    
    INSERT INTO expenses (
      store_id, category, description, amount, expense_date, reference_id, payment_method
    ) VALUES (
      NEW.store_id,
      CASE WHEN is_new_product THEN 'new_product' ELSE 'inventory_restock' END,
      expense_description,
      expense_amount,
      NEW.purchase_date::date,
      NEW.id,
      COALESCE(NEW.payment_method, 'Cash')
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_restock_expense"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer DEFAULT NULL::integer) RETURNS TABLE("batch_id" integer, "quantity_deducted" integer, "batch_cost_price" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  remaining_qty INTEGER := p_quantity;
  batch RECORD;
  deduct_qty INTEGER;
BEGIN
  -- Loop through batches in FIFO order (oldest first)
  FOR batch IN 
    SELECT id, quantity_remaining, stock_batches.cost_price
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
    SET quantity_remaining = stock_batches.quantity_remaining - deduct_qty,
        is_depleted = (stock_batches.quantity_remaining - deduct_qty = 0),
        depleted_at = CASE WHEN (stock_batches.quantity_remaining - deduct_qty = 0) THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = batch.id;
    
    -- Return deduction info
    batch_id := batch.id;
    quantity_deducted := deduct_qty;
    batch_cost_price := batch.cost_price;
    RETURN NEXT;
    
    remaining_qty := remaining_qty - deduct_qty;
  END LOOP;
  
  -- NOTE: No need to manually update aggregated_stock here
  -- The update_aggregated_stock trigger will automatically recalculate it
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer) IS 'Deducts stock using FIFO (First In, First Out) method. Works with new aggregated_stock schema.';



CREATE OR REPLACE FUNCTION "public"."generate_batch_number"("p_store_id" integer, "p_product_id" integer) RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  batch_count INTEGER;
  product_code VARCHAR(10);
BEGIN
  -- Count existing batches for this product
  SELECT COUNT(*) INTO batch_count 
  FROM stock_batches 
  WHERE product_id = p_product_id AND store_id = p_store_id;
  
  -- Get product first 3 chars or id
  SELECT COALESCE(UPPER(SUBSTRING(name FROM 1 FOR 3)), id::VARCHAR)
  INTO product_code
  FROM products 
  WHERE id = p_product_id;
  
  -- Format: PROD-XXX-YYYYMMDD-NNN
  RETURN product_code || '-' || 
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD((batch_count + 1)::VARCHAR, 3, '0');
END;
$$;


ALTER FUNCTION "public"."generate_batch_number"("p_store_id" integer, "p_product_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_store_code"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    code VARCHAR(3);
    chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    is_unique BOOLEAN := FALSE;
BEGIN
    WHILE NOT is_unique LOOP
        code := '';
        FOR i IN 1..3 LOOP
            code := code || substr(chars, floor(random() * 36 + 1)::integer, 1);
        END LOOP;
        
        SELECT NOT EXISTS (SELECT 1 FROM stores WHERE store_code = code) INTO is_unique;
    END LOOP;
    
    RETURN code;
END;
$$;


ALTER FUNCTION "public"."generate_store_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_sale_number"("p_store_id" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Advisory lock scoped to transaction prevents concurrent duplicates
  PERFORM pg_advisory_xact_lock(p_store_id);
  
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$$;


ALTER FUNCTION "public"."get_next_sale_number"("p_store_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_next_sale_number"("p_store_id" integer) IS 'Returns the next available sale number for a specific store';



CREATE OR REPLACE FUNCTION "public"."get_user_store_id"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_store_id INTEGER;
BEGIN
    -- Try to get from managers table (Supabase Auth users)
    SELECT store_id INTO user_store_id 
    FROM managers 
    WHERE id = auth.uid();
    
    RETURN user_store_id;
END;
$$;


ALTER FUNCTION "public"."get_user_store_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_cashier_password"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2%' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."hash_cashier_password"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revert_sale_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sale_item RECORD;
  batch_record RECORD;
  remaining_qty INTEGER;
BEGIN
  -- For each item in the deleted sale, restore stock
  FOR sale_item IN 
    SELECT si.product_id, si.quantity, si.product_sku
    FROM sale_items si
    WHERE si.sale_id = OLD.id
  LOOP
    -- Find the most recent depleted or partially depleted batch for this product
    -- to restore stock in FIFO reverse order
    remaining_qty := sale_item.quantity;
    
    FOR batch_record IN
      SELECT id, quantity_remaining, quantity_purchased
      FROM stock_batches
      WHERE product_id = sale_item.product_id 
        AND store_id = OLD.store_id
      ORDER BY purchase_date DESC
    LOOP
      EXIT WHEN remaining_qty <= 0;
      
      -- Restore stock to this batch
      UPDATE stock_batches
      SET 
        quantity_remaining = quantity_remaining + LEAST(remaining_qty, quantity_purchased - quantity_remaining),
        is_depleted = FALSE,
        depleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = batch_record.id;
      
      remaining_qty := remaining_qty - LEAST(remaining_qty, quantity_purchased - batch_record.quantity_remaining);
    END LOOP;
    
    -- Update product IMEIs if applicable
    UPDATE product_imeis
    SET 
      status = 'in_stock',
      sold_at = NULL,
      sale_id = NULL
    WHERE sale_id = OLD.id AND product_id = sale_item.product_id;
  END LOOP;
  
  -- Note: The sale_items will be automatically deleted by CASCADE
  -- The revenue adjustment should be done in the application layer
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."revert_sale_deletion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revert_sale_deletion"() IS 'Restores stock quantities when a sale is deleted';



CREATE OR REPLACE FUNCTION "public"."set_sale_number_store"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only set if not already provided
  IF NEW.sale_number_store IS NULL THEN
    NEW.sale_number_store := get_next_sale_number(NEW.store_id);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sale_number_store"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_aggregated_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_product_id INTEGER;
  v_store_id INTEGER;
  v_total_purchased INTEGER;
  v_total_remaining INTEGER;
  v_total_sold INTEGER;
  v_weighted_cost NUMERIC(10, 2);
  v_weighted_selling NUMERIC(10, 2);
  v_weighted_lowest NUMERIC(10, 2);
  v_total_cost_value NUMERIC(12, 2);
  v_total_selling_value NUMERIC(12, 2);
  v_total_lowest_value NUMERIC(12, 2);
BEGIN
  -- Determine which product to update
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
    v_store_id := OLD.store_id;
  ELSE
    v_product_id := NEW.product_id;
    v_store_id := NEW.store_id;
  END IF;

  -- Calculate aggregated values from all batches of this product
  SELECT 
    COALESCE(SUM(quantity_purchased), 0),
    COALESCE(SUM(quantity_remaining), 0),
    COALESCE(SUM(quantity_purchased - quantity_remaining), 0),
    COALESCE(SUM(cost_price * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(selling_price, 0) * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(lowest_negotiable_price, 0) * quantity_remaining), 0)
  INTO 
    v_total_purchased,
    v_total_remaining,
    v_total_sold,
    v_total_cost_value,
    v_total_selling_value,
    v_total_lowest_value
  FROM stock_batches
  WHERE product_id = v_product_id 
    AND store_id = v_store_id
    AND NOT is_depleted;

  -- Calculate weighted averages (avoid division by zero)
  IF v_total_remaining > 0 THEN
    v_weighted_cost := v_total_cost_value / v_total_remaining;
    v_weighted_selling := v_total_selling_value / v_total_remaining;
    v_weighted_lowest := v_total_lowest_value / v_total_remaining;
  ELSE
    v_weighted_cost := 0;
    v_weighted_selling := 0;
    v_weighted_lowest := 0;
  END IF;

  -- Upsert aggregated_stock record
  INSERT INTO aggregated_stock (
    product_id,
    store_id,
    aggregated_cost_price,
    aggregated_selling_price,
    aggregated_lowest_negotiable,
    total_quantity_purchased,
    total_quantity_remaining,
    total_quantity_sold,
    updated_at
  ) VALUES (
    v_product_id,
    v_store_id,
    v_weighted_cost,
    v_weighted_selling,
    v_weighted_lowest,
    v_total_purchased,
    v_total_remaining,
    v_total_sold,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (product_id, store_id) 
  DO UPDATE SET
    aggregated_cost_price = EXCLUDED.aggregated_cost_price,
    aggregated_selling_price = EXCLUDED.aggregated_selling_price,
    aggregated_lowest_negotiable = EXCLUDED.aggregated_lowest_negotiable,
    total_quantity_purchased = EXCLUDED.total_quantity_purchased,
    total_quantity_remaining = EXCLUDED.total_quantity_remaining,
    total_quantity_sold = EXCLUDED.total_quantity_sold,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_aggregated_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_predefined_expenses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_predefined_expenses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_quotation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_quotation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_receipt_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_receipt_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supplier_khaata_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_supplier_khaata_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_cashier_login"("identifier" "text", "password_input" "text") RETURNS TABLE("id" integer, "full_name" character varying, "phone_number" character varying, "store_id" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone_number,
        c.store_id
    FROM cashier_accounts c
    WHERE 
        -- Exact match on full_name (case-insensitive) OR exact match on phone_number
        (LOWER(c.full_name) = LOWER(identifier) OR c.phone_number = identifier)
        AND c.password_hash = crypt(password_input, c.password_hash)
        AND c.is_active = true
        AND c.store_id IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."verify_cashier_login"("identifier" "text", "password_input" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."aggregated_stock" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "aggregated_cost_price" numeric(10,2) DEFAULT 0,
    "aggregated_selling_price" numeric(10,2) DEFAULT 0,
    "aggregated_lowest_negotiable" numeric(10,2) DEFAULT 0,
    "total_quantity_purchased" integer DEFAULT 0 NOT NULL,
    "total_quantity_remaining" integer DEFAULT 0 NOT NULL,
    "total_quantity_sold" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aggregated_stock_cost_price_check" CHECK (("aggregated_cost_price" >= (0)::numeric)),
    CONSTRAINT "aggregated_stock_lowest_negotiable_check" CHECK (("aggregated_lowest_negotiable" >= (0)::numeric)),
    CONSTRAINT "aggregated_stock_quantities_check" CHECK ((("total_quantity_remaining" >= 0) AND ("total_quantity_remaining" <= "total_quantity_purchased"))),
    CONSTRAINT "aggregated_stock_selling_price_check" CHECK (("aggregated_selling_price" >= (0)::numeric)),
    CONSTRAINT "aggregated_stock_threshold_check" CHECK (("low_stock_threshold" >= 0))
);


ALTER TABLE "public"."aggregated_stock" OWNER TO "postgres";


COMMENT ON TABLE "public"."aggregated_stock" IS 'Stores aggregated stock data with weighted average prices calculated from stock_batches';



CREATE SEQUENCE IF NOT EXISTS "public"."aggregated_stock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."aggregated_stock_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."aggregated_stock_id_seq" OWNED BY "public"."aggregated_stock"."id";



CREATE TABLE IF NOT EXISTS "public"."cashier_accounts" (
    "id" integer NOT NULL,
    "full_name" character varying(100) NOT NULL,
    "phone_number" character varying(11),
    "password_hash" character varying(255) NOT NULL,
    "role" character varying(20) DEFAULT 'Cashier'::character varying,
    "store_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "is_active" boolean DEFAULT true,
    CONSTRAINT "cashier_accounts_role_check" CHECK ((("role")::"text" = 'Cashier'::"text"))
);


ALTER TABLE "public"."cashier_accounts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cashier_accounts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cashier_accounts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cashier_accounts_id_seq" OWNED BY "public"."cashier_accounts"."id";



CREATE TABLE IF NOT EXISTS "public"."cashiers" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "commission_rate" numeric(5,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "salary" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."cashiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."cashiers" IS 'Stores cashier information for each store';



COMMENT ON COLUMN "public"."cashiers"."commission_rate" IS 'Commission rate as percentage (e.g., 5.50 for 5.5%)';



COMMENT ON COLUMN "public"."cashiers"."salary" IS 'Monthly salary for the cashier';



CREATE SEQUENCE IF NOT EXISTS "public"."cashiers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cashiers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cashiers_id_seq" OWNED BY "public"."cashiers"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "requires_imei" boolean DEFAULT false
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."categories"."requires_imei" IS 'If true, all products in this category will require IMEI tracking (for phones, tablets, etc.)';



CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."customer_payments" (
    "id" integer NOT NULL,
    "partial_payment_customer_id" integer NOT NULL,
    "sale_id" integer,
    "customer_name" character varying(100) NOT NULL,
    "customer_phone" character varying(20),
    "payment_amount" numeric(10,2) NOT NULL,
    "payment_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "payment_method" character varying(20) DEFAULT 'Cash'::character varying,
    "notes" "text",
    "store_id" integer NOT NULL,
    "recorded_by" "uuid",
    "cashier_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_payments_payment_amount_check" CHECK (("payment_amount" > (0)::numeric)),
    CONSTRAINT "customer_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY (ARRAY[('Cash'::character varying)::"text", ('Digital'::character varying)::"text"]))),
    CONSTRAINT "customer_payments_recorder_check" CHECK (((("recorded_by" IS NOT NULL) AND ("cashier_id" IS NULL)) OR (("recorded_by" IS NULL) AND ("cashier_id" IS NOT NULL))))
);


ALTER TABLE "public"."customer_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_payments" IS 'Tracks customer dues payments made on their partial payment accounts';



CREATE SEQUENCE IF NOT EXISTS "public"."customer_payments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_payments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customer_payments_id_seq" OWNED BY "public"."customer_payments"."id";



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" integer NOT NULL,
    "description" character varying(255) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category" character varying(50),
    "expense_date" "date" NOT NULL,
    "recorded_by" "uuid",
    "store_id" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "reference_id" integer,
    "payment_method" character varying(20) DEFAULT 'Cash'::character varying,
    "marked_for_review" boolean DEFAULT false,
    "review_note" "text",
    "marked_at" timestamp without time zone,
    "marked_by" character varying(255),
    "recorded_by_cashier_id" integer,
    "cashier_ref_id" integer,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "expenses_payment_method_check" CHECK ((("payment_method")::"text" = ANY (ARRAY[('Cash'::character varying)::"text", ('Digital'::character varying)::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."expenses"."category" IS 'Expense category: new_product (first batch of product), inventory_restock (subsequent batches), or other categories';



COMMENT ON COLUMN "public"."expenses"."recorded_by" IS 'UUID of manager who recorded this expense (if applicable)';



COMMENT ON COLUMN "public"."expenses"."reference_id" IS 'Links expense to related record. For inventory_restock category, this is the stock_batch_id.';



COMMENT ON COLUMN "public"."expenses"."payment_method" IS 'Payment method used for the expense (Cash or Digital)';



COMMENT ON COLUMN "public"."expenses"."marked_for_review" IS 'Flag indicating if cashier marked this expense for manager review';



COMMENT ON COLUMN "public"."expenses"."review_note" IS 'Note explaining why the expense was marked for review';



COMMENT ON COLUMN "public"."expenses"."marked_at" IS 'Timestamp when the expense was marked for review';



COMMENT ON COLUMN "public"."expenses"."marked_by" IS 'ID of the cashier who marked the expense';



COMMENT ON COLUMN "public"."expenses"."recorded_by_cashier_id" IS 'ID of cashier who recorded this expense (if applicable)';



COMMENT ON COLUMN "public"."expenses"."cashier_ref_id" IS 'Reference to the staff member (from cashiers table) who recorded the expense';



CREATE OR REPLACE VIEW "public"."expense_summary" AS
 SELECT "store_id",
    "category",
    "date_trunc"('day'::"text", ("expense_date")::timestamp with time zone) AS "expense_day",
    "date_trunc"('month'::"text", ("expense_date")::timestamp with time zone) AS "expense_month",
    "date_trunc"('year'::"text", ("expense_date")::timestamp with time zone) AS "expense_year",
    "count"(*) AS "transaction_count",
    "sum"("amount") AS "total_amount"
   FROM "public"."expenses"
  GROUP BY "store_id", "category", ("date_trunc"('day'::"text", ("expense_date")::timestamp with time zone)), ("date_trunc"('month'::"text", ("expense_date")::timestamp with time zone)), ("date_trunc"('year'::"text", ("expense_date")::timestamp with time zone));


ALTER VIEW "public"."expense_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."expense_summary" IS 'Aggregated expense data by store, category, and time period for reporting';



CREATE SEQUENCE IF NOT EXISTS "public"."expenses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."expenses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."expenses_id_seq" OWNED BY "public"."expenses"."id";



CREATE TABLE IF NOT EXISTS "public"."initial_customer_entries" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "customer_name" character varying(100) NOT NULL,
    "customer_cnic" character varying(20),
    "customer_phone" character varying(20),
    "amount_owed" numeric(10,2) NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "initial_customer_entries_amount_owed_check" CHECK (("amount_owed" >= (0)::numeric))
);


ALTER TABLE "public"."initial_customer_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."initial_customer_entries" IS 'Initial customer balances when migrating to this POS - customers who owe money';



COMMENT ON COLUMN "public"."initial_customer_entries"."amount_owed" IS 'Amount customer owes at migration time - does not affect profit/loss';



CREATE SEQUENCE IF NOT EXISTS "public"."initial_customer_entries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."initial_customer_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."initial_customer_entries_id_seq" OWNED BY "public"."initial_customer_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."initial_supplier_entries" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "supplier_name" character varying(100) NOT NULL,
    "contact_person" character varying(100),
    "supplier_phone" character varying(20),
    "supplier_email" character varying(100),
    "address" "text",
    "amount_owed" numeric(10,2) NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "initial_supplier_entries_amount_owed_check" CHECK (("amount_owed" >= (0)::numeric))
);


ALTER TABLE "public"."initial_supplier_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."initial_supplier_entries" IS 'Initial supplier balances when migrating to this POS - suppliers to whom we owe money';



COMMENT ON COLUMN "public"."initial_supplier_entries"."amount_owed" IS 'Amount we owe supplier at migration time - does not affect profit/loss';



CREATE SEQUENCE IF NOT EXISTS "public"."initial_supplier_entries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."initial_supplier_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."initial_supplier_entries_id_seq" OWNED BY "public"."initial_supplier_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" integer NOT NULL,
    "sku" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "category" character varying(50),
    "store_id" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "category_id" integer,
    "subcategory_id" integer,
    "is_phone" boolean DEFAULT false,
    "barcode" character varying(100)
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."barcode" IS 'Barcode for non-phone products. For phones, use IMEI from product_imeis table.';



CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" integer NOT NULL,
    "category_id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."inventory_view" AS
 SELECT "p"."id" AS "product_id",
    "p"."sku",
    "p"."name" AS "product_name",
    "p"."description",
    "p"."category",
    "p"."store_id",
    "p"."is_active",
    "p"."is_phone",
    "c"."id" AS "category_id",
    "c"."name" AS "category_name",
    "sc"."id" AS "subcategory_id",
    "sc"."name" AS "subcategory_name",
    COALESCE("agg"."aggregated_cost_price", (0)::numeric) AS "cost_price",
    COALESCE("agg"."aggregated_selling_price", (0)::numeric) AS "selling_price",
    COALESCE("agg"."aggregated_lowest_negotiable", (0)::numeric) AS "min_price",
    COALESCE("agg"."total_quantity_purchased", 0) AS "total_quantity_purchased",
    COALESCE("agg"."total_quantity_remaining", 0) AS "stock_quantity",
    COALESCE("agg"."total_quantity_sold", 0) AS "total_quantity_sold",
    COALESCE("agg"."low_stock_threshold", 10) AS "low_stock_threshold",
    "p"."created_at",
    "p"."updated_at",
    "agg"."updated_at" AS "last_stock_update"
   FROM ((("public"."products" "p"
     LEFT JOIN "public"."aggregated_stock" "agg" ON ((("agg"."product_id" = "p"."id") AND ("agg"."store_id" = "p"."store_id"))))
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "p"."category_id")))
     LEFT JOIN "public"."subcategories" "sc" ON (("sc"."id" = "p"."subcategory_id")))
  WHERE ("p"."is_active" = true);


ALTER VIEW "public"."inventory_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."inventory_view" IS 'Virtual inventory table showing products with aggregated stock and pricing data';



CREATE TABLE IF NOT EXISTS "public"."join_requests" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "user_id" "text" NOT NULL,
    "user_type" character varying(20) NOT NULL,
    "user_name" character varying(100) NOT NULL,
    "user_phone" character varying(11) NOT NULL,
    "user_email" character varying(100),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "requested_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp without time zone,
    "notes" "text",
    CONSTRAINT "join_requests_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('approved'::character varying)::"text", ('rejected'::character varying)::"text"]))),
    CONSTRAINT "join_requests_user_type_check" CHECK ((("user_type")::"text" = ANY (ARRAY[('Manager'::character varying)::"text", ('Cashier'::character varying)::"text"])))
);


ALTER TABLE "public"."join_requests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."join_requests_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."join_requests_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."join_requests_id_seq" OWNED BY "public"."join_requests"."id";



CREATE TABLE IF NOT EXISTS "public"."managers" (
    "id" "uuid" NOT NULL,
    "email" character varying(100) NOT NULL,
    "full_name" character varying(100) NOT NULL,
    "phone_number" character varying(11) NOT NULL,
    "store_name" character varying(100),
    "store_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "is_active" boolean DEFAULT true,
    "store_code" character varying(20)
);


ALTER TABLE "public"."managers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_withdrawals" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "withdrawal_from" character varying(20) NOT NULL,
    "description" "text",
    "withdrawal_date" "date" NOT NULL,
    "recorded_by" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_withdrawals_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "owner_withdrawals_withdrawal_from_check" CHECK ((("withdrawal_from")::"text" = ANY ((ARRAY['Cash'::character varying, 'Bank'::character varying])::"text"[])))
);


ALTER TABLE "public"."owner_withdrawals" OWNER TO "postgres";


COMMENT ON TABLE "public"."owner_withdrawals" IS 'Tracks owner capital withdrawals. These do NOT affect profit/loss - only cash/bank balance.';



CREATE SEQUENCE IF NOT EXISTS "public"."owner_withdrawals_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."owner_withdrawals_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."owner_withdrawals_id_seq" OWNED BY "public"."owner_withdrawals"."id";



CREATE TABLE IF NOT EXISTS "public"."partial_payment_customers" (
    "id" integer NOT NULL,
    "sale_id" integer NOT NULL,
    "customer_name" character varying(100) NOT NULL,
    "customer_cnic" character varying(20),
    "customer_phone" character varying(20),
    "total_amount" numeric(10,2) NOT NULL,
    "amount_paid" numeric(10,2) NOT NULL,
    "amount_remaining" numeric(10,2) NOT NULL,
    "store_id" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partial_payment_customers_amount_paid_check" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "partial_payment_customers_amount_remaining_check" CHECK (("amount_remaining" >= (0)::numeric)),
    CONSTRAINT "partial_payment_customers_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."partial_payment_customers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."partial_payment_customers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."partial_payment_customers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."partial_payment_customers_id_seq" OWNED BY "public"."partial_payment_customers"."id";



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" integer NOT NULL,
    "sale_id" integer,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(20),
    "payment_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "manager_id" "uuid",
    "store_id" integer NOT NULL,
    "cashier_id" integer,
    CONSTRAINT "payments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_recorder_check" CHECK (((("manager_id" IS NOT NULL) AND ("cashier_id" IS NULL)) OR (("manager_id" IS NULL) AND ("cashier_id" IS NOT NULL))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payments_id_seq" OWNED BY "public"."payments"."id";



CREATE TABLE IF NOT EXISTS "public"."predefined_expenses" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "category" character varying(100) NOT NULL,
    "default_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."predefined_expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."predefined_expenses" IS 'Pre-defined expense templates that can be quickly selected when recording expenses. Helps with recurring expenses like rent, utilities, etc.';



CREATE SEQUENCE IF NOT EXISTS "public"."predefined_expenses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."predefined_expenses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."predefined_expenses_id_seq" OWNED BY "public"."predefined_expenses"."id";



CREATE TABLE IF NOT EXISTS "public"."product_imeis" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "batch_id" integer,
    "store_id" integer NOT NULL,
    "imei_number" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'in_stock'::character varying,
    "sold_at" timestamp with time zone,
    "sale_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_imeis" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_imeis" IS 'Tracks IMEI numbers for phone products';



CREATE SEQUENCE IF NOT EXISTS "public"."product_imeis_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_imeis_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_imeis_id_seq" OWNED BY "public"."product_imeis"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."quotation_audit_logs" (
    "id" integer NOT NULL,
    "quotation_id" integer NOT NULL,
    "action" character varying(50) NOT NULL,
    "user_id" "uuid",
    "cashier_id" integer,
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quotation_audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quotation_audit_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quotation_audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."quotation_audit_logs_id_seq" OWNED BY "public"."quotation_audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "id" integer NOT NULL,
    "quotation_id" integer NOT NULL,
    "product_id" integer,
    "product_name" character varying(255) NOT NULL,
    "product_sku" character varying(100),
    "product_description" "text",
    "product_category" character varying(100),
    "quantity" numeric(10,3) NOT NULL,
    "unit_price" numeric(15,2) NOT NULL,
    "line_total" numeric(15,2) NOT NULL,
    "discount_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_manual_item" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quotation_items_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "quotation_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quotation_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quotation_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."quotation_items_id_seq" OWNED BY "public"."quotation_items"."id";



CREATE TABLE IF NOT EXISTS "public"."quotation_sequences" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "year" integer NOT NULL,
    "last_sequence" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."quotation_sequences" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quotation_sequences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quotation_sequences_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."quotation_sequences_id_seq" OWNED BY "public"."quotation_sequences"."id";



CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" integer NOT NULL,
    "quotation_number" character varying(50) NOT NULL,
    "customer_name" character varying(255),
    "customer_phone" character varying(50),
    "customer_email" character varying(255),
    "customer_address" "text",
    "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_type" character varying(20) DEFAULT 'none'::character varying NOT NULL,
    "discount_value" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "total" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms_and_conditions" "text",
    "valid_until" "date",
    "status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "store_id" integer NOT NULL,
    "created_by" "uuid",
    "created_by_cashier_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finalized_at" timestamp with time zone,
    "finalized_by" "uuid",
    "finalized_by_cashier_id" integer,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deleted_by_cashier_id" integer,
    CONSTRAINT "quotations_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "quotations_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['none'::character varying, 'fixed'::character varying, 'percentage'::character varying])::"text"[]))),
    CONSTRAINT "quotations_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "quotations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'finalized'::character varying, 'expired'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "quotations_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quotations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quotations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."quotations_id_seq" OWNED BY "public"."quotations"."id";



CREATE TABLE IF NOT EXISTS "public"."receipt_settings" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "business_name" "text" DEFAULT 'My Store'::"text" NOT NULL,
    "business_address" "text",
    "business_phone" "text",
    "business_email" "text",
    "tax_id" "text",
    "logo_url" "text",
    "default_format" "text" DEFAULT 'pdf'::"text" NOT NULL,
    "thermal_paper_width" "text" DEFAULT '80mm'::"text" NOT NULL,
    "auto_print" boolean DEFAULT false NOT NULL,
    "show_logo" boolean DEFAULT true NOT NULL,
    "show_tax_id" boolean DEFAULT true NOT NULL,
    "thank_you_message" "text" DEFAULT 'Thank you for your purchase!'::"text" NOT NULL,
    "return_policy" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "receipt_settings_default_format_check" CHECK (("default_format" = ANY (ARRAY['pdf'::"text", 'thermal'::"text"]))),
    CONSTRAINT "receipt_settings_thermal_paper_width_check" CHECK (("thermal_paper_width" = ANY (ARRAY['58mm'::"text", '80mm'::"text"])))
);


ALTER TABLE "public"."receipt_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."receipt_settings" IS 'Stores receipt printing configuration for each store including branding and preferences';



CREATE SEQUENCE IF NOT EXISTS "public"."receipt_settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receipt_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."receipt_settings_id_seq" OWNED BY "public"."receipt_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."sale_items" (
    "id" integer NOT NULL,
    "sale_id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "product_sku" character varying(50) NOT NULL,
    "product_name" character varying(100) NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "cost_price_snapshot" numeric(10,2),
    "subtotal" numeric(10,2) NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_items_cost_price_snapshot_check" CHECK (("cost_price_snapshot" >= (0)::numeric)),
    CONSTRAINT "sale_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sale_items_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "sale_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."sale_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sale_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sale_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sale_items_id_seq" OWNED BY "public"."sale_items"."id";



CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" integer NOT NULL,
    "sale_number" character varying(50) NOT NULL,
    "sale_description" character varying(255),
    "cashier_id" "uuid",
    "total_amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(20),
    "payment_status" character varying(20),
    "amount_paid" numeric(10,2) DEFAULT 0,
    "amount_due" numeric(10,2) DEFAULT 0,
    "sale_date" timestamp with time zone,
    "store_id" integer NOT NULL,
    "notes" "text",
    "discount_type" character varying(20) DEFAULT 'none'::character varying NOT NULL,
    "discount_value" numeric(10,2) DEFAULT 0,
    "cashier_ref_id" integer,
    "marked_for_review" boolean DEFAULT false,
    "review_reason" "text",
    "marked_by_cashier_id" integer,
    "marked_at" timestamp without time zone,
    "customer_id" integer,
    "customer_name" character varying(100),
    "customer_phone" character varying(20),
    "customer_cnic" character varying(20),
    "sale_number_store" integer NOT NULL,
    CONSTRAINT "sales_amount_due_check" CHECK (("amount_due" >= (0)::numeric)),
    CONSTRAINT "sales_amount_paid_check" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "sales_discount_type_check" CHECK ((("discount_type")::"text" = ANY (ARRAY[('percentage'::character varying)::"text", ('amount'::character varying)::"text", ('none'::character varying)::"text"]))),
    CONSTRAINT "sales_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "sales_payment_method_check" CHECK ((("payment_method")::"text" = ANY (ARRAY[('Cash'::character varying)::"text", ('Digital'::character varying)::"text"]))),
    CONSTRAINT "sales_payment_status_check" CHECK ((("payment_status")::"text" = ANY (ARRAY[('Paid'::character varying)::"text", ('Partial'::character varying)::"text", ('Pending'::character varying)::"text"]))),
    CONSTRAINT "sales_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales"."cashier_ref_id" IS 'Reference to the cashier who made the sale (from cashiers table)';



COMMENT ON COLUMN "public"."sales"."marked_for_review" IS 'Flag indicating if cashier marked this sale for manager review';



COMMENT ON COLUMN "public"."sales"."review_reason" IS 'Reason provided by cashier for marking the sale';



COMMENT ON COLUMN "public"."sales"."marked_by_cashier_id" IS 'Cashier who marked the sale for review';



COMMENT ON COLUMN "public"."sales"."marked_at" IS 'Timestamp when sale was marked for review';



COMMENT ON COLUMN "public"."sales"."customer_id" IS 'Reference to partial_payment_customers table (for tracking all customer sales, not just partial payments)';



COMMENT ON COLUMN "public"."sales"."customer_name" IS 'Customer name for quick reference';



COMMENT ON COLUMN "public"."sales"."customer_phone" IS 'Customer phone for quick reference and searching';



COMMENT ON COLUMN "public"."sales"."customer_cnic" IS 'Customer CNIC for identification';



COMMENT ON COLUMN "public"."sales"."sale_number_store" IS 'Sequential sale number within the store (1, 2, 3, ...)';



CREATE SEQUENCE IF NOT EXISTS "public"."sales_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sales_id_seq" OWNED BY "public"."sales"."id";



CREATE TABLE IF NOT EXISTS "public"."stock_batches" (
    "id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "supplier_id" integer,
    "batch_number" character varying(50),
    "purchase_date" timestamp with time zone DEFAULT "now"(),
    "cost_price" numeric(10,2) NOT NULL,
    "quantity_purchased" integer NOT NULL,
    "quantity_remaining" integer NOT NULL,
    "is_depleted" boolean DEFAULT false,
    "depleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "selling_price" numeric(10,2),
    "lowest_negotiable_price" numeric(10,2),
    "is_initial_stock" boolean DEFAULT false,
    "payment_method" character varying(20) DEFAULT 'Cash'::character varying,
    "amount_paid" numeric(10,2) DEFAULT 0,
    CONSTRAINT "check_remaining_qty" CHECK ((("quantity_remaining" >= 0) AND ("quantity_remaining" <= "quantity_purchased"))),
    CONSTRAINT "stock_batches_lowest_negotiable_check" CHECK (("lowest_negotiable_price" >= (0)::numeric)),
    CONSTRAINT "stock_batches_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['Cash'::character varying, 'Digital'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_batches" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_batches" IS 'Tracks individual stock purchases for FIFO inventory management';



COMMENT ON COLUMN "public"."stock_batches"."selling_price" IS 'Selling price (target price) set during this specific restock. Used for weighted average calculation.';



COMMENT ON COLUMN "public"."stock_batches"."lowest_negotiable_price" IS 'Minimum acceptable selling price for this batch';



COMMENT ON COLUMN "public"."stock_batches"."is_initial_stock" IS 'TRUE for stock added during initial store setup (not counted as expense). FALSE for regular restocking (counted as expense).';



COMMENT ON COLUMN "public"."stock_batches"."payment_method" IS 'Payment method used for purchasing this stock batch (Cash or Digital)';



COMMENT ON COLUMN "public"."stock_batches"."amount_paid" IS 'Amount actually paid to supplier. Used for expense tracking. If less than total cost, remainder goes to supplier_khaata.';



CREATE SEQUENCE IF NOT EXISTS "public"."stock_batches_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stock_batches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stock_batches_id_seq" OWNED BY "public"."stock_batches"."id";



CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" integer NOT NULL,
    "store_code" character varying(3) NOT NULL,
    "store_name" character varying(100) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "is_active" boolean DEFAULT true,
    "currency" character varying(10) DEFAULT 'PKR'::character varying NOT NULL,
    "logo_url" "text"
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stores"."currency" IS 'Store currency code (e.g., PKR, USD, EUR, GBP, INR)';



CREATE SEQUENCE IF NOT EXISTS "public"."stores_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stores_id_seq" OWNED BY "public"."stores"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."subcategories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."subcategories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subcategories_id_seq" OWNED BY "public"."subcategories"."id";



CREATE TABLE IF NOT EXISTS "public"."supplier_khaata" (
    "id" integer NOT NULL,
    "stock_batch_id" integer NOT NULL,
    "supplier_id" integer NOT NULL,
    "supplier_name" character varying(100) NOT NULL,
    "supplier_phone" character varying(20),
    "supplier_contact" character varying(255),
    "total_amount" numeric(10,2) NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_remaining" numeric(10,2) NOT NULL,
    "store_id" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_khaata_amount_paid_check" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "supplier_khaata_amount_remaining_check" CHECK (("amount_remaining" >= (0)::numeric)),
    CONSTRAINT "supplier_khaata_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."supplier_khaata" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supplier_khaata_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supplier_khaata_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supplier_khaata_id_seq" OWNED BY "public"."supplier_khaata"."id";



CREATE TABLE IF NOT EXISTS "public"."supplier_khaata_payments" (
    "id" integer NOT NULL,
    "supplier_khaata_id" integer NOT NULL,
    "supplier_name" character varying(100) NOT NULL,
    "supplier_phone" character varying(20),
    "payment_amount" numeric(10,2) NOT NULL,
    "payment_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "payment_method" character varying(20) DEFAULT 'Cash'::character varying,
    "notes" "text",
    "store_id" integer NOT NULL,
    "recorded_by" "uuid",
    "cashier_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_khaata_payments_payment_amount_check" CHECK (("payment_amount" > (0)::numeric)),
    CONSTRAINT "supplier_khaata_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY (ARRAY[('Cash'::character varying)::"text", ('Digital'::character varying)::"text"]))),
    CONSTRAINT "supplier_khaata_payments_recorder_check" CHECK (((("recorded_by" IS NOT NULL) AND ("cashier_id" IS NULL)) OR (("recorded_by" IS NULL) AND ("cashier_id" IS NOT NULL))))
);


ALTER TABLE "public"."supplier_khaata_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_khaata_payments" IS 'Tracks supplier dues payments made on their khaata accounts';



CREATE SEQUENCE IF NOT EXISTS "public"."supplier_khaata_payments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supplier_khaata_payments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supplier_khaata_payments_id_seq" OWNED BY "public"."supplier_khaata_payments"."id";



CREATE OR REPLACE VIEW "public"."supplier_khaata_summary" AS
 SELECT "supplier_id",
    "supplier_name",
    "supplier_phone",
    "store_id",
    "count"("id") AS "total_transactions",
    "sum"("total_amount") AS "total_amount",
    "sum"("amount_paid") AS "total_paid",
    "sum"("amount_remaining") AS "total_remaining",
    "min"("created_at") AS "first_transaction",
    "max"("updated_at") AS "last_updated"
   FROM "public"."supplier_khaata" "sk"
  GROUP BY "supplier_id", "supplier_name", "supplier_phone", "store_id";


ALTER VIEW "public"."supplier_khaata_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_payments" (
    "id" integer NOT NULL,
    "supplier_id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(20) DEFAULT 'Cash'::character varying,
    "payment_date" timestamp without time zone DEFAULT "now"(),
    "recorded_by_manager_id" "uuid",
    "recorded_by_cashier_id" integer,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "supplier_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY (ARRAY[('Cash'::character varying)::"text", ('Digital'::character varying)::"text"])))
);


ALTER TABLE "public"."supplier_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_payments" IS 'Tracks all payments made to suppliers';



CREATE SEQUENCE IF NOT EXISTS "public"."supplier_payments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supplier_payments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supplier_payments_id_seq" OWNED BY "public"."supplier_payments"."id";



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" integer NOT NULL,
    "store_id" integer NOT NULL,
    "supplier_name" character varying(255) NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "email" character varying(255),
    "address" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "balance_owed" numeric(10,2) DEFAULT 0,
    "initial_balance" numeric(10,2) DEFAULT 0,
    "last_payment_date" timestamp without time zone,
    "total_paid" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."suppliers" IS 'Stores supplier/vendor information with unique phone numbers per store';



COMMENT ON COLUMN "public"."suppliers"."balance_owed" IS 'Current outstanding balance owed to this supplier';



COMMENT ON COLUMN "public"."suppliers"."initial_balance" IS 'Initial balance when supplier was added (for migration)';



COMMENT ON COLUMN "public"."suppliers"."last_payment_date" IS 'Date of last payment to supplier';



COMMENT ON COLUMN "public"."suppliers"."total_paid" IS 'Total amount paid to supplier over time';



CREATE SEQUENCE IF NOT EXISTS "public"."suppliers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."suppliers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."suppliers_id_seq" OWNED BY "public"."suppliers"."id";



ALTER TABLE ONLY "public"."aggregated_stock" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."aggregated_stock_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cashier_accounts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cashier_accounts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cashiers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cashiers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customer_payments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customer_payments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."expenses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."expenses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."initial_customer_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."initial_customer_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."initial_supplier_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."initial_supplier_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."join_requests" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."join_requests_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."owner_withdrawals" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."owner_withdrawals_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."partial_payment_customers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."partial_payment_customers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."payments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."predefined_expenses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."predefined_expenses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_imeis" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_imeis_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."quotation_audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."quotation_audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."quotation_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."quotation_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."quotation_sequences" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."quotation_sequences_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."quotations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."quotations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."receipt_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."receipt_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sale_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sale_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stock_batches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stock_batches_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subcategories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subcategories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."supplier_khaata" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supplier_khaata_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."supplier_khaata_payments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supplier_khaata_payments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."supplier_payments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supplier_payments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."suppliers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."suppliers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."aggregated_stock"
    ADD CONSTRAINT "aggregated_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aggregated_stock"
    ADD CONSTRAINT "aggregated_stock_product_store_unique" UNIQUE ("product_id", "store_id");



ALTER TABLE ONLY "public"."cashier_accounts"
    ADD CONSTRAINT "cashier_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cashier_accounts"
    ADD CONSTRAINT "cashier_accounts_store_phone_unique" UNIQUE ("store_id", "phone_number");



ALTER TABLE ONLY "public"."cashiers"
    ADD CONSTRAINT "cashiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_store_id_name_key" UNIQUE ("store_id", "name");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."initial_customer_entries"
    ADD CONSTRAINT "initial_customer_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."initial_supplier_entries"
    ADD CONSTRAINT "initial_supplier_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_store_code_key" UNIQUE ("store_code");



ALTER TABLE ONLY "public"."owner_withdrawals"
    ADD CONSTRAINT "owner_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partial_payment_customers"
    ADD CONSTRAINT "partial_payment_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."predefined_expenses"
    ADD CONSTRAINT "predefined_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "product_imeis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_store_id_key" UNIQUE ("sku", "store_id");



ALTER TABLE ONLY "public"."quotation_audit_logs"
    ADD CONSTRAINT "quotation_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_sequences"
    ADD CONSTRAINT "quotation_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_sequences"
    ADD CONSTRAINT "quotation_sequences_store_id_year_key" UNIQUE ("store_id", "year");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_quotation_number_key" UNIQUE ("quotation_number");



ALTER TABLE ONLY "public"."receipt_settings"
    ADD CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_settings"
    ADD CONSTRAINT "receipt_settings_store_unique" UNIQUE ("store_id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_sale_number_store_id_key" UNIQUE ("sale_number", "store_id");



ALTER TABLE ONLY "public"."stock_batches"
    ADD CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_store_code_key" UNIQUE ("store_code");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_khaata_payments"
    ADD CONSTRAINT "supplier_khaata_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_khaata"
    ADD CONSTRAINT "supplier_khaata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "unique_imei_per_store" UNIQUE ("store_id", "imei_number");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "unique_sale_number_per_store" UNIQUE ("store_id", "sale_number_store");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "unique_supplier_phone_per_store" UNIQUE ("store_id", "phone_number");



CREATE INDEX "idx_aggregated_stock_low" ON "public"."aggregated_stock" USING "btree" ("store_id", "total_quantity_remaining") WHERE ("total_quantity_remaining" <= "low_stock_threshold");



CREATE INDEX "idx_aggregated_stock_product_store" ON "public"."aggregated_stock" USING "btree" ("product_id", "store_id");



CREATE INDEX "idx_aggregated_stock_remaining" ON "public"."aggregated_stock" USING "btree" ("total_quantity_remaining");



CREATE INDEX "idx_aggregated_stock_store_id" ON "public"."aggregated_stock" USING "btree" ("store_id");



CREATE INDEX "idx_batches_depleted" ON "public"."stock_batches" USING "btree" ("is_depleted", "purchase_date");



CREATE INDEX "idx_batches_lowest_negotiable" ON "public"."stock_batches" USING "btree" ("lowest_negotiable_price");



CREATE INDEX "idx_batches_product" ON "public"."stock_batches" USING "btree" ("product_id");



CREATE INDEX "idx_batches_store" ON "public"."stock_batches" USING "btree" ("store_id");



CREATE INDEX "idx_cashier_name" ON "public"."cashier_accounts" USING "btree" ("full_name");



CREATE INDEX "idx_cashier_phone" ON "public"."cashier_accounts" USING "btree" ("phone_number");



CREATE INDEX "idx_cashier_store_id" ON "public"."cashier_accounts" USING "btree" ("store_id");



CREATE INDEX "idx_cashiers_active" ON "public"."cashiers" USING "btree" ("is_active");



CREATE INDEX "idx_cashiers_store_active" ON "public"."cashiers" USING "btree" ("store_id", "is_active");



CREATE INDEX "idx_categories_is_active" ON "public"."categories" USING "btree" ("is_active");



CREATE INDEX "idx_categories_store" ON "public"."categories" USING "btree" ("store_id", "name");



CREATE INDEX "idx_customer_payments_date" ON "public"."customer_payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_customer_payments_partial_payment_id" ON "public"."customer_payments" USING "btree" ("partial_payment_customer_id");



CREATE INDEX "idx_customer_payments_sale_id" ON "public"."customer_payments" USING "btree" ("sale_id");



CREATE INDEX "idx_customer_payments_store" ON "public"."customer_payments" USING "btree" ("store_id", "payment_method");



CREATE INDEX "idx_customer_payments_store_id" ON "public"."customer_payments" USING "btree" ("store_id");



CREATE INDEX "idx_expenses_cashier_ref_id" ON "public"."expenses" USING "btree" ("cashier_ref_id");



CREATE INDEX "idx_expenses_category" ON "public"."expenses" USING "btree" ("category", "store_id");



CREATE INDEX "idx_expenses_date" ON "public"."expenses" USING "btree" ("expense_date");



CREATE INDEX "idx_expenses_marked_for_review" ON "public"."expenses" USING "btree" ("marked_for_review") WHERE ("marked_for_review" = true);



CREATE INDEX "idx_expenses_payment_method" ON "public"."expenses" USING "btree" ("payment_method");



CREATE INDEX "idx_expenses_recorded_by" ON "public"."expenses" USING "btree" ("recorded_by");



CREATE INDEX "idx_expenses_recorded_by_cashier" ON "public"."expenses" USING "btree" ("recorded_by_cashier_id");



CREATE INDEX "idx_expenses_reference_id" ON "public"."expenses" USING "btree" ("reference_id");



CREATE INDEX "idx_expenses_store_category" ON "public"."expenses" USING "btree" ("store_id", "category", "expense_date" DESC);



CREATE INDEX "idx_expenses_store_date" ON "public"."expenses" USING "btree" ("store_id", "expense_date" DESC);



CREATE INDEX "idx_expenses_store_id" ON "public"."expenses" USING "btree" ("store_id");



CREATE INDEX "idx_imeis_product" ON "public"."product_imeis" USING "btree" ("product_id");



CREATE INDEX "idx_imeis_status" ON "public"."product_imeis" USING "btree" ("status");



CREATE INDEX "idx_initial_customers_created_at" ON "public"."initial_customer_entries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_initial_customers_phone" ON "public"."initial_customer_entries" USING "btree" ("customer_phone");



CREATE INDEX "idx_initial_customers_store_id" ON "public"."initial_customer_entries" USING "btree" ("store_id");



CREATE INDEX "idx_initial_suppliers_created_at" ON "public"."initial_supplier_entries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_initial_suppliers_phone" ON "public"."initial_supplier_entries" USING "btree" ("supplier_phone");



CREATE INDEX "idx_initial_suppliers_store_id" ON "public"."initial_supplier_entries" USING "btree" ("store_id");



CREATE INDEX "idx_join_requests_status" ON "public"."join_requests" USING "btree" ("status");



CREATE INDEX "idx_join_requests_store_id" ON "public"."join_requests" USING "btree" ("store_id");



CREATE INDEX "idx_join_requests_user_id" ON "public"."join_requests" USING "btree" ("user_id");



CREATE INDEX "idx_managers_phone" ON "public"."managers" USING "btree" ("phone_number");



CREATE INDEX "idx_managers_store_id" ON "public"."managers" USING "btree" ("store_id");



CREATE INDEX "idx_owner_withdrawals_date" ON "public"."owner_withdrawals" USING "btree" ("withdrawal_date");



CREATE INDEX "idx_owner_withdrawals_store_id" ON "public"."owner_withdrawals" USING "btree" ("store_id");



CREATE INDEX "idx_partial_payment_phone" ON "public"."partial_payment_customers" USING "btree" ("customer_phone", "store_id");



CREATE INDEX "idx_partial_payment_sale_id" ON "public"."partial_payment_customers" USING "btree" ("sale_id");



CREATE INDEX "idx_partial_payment_status" ON "public"."partial_payment_customers" USING "btree" ("store_id") WHERE ("amount_remaining" > (0)::numeric);



CREATE INDEX "idx_partial_payment_store_date" ON "public"."partial_payment_customers" USING "btree" ("store_id", "created_at" DESC);



CREATE INDEX "idx_partial_payment_store_id" ON "public"."partial_payment_customers" USING "btree" ("store_id");



CREATE INDEX "idx_payments_cashier" ON "public"."payments" USING "btree" ("cashier_id", "store_id") WHERE ("cashier_id" IS NOT NULL);



CREATE INDEX "idx_payments_manager" ON "public"."payments" USING "btree" ("manager_id", "store_id") WHERE ("manager_id" IS NOT NULL);



CREATE INDEX "idx_payments_sale_id" ON "public"."payments" USING "btree" ("sale_id");



CREATE INDEX "idx_payments_store_date" ON "public"."payments" USING "btree" ("store_id", "payment_date" DESC);



CREATE INDEX "idx_payments_store_id" ON "public"."payments" USING "btree" ("store_id");



CREATE INDEX "idx_predefined_expenses_is_active" ON "public"."predefined_expenses" USING "btree" ("is_active");



CREATE INDEX "idx_predefined_expenses_store_id" ON "public"."predefined_expenses" USING "btree" ("store_id");



CREATE INDEX "idx_product_imeis_imei_search" ON "public"."product_imeis" USING "btree" ("imei_number") WHERE (("status")::"text" = 'in_stock'::"text");



CREATE INDEX "idx_product_imeis_number" ON "public"."product_imeis" USING "btree" ("imei_number", "store_id");



CREATE INDEX "idx_product_imeis_product" ON "public"."product_imeis" USING "btree" ("product_id", "status") WHERE (("status")::"text" = 'in_stock'::"text");



CREATE INDEX "idx_product_imeis_status" ON "public"."product_imeis" USING "btree" ("product_id", "status");



CREATE UNIQUE INDEX "idx_products_barcode" ON "public"."products" USING "btree" ("store_id", "barcode") WHERE ("barcode" IS NOT NULL);



CREATE INDEX "idx_products_barcode_search" ON "public"."products" USING "btree" ("barcode");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_is_active" ON "public"."products" USING "btree" ("is_active");



CREATE INDEX "idx_products_is_phone" ON "public"."products" USING "btree" ("is_phone") WHERE ("is_phone" = true);



CREATE INDEX "idx_products_sku_store" ON "public"."products" USING "btree" ("sku", "store_id");



CREATE INDEX "idx_products_store_active" ON "public"."products" USING "btree" ("store_id", "is_active");



CREATE INDEX "idx_products_store_id" ON "public"."products" USING "btree" ("store_id");



CREATE INDEX "idx_products_subcategory_id" ON "public"."products" USING "btree" ("subcategory_id");



CREATE INDEX "idx_quotation_audit_quotation" ON "public"."quotation_audit_logs" USING "btree" ("quotation_id", "created_at" DESC);



CREATE INDEX "idx_quotation_items_product" ON "public"."quotation_items" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "idx_quotation_items_quotation" ON "public"."quotation_items" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotations_customer" ON "public"."quotations" USING "btree" ("customer_phone", "customer_name");



CREATE INDEX "idx_quotations_deleted" ON "public"."quotations" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_quotations_store_number" ON "public"."quotations" USING "btree" ("store_id", "quotation_number");



CREATE INDEX "idx_quotations_store_status_date" ON "public"."quotations" USING "btree" ("store_id", "status", "created_at" DESC);



CREATE INDEX "idx_quotations_valid_until" ON "public"."quotations" USING "btree" ("valid_until") WHERE (("status")::"text" = 'finalized'::"text");



CREATE INDEX "idx_receipt_settings_store_id" ON "public"."receipt_settings" USING "btree" ("store_id");



CREATE INDEX "idx_sale_items_product_id" ON "public"."sale_items" USING "btree" ("product_id");



CREATE INDEX "idx_sale_items_sale_id" ON "public"."sale_items" USING "btree" ("sale_id");



CREATE INDEX "idx_sales_cashier" ON "public"."sales" USING "btree" ("cashier_id");



CREATE INDEX "idx_sales_customer_id" ON "public"."sales" USING "btree" ("customer_id");



CREATE INDEX "idx_sales_customer_phone" ON "public"."sales" USING "btree" ("customer_phone");



CREATE INDEX "idx_sales_date" ON "public"."sales" USING "btree" ("sale_date");



CREATE INDEX "idx_sales_marked_for_review" ON "public"."sales" USING "btree" ("marked_for_review") WHERE ("marked_for_review" = true);



CREATE INDEX "idx_sales_number_store" ON "public"."sales" USING "btree" ("sale_number", "store_id");



CREATE INDEX "idx_sales_payment_status" ON "public"."sales" USING "btree" ("store_id", "payment_status");



CREATE INDEX "idx_sales_store_date" ON "public"."sales" USING "btree" ("store_id", "sale_date" DESC);



CREATE INDEX "idx_sales_store_id" ON "public"."sales" USING "btree" ("store_id");



CREATE INDEX "idx_sales_store_number" ON "public"."sales" USING "btree" ("store_id", "sale_number_store" DESC);



CREATE INDEX "idx_stock_batches_payment_method" ON "public"."stock_batches" USING "btree" ("payment_method");



CREATE INDEX "idx_stock_batches_product" ON "public"."stock_batches" USING "btree" ("product_id", "is_depleted");



CREATE INDEX "idx_stock_batches_product_active" ON "public"."stock_batches" USING "btree" ("product_id", "is_depleted") WHERE ("is_depleted" = false);



CREATE INDEX "idx_stock_batches_store" ON "public"."stock_batches" USING "btree" ("store_id", "purchase_date" DESC);



CREATE INDEX "idx_stock_batches_store_date" ON "public"."stock_batches" USING "btree" ("store_id", "purchase_date" DESC);



CREATE INDEX "idx_stock_batches_supplier" ON "public"."stock_batches" USING "btree" ("supplier_id", "store_id");



CREATE INDEX "idx_stores_code" ON "public"."stores" USING "btree" ("store_code");



CREATE INDEX "idx_stores_created_by" ON "public"."stores" USING "btree" ("created_by");



CREATE INDEX "idx_subcategories_category" ON "public"."subcategories" USING "btree" ("category_id", "name");



CREATE INDEX "idx_subcategories_is_active" ON "public"."subcategories" USING "btree" ("is_active");



CREATE INDEX "idx_supplier_khaata_payments_date" ON "public"."supplier_khaata_payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_supplier_khaata_payments_store_id" ON "public"."supplier_khaata_payments" USING "btree" ("store_id");



CREATE INDEX "idx_supplier_khaata_payments_supplier_id" ON "public"."supplier_khaata_payments" USING "btree" ("supplier_khaata_id");



CREATE INDEX "idx_supplier_khaata_stock_batch_id" ON "public"."supplier_khaata" USING "btree" ("stock_batch_id");



CREATE INDEX "idx_supplier_khaata_store_id" ON "public"."supplier_khaata" USING "btree" ("store_id");



CREATE INDEX "idx_supplier_khaata_supplier_id" ON "public"."supplier_khaata" USING "btree" ("supplier_id");



CREATE INDEX "idx_supplier_khaata_supplier_phone" ON "public"."supplier_khaata" USING "btree" ("supplier_phone");



CREATE INDEX "idx_supplier_payments_date" ON "public"."supplier_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_supplier_payments_store" ON "public"."supplier_payments" USING "btree" ("store_id");



CREATE INDEX "idx_supplier_payments_store_date" ON "public"."supplier_payments" USING "btree" ("store_id", "payment_date" DESC);



CREATE INDEX "idx_supplier_payments_supplier" ON "public"."supplier_payments" USING "btree" ("supplier_id");



CREATE INDEX "idx_suppliers_phone" ON "public"."suppliers" USING "btree" ("phone_number");



CREATE INDEX "idx_suppliers_store" ON "public"."suppliers" USING "btree" ("store_id");



CREATE OR REPLACE TRIGGER "hash_cashier_password_trigger" BEFORE INSERT OR UPDATE OF "password_hash" ON "public"."cashier_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."hash_cashier_password"();



CREATE OR REPLACE TRIGGER "receipt_settings_updated_at_trigger" BEFORE UPDATE ON "public"."receipt_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_receipt_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_create_restock_expense" AFTER INSERT ON "public"."stock_batches" FOR EACH ROW EXECUTE FUNCTION "public"."create_restock_expense"();



CREATE OR REPLACE TRIGGER "trigger_quotation_item_updated_at" BEFORE UPDATE ON "public"."quotation_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_quotation_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_quotation_updated_at" BEFORE UPDATE ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."update_quotation_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_revert_sale_deletion" BEFORE DELETE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."revert_sale_deletion"();



CREATE OR REPLACE TRIGGER "trigger_set_sale_number_store" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_sale_number_store"();



CREATE OR REPLACE TRIGGER "trigger_update_aggregated_stock" AFTER INSERT OR DELETE OR UPDATE ON "public"."stock_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_aggregated_stock"();



COMMENT ON TRIGGER "trigger_update_aggregated_stock" ON "public"."stock_batches" IS 'Automatically updates aggregated_stock when stock_batches are modified';



CREATE OR REPLACE TRIGGER "trigger_update_supplier_khaata_updated_at" BEFORE UPDATE ON "public"."supplier_khaata" FOR EACH ROW EXECUTE FUNCTION "public"."update_supplier_khaata_updated_at"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_predefined_expenses_timestamp" BEFORE UPDATE ON "public"."predefined_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_predefined_expenses_updated_at"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subcategories_updated_at" BEFORE UPDATE ON "public"."subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."aggregated_stock"
    ADD CONSTRAINT "aggregated_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aggregated_stock"
    ADD CONSTRAINT "aggregated_stock_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cashier_accounts"
    ADD CONSTRAINT "cashier_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."cashiers"
    ADD CONSTRAINT "cashiers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_cashier_ref_id_fkey" FOREIGN KEY ("cashier_ref_id") REFERENCES "public"."cashiers"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_recorded_by_cashier_id_fkey" FOREIGN KEY ("recorded_by_cashier_id") REFERENCES "public"."cashier_accounts"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "fk_customer_payment_partial_payment" FOREIGN KEY ("partial_payment_customer_id") REFERENCES "public"."partial_payment_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "fk_customer_payment_sale" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "fk_customer_payment_store" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_khaata_payments"
    ADD CONSTRAINT "fk_supplier_khaata_payment_store" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_khaata_payments"
    ADD CONSTRAINT "fk_supplier_khaata_payment_supplier" FOREIGN KEY ("supplier_khaata_id") REFERENCES "public"."supplier_khaata"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_khaata"
    ADD CONSTRAINT "fk_supplier_khaata_stock_batch" FOREIGN KEY ("stock_batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supplier_khaata"
    ADD CONSTRAINT "fk_supplier_khaata_store" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_khaata"
    ADD CONSTRAINT "fk_supplier_khaata_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."initial_customer_entries"
    ADD CONSTRAINT "initial_customer_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."initial_supplier_entries"
    ADD CONSTRAINT "initial_supplier_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."owner_withdrawals"
    ADD CONSTRAINT "owner_withdrawals_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owner_withdrawals"
    ADD CONSTRAINT "owner_withdrawals_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partial_payment_customers"
    ADD CONSTRAINT "partial_payment_customers_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."partial_payment_customers"
    ADD CONSTRAINT "partial_payment_customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."predefined_expenses"
    ADD CONSTRAINT "predefined_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."predefined_expenses"
    ADD CONSTRAINT "predefined_expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "product_imeis_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "product_imeis_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "product_imeis_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_imeis"
    ADD CONSTRAINT "product_imeis_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_audit_logs"
    ADD CONSTRAINT "quotation_audit_logs_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_sequences"
    ADD CONSTRAINT "quotation_sequences_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipt_settings"
    ADD CONSTRAINT "receipt_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_cashier_ref_id_fkey" FOREIGN KEY ("cashier_ref_id") REFERENCES "public"."cashiers"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."partial_payment_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."stock_batches"
    ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_batches"
    ADD CONSTRAINT "stock_batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_batches"
    ADD CONSTRAINT "stock_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_recorded_by_manager_id_fkey" FOREIGN KEY ("recorded_by_manager_id") REFERENCES "public"."managers"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone authenticated can view categories" ON "public"."categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone authenticated can view subcategories" ON "public"."subcategories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can create cashier account" ON "public"."cashier_accounts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create join request" ON "public"."join_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create manager account" ON "public"."managers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Cashiers can view receipt settings" ON "public"."receipt_settings" FOR SELECT USING ((("store_id" IN ( SELECT "cashier_accounts"."store_id"
   FROM "public"."cashier_accounts"
  WHERE ("cashier_accounts"."id" IN ( SELECT ("current_setting"('app.cashier_id'::"text", true))::integer AS "current_setting"
          WHERE (("current_setting"('app.cashier_id'::"text", true) IS NOT NULL) AND ("current_setting"('app.cashier_id'::"text", true) <> ''::"text")))))) OR ("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can create stores" ON "public"."stores" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Managers can delete cashiers in their store" ON "public"."cashiers" FOR DELETE USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can delete categories" ON "public"."categories" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can delete expenses in their store" ON "public"."expenses" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can delete predefined expenses for their store" ON "public"."predefined_expenses" FOR DELETE TO "authenticated" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can delete subcategories" ON "public"."subcategories" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can delete withdrawals from their store" ON "public"."owner_withdrawals" FOR DELETE TO "authenticated" USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can insert cashiers in their store" ON "public"."cashiers" FOR INSERT WITH CHECK (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can insert categories" ON "public"."categories" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can insert expenses to their store" ON "public"."expenses" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can insert predefined expenses for their store" ON "public"."predefined_expenses" FOR INSERT TO "authenticated" WITH CHECK (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can insert subcategories" ON "public"."subcategories" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can insert withdrawals in their store" ON "public"."owner_withdrawals" FOR INSERT TO "authenticated" WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can manage receipt settings" ON "public"."receipt_settings" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())))) WITH CHECK (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update cashiers in their store" ON "public"."cashiers" FOR UPDATE USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update categories" ON "public"."categories" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update expenses in their store" ON "public"."expenses" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can update join requests for their store" ON "public"."join_requests" FOR UPDATE USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update predefined expenses for their store" ON "public"."predefined_expenses" FOR UPDATE TO "authenticated" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update subcategories" ON "public"."subcategories" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can update their own data" ON "public"."managers" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Managers can update withdrawals in their store" ON "public"."owner_withdrawals" FOR UPDATE TO "authenticated" USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Managers can view cashiers in their store" ON "public"."cashiers" FOR SELECT USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can view join requests for their store" ON "public"."join_requests" FOR SELECT USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can view predefined expenses for their store" ON "public"."predefined_expenses" FOR SELECT TO "authenticated" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Managers can view users in their store" ON "public"."managers" FOR SELECT USING ((("store_id" = "public"."get_user_store_id"()) OR ("auth"."uid"() = "id")));



CREATE POLICY "Service role full access on quotation_audit_logs" ON "public"."quotation_audit_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on quotation_items" ON "public"."quotation_items" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on quotation_sequences" ON "public"."quotation_sequences" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on quotations" ON "public"."quotations" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create sales in their store" ON "public"."sales" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can delete products in their store" ON "public"."products" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert partial payment customers to their store" ON "public"."partial_payment_customers" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert payments to their store" ON "public"."payments" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert products to their store" ON "public"."products" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert sale items to their store sales" ON "public"."sale_items" FOR INSERT WITH CHECK (("sale_id" IN ( SELECT "sales"."id"
   FROM "public"."sales"
  WHERE ("sales"."store_id" = "public"."get_user_store_id"()))));



CREATE POLICY "Users can update partial payment customers in their store" ON "public"."partial_payment_customers" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can update products in their store" ON "public"."products" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can update sales in their store" ON "public"."sales" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view cashiers in their store" ON "public"."cashier_accounts" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view expenses from their store" ON "public"."expenses" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view partial payment customers from their store" ON "public"."partial_payment_customers" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view payments from their store" ON "public"."payments" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view products from their store" ON "public"."products" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view sale items from their store" ON "public"."sale_items" FOR SELECT USING (("sale_id" IN ( SELECT "sales"."id"
   FROM "public"."sales"
  WHERE ("sales"."store_id" = "public"."get_user_store_id"()))));



CREATE POLICY "Users can view sales from their store" ON "public"."sales" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view their own store" ON "public"."stores" FOR SELECT USING (("id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view withdrawals from their store" ON "public"."owner_withdrawals" FOR SELECT TO "authenticated" USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "batches_store_isolation" ON "public"."stock_batches" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())
UNION
 SELECT "cashier_accounts"."store_id"
   FROM "public"."cashier_accounts"
  WHERE (("cashier_accounts"."id")::"text" = ("auth"."jwt"() ->> 'sub'::"text")))));



ALTER TABLE "public"."cashier_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cashiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_payments_delete" ON "public"."customer_payments" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "customer_payments_insert" ON "public"."customer_payments" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "customer_payments_select" ON "public"."customer_payments" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "customer_payments_update" ON "public"."customer_payments" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imeis_store_isolation" ON "public"."product_imeis" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())
UNION
 SELECT "cashier_accounts"."store_id"
   FROM "public"."cashier_accounts"
  WHERE (("cashier_accounts"."id")::"text" = ("auth"."jwt"() ->> 'sub'::"text")))));



ALTER TABLE "public"."join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."managers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_withdrawals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partial_payment_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."predefined_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_imeis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receipt_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_khaata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_khaata_delete" ON "public"."supplier_khaata" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_insert" ON "public"."supplier_khaata" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



ALTER TABLE "public"."supplier_khaata_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_khaata_payments_delete" ON "public"."supplier_khaata_payments" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_payments_insert" ON "public"."supplier_khaata_payments" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_payments_select" ON "public"."supplier_khaata_payments" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_payments_update" ON "public"."supplier_khaata_payments" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_select" ON "public"."supplier_khaata" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "supplier_khaata_update" ON "public"."supplier_khaata" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"()));



ALTER TABLE "public"."supplier_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_payments_store_isolation" ON "public"."supplier_payments" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())
UNION
 SELECT "cashier_accounts"."store_id"
   FROM "public"."cashier_accounts"
  WHERE (("cashier_accounts"."id")::"text" = ("auth"."jwt"() ->> 'sub'::"text")))));



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_store_isolation" ON "public"."suppliers" USING (("store_id" IN ( SELECT "managers"."store_id"
   FROM "public"."managers"
  WHERE ("managers"."id" = "auth"."uid"())
UNION
 SELECT "cashier_accounts"."store_id"
   FROM "public"."cashier_accounts"
  WHERE (("cashier_accounts"."id")::"text" = ("auth"."jwt"() ->> 'sub'::"text")))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_restock_expense"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_restock_expense"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_restock_expense"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_stock_fifo"("p_product_id" integer, "p_store_id" integer, "p_quantity" integer, "p_sale_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_batch_number"("p_store_id" integer, "p_product_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_batch_number"("p_store_id" integer, "p_product_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_batch_number"("p_store_id" integer, "p_product_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_store_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_store_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_store_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_sale_number"("p_store_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_sale_number"("p_store_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_sale_number"("p_store_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_cashier_password"() TO "anon";
GRANT ALL ON FUNCTION "public"."hash_cashier_password"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_cashier_password"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revert_sale_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."revert_sale_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."revert_sale_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sale_number_store"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sale_number_store"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sale_number_store"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_aggregated_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_aggregated_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_aggregated_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_predefined_expenses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_predefined_expenses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_predefined_expenses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_quotation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_quotation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_quotation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_receipt_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_receipt_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_receipt_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supplier_khaata_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier_khaata_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier_khaata_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_cashier_login"("identifier" "text", "password_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_cashier_login"("identifier" "text", "password_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_cashier_login"("identifier" "text", "password_input" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."aggregated_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."aggregated_stock" TO "service_role";



GRANT ALL ON SEQUENCE "public"."aggregated_stock_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."aggregated_stock_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."aggregated_stock_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cashier_accounts" TO "anon";
GRANT ALL ON TABLE "public"."cashier_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."cashier_accounts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cashier_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cashier_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cashier_accounts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cashiers" TO "anon";
GRANT ALL ON TABLE "public"."cashiers" TO "authenticated";
GRANT ALL ON TABLE "public"."cashiers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cashiers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cashiers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cashiers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."expense_summary" TO "anon";
GRANT ALL ON TABLE "public"."expense_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."expenses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."expenses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."expenses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."initial_customer_entries" TO "anon";
GRANT ALL ON TABLE "public"."initial_customer_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."initial_customer_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."initial_customer_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."initial_customer_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."initial_customer_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."initial_supplier_entries" TO "anon";
GRANT ALL ON TABLE "public"."initial_supplier_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."initial_supplier_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."initial_supplier_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."initial_supplier_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."initial_supplier_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_view" TO "anon";
GRANT ALL ON TABLE "public"."inventory_view" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_view" TO "service_role";



GRANT ALL ON TABLE "public"."join_requests" TO "anon";
GRANT ALL ON TABLE "public"."join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."join_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."join_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."join_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."join_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."managers" TO "anon";
GRANT ALL ON TABLE "public"."managers" TO "authenticated";
GRANT ALL ON TABLE "public"."managers" TO "service_role";



GRANT ALL ON TABLE "public"."owner_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_withdrawals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."owner_withdrawals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."owner_withdrawals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."owner_withdrawals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."partial_payment_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."partial_payment_customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."partial_payment_customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."partial_payment_customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."partial_payment_customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."predefined_expenses" TO "anon";
GRANT ALL ON TABLE "public"."predefined_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."predefined_expenses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."predefined_expenses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."predefined_expenses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."predefined_expenses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_imeis" TO "authenticated";
GRANT ALL ON TABLE "public"."product_imeis" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_imeis_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_imeis_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_imeis_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."quotation_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quotation_audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quotation_audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quotation_audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quotation_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quotation_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quotation_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_sequences" TO "anon";
GRANT ALL ON TABLE "public"."quotation_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_sequences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quotation_sequences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quotation_sequences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quotation_sequences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quotations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quotations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quotations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receipt_settings" TO "anon";
GRANT ALL ON TABLE "public"."receipt_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receipt_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receipt_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receipt_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sale_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sale_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sale_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stock_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_batches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_batches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_batches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_batches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subcategories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subcategories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subcategories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_khaata" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_khaata" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_khaata_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_khaata_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_khaata_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_khaata_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_khaata_payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_khaata_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_khaata_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_khaata_payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_khaata_summary" TO "anon";
GRANT ALL ON TABLE "public"."supplier_khaata_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_khaata_summary" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































