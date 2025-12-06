-- 1. Cashier_accounts
-- create table public.cashier_accounts (
--   id serial not null,
--   full_name character varying(100) not null,
--   phone_number character varying(11) not null,
--   password_hash character varying(255) not null,
--   role character varying(20) null default 'Cashier'::character varying,
--   store_id integer null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   is_active boolean null default true,
--   constraint cashier_accounts_pkey primary key (id),
--   constraint cashier_accounts_phone_number_key unique (phone_number),
--   constraint cashier_accounts_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint cashier_accounts_role_check check (((role)::text = 'Cashier'::text))
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_cashier_store_id on public.cashier_accounts using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_cashier_phone on public.cashier_accounts using btree (phone_number) TABLESPACE pg_default;

-- create index IF not exists idx_cashier_name on public.cashier_accounts using btree (full_name) TABLESPACE pg_default;

-- create trigger hash_cashier_password_trigger BEFORE INSERT on cashier_accounts for EACH row
-- execute FUNCTION hash_cashier_password ();

-- 2. Categories Table
-- create table public.categories (
--   id serial not null,
--   store_id integer not null,
--   name character varying(100) not null,
--   description text null,
--   is_active boolean null default true,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint categories_pkey primary key (id),
--   constraint categories_store_id_name_key unique (store_id, name)
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_categories_store_id on public.categories using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_categories_is_active on public.categories using btree (is_active) TABLESPACE pg_default;

-- create trigger update_categories_updated_at BEFORE
-- update on categories for EACH row
-- execute FUNCTION update_updated_at_column ();

-- 3. Expenses Table
-- create table public.expenses (
--   id serial not null,
--   description character varying(255) not null,
--   amount numeric(10, 2) not null,
--   category character varying(50) null,
--   expense_date date not null,
--   recorded_by uuid null,
--   store_id integer not null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint expenses_pkey primary key (id),
--   constraint expenses_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint expenses_amount_check check ((amount >= (0)::numeric))
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_expenses_store_id on public.expenses using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_expenses_date on public.expenses using btree (expense_date) TABLESPACE pg_default;

-- create index IF not exists idx_expenses_recorded_by on public.expenses using btree (recorded_by) TABLESPACE pg_default;


-- 4. Inventory Table
-- create table public.inventory (
--   id serial not null,
--   product_id integer not null,
--   cost_price numeric(10, 2) not null,
--   selling_price numeric(10, 2) not null,
--   quantity_added integer not null,
--   quantity_remaining integer not null default 0,
--   low_stock_threshold integer null default 10,
--   batch_number character varying(50) null,
--   restock_date timestamp without time zone null default CURRENT_TIMESTAMP,
--   store_id integer not null,
--   notes text null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint inventory_pkey primary key (id),
--   constraint inventory_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
--   constraint inventory_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint inventory_quantity_remaining_check check ((quantity_remaining >= 0)),
--   constraint inventory_selling_price_check check ((selling_price >= (0)::numeric)),
--   constraint inventory_quantity_added_check check ((quantity_added >= 0)),
--   constraint inventory_low_stock_threshold_check check ((low_stock_threshold >= 0)),
--   constraint inventory_cost_price_check check ((cost_price >= (0)::numeric))
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_inventory_product_id on public.inventory using btree (product_id) TABLESPACE pg_default;

-- create index IF not exists idx_inventory_store_id on public.inventory using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_inventory_quantity_remaining on public.inventory using btree (quantity_remaining) TABLESPACE pg_default;

-- create index IF not exists idx_inventory_restock_date on public.inventory using btree (restock_date) TABLESPACE pg_default;

-- create trigger update_inventory_updated_at BEFORE
-- update on inventory for EACH row
-- execute FUNCTION update_updated_at_column ();

-- 5. Join Request table
-- create table public.join_requests (
--   id serial not null,
--   store_id integer not null,
--   user_id text not null,
--   user_type character varying(20) not null,
--   user_name character varying(100) not null,
--   user_phone character varying(11) not null,
--   user_email character varying(100) null,
--   status character varying(20) null default 'pending'::character varying,
--   requested_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   reviewed_by uuid null,
--   reviewed_at timestamp without time zone null,
--   notes text null,
--   constraint join_requests_pkey primary key (id),
--   constraint join_requests_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE,
--   constraint join_requests_status_check check (
--     (
--       (status)::text = any (
--         (
--           array[
--             'pending'::character varying,
--             'approved'::character varying,
--             'rejected'::character varying
--           ]
--         )::text[]
--       )
--     )
--   ),
--   constraint join_requests_user_type_check check (
--     (
--       (user_type)::text = any (
--         (
--           array[
--             'Manager'::character varying,
--             'Cashier'::character varying
--           ]
--         )::text[]
--       )
--     )
--   )
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_join_requests_store_id on public.join_requests using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_join_requests_status on public.join_requests using btree (status) TABLESPACE pg_default;

-- create index IF not exists idx_join_requests_user_id on public.join_requests using btree (user_id) TABLESPACE pg_default;



-- 6.Managers Table
-- create table public.managers (
--   id uuid not null,
--   email character varying(100) not null,
--   full_name character varying(100) not null,
--   phone_number character varying(11) not null,
--   store_name character varying(100) null,
--   store_id integer null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   is_active boolean null default true,
--   store_code character varying(20) null,
--   constraint managers_pkey primary key (id),
--   constraint managers_email_key unique (email),
--   constraint managers_phone_number_key unique (phone_number),
--   constraint managers_store_code_key unique (store_code),
--   constraint managers_store_id_fkey foreign KEY (store_id) references stores (id)
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_managers_store_id on public.managers using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_managers_phone on public.managers using btree (phone_number) TABLESPACE pg_default;



-- 7. Partial_Payment_Customers Table
-- create table public.partial_payment_customers (
--   id serial not null,
--   sale_id integer not null,
--   customer_name character varying(100) not null,
--   customer_cnic character varying(20) null,
--   customer_phone character varying(20) null,
--   total_amount numeric(10, 2) not null,
--   amount_paid numeric(10, 2) not null,
--   amount_remaining numeric(10, 2) not null,
--   store_id integer not null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint partial_payment_customers_pkey primary key (id),
--   constraint partial_payment_customers_sale_id_fkey foreign KEY (sale_id) references sales (id) on delete CASCADE,
--   constraint partial_payment_customers_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint partial_payment_customers_amount_paid_check check ((amount_paid >= (0)::numeric)),
--   constraint partial_payment_customers_amount_remaining_check check ((amount_remaining >= (0)::numeric)),
--   constraint partial_payment_customers_total_amount_check check ((total_amount >= (0)::numeric))
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_partial_payment_store_id on public.partial_payment_customers using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_partial_payment_sale_id on public.partial_payment_customers using btree (sale_id) TABLESPACE pg_default;



-- 8. Payments Table
-- create table public.payments (
--   id serial not null,
--   sale_id integer null,
--   amount numeric(10, 2) not null,
--   payment_method character varying(20) null,
--   payment_date timestamp without time zone null default CURRENT_TIMESTAMP,
--   manager_id uuid null,
--   store_id integer not null,
--   cashier_id integer null,
--   constraint payments_pkey primary key (id),
--   constraint payments_sale_id_fkey foreign KEY (sale_id) references sales (id),
--   constraint payments_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint payments_amount_check check ((amount >= (0)::numeric)),
--   constraint payments_recorder_check check (
--     (
--       (
--         (manager_id is not null)
--         and (cashier_id is null)
--       )
--       or (
--         (manager_id is null)
--         and (cashier_id is not null)
--       )
--     )
--   )
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_payments_cashier_id on public.payments using btree (cashier_id) TABLESPACE pg_default;

-- create index IF not exists idx_payments_store_id on public.payments using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_payments_sale_id on public.payments using btree (sale_id) TABLESPACE pg_default;



-- 9. product_imeis Table
-- create table public.product_imeis (
--   id serial not null,
--   product_id integer not null,
--   batch_id integer null,
--   store_id integer not null,
--   imei_number character varying(20) not null,
--   status character varying(20) null default 'in_stock'::character varying,
--   sold_at timestamp with time zone null,
--   sale_id integer null,
--   created_at timestamp with time zone null default now(),
--   updated_at timestamp with time zone null default now(),
--   constraint product_imeis_pkey primary key (id),
--   constraint unique_imei_per_store unique (store_id, imei_number),
--   constraint product_imeis_batch_id_fkey foreign KEY (batch_id) references stock_batches (id) on delete set null,
--   constraint product_imeis_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
--   constraint product_imeis_sale_id_fkey foreign KEY (sale_id) references sales (id) on delete set null,
--   constraint product_imeis_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_imeis_product on public.product_imeis using btree (product_id) TABLESPACE pg_default;

-- create index IF not exists idx_imeis_status on public.product_imeis using btree (status) TABLESPACE pg_default;

-- create index IF not exists idx_imeis_imei on public.product_imeis using btree (imei_number) TABLESPACE pg_default;




-- 10. Products Table
-- create table public.products (
--   id serial not null,
--   sku character varying(50) not null,
--   name character varying(100) not null,
--   description text null,
--   category character varying(50) null,
--   store_id integer not null,
--   is_active boolean null default true,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   category_id integer null,
--   subcategory_id integer null,
--   cost_price numeric(10, 2) null,
--   target_price numeric(10, 2) null,
--   min_sale_price numeric(10, 2) null,
--   average_price numeric(10, 2) null,
--   is_phone boolean null default false,
--   constraint products_pkey primary key (id),
--   constraint products_sku_store_id_key unique (sku, store_id),
--   constraint products_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
--   constraint products_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint products_subcategory_id_fkey foreign KEY (subcategory_id) references subcategories (id) on delete set null
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_products_category_id on public.products using btree (category_id) TABLESPACE pg_default;

-- create index IF not exists idx_products_subcategory_id on public.products using btree (subcategory_id) TABLESPACE pg_default;

-- create index IF not exists idx_products_sku_store on public.products using btree (sku, store_id) TABLESPACE pg_default;

-- create index IF not exists idx_products_store_id on public.products using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_products_category on public.products using btree (category) TABLESPACE pg_default;

-- create index IF not exists idx_products_is_active on public.products using btree (is_active) TABLESPACE pg_default;

-- create index IF not exists idx_products_is_phone on public.products using btree (is_phone) TABLESPACE pg_default
-- where
--   (is_phone = true);

-- create index IF not exists idx_products_average_price on public.products using btree (average_price) TABLESPACE pg_default;

-- create trigger update_products_updated_at BEFORE
-- update on products for EACH row
-- execute FUNCTION update_updated_at_column ();





-- 11. Sale Items table
-- create table public.sale_items (
--   id serial not null,
--   sale_id integer not null,
--   product_id integer not null,
--   product_sku character varying(50) not null,
--   product_name character varying(100) not null,
--   quantity integer not null,
--   unit_price numeric(10, 2) not null,
--   cost_price_snapshot numeric(10, 2) null,
--   subtotal numeric(10, 2) not null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint sale_items_pkey primary key (id),
--   constraint sale_items_sale_id_fkey foreign KEY (sale_id) references sales (id) on delete CASCADE,
--   constraint sale_items_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT,
--   constraint sale_items_unit_price_check check ((unit_price >= (0)::numeric)),
--   constraint sale_items_quantity_check check ((quantity > 0)),
--   constraint sale_items_cost_price_snapshot_check check ((cost_price_snapshot >= (0)::numeric)),
--   constraint sale_items_subtotal_check check ((subtotal >= (0)::numeric))
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_sale_items_product_id on public.sale_items using btree (product_id) TABLESPACE pg_default;

-- create index IF not exists idx_sale_items_sale_id on public.sale_items using btree (sale_id) TABLESPACE pg_default;




-- 12. Sales table
-- create table public.sales (
--   id serial not null,
--   sale_number character varying(50) not null,
--   sale_description character varying(255) null,
--   cashier_id uuid null,
--   total_amount numeric(10, 2) not null,
--   payment_method character varying(20) null,
--   payment_status character varying(20) null,
--   amount_paid numeric(10, 2) null default 0,
--   amount_due numeric(10, 2) null default 0,
--   sale_date timestamp without time zone null default CURRENT_TIMESTAMP,
--   store_id integer not null,
--   notes text null,
--   discount_type character varying(20) not null default 'none'::character varying,
--   discount_value numeric(10, 2) null default 0,
--   constraint sales_pkey primary key (id),
--   constraint sales_sale_number_store_id_key unique (sale_number, store_id),
--   constraint sales_store_id_fkey foreign KEY (store_id) references stores (id),
--   constraint sales_discount_value_check check ((discount_value >= (0)::numeric)),
--   constraint sales_payment_method_check check (
--     (
--       (payment_method)::text = any (
--         (
--           array[
--             'Cash'::character varying,
--             'Digital'::character varying
--           ]
--         )::text[]
--       )
--     )
--   ),
--   constraint sales_payment_status_check check (
--     (
--       (payment_status)::text = any (
--         (
--           array[
--             'Paid'::character varying,
--             'Partial'::character varying,
--             'Pending'::character varying
--           ]
--         )::text[]
--       )
--     )
--   ),
--   constraint sales_amount_due_check check ((amount_due >= (0)::numeric)),
--   constraint sales_total_amount_check check ((total_amount >= (0)::numeric)),
--   constraint sales_amount_paid_check check ((amount_paid >= (0)::numeric)),
--   constraint sales_discount_type_check check (
--     (
--       (discount_type)::text = any (
--         (
--           array[
--             'percentage'::character varying,
--             'amount'::character varying,
--             'none'::character varying
--           ]
--         )::text[]
--       )
--     )
--   )
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_sales_store_id on public.sales using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_sales_cashier on public.sales using btree (cashier_id) TABLESPACE pg_default;

-- create index IF not exists idx_sales_date on public.sales using btree (sale_date) TABLESPACE pg_default;

-- create index IF not exists idx_sales_number_store on public.sales using btree (sale_number, store_id) TABLESPACE pg_default;




-- 13. Stock_Batches Table
-- create table public.stock_batches (
--   id serial not null,
--   product_id integer not null,
--   store_id integer not null,
--   supplier_id integer null,
--   batch_number character varying(50) null,
--   purchase_date timestamp with time zone null default now(),
--   cost_price numeric(10, 2) not null,
--   quantity_purchased integer not null,
--   quantity_remaining integer not null,
--   is_depleted boolean null default false,
--   depleted_at timestamp with time zone null,
--   created_at timestamp with time zone null default now(),
--   updated_at timestamp with time zone null default now(),
--   selling_price numeric(10, 2) null,
--   constraint stock_batches_pkey primary key (id),
--   constraint stock_batches_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
--   constraint stock_batches_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE,
--   constraint stock_batches_supplier_id_fkey foreign KEY (supplier_id) references suppliers (id) on delete set null,
--   constraint check_remaining_qty check (
--     (
--       (quantity_remaining >= 0)
--       and (quantity_remaining <= quantity_purchased)
--     )
--   )
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_batches_product on public.stock_batches using btree (product_id) TABLESPACE pg_default;

-- create index IF not exists idx_batches_store on public.stock_batches using btree (store_id) TABLESPACE pg_default;

-- create index IF not exists idx_batches_supplier on public.stock_batches using btree (supplier_id) TABLESPACE pg_default;

-- create index IF not exists idx_batches_depleted on public.stock_batches using btree (is_depleted, purchase_date) TABLESPACE pg_default;

-- create trigger trg_batch_update_avg_price
-- after INSERT
-- or
-- update on stock_batches for EACH row
-- execute FUNCTION trigger_update_average_price ();

-- create trigger update_product_avg_price_trigger
-- after INSERT
-- or DELETE
-- or
-- update on stock_batches for EACH row
-- execute FUNCTION trigger_update_product_average_price ();


-- 14. Stores Table
-- create table public.stores (
--   id serial not null,
--   store_code character varying(3) not null,
--   store_name character varying(100) not null,
--   created_by uuid not null,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   is_active boolean null default true,
--   constraint stores_pkey primary key (id),
--   constraint stores_store_code_key unique (store_code)
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_stores_code on public.stores using btree (store_code) TABLESPACE pg_default;

-- create index IF not exists idx_stores_created_by on public.stores using btree (created_by) TABLESPACE pg_default;



-- 15. Subcategories Table
-- create table public.subcategories (
--   id serial not null,
--   category_id integer not null,
--   name character varying(100) not null,
--   description text null,
--   is_active boolean null default true,
--   created_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
--   constraint subcategories_pkey primary key (id),
--   constraint subcategories_category_id_name_key unique (category_id, name),
--   constraint subcategories_category_id_fkey foreign KEY (category_id) references categories (id) on delete CASCADE
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_subcategories_category_id on public.subcategories using btree (category_id) TABLESPACE pg_default;

-- create index IF not exists idx_subcategories_is_active on public.subcategories using btree (is_active) TABLESPACE pg_default;

-- create trigger update_subcategories_updated_at BEFORE
-- update on subcategories for EACH row
-- execute FUNCTION update_updated_at_column ();


-- 16. Suppliers table
-- create table public.suppliers (
--   id serial not null,
--   store_id integer not null,
--   supplier_name character varying(255) not null,
--   phone_number character varying(20) not null,
--   email character varying(255) null,
--   address text null,
--   notes text null,
--   is_active boolean null default true,
--   created_at timestamp with time zone null default now(),
--   updated_at timestamp with time zone null default now(),
--   constraint suppliers_pkey primary key (id),
--   constraint unique_supplier_phone_per_store unique (store_id, phone_number),
--   constraint suppliers_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE
-- ) TABLESPACE pg_default;

-- create index IF not exists idx_suppliers_phone on public.suppliers using btree (phone_number) TABLESPACE pg_default;

-- create index IF not exists idx_suppliers_store on public.suppliers using btree (store_id) TABLESPACE pg_default;