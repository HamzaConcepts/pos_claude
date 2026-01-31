drop extension if exists "pg_net";

create sequence "public"."aggregated_stock_id_seq";

create sequence "public"."cashier_accounts_id_seq";

create sequence "public"."cashiers_id_seq";

create sequence "public"."categories_id_seq";

create sequence "public"."customer_payments_id_seq";

create sequence "public"."expenses_id_seq";

create sequence "public"."initial_customer_entries_id_seq";

create sequence "public"."initial_supplier_entries_id_seq";

create sequence "public"."join_requests_id_seq";

create sequence "public"."partial_payment_customers_id_seq";

create sequence "public"."payments_id_seq";

create sequence "public"."predefined_expenses_id_seq";

create sequence "public"."product_imeis_id_seq";

create sequence "public"."products_id_seq";

create sequence "public"."sale_items_id_seq";

create sequence "public"."sales_id_seq";

create sequence "public"."stock_batches_id_seq";

create sequence "public"."stores_id_seq";

create sequence "public"."subcategories_id_seq";

create sequence "public"."supplier_khaata_id_seq";

create sequence "public"."supplier_khaata_payments_id_seq";

create sequence "public"."supplier_payments_id_seq";

create sequence "public"."suppliers_id_seq";


  create table "public"."aggregated_stock" (
    "id" integer not null default nextval('public.aggregated_stock_id_seq'::regclass),
    "product_id" integer not null,
    "store_id" integer not null,
    "aggregated_cost_price" numeric(10,2) default 0,
    "aggregated_selling_price" numeric(10,2) default 0,
    "aggregated_lowest_negotiable" numeric(10,2) default 0,
    "total_quantity_purchased" integer not null default 0,
    "total_quantity_remaining" integer not null default 0,
    "total_quantity_sold" integer not null default 0,
    "low_stock_threshold" integer not null default 10,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."cashier_accounts" (
    "id" integer not null default nextval('public.cashier_accounts_id_seq'::regclass),
    "full_name" character varying(100) not null,
    "phone_number" character varying(11) not null,
    "password_hash" character varying(255) not null,
    "role" character varying(20) default 'Cashier'::character varying,
    "store_id" integer,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "is_active" boolean default true
      );


alter table "public"."cashier_accounts" enable row level security;


  create table "public"."cashiers" (
    "id" integer not null default nextval('public.cashiers_id_seq'::regclass),
    "store_id" integer not null,
    "full_name" text not null,
    "phone_number" text not null,
    "commission_rate" numeric(5,2) default 0,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "salary" numeric(10,2) default 0
      );


alter table "public"."cashiers" enable row level security;


  create table "public"."categories" (
    "id" integer not null default nextval('public.categories_id_seq'::regclass),
    "store_id" integer not null,
    "name" character varying(100) not null,
    "description" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "requires_imei" boolean default false
      );


alter table "public"."categories" enable row level security;


  create table "public"."customer_payments" (
    "id" integer not null default nextval('public.customer_payments_id_seq'::regclass),
    "partial_payment_customer_id" integer not null,
    "sale_id" integer,
    "customer_name" character varying(100) not null,
    "customer_phone" character varying(20),
    "payment_amount" numeric(10,2) not null,
    "payment_date" timestamp without time zone default CURRENT_TIMESTAMP,
    "payment_method" character varying(20) default 'Cash'::character varying,
    "notes" text,
    "store_id" integer not null,
    "recorded_by" uuid,
    "cashier_id" integer,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."customer_payments" enable row level security;


  create table "public"."expenses" (
    "id" integer not null default nextval('public.expenses_id_seq'::regclass),
    "description" character varying(255) not null,
    "amount" numeric(10,2) not null,
    "category" character varying(50),
    "expense_date" date not null,
    "recorded_by" uuid,
    "store_id" integer not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "reference_id" integer,
    "payment_method" character varying(20) default 'Cash'::character varying,
    "marked_for_review" boolean default false,
    "review_note" text,
    "marked_at" timestamp without time zone,
    "marked_by" character varying(255),
    "recorded_by_cashier_id" integer
      );


alter table "public"."expenses" enable row level security;


  create table "public"."initial_customer_entries" (
    "id" integer not null default nextval('public.initial_customer_entries_id_seq'::regclass),
    "store_id" integer not null,
    "customer_name" character varying(100) not null,
    "customer_cnic" character varying(20),
    "customer_phone" character varying(20),
    "amount_owed" numeric(10,2) not null,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."initial_supplier_entries" (
    "id" integer not null default nextval('public.initial_supplier_entries_id_seq'::regclass),
    "store_id" integer not null,
    "supplier_name" character varying(100) not null,
    "contact_person" character varying(100),
    "supplier_phone" character varying(20),
    "supplier_email" character varying(100),
    "address" text,
    "amount_owed" numeric(10,2) not null,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."join_requests" (
    "id" integer not null default nextval('public.join_requests_id_seq'::regclass),
    "store_id" integer not null,
    "user_id" text not null,
    "user_type" character varying(20) not null,
    "user_name" character varying(100) not null,
    "user_phone" character varying(11) not null,
    "user_email" character varying(100),
    "status" character varying(20) default 'pending'::character varying,
    "requested_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "reviewed_by" uuid,
    "reviewed_at" timestamp without time zone,
    "notes" text
      );


alter table "public"."join_requests" enable row level security;


  create table "public"."managers" (
    "id" uuid not null,
    "email" character varying(100) not null,
    "full_name" character varying(100) not null,
    "phone_number" character varying(11) not null,
    "store_name" character varying(100),
    "store_id" integer,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "is_active" boolean default true,
    "store_code" character varying(20)
      );


alter table "public"."managers" enable row level security;


  create table "public"."partial_payment_customers" (
    "id" integer not null default nextval('public.partial_payment_customers_id_seq'::regclass),
    "sale_id" integer not null,
    "customer_name" character varying(100) not null,
    "customer_cnic" character varying(20),
    "customer_phone" character varying(20),
    "total_amount" numeric(10,2) not null,
    "amount_paid" numeric(10,2) not null,
    "amount_remaining" numeric(10,2) not null,
    "store_id" integer not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."partial_payment_customers" enable row level security;


  create table "public"."payments" (
    "id" integer not null default nextval('public.payments_id_seq'::regclass),
    "sale_id" integer,
    "amount" numeric(10,2) not null,
    "payment_method" character varying(20),
    "payment_date" timestamp without time zone default CURRENT_TIMESTAMP,
    "manager_id" uuid,
    "store_id" integer not null,
    "cashier_id" integer
      );


alter table "public"."payments" enable row level security;


  create table "public"."predefined_expenses" (
    "id" integer not null default nextval('public.predefined_expenses_id_seq'::regclass),
    "store_id" integer not null,
    "name" character varying(255) not null,
    "category" character varying(100) not null,
    "default_amount" numeric(10,2) not null default 0,
    "description" text,
    "is_active" boolean default true,
    "created_by" uuid,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."predefined_expenses" enable row level security;


  create table "public"."product_imeis" (
    "id" integer not null default nextval('public.product_imeis_id_seq'::regclass),
    "product_id" integer not null,
    "batch_id" integer,
    "store_id" integer not null,
    "imei_number" character varying(20) not null,
    "status" character varying(20) default 'in_stock'::character varying,
    "sold_at" timestamp with time zone,
    "sale_id" integer,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."product_imeis" enable row level security;


  create table "public"."products" (
    "id" integer not null default nextval('public.products_id_seq'::regclass),
    "sku" character varying(50) not null,
    "name" character varying(100) not null,
    "description" text,
    "category" character varying(50),
    "store_id" integer not null,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "category_id" integer,
    "subcategory_id" integer,
    "is_phone" boolean default false,
    "barcode" character varying(100)
      );


alter table "public"."products" enable row level security;


  create table "public"."sale_items" (
    "id" integer not null default nextval('public.sale_items_id_seq'::regclass),
    "sale_id" integer not null,
    "product_id" integer not null,
    "product_sku" character varying(50) not null,
    "product_name" character varying(100) not null,
    "quantity" integer not null,
    "unit_price" numeric(10,2) not null,
    "cost_price_snapshot" numeric(10,2),
    "subtotal" numeric(10,2) not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."sale_items" enable row level security;


  create table "public"."sales" (
    "id" integer not null default nextval('public.sales_id_seq'::regclass),
    "sale_number" character varying(50) not null,
    "sale_description" character varying(255),
    "cashier_id" uuid,
    "total_amount" numeric(10,2) not null,
    "payment_method" character varying(20),
    "payment_status" character varying(20),
    "amount_paid" numeric(10,2) default 0,
    "amount_due" numeric(10,2) default 0,
    "sale_date" timestamp without time zone default CURRENT_TIMESTAMP,
    "store_id" integer not null,
    "notes" text,
    "discount_type" character varying(20) not null default 'none'::character varying,
    "discount_value" numeric(10,2) default 0,
    "cashier_ref_id" integer,
    "marked_for_review" boolean default false,
    "review_reason" text,
    "marked_by_cashier_id" integer,
    "marked_at" timestamp without time zone,
    "customer_id" integer,
    "customer_name" character varying(100),
    "customer_phone" character varying(20),
    "customer_cnic" character varying(20),
    "sale_number_store" integer not null
      );


alter table "public"."sales" enable row level security;


  create table "public"."stock_batches" (
    "id" integer not null default nextval('public.stock_batches_id_seq'::regclass),
    "product_id" integer not null,
    "store_id" integer not null,
    "supplier_id" integer,
    "batch_number" character varying(50),
    "purchase_date" timestamp with time zone default now(),
    "cost_price" numeric(10,2) not null,
    "quantity_purchased" integer not null,
    "quantity_remaining" integer not null,
    "is_depleted" boolean default false,
    "depleted_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "selling_price" numeric(10,2),
    "lowest_negotiable_price" numeric(10,2),
    "is_initial_stock" boolean default false,
    "payment_method" character varying(20) default 'Cash'::character varying
      );


alter table "public"."stock_batches" enable row level security;


  create table "public"."stores" (
    "id" integer not null default nextval('public.stores_id_seq'::regclass),
    "store_code" character varying(3) not null,
    "store_name" character varying(100) not null,
    "created_by" uuid not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "is_active" boolean default true
      );


alter table "public"."stores" enable row level security;


  create table "public"."subcategories" (
    "id" integer not null default nextval('public.subcategories_id_seq'::regclass),
    "category_id" integer not null,
    "name" character varying(100) not null,
    "description" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."subcategories" enable row level security;


  create table "public"."supplier_khaata" (
    "id" integer not null default nextval('public.supplier_khaata_id_seq'::regclass),
    "stock_batch_id" integer not null,
    "supplier_id" integer not null,
    "supplier_name" character varying(100) not null,
    "supplier_phone" character varying(20),
    "supplier_contact" character varying(255),
    "total_amount" numeric(10,2) not null,
    "amount_paid" numeric(10,2) not null default 0,
    "amount_remaining" numeric(10,2) not null,
    "store_id" integer not null,
    "notes" text,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."supplier_khaata" enable row level security;


  create table "public"."supplier_khaata_payments" (
    "id" integer not null default nextval('public.supplier_khaata_payments_id_seq'::regclass),
    "supplier_khaata_id" integer not null,
    "supplier_name" character varying(100) not null,
    "supplier_phone" character varying(20),
    "payment_amount" numeric(10,2) not null,
    "payment_date" timestamp without time zone default CURRENT_TIMESTAMP,
    "payment_method" character varying(20) default 'Cash'::character varying,
    "notes" text,
    "store_id" integer not null,
    "recorded_by" uuid,
    "cashier_id" integer,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."supplier_khaata_payments" enable row level security;


  create table "public"."supplier_payments" (
    "id" integer not null default nextval('public.supplier_payments_id_seq'::regclass),
    "supplier_id" integer not null,
    "store_id" integer not null,
    "amount" numeric(10,2) not null,
    "payment_method" character varying(20) default 'Cash'::character varying,
    "payment_date" timestamp without time zone default now(),
    "recorded_by_manager_id" uuid,
    "recorded_by_cashier_id" integer,
    "notes" text,
    "created_at" timestamp without time zone default now()
      );



  create table "public"."suppliers" (
    "id" integer not null default nextval('public.suppliers_id_seq'::regclass),
    "store_id" integer not null,
    "supplier_name" character varying(255) not null,
    "phone_number" character varying(20) not null,
    "email" character varying(255),
    "address" text,
    "notes" text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "balance_owed" numeric(10,2) default 0,
    "initial_balance" numeric(10,2) default 0,
    "last_payment_date" timestamp without time zone,
    "total_paid" numeric(10,2) default 0
      );


alter table "public"."suppliers" enable row level security;

alter sequence "public"."aggregated_stock_id_seq" owned by "public"."aggregated_stock"."id";

alter sequence "public"."cashier_accounts_id_seq" owned by "public"."cashier_accounts"."id";

alter sequence "public"."cashiers_id_seq" owned by "public"."cashiers"."id";

alter sequence "public"."categories_id_seq" owned by "public"."categories"."id";

alter sequence "public"."customer_payments_id_seq" owned by "public"."customer_payments"."id";

alter sequence "public"."expenses_id_seq" owned by "public"."expenses"."id";

alter sequence "public"."initial_customer_entries_id_seq" owned by "public"."initial_customer_entries"."id";

alter sequence "public"."initial_supplier_entries_id_seq" owned by "public"."initial_supplier_entries"."id";

alter sequence "public"."join_requests_id_seq" owned by "public"."join_requests"."id";

alter sequence "public"."partial_payment_customers_id_seq" owned by "public"."partial_payment_customers"."id";

alter sequence "public"."payments_id_seq" owned by "public"."payments"."id";

alter sequence "public"."predefined_expenses_id_seq" owned by "public"."predefined_expenses"."id";

alter sequence "public"."product_imeis_id_seq" owned by "public"."product_imeis"."id";

alter sequence "public"."products_id_seq" owned by "public"."products"."id";

alter sequence "public"."sale_items_id_seq" owned by "public"."sale_items"."id";

alter sequence "public"."sales_id_seq" owned by "public"."sales"."id";

alter sequence "public"."stock_batches_id_seq" owned by "public"."stock_batches"."id";

alter sequence "public"."stores_id_seq" owned by "public"."stores"."id";

alter sequence "public"."subcategories_id_seq" owned by "public"."subcategories"."id";

alter sequence "public"."supplier_khaata_id_seq" owned by "public"."supplier_khaata"."id";

alter sequence "public"."supplier_khaata_payments_id_seq" owned by "public"."supplier_khaata_payments"."id";

alter sequence "public"."supplier_payments_id_seq" owned by "public"."supplier_payments"."id";

alter sequence "public"."suppliers_id_seq" owned by "public"."suppliers"."id";

CREATE UNIQUE INDEX aggregated_stock_pkey ON public.aggregated_stock USING btree (id);

CREATE UNIQUE INDEX aggregated_stock_product_store_unique ON public.aggregated_stock USING btree (product_id, store_id);

CREATE UNIQUE INDEX cashier_accounts_phone_number_key ON public.cashier_accounts USING btree (phone_number);

CREATE UNIQUE INDEX cashier_accounts_pkey ON public.cashier_accounts USING btree (id);

CREATE UNIQUE INDEX cashiers_pkey ON public.cashiers USING btree (id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX categories_store_id_name_key ON public.categories USING btree (store_id, name);

CREATE UNIQUE INDEX customer_payments_pkey ON public.customer_payments USING btree (id);

CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (id);

CREATE INDEX idx_aggregated_stock_product_id ON public.aggregated_stock USING btree (product_id);

CREATE INDEX idx_aggregated_stock_product_store ON public.aggregated_stock USING btree (product_id, store_id);

CREATE INDEX idx_aggregated_stock_remaining ON public.aggregated_stock USING btree (total_quantity_remaining);

CREATE INDEX idx_aggregated_stock_store_id ON public.aggregated_stock USING btree (store_id);

CREATE INDEX idx_batches_depleted ON public.stock_batches USING btree (is_depleted, purchase_date);

CREATE INDEX idx_batches_lowest_negotiable ON public.stock_batches USING btree (lowest_negotiable_price);

CREATE INDEX idx_batches_product ON public.stock_batches USING btree (product_id);

CREATE INDEX idx_batches_store ON public.stock_batches USING btree (store_id);

CREATE INDEX idx_batches_supplier ON public.stock_batches USING btree (supplier_id);

CREATE INDEX idx_cashier_name ON public.cashier_accounts USING btree (full_name);

CREATE INDEX idx_cashier_phone ON public.cashier_accounts USING btree (phone_number);

CREATE INDEX idx_cashier_store_id ON public.cashier_accounts USING btree (store_id);

CREATE INDEX idx_cashiers_active ON public.cashiers USING btree (is_active);

CREATE INDEX idx_cashiers_store_id ON public.cashiers USING btree (store_id);

CREATE INDEX idx_categories_is_active ON public.categories USING btree (is_active);

CREATE INDEX idx_categories_store_id ON public.categories USING btree (store_id);

CREATE INDEX idx_customer_payments_date ON public.customer_payments USING btree (payment_date DESC);

CREATE INDEX idx_customer_payments_partial_payment_id ON public.customer_payments USING btree (partial_payment_customer_id);

CREATE INDEX idx_customer_payments_sale_id ON public.customer_payments USING btree (sale_id);

CREATE INDEX idx_customer_payments_store_id ON public.customer_payments USING btree (store_id);

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);

CREATE INDEX idx_expenses_marked_for_review ON public.expenses USING btree (marked_for_review) WHERE (marked_for_review = true);

CREATE INDEX idx_expenses_payment_method ON public.expenses USING btree (payment_method);

CREATE INDEX idx_expenses_recorded_by ON public.expenses USING btree (recorded_by);

CREATE INDEX idx_expenses_recorded_by_cashier ON public.expenses USING btree (recorded_by_cashier_id);

CREATE INDEX idx_expenses_reference_id ON public.expenses USING btree (reference_id);

CREATE INDEX idx_expenses_store_id ON public.expenses USING btree (store_id);

CREATE INDEX idx_imeis_imei ON public.product_imeis USING btree (imei_number);

CREATE INDEX idx_imeis_product ON public.product_imeis USING btree (product_id);

CREATE INDEX idx_imeis_status ON public.product_imeis USING btree (status);

CREATE INDEX idx_initial_customers_created_at ON public.initial_customer_entries USING btree (created_at DESC);

CREATE INDEX idx_initial_customers_phone ON public.initial_customer_entries USING btree (customer_phone);

CREATE INDEX idx_initial_customers_store_id ON public.initial_customer_entries USING btree (store_id);

CREATE INDEX idx_initial_suppliers_created_at ON public.initial_supplier_entries USING btree (created_at DESC);

CREATE INDEX idx_initial_suppliers_phone ON public.initial_supplier_entries USING btree (supplier_phone);

CREATE INDEX idx_initial_suppliers_store_id ON public.initial_supplier_entries USING btree (store_id);

CREATE INDEX idx_join_requests_status ON public.join_requests USING btree (status);

CREATE INDEX idx_join_requests_store_id ON public.join_requests USING btree (store_id);

CREATE INDEX idx_join_requests_user_id ON public.join_requests USING btree (user_id);

CREATE INDEX idx_managers_phone ON public.managers USING btree (phone_number);

CREATE INDEX idx_managers_store_id ON public.managers USING btree (store_id);

CREATE INDEX idx_partial_payment_sale_id ON public.partial_payment_customers USING btree (sale_id);

CREATE INDEX idx_partial_payment_store_id ON public.partial_payment_customers USING btree (store_id);

CREATE INDEX idx_payments_cashier_id ON public.payments USING btree (cashier_id);

CREATE INDEX idx_payments_sale_id ON public.payments USING btree (sale_id);

CREATE INDEX idx_payments_store_id ON public.payments USING btree (store_id);

CREATE INDEX idx_predefined_expenses_is_active ON public.predefined_expenses USING btree (is_active);

CREATE INDEX idx_predefined_expenses_store_id ON public.predefined_expenses USING btree (store_id);

CREATE INDEX idx_product_imeis_imei_search ON public.product_imeis USING btree (imei_number) WHERE ((status)::text = 'in_stock'::text);

CREATE UNIQUE INDEX idx_products_barcode ON public.products USING btree (barcode) WHERE (barcode IS NOT NULL);

CREATE INDEX idx_products_barcode_search ON public.products USING btree (barcode);

CREATE INDEX idx_products_category ON public.products USING btree (category);

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);

CREATE INDEX idx_products_is_active ON public.products USING btree (is_active);

CREATE INDEX idx_products_is_phone ON public.products USING btree (is_phone) WHERE (is_phone = true);

CREATE INDEX idx_products_sku_store ON public.products USING btree (sku, store_id);

CREATE INDEX idx_products_store_id ON public.products USING btree (store_id);

CREATE INDEX idx_products_subcategory_id ON public.products USING btree (subcategory_id);

CREATE INDEX idx_sale_items_product_id ON public.sale_items USING btree (product_id);

CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);

CREATE INDEX idx_sales_cashier ON public.sales USING btree (cashier_id);

CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);

CREATE INDEX idx_sales_customer_phone ON public.sales USING btree (customer_phone);

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);

CREATE INDEX idx_sales_marked_for_review ON public.sales USING btree (marked_for_review) WHERE (marked_for_review = true);

CREATE INDEX idx_sales_number_store ON public.sales USING btree (sale_number, store_id);

CREATE INDEX idx_sales_store_id ON public.sales USING btree (store_id);

CREATE INDEX idx_sales_store_number ON public.sales USING btree (store_id, sale_number_store DESC);

CREATE INDEX idx_stock_batches_payment_method ON public.stock_batches USING btree (payment_method);

CREATE INDEX idx_stores_code ON public.stores USING btree (store_code);

CREATE INDEX idx_stores_created_by ON public.stores USING btree (created_by);

CREATE INDEX idx_subcategories_category_id ON public.subcategories USING btree (category_id);

CREATE INDEX idx_subcategories_is_active ON public.subcategories USING btree (is_active);

CREATE INDEX idx_supplier_khaata_payments_date ON public.supplier_khaata_payments USING btree (payment_date DESC);

CREATE INDEX idx_supplier_khaata_payments_store_id ON public.supplier_khaata_payments USING btree (store_id);

CREATE INDEX idx_supplier_khaata_payments_supplier_id ON public.supplier_khaata_payments USING btree (supplier_khaata_id);

CREATE INDEX idx_supplier_khaata_stock_batch_id ON public.supplier_khaata USING btree (stock_batch_id);

CREATE INDEX idx_supplier_khaata_store_id ON public.supplier_khaata USING btree (store_id);

CREATE INDEX idx_supplier_khaata_supplier_id ON public.supplier_khaata USING btree (supplier_id);

CREATE INDEX idx_supplier_khaata_supplier_phone ON public.supplier_khaata USING btree (supplier_phone);

CREATE INDEX idx_supplier_payments_date ON public.supplier_payments USING btree (payment_date);

CREATE INDEX idx_supplier_payments_store ON public.supplier_payments USING btree (store_id);

CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments USING btree (supplier_id);

CREATE INDEX idx_suppliers_phone ON public.suppliers USING btree (phone_number);

CREATE INDEX idx_suppliers_store ON public.suppliers USING btree (store_id);

CREATE UNIQUE INDEX initial_customer_entries_pkey ON public.initial_customer_entries USING btree (id);

CREATE UNIQUE INDEX initial_supplier_entries_pkey ON public.initial_supplier_entries USING btree (id);

CREATE UNIQUE INDEX join_requests_pkey ON public.join_requests USING btree (id);

CREATE UNIQUE INDEX managers_email_key ON public.managers USING btree (email);

CREATE UNIQUE INDEX managers_phone_number_key ON public.managers USING btree (phone_number);

CREATE UNIQUE INDEX managers_pkey ON public.managers USING btree (id);

CREATE UNIQUE INDEX managers_store_code_key ON public.managers USING btree (store_code);

CREATE UNIQUE INDEX partial_payment_customers_pkey ON public.partial_payment_customers USING btree (id);

CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);

CREATE UNIQUE INDEX predefined_expenses_pkey ON public.predefined_expenses USING btree (id);

CREATE UNIQUE INDEX product_imeis_pkey ON public.product_imeis USING btree (id);

CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);

CREATE UNIQUE INDEX products_sku_store_id_key ON public.products USING btree (sku, store_id);

CREATE UNIQUE INDEX sale_items_pkey ON public.sale_items USING btree (id);

CREATE UNIQUE INDEX sales_pkey ON public.sales USING btree (id);

CREATE UNIQUE INDEX sales_sale_number_store_id_key ON public.sales USING btree (sale_number, store_id);

CREATE UNIQUE INDEX stock_batches_pkey ON public.stock_batches USING btree (id);

CREATE UNIQUE INDEX stores_pkey ON public.stores USING btree (id);

CREATE UNIQUE INDEX stores_store_code_key ON public.stores USING btree (store_code);

CREATE UNIQUE INDEX subcategories_category_id_name_key ON public.subcategories USING btree (category_id, name);

CREATE UNIQUE INDEX subcategories_pkey ON public.subcategories USING btree (id);

CREATE UNIQUE INDEX supplier_khaata_payments_pkey ON public.supplier_khaata_payments USING btree (id);

CREATE UNIQUE INDEX supplier_khaata_pkey ON public.supplier_khaata USING btree (id);

CREATE UNIQUE INDEX supplier_payments_pkey ON public.supplier_payments USING btree (id);

CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id);

CREATE UNIQUE INDEX unique_imei_per_store ON public.product_imeis USING btree (store_id, imei_number);

CREATE UNIQUE INDEX unique_sale_number_per_store ON public.sales USING btree (store_id, sale_number_store);

CREATE UNIQUE INDEX unique_supplier_phone_per_store ON public.suppliers USING btree (store_id, phone_number);

alter table "public"."aggregated_stock" add constraint "aggregated_stock_pkey" PRIMARY KEY using index "aggregated_stock_pkey";

alter table "public"."cashier_accounts" add constraint "cashier_accounts_pkey" PRIMARY KEY using index "cashier_accounts_pkey";

alter table "public"."cashiers" add constraint "cashiers_pkey" PRIMARY KEY using index "cashiers_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."customer_payments" add constraint "customer_payments_pkey" PRIMARY KEY using index "customer_payments_pkey";

alter table "public"."expenses" add constraint "expenses_pkey" PRIMARY KEY using index "expenses_pkey";

alter table "public"."initial_customer_entries" add constraint "initial_customer_entries_pkey" PRIMARY KEY using index "initial_customer_entries_pkey";

alter table "public"."initial_supplier_entries" add constraint "initial_supplier_entries_pkey" PRIMARY KEY using index "initial_supplier_entries_pkey";

alter table "public"."join_requests" add constraint "join_requests_pkey" PRIMARY KEY using index "join_requests_pkey";

alter table "public"."managers" add constraint "managers_pkey" PRIMARY KEY using index "managers_pkey";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_pkey" PRIMARY KEY using index "partial_payment_customers_pkey";

alter table "public"."payments" add constraint "payments_pkey" PRIMARY KEY using index "payments_pkey";

alter table "public"."predefined_expenses" add constraint "predefined_expenses_pkey" PRIMARY KEY using index "predefined_expenses_pkey";

alter table "public"."product_imeis" add constraint "product_imeis_pkey" PRIMARY KEY using index "product_imeis_pkey";

alter table "public"."products" add constraint "products_pkey" PRIMARY KEY using index "products_pkey";

alter table "public"."sale_items" add constraint "sale_items_pkey" PRIMARY KEY using index "sale_items_pkey";

alter table "public"."sales" add constraint "sales_pkey" PRIMARY KEY using index "sales_pkey";

alter table "public"."stock_batches" add constraint "stock_batches_pkey" PRIMARY KEY using index "stock_batches_pkey";

alter table "public"."stores" add constraint "stores_pkey" PRIMARY KEY using index "stores_pkey";

alter table "public"."subcategories" add constraint "subcategories_pkey" PRIMARY KEY using index "subcategories_pkey";

alter table "public"."supplier_khaata" add constraint "supplier_khaata_pkey" PRIMARY KEY using index "supplier_khaata_pkey";

alter table "public"."supplier_khaata_payments" add constraint "supplier_khaata_payments_pkey" PRIMARY KEY using index "supplier_khaata_payments_pkey";

alter table "public"."supplier_payments" add constraint "supplier_payments_pkey" PRIMARY KEY using index "supplier_payments_pkey";

alter table "public"."suppliers" add constraint "suppliers_pkey" PRIMARY KEY using index "suppliers_pkey";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_cost_price_check" CHECK ((aggregated_cost_price >= (0)::numeric)) not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_cost_price_check";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_lowest_negotiable_check" CHECK ((aggregated_lowest_negotiable >= (0)::numeric)) not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_lowest_negotiable_check";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_product_id_fkey";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_product_store_unique" UNIQUE using index "aggregated_stock_product_store_unique";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_quantities_check" CHECK (((total_quantity_remaining >= 0) AND (total_quantity_remaining <= total_quantity_purchased))) not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_quantities_check";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_selling_price_check" CHECK ((aggregated_selling_price >= (0)::numeric)) not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_selling_price_check";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_store_id_fkey";

alter table "public"."aggregated_stock" add constraint "aggregated_stock_threshold_check" CHECK ((low_stock_threshold >= 0)) not valid;

alter table "public"."aggregated_stock" validate constraint "aggregated_stock_threshold_check";

alter table "public"."cashier_accounts" add constraint "cashier_accounts_phone_number_key" UNIQUE using index "cashier_accounts_phone_number_key";

alter table "public"."cashier_accounts" add constraint "cashier_accounts_role_check" CHECK (((role)::text = 'Cashier'::text)) not valid;

alter table "public"."cashier_accounts" validate constraint "cashier_accounts_role_check";

alter table "public"."cashier_accounts" add constraint "cashier_accounts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."cashier_accounts" validate constraint "cashier_accounts_store_id_fkey";

alter table "public"."cashiers" add constraint "cashiers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."cashiers" validate constraint "cashiers_store_id_fkey";

alter table "public"."categories" add constraint "categories_store_id_name_key" UNIQUE using index "categories_store_id_name_key";

alter table "public"."customer_payments" add constraint "customer_payments_payment_amount_check" CHECK ((payment_amount > (0)::numeric)) not valid;

alter table "public"."customer_payments" validate constraint "customer_payments_payment_amount_check";

alter table "public"."customer_payments" add constraint "customer_payments_payment_method_check" CHECK (((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('Digital'::character varying)::text]))) not valid;

alter table "public"."customer_payments" validate constraint "customer_payments_payment_method_check";

alter table "public"."customer_payments" add constraint "customer_payments_recorder_check" CHECK ((((recorded_by IS NOT NULL) AND (cashier_id IS NULL)) OR ((recorded_by IS NULL) AND (cashier_id IS NOT NULL)))) not valid;

alter table "public"."customer_payments" validate constraint "customer_payments_recorder_check";

alter table "public"."customer_payments" add constraint "fk_customer_payment_partial_payment" FOREIGN KEY (partial_payment_customer_id) REFERENCES public.partial_payment_customers(id) ON DELETE CASCADE not valid;

alter table "public"."customer_payments" validate constraint "fk_customer_payment_partial_payment";

alter table "public"."customer_payments" add constraint "fk_customer_payment_sale" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE not valid;

alter table "public"."customer_payments" validate constraint "fk_customer_payment_sale";

alter table "public"."customer_payments" add constraint "fk_customer_payment_store" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."customer_payments" validate constraint "fk_customer_payment_store";

alter table "public"."expenses" add constraint "expenses_amount_check" CHECK ((amount >= (0)::numeric)) not valid;

alter table "public"."expenses" validate constraint "expenses_amount_check";

alter table "public"."expenses" add constraint "expenses_payment_method_check" CHECK (((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('Digital'::character varying)::text]))) not valid;

alter table "public"."expenses" validate constraint "expenses_payment_method_check";

alter table "public"."expenses" add constraint "expenses_recorded_by_cashier_id_fkey" FOREIGN KEY (recorded_by_cashier_id) REFERENCES public.cashier_accounts(id) not valid;

alter table "public"."expenses" validate constraint "expenses_recorded_by_cashier_id_fkey";

alter table "public"."expenses" add constraint "expenses_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."expenses" validate constraint "expenses_store_id_fkey";

alter table "public"."initial_customer_entries" add constraint "initial_customer_entries_amount_owed_check" CHECK ((amount_owed >= (0)::numeric)) not valid;

alter table "public"."initial_customer_entries" validate constraint "initial_customer_entries_amount_owed_check";

alter table "public"."initial_customer_entries" add constraint "initial_customer_entries_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."initial_customer_entries" validate constraint "initial_customer_entries_store_id_fkey";

alter table "public"."initial_supplier_entries" add constraint "initial_supplier_entries_amount_owed_check" CHECK ((amount_owed >= (0)::numeric)) not valid;

alter table "public"."initial_supplier_entries" validate constraint "initial_supplier_entries_amount_owed_check";

alter table "public"."initial_supplier_entries" add constraint "initial_supplier_entries_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."initial_supplier_entries" validate constraint "initial_supplier_entries_store_id_fkey";

alter table "public"."join_requests" add constraint "join_requests_status_check" CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))) not valid;

alter table "public"."join_requests" validate constraint "join_requests_status_check";

alter table "public"."join_requests" add constraint "join_requests_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."join_requests" validate constraint "join_requests_store_id_fkey";

alter table "public"."join_requests" add constraint "join_requests_user_type_check" CHECK (((user_type)::text = ANY (ARRAY[('Manager'::character varying)::text, ('Cashier'::character varying)::text]))) not valid;

alter table "public"."join_requests" validate constraint "join_requests_user_type_check";

alter table "public"."managers" add constraint "managers_email_key" UNIQUE using index "managers_email_key";

alter table "public"."managers" add constraint "managers_phone_number_key" UNIQUE using index "managers_phone_number_key";

alter table "public"."managers" add constraint "managers_store_code_key" UNIQUE using index "managers_store_code_key";

alter table "public"."managers" add constraint "managers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."managers" validate constraint "managers_store_id_fkey";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_amount_paid_check" CHECK ((amount_paid >= (0)::numeric)) not valid;

alter table "public"."partial_payment_customers" validate constraint "partial_payment_customers_amount_paid_check";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_amount_remaining_check" CHECK ((amount_remaining >= (0)::numeric)) not valid;

alter table "public"."partial_payment_customers" validate constraint "partial_payment_customers_amount_remaining_check";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE not valid;

alter table "public"."partial_payment_customers" validate constraint "partial_payment_customers_sale_id_fkey";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."partial_payment_customers" validate constraint "partial_payment_customers_store_id_fkey";

alter table "public"."partial_payment_customers" add constraint "partial_payment_customers_total_amount_check" CHECK ((total_amount >= (0)::numeric)) not valid;

alter table "public"."partial_payment_customers" validate constraint "partial_payment_customers_total_amount_check";

alter table "public"."payments" add constraint "payments_amount_check" CHECK ((amount >= (0)::numeric)) not valid;

alter table "public"."payments" validate constraint "payments_amount_check";

alter table "public"."payments" add constraint "payments_recorder_check" CHECK ((((manager_id IS NOT NULL) AND (cashier_id IS NULL)) OR ((manager_id IS NULL) AND (cashier_id IS NOT NULL)))) not valid;

alter table "public"."payments" validate constraint "payments_recorder_check";

alter table "public"."payments" add constraint "payments_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) not valid;

alter table "public"."payments" validate constraint "payments_sale_id_fkey";

alter table "public"."payments" add constraint "payments_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."payments" validate constraint "payments_store_id_fkey";

alter table "public"."predefined_expenses" add constraint "predefined_expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."predefined_expenses" validate constraint "predefined_expenses_created_by_fkey";

alter table "public"."predefined_expenses" add constraint "predefined_expenses_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."predefined_expenses" validate constraint "predefined_expenses_store_id_fkey";

alter table "public"."product_imeis" add constraint "product_imeis_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.stock_batches(id) ON DELETE SET NULL not valid;

alter table "public"."product_imeis" validate constraint "product_imeis_batch_id_fkey";

alter table "public"."product_imeis" add constraint "product_imeis_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."product_imeis" validate constraint "product_imeis_product_id_fkey";

alter table "public"."product_imeis" add constraint "product_imeis_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL not valid;

alter table "public"."product_imeis" validate constraint "product_imeis_sale_id_fkey";

alter table "public"."product_imeis" add constraint "product_imeis_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."product_imeis" validate constraint "product_imeis_store_id_fkey";

alter table "public"."product_imeis" add constraint "unique_imei_per_store" UNIQUE using index "unique_imei_per_store";

alter table "public"."products" add constraint "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_category_id_fkey";

alter table "public"."products" add constraint "products_sku_store_id_key" UNIQUE using index "products_sku_store_id_key";

alter table "public"."products" add constraint "products_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."products" validate constraint "products_store_id_fkey";

alter table "public"."products" add constraint "products_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_subcategory_id_fkey";

alter table "public"."sale_items" add constraint "sale_items_cost_price_snapshot_check" CHECK ((cost_price_snapshot >= (0)::numeric)) not valid;

alter table "public"."sale_items" validate constraint "sale_items_cost_price_snapshot_check";

alter table "public"."sale_items" add constraint "sale_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT not valid;

alter table "public"."sale_items" validate constraint "sale_items_product_id_fkey";

alter table "public"."sale_items" add constraint "sale_items_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."sale_items" validate constraint "sale_items_quantity_check";

alter table "public"."sale_items" add constraint "sale_items_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE not valid;

alter table "public"."sale_items" validate constraint "sale_items_sale_id_fkey";

alter table "public"."sale_items" add constraint "sale_items_subtotal_check" CHECK ((subtotal >= (0)::numeric)) not valid;

alter table "public"."sale_items" validate constraint "sale_items_subtotal_check";

alter table "public"."sale_items" add constraint "sale_items_unit_price_check" CHECK ((unit_price >= (0)::numeric)) not valid;

alter table "public"."sale_items" validate constraint "sale_items_unit_price_check";

alter table "public"."sales" add constraint "sales_amount_due_check" CHECK ((amount_due >= (0)::numeric)) not valid;

alter table "public"."sales" validate constraint "sales_amount_due_check";

alter table "public"."sales" add constraint "sales_amount_paid_check" CHECK ((amount_paid >= (0)::numeric)) not valid;

alter table "public"."sales" validate constraint "sales_amount_paid_check";

alter table "public"."sales" add constraint "sales_cashier_ref_id_fkey" FOREIGN KEY (cashier_ref_id) REFERENCES public.cashiers(id) not valid;

alter table "public"."sales" validate constraint "sales_cashier_ref_id_fkey";

alter table "public"."sales" add constraint "sales_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.partial_payment_customers(id) ON DELETE SET NULL not valid;

alter table "public"."sales" validate constraint "sales_customer_id_fkey";

alter table "public"."sales" add constraint "sales_discount_type_check" CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('amount'::character varying)::text, ('none'::character varying)::text]))) not valid;

alter table "public"."sales" validate constraint "sales_discount_type_check";

alter table "public"."sales" add constraint "sales_discount_value_check" CHECK ((discount_value >= (0)::numeric)) not valid;

alter table "public"."sales" validate constraint "sales_discount_value_check";

alter table "public"."sales" add constraint "sales_payment_method_check" CHECK (((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('Digital'::character varying)::text]))) not valid;

alter table "public"."sales" validate constraint "sales_payment_method_check";

alter table "public"."sales" add constraint "sales_payment_status_check" CHECK (((payment_status)::text = ANY (ARRAY[('Paid'::character varying)::text, ('Partial'::character varying)::text, ('Pending'::character varying)::text]))) not valid;

alter table "public"."sales" validate constraint "sales_payment_status_check";

alter table "public"."sales" add constraint "sales_sale_number_store_id_key" UNIQUE using index "sales_sale_number_store_id_key";

alter table "public"."sales" add constraint "sales_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."sales" validate constraint "sales_store_id_fkey";

alter table "public"."sales" add constraint "sales_total_amount_check" CHECK ((total_amount >= (0)::numeric)) not valid;

alter table "public"."sales" validate constraint "sales_total_amount_check";

alter table "public"."sales" add constraint "unique_sale_number_per_store" UNIQUE using index "unique_sale_number_per_store";

alter table "public"."stock_batches" add constraint "check_remaining_qty" CHECK (((quantity_remaining >= 0) AND (quantity_remaining <= quantity_purchased))) not valid;

alter table "public"."stock_batches" validate constraint "check_remaining_qty";

alter table "public"."stock_batches" add constraint "stock_batches_lowest_negotiable_check" CHECK ((lowest_negotiable_price >= (0)::numeric)) not valid;

alter table "public"."stock_batches" validate constraint "stock_batches_lowest_negotiable_check";

alter table "public"."stock_batches" add constraint "stock_batches_payment_method_check" CHECK (((payment_method)::text = ANY ((ARRAY['Cash'::character varying, 'Digital'::character varying])::text[]))) not valid;

alter table "public"."stock_batches" validate constraint "stock_batches_payment_method_check";

alter table "public"."stock_batches" add constraint "stock_batches_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."stock_batches" validate constraint "stock_batches_product_id_fkey";

alter table "public"."stock_batches" add constraint "stock_batches_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."stock_batches" validate constraint "stock_batches_store_id_fkey";

alter table "public"."stock_batches" add constraint "stock_batches_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."stock_batches" validate constraint "stock_batches_supplier_id_fkey";

alter table "public"."stores" add constraint "stores_store_code_key" UNIQUE using index "stores_store_code_key";

alter table "public"."subcategories" add constraint "subcategories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."subcategories" validate constraint "subcategories_category_id_fkey";

alter table "public"."subcategories" add constraint "subcategories_category_id_name_key" UNIQUE using index "subcategories_category_id_name_key";

alter table "public"."supplier_khaata" add constraint "fk_supplier_khaata_stock_batch" FOREIGN KEY (stock_batch_id) REFERENCES public.stock_batches(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_khaata" validate constraint "fk_supplier_khaata_stock_batch";

alter table "public"."supplier_khaata" add constraint "fk_supplier_khaata_store" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_khaata" validate constraint "fk_supplier_khaata_store";

alter table "public"."supplier_khaata" add constraint "fk_supplier_khaata_supplier" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_khaata" validate constraint "fk_supplier_khaata_supplier";

alter table "public"."supplier_khaata" add constraint "supplier_khaata_amount_paid_check" CHECK ((amount_paid >= (0)::numeric)) not valid;

alter table "public"."supplier_khaata" validate constraint "supplier_khaata_amount_paid_check";

alter table "public"."supplier_khaata" add constraint "supplier_khaata_amount_remaining_check" CHECK ((amount_remaining >= (0)::numeric)) not valid;

alter table "public"."supplier_khaata" validate constraint "supplier_khaata_amount_remaining_check";

alter table "public"."supplier_khaata" add constraint "supplier_khaata_total_amount_check" CHECK ((total_amount >= (0)::numeric)) not valid;

alter table "public"."supplier_khaata" validate constraint "supplier_khaata_total_amount_check";

alter table "public"."supplier_khaata_payments" add constraint "fk_supplier_khaata_payment_store" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_khaata_payments" validate constraint "fk_supplier_khaata_payment_store";

alter table "public"."supplier_khaata_payments" add constraint "fk_supplier_khaata_payment_supplier" FOREIGN KEY (supplier_khaata_id) REFERENCES public.supplier_khaata(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_khaata_payments" validate constraint "fk_supplier_khaata_payment_supplier";

alter table "public"."supplier_khaata_payments" add constraint "supplier_khaata_payments_payment_amount_check" CHECK ((payment_amount > (0)::numeric)) not valid;

alter table "public"."supplier_khaata_payments" validate constraint "supplier_khaata_payments_payment_amount_check";

alter table "public"."supplier_khaata_payments" add constraint "supplier_khaata_payments_payment_method_check" CHECK (((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('Digital'::character varying)::text]))) not valid;

alter table "public"."supplier_khaata_payments" validate constraint "supplier_khaata_payments_payment_method_check";

alter table "public"."supplier_khaata_payments" add constraint "supplier_khaata_payments_recorder_check" CHECK ((((recorded_by IS NOT NULL) AND (cashier_id IS NULL)) OR ((recorded_by IS NULL) AND (cashier_id IS NOT NULL)))) not valid;

alter table "public"."supplier_khaata_payments" validate constraint "supplier_khaata_payments_recorder_check";

alter table "public"."supplier_payments" add constraint "supplier_payments_payment_method_check" CHECK (((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('Digital'::character varying)::text]))) not valid;

alter table "public"."supplier_payments" validate constraint "supplier_payments_payment_method_check";

alter table "public"."supplier_payments" add constraint "supplier_payments_recorded_by_manager_id_fkey" FOREIGN KEY (recorded_by_manager_id) REFERENCES public.managers(id) not valid;

alter table "public"."supplier_payments" validate constraint "supplier_payments_recorded_by_manager_id_fkey";

alter table "public"."supplier_payments" add constraint "supplier_payments_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE not valid;

alter table "public"."supplier_payments" validate constraint "supplier_payments_supplier_id_fkey";

alter table "public"."suppliers" add constraint "suppliers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."suppliers" validate constraint "suppliers_store_id_fkey";

alter table "public"."suppliers" add constraint "unique_supplier_phone_per_store" UNIQUE using index "unique_supplier_phone_per_store";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_restock_expense()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  product_name TEXT;
  is_new_product BOOLEAN;
  expense_description TEXT;
BEGIN
  -- Only create expense if this is NOT initial stock
  IF NEW.is_initial_stock = FALSE THEN
    -- Get product name
    SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
    
    -- Check if this is a new product (first batch for this product)
    -- If batch_number ends with '-1', it's the first batch for this product
    is_new_product := (NEW.batch_number LIKE '%-1');
    
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
      NEW.cost_price * NEW.quantity_purchased,
      NEW.purchase_date::date,
      NEW.id,
      COALESCE(NEW.payment_method, 'Cash')
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(p_product_id integer, p_store_id integer, p_quantity integer, p_sale_id integer DEFAULT NULL::integer)
 RETURNS TABLE(batch_id integer, quantity_deducted integer, batch_cost_price numeric)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

create or replace view "public"."expense_summary" as  SELECT store_id,
    category,
    date_trunc('day'::text, (expense_date)::timestamp with time zone) AS expense_day,
    date_trunc('month'::text, (expense_date)::timestamp with time zone) AS expense_month,
    date_trunc('year'::text, (expense_date)::timestamp with time zone) AS expense_year,
    count(*) AS transaction_count,
    sum(amount) AS total_amount
   FROM public.expenses
  GROUP BY store_id, category, (date_trunc('day'::text, (expense_date)::timestamp with time zone)), (date_trunc('month'::text, (expense_date)::timestamp with time zone)), (date_trunc('year'::text, (expense_date)::timestamp with time zone));


CREATE OR REPLACE FUNCTION public.generate_batch_number(p_store_id integer, p_product_id integer)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_store_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_next_sale_number(p_store_id integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get the maximum sale number for this store and add 1
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_store_id()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_store_id INTEGER;
BEGIN
    -- Try to get from managers table (Supabase Auth users)
    SELECT store_id INTO user_store_id 
    FROM managers 
    WHERE id = auth.uid();
    
    RETURN user_store_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hash_cashier_password()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2%' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$function$
;

create or replace view "public"."inventory_view" as  SELECT p.id AS product_id,
    p.sku,
    p.name AS product_name,
    p.description,
    p.category,
    p.store_id,
    p.is_active,
    p.is_phone,
    c.id AS category_id,
    c.name AS category_name,
    sc.id AS subcategory_id,
    sc.name AS subcategory_name,
    COALESCE(agg.aggregated_cost_price, (0)::numeric) AS cost_price,
    COALESCE(agg.aggregated_selling_price, (0)::numeric) AS selling_price,
    COALESCE(agg.aggregated_lowest_negotiable, (0)::numeric) AS min_price,
    COALESCE(agg.total_quantity_purchased, 0) AS total_quantity_purchased,
    COALESCE(agg.total_quantity_remaining, 0) AS stock_quantity,
    COALESCE(agg.total_quantity_sold, 0) AS total_quantity_sold,
    COALESCE(agg.low_stock_threshold, 10) AS low_stock_threshold,
    p.created_at,
    p.updated_at,
    agg.updated_at AS last_stock_update
   FROM (((public.products p
     LEFT JOIN public.aggregated_stock agg ON (((agg.product_id = p.id) AND (agg.store_id = p.store_id))))
     LEFT JOIN public.categories c ON ((c.id = p.category_id)))
     LEFT JOIN public.subcategories sc ON ((sc.id = p.subcategory_id)))
  WHERE (p.is_active = true);


CREATE OR REPLACE FUNCTION public.revert_sale_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_sale_number_store()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only set if not already provided
  IF NEW.sale_number_store IS NULL THEN
    NEW.sale_number_store := get_next_sale_number(NEW.store_id);
  END IF;
  
  RETURN NEW;
END;
$function$
;

create or replace view "public"."supplier_khaata_summary" as  SELECT supplier_id,
    supplier_name,
    supplier_phone,
    store_id,
    count(id) AS total_transactions,
    sum(total_amount) AS total_amount,
    sum(amount_paid) AS total_paid,
    sum(amount_remaining) AS total_remaining,
    min(created_at) AS first_transaction,
    max(updated_at) AS last_updated
   FROM public.supplier_khaata sk
  GROUP BY supplier_id, supplier_name, supplier_phone, store_id;


CREATE OR REPLACE FUNCTION public.trigger_update_average_price()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update average price when batch changes
  PERFORM update_product_average_price(NEW.product_id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_aggregated_stock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_aggregated_stock_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_predefined_expenses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_supplier_khaata_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_cashier_login(identifier text, password_input text)
 RETURNS TABLE(id integer, full_name character varying, phone_number character varying, store_id integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

grant delete on table "public"."aggregated_stock" to "anon";

grant insert on table "public"."aggregated_stock" to "anon";

grant references on table "public"."aggregated_stock" to "anon";

grant select on table "public"."aggregated_stock" to "anon";

grant trigger on table "public"."aggregated_stock" to "anon";

grant truncate on table "public"."aggregated_stock" to "anon";

grant update on table "public"."aggregated_stock" to "anon";

grant delete on table "public"."aggregated_stock" to "authenticated";

grant insert on table "public"."aggregated_stock" to "authenticated";

grant references on table "public"."aggregated_stock" to "authenticated";

grant select on table "public"."aggregated_stock" to "authenticated";

grant trigger on table "public"."aggregated_stock" to "authenticated";

grant truncate on table "public"."aggregated_stock" to "authenticated";

grant update on table "public"."aggregated_stock" to "authenticated";

grant delete on table "public"."aggregated_stock" to "service_role";

grant insert on table "public"."aggregated_stock" to "service_role";

grant references on table "public"."aggregated_stock" to "service_role";

grant select on table "public"."aggregated_stock" to "service_role";

grant trigger on table "public"."aggregated_stock" to "service_role";

grant truncate on table "public"."aggregated_stock" to "service_role";

grant update on table "public"."aggregated_stock" to "service_role";

grant delete on table "public"."cashier_accounts" to "anon";

grant insert on table "public"."cashier_accounts" to "anon";

grant references on table "public"."cashier_accounts" to "anon";

grant select on table "public"."cashier_accounts" to "anon";

grant trigger on table "public"."cashier_accounts" to "anon";

grant truncate on table "public"."cashier_accounts" to "anon";

grant update on table "public"."cashier_accounts" to "anon";

grant delete on table "public"."cashier_accounts" to "authenticated";

grant insert on table "public"."cashier_accounts" to "authenticated";

grant references on table "public"."cashier_accounts" to "authenticated";

grant select on table "public"."cashier_accounts" to "authenticated";

grant trigger on table "public"."cashier_accounts" to "authenticated";

grant truncate on table "public"."cashier_accounts" to "authenticated";

grant update on table "public"."cashier_accounts" to "authenticated";

grant delete on table "public"."cashier_accounts" to "service_role";

grant insert on table "public"."cashier_accounts" to "service_role";

grant references on table "public"."cashier_accounts" to "service_role";

grant select on table "public"."cashier_accounts" to "service_role";

grant trigger on table "public"."cashier_accounts" to "service_role";

grant truncate on table "public"."cashier_accounts" to "service_role";

grant update on table "public"."cashier_accounts" to "service_role";

grant delete on table "public"."cashiers" to "anon";

grant insert on table "public"."cashiers" to "anon";

grant references on table "public"."cashiers" to "anon";

grant select on table "public"."cashiers" to "anon";

grant trigger on table "public"."cashiers" to "anon";

grant truncate on table "public"."cashiers" to "anon";

grant update on table "public"."cashiers" to "anon";

grant delete on table "public"."cashiers" to "authenticated";

grant insert on table "public"."cashiers" to "authenticated";

grant references on table "public"."cashiers" to "authenticated";

grant select on table "public"."cashiers" to "authenticated";

grant trigger on table "public"."cashiers" to "authenticated";

grant truncate on table "public"."cashiers" to "authenticated";

grant update on table "public"."cashiers" to "authenticated";

grant delete on table "public"."cashiers" to "service_role";

grant insert on table "public"."cashiers" to "service_role";

grant references on table "public"."cashiers" to "service_role";

grant select on table "public"."cashiers" to "service_role";

grant trigger on table "public"."cashiers" to "service_role";

grant truncate on table "public"."cashiers" to "service_role";

grant update on table "public"."cashiers" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."customer_payments" to "anon";

grant insert on table "public"."customer_payments" to "anon";

grant references on table "public"."customer_payments" to "anon";

grant select on table "public"."customer_payments" to "anon";

grant trigger on table "public"."customer_payments" to "anon";

grant truncate on table "public"."customer_payments" to "anon";

grant update on table "public"."customer_payments" to "anon";

grant delete on table "public"."customer_payments" to "authenticated";

grant insert on table "public"."customer_payments" to "authenticated";

grant references on table "public"."customer_payments" to "authenticated";

grant select on table "public"."customer_payments" to "authenticated";

grant trigger on table "public"."customer_payments" to "authenticated";

grant truncate on table "public"."customer_payments" to "authenticated";

grant update on table "public"."customer_payments" to "authenticated";

grant delete on table "public"."customer_payments" to "service_role";

grant insert on table "public"."customer_payments" to "service_role";

grant references on table "public"."customer_payments" to "service_role";

grant select on table "public"."customer_payments" to "service_role";

grant trigger on table "public"."customer_payments" to "service_role";

grant truncate on table "public"."customer_payments" to "service_role";

grant update on table "public"."customer_payments" to "service_role";

grant delete on table "public"."expenses" to "anon";

grant insert on table "public"."expenses" to "anon";

grant references on table "public"."expenses" to "anon";

grant select on table "public"."expenses" to "anon";

grant trigger on table "public"."expenses" to "anon";

grant truncate on table "public"."expenses" to "anon";

grant update on table "public"."expenses" to "anon";

grant delete on table "public"."expenses" to "authenticated";

grant insert on table "public"."expenses" to "authenticated";

grant references on table "public"."expenses" to "authenticated";

grant select on table "public"."expenses" to "authenticated";

grant trigger on table "public"."expenses" to "authenticated";

grant truncate on table "public"."expenses" to "authenticated";

grant update on table "public"."expenses" to "authenticated";

grant delete on table "public"."expenses" to "service_role";

grant insert on table "public"."expenses" to "service_role";

grant references on table "public"."expenses" to "service_role";

grant select on table "public"."expenses" to "service_role";

grant trigger on table "public"."expenses" to "service_role";

grant truncate on table "public"."expenses" to "service_role";

grant update on table "public"."expenses" to "service_role";

grant delete on table "public"."initial_customer_entries" to "anon";

grant insert on table "public"."initial_customer_entries" to "anon";

grant references on table "public"."initial_customer_entries" to "anon";

grant select on table "public"."initial_customer_entries" to "anon";

grant trigger on table "public"."initial_customer_entries" to "anon";

grant truncate on table "public"."initial_customer_entries" to "anon";

grant update on table "public"."initial_customer_entries" to "anon";

grant delete on table "public"."initial_customer_entries" to "authenticated";

grant insert on table "public"."initial_customer_entries" to "authenticated";

grant references on table "public"."initial_customer_entries" to "authenticated";

grant select on table "public"."initial_customer_entries" to "authenticated";

grant trigger on table "public"."initial_customer_entries" to "authenticated";

grant truncate on table "public"."initial_customer_entries" to "authenticated";

grant update on table "public"."initial_customer_entries" to "authenticated";

grant delete on table "public"."initial_customer_entries" to "service_role";

grant insert on table "public"."initial_customer_entries" to "service_role";

grant references on table "public"."initial_customer_entries" to "service_role";

grant select on table "public"."initial_customer_entries" to "service_role";

grant trigger on table "public"."initial_customer_entries" to "service_role";

grant truncate on table "public"."initial_customer_entries" to "service_role";

grant update on table "public"."initial_customer_entries" to "service_role";

grant delete on table "public"."initial_supplier_entries" to "anon";

grant insert on table "public"."initial_supplier_entries" to "anon";

grant references on table "public"."initial_supplier_entries" to "anon";

grant select on table "public"."initial_supplier_entries" to "anon";

grant trigger on table "public"."initial_supplier_entries" to "anon";

grant truncate on table "public"."initial_supplier_entries" to "anon";

grant update on table "public"."initial_supplier_entries" to "anon";

grant delete on table "public"."initial_supplier_entries" to "authenticated";

grant insert on table "public"."initial_supplier_entries" to "authenticated";

grant references on table "public"."initial_supplier_entries" to "authenticated";

grant select on table "public"."initial_supplier_entries" to "authenticated";

grant trigger on table "public"."initial_supplier_entries" to "authenticated";

grant truncate on table "public"."initial_supplier_entries" to "authenticated";

grant update on table "public"."initial_supplier_entries" to "authenticated";

grant delete on table "public"."initial_supplier_entries" to "service_role";

grant insert on table "public"."initial_supplier_entries" to "service_role";

grant references on table "public"."initial_supplier_entries" to "service_role";

grant select on table "public"."initial_supplier_entries" to "service_role";

grant trigger on table "public"."initial_supplier_entries" to "service_role";

grant truncate on table "public"."initial_supplier_entries" to "service_role";

grant update on table "public"."initial_supplier_entries" to "service_role";

grant delete on table "public"."join_requests" to "anon";

grant insert on table "public"."join_requests" to "anon";

grant references on table "public"."join_requests" to "anon";

grant select on table "public"."join_requests" to "anon";

grant trigger on table "public"."join_requests" to "anon";

grant truncate on table "public"."join_requests" to "anon";

grant update on table "public"."join_requests" to "anon";

grant delete on table "public"."join_requests" to "authenticated";

grant insert on table "public"."join_requests" to "authenticated";

grant references on table "public"."join_requests" to "authenticated";

grant select on table "public"."join_requests" to "authenticated";

grant trigger on table "public"."join_requests" to "authenticated";

grant truncate on table "public"."join_requests" to "authenticated";

grant update on table "public"."join_requests" to "authenticated";

grant delete on table "public"."join_requests" to "service_role";

grant insert on table "public"."join_requests" to "service_role";

grant references on table "public"."join_requests" to "service_role";

grant select on table "public"."join_requests" to "service_role";

grant trigger on table "public"."join_requests" to "service_role";

grant truncate on table "public"."join_requests" to "service_role";

grant update on table "public"."join_requests" to "service_role";

grant delete on table "public"."managers" to "anon";

grant insert on table "public"."managers" to "anon";

grant references on table "public"."managers" to "anon";

grant select on table "public"."managers" to "anon";

grant trigger on table "public"."managers" to "anon";

grant truncate on table "public"."managers" to "anon";

grant update on table "public"."managers" to "anon";

grant delete on table "public"."managers" to "authenticated";

grant insert on table "public"."managers" to "authenticated";

grant references on table "public"."managers" to "authenticated";

grant select on table "public"."managers" to "authenticated";

grant trigger on table "public"."managers" to "authenticated";

grant truncate on table "public"."managers" to "authenticated";

grant update on table "public"."managers" to "authenticated";

grant delete on table "public"."managers" to "service_role";

grant insert on table "public"."managers" to "service_role";

grant references on table "public"."managers" to "service_role";

grant select on table "public"."managers" to "service_role";

grant trigger on table "public"."managers" to "service_role";

grant truncate on table "public"."managers" to "service_role";

grant update on table "public"."managers" to "service_role";

grant delete on table "public"."partial_payment_customers" to "anon";

grant insert on table "public"."partial_payment_customers" to "anon";

grant references on table "public"."partial_payment_customers" to "anon";

grant select on table "public"."partial_payment_customers" to "anon";

grant trigger on table "public"."partial_payment_customers" to "anon";

grant truncate on table "public"."partial_payment_customers" to "anon";

grant update on table "public"."partial_payment_customers" to "anon";

grant delete on table "public"."partial_payment_customers" to "authenticated";

grant insert on table "public"."partial_payment_customers" to "authenticated";

grant references on table "public"."partial_payment_customers" to "authenticated";

grant select on table "public"."partial_payment_customers" to "authenticated";

grant trigger on table "public"."partial_payment_customers" to "authenticated";

grant truncate on table "public"."partial_payment_customers" to "authenticated";

grant update on table "public"."partial_payment_customers" to "authenticated";

grant delete on table "public"."partial_payment_customers" to "service_role";

grant insert on table "public"."partial_payment_customers" to "service_role";

grant references on table "public"."partial_payment_customers" to "service_role";

grant select on table "public"."partial_payment_customers" to "service_role";

grant trigger on table "public"."partial_payment_customers" to "service_role";

grant truncate on table "public"."partial_payment_customers" to "service_role";

grant update on table "public"."partial_payment_customers" to "service_role";

grant delete on table "public"."payments" to "anon";

grant insert on table "public"."payments" to "anon";

grant references on table "public"."payments" to "anon";

grant select on table "public"."payments" to "anon";

grant trigger on table "public"."payments" to "anon";

grant truncate on table "public"."payments" to "anon";

grant update on table "public"."payments" to "anon";

grant delete on table "public"."payments" to "authenticated";

grant insert on table "public"."payments" to "authenticated";

grant references on table "public"."payments" to "authenticated";

grant select on table "public"."payments" to "authenticated";

grant trigger on table "public"."payments" to "authenticated";

grant truncate on table "public"."payments" to "authenticated";

grant update on table "public"."payments" to "authenticated";

grant delete on table "public"."payments" to "service_role";

grant insert on table "public"."payments" to "service_role";

grant references on table "public"."payments" to "service_role";

grant select on table "public"."payments" to "service_role";

grant trigger on table "public"."payments" to "service_role";

grant truncate on table "public"."payments" to "service_role";

grant update on table "public"."payments" to "service_role";

grant delete on table "public"."predefined_expenses" to "anon";

grant insert on table "public"."predefined_expenses" to "anon";

grant references on table "public"."predefined_expenses" to "anon";

grant select on table "public"."predefined_expenses" to "anon";

grant trigger on table "public"."predefined_expenses" to "anon";

grant truncate on table "public"."predefined_expenses" to "anon";

grant update on table "public"."predefined_expenses" to "anon";

grant delete on table "public"."predefined_expenses" to "authenticated";

grant insert on table "public"."predefined_expenses" to "authenticated";

grant references on table "public"."predefined_expenses" to "authenticated";

grant select on table "public"."predefined_expenses" to "authenticated";

grant trigger on table "public"."predefined_expenses" to "authenticated";

grant truncate on table "public"."predefined_expenses" to "authenticated";

grant update on table "public"."predefined_expenses" to "authenticated";

grant delete on table "public"."predefined_expenses" to "service_role";

grant insert on table "public"."predefined_expenses" to "service_role";

grant references on table "public"."predefined_expenses" to "service_role";

grant select on table "public"."predefined_expenses" to "service_role";

grant trigger on table "public"."predefined_expenses" to "service_role";

grant truncate on table "public"."predefined_expenses" to "service_role";

grant update on table "public"."predefined_expenses" to "service_role";

grant delete on table "public"."product_imeis" to "anon";

grant insert on table "public"."product_imeis" to "anon";

grant references on table "public"."product_imeis" to "anon";

grant select on table "public"."product_imeis" to "anon";

grant trigger on table "public"."product_imeis" to "anon";

grant truncate on table "public"."product_imeis" to "anon";

grant update on table "public"."product_imeis" to "anon";

grant delete on table "public"."product_imeis" to "authenticated";

grant insert on table "public"."product_imeis" to "authenticated";

grant references on table "public"."product_imeis" to "authenticated";

grant select on table "public"."product_imeis" to "authenticated";

grant trigger on table "public"."product_imeis" to "authenticated";

grant truncate on table "public"."product_imeis" to "authenticated";

grant update on table "public"."product_imeis" to "authenticated";

grant delete on table "public"."product_imeis" to "service_role";

grant insert on table "public"."product_imeis" to "service_role";

grant references on table "public"."product_imeis" to "service_role";

grant select on table "public"."product_imeis" to "service_role";

grant trigger on table "public"."product_imeis" to "service_role";

grant truncate on table "public"."product_imeis" to "service_role";

grant update on table "public"."product_imeis" to "service_role";

grant delete on table "public"."products" to "anon";

grant insert on table "public"."products" to "anon";

grant references on table "public"."products" to "anon";

grant select on table "public"."products" to "anon";

grant trigger on table "public"."products" to "anon";

grant truncate on table "public"."products" to "anon";

grant update on table "public"."products" to "anon";

grant delete on table "public"."products" to "authenticated";

grant insert on table "public"."products" to "authenticated";

grant references on table "public"."products" to "authenticated";

grant select on table "public"."products" to "authenticated";

grant trigger on table "public"."products" to "authenticated";

grant truncate on table "public"."products" to "authenticated";

grant update on table "public"."products" to "authenticated";

grant delete on table "public"."products" to "service_role";

grant insert on table "public"."products" to "service_role";

grant references on table "public"."products" to "service_role";

grant select on table "public"."products" to "service_role";

grant trigger on table "public"."products" to "service_role";

grant truncate on table "public"."products" to "service_role";

grant update on table "public"."products" to "service_role";

grant delete on table "public"."sale_items" to "anon";

grant insert on table "public"."sale_items" to "anon";

grant references on table "public"."sale_items" to "anon";

grant select on table "public"."sale_items" to "anon";

grant trigger on table "public"."sale_items" to "anon";

grant truncate on table "public"."sale_items" to "anon";

grant update on table "public"."sale_items" to "anon";

grant delete on table "public"."sale_items" to "authenticated";

grant insert on table "public"."sale_items" to "authenticated";

grant references on table "public"."sale_items" to "authenticated";

grant select on table "public"."sale_items" to "authenticated";

grant trigger on table "public"."sale_items" to "authenticated";

grant truncate on table "public"."sale_items" to "authenticated";

grant update on table "public"."sale_items" to "authenticated";

grant delete on table "public"."sale_items" to "service_role";

grant insert on table "public"."sale_items" to "service_role";

grant references on table "public"."sale_items" to "service_role";

grant select on table "public"."sale_items" to "service_role";

grant trigger on table "public"."sale_items" to "service_role";

grant truncate on table "public"."sale_items" to "service_role";

grant update on table "public"."sale_items" to "service_role";

grant delete on table "public"."sales" to "anon";

grant insert on table "public"."sales" to "anon";

grant references on table "public"."sales" to "anon";

grant select on table "public"."sales" to "anon";

grant trigger on table "public"."sales" to "anon";

grant truncate on table "public"."sales" to "anon";

grant update on table "public"."sales" to "anon";

grant delete on table "public"."sales" to "authenticated";

grant insert on table "public"."sales" to "authenticated";

grant references on table "public"."sales" to "authenticated";

grant select on table "public"."sales" to "authenticated";

grant trigger on table "public"."sales" to "authenticated";

grant truncate on table "public"."sales" to "authenticated";

grant update on table "public"."sales" to "authenticated";

grant delete on table "public"."sales" to "service_role";

grant insert on table "public"."sales" to "service_role";

grant references on table "public"."sales" to "service_role";

grant select on table "public"."sales" to "service_role";

grant trigger on table "public"."sales" to "service_role";

grant truncate on table "public"."sales" to "service_role";

grant update on table "public"."sales" to "service_role";

grant delete on table "public"."stock_batches" to "anon";

grant insert on table "public"."stock_batches" to "anon";

grant references on table "public"."stock_batches" to "anon";

grant select on table "public"."stock_batches" to "anon";

grant trigger on table "public"."stock_batches" to "anon";

grant truncate on table "public"."stock_batches" to "anon";

grant update on table "public"."stock_batches" to "anon";

grant delete on table "public"."stock_batches" to "authenticated";

grant insert on table "public"."stock_batches" to "authenticated";

grant references on table "public"."stock_batches" to "authenticated";

grant select on table "public"."stock_batches" to "authenticated";

grant trigger on table "public"."stock_batches" to "authenticated";

grant truncate on table "public"."stock_batches" to "authenticated";

grant update on table "public"."stock_batches" to "authenticated";

grant delete on table "public"."stock_batches" to "service_role";

grant insert on table "public"."stock_batches" to "service_role";

grant references on table "public"."stock_batches" to "service_role";

grant select on table "public"."stock_batches" to "service_role";

grant trigger on table "public"."stock_batches" to "service_role";

grant truncate on table "public"."stock_batches" to "service_role";

grant update on table "public"."stock_batches" to "service_role";

grant delete on table "public"."stores" to "anon";

grant insert on table "public"."stores" to "anon";

grant references on table "public"."stores" to "anon";

grant select on table "public"."stores" to "anon";

grant trigger on table "public"."stores" to "anon";

grant truncate on table "public"."stores" to "anon";

grant update on table "public"."stores" to "anon";

grant delete on table "public"."stores" to "authenticated";

grant insert on table "public"."stores" to "authenticated";

grant references on table "public"."stores" to "authenticated";

grant select on table "public"."stores" to "authenticated";

grant trigger on table "public"."stores" to "authenticated";

grant truncate on table "public"."stores" to "authenticated";

grant update on table "public"."stores" to "authenticated";

grant delete on table "public"."stores" to "service_role";

grant insert on table "public"."stores" to "service_role";

grant references on table "public"."stores" to "service_role";

grant select on table "public"."stores" to "service_role";

grant trigger on table "public"."stores" to "service_role";

grant truncate on table "public"."stores" to "service_role";

grant update on table "public"."stores" to "service_role";

grant delete on table "public"."subcategories" to "anon";

grant insert on table "public"."subcategories" to "anon";

grant references on table "public"."subcategories" to "anon";

grant select on table "public"."subcategories" to "anon";

grant trigger on table "public"."subcategories" to "anon";

grant truncate on table "public"."subcategories" to "anon";

grant update on table "public"."subcategories" to "anon";

grant delete on table "public"."subcategories" to "authenticated";

grant insert on table "public"."subcategories" to "authenticated";

grant references on table "public"."subcategories" to "authenticated";

grant select on table "public"."subcategories" to "authenticated";

grant trigger on table "public"."subcategories" to "authenticated";

grant truncate on table "public"."subcategories" to "authenticated";

grant update on table "public"."subcategories" to "authenticated";

grant delete on table "public"."subcategories" to "service_role";

grant insert on table "public"."subcategories" to "service_role";

grant references on table "public"."subcategories" to "service_role";

grant select on table "public"."subcategories" to "service_role";

grant trigger on table "public"."subcategories" to "service_role";

grant truncate on table "public"."subcategories" to "service_role";

grant update on table "public"."subcategories" to "service_role";

grant delete on table "public"."supplier_khaata" to "anon";

grant insert on table "public"."supplier_khaata" to "anon";

grant references on table "public"."supplier_khaata" to "anon";

grant select on table "public"."supplier_khaata" to "anon";

grant trigger on table "public"."supplier_khaata" to "anon";

grant truncate on table "public"."supplier_khaata" to "anon";

grant update on table "public"."supplier_khaata" to "anon";

grant delete on table "public"."supplier_khaata" to "authenticated";

grant insert on table "public"."supplier_khaata" to "authenticated";

grant references on table "public"."supplier_khaata" to "authenticated";

grant select on table "public"."supplier_khaata" to "authenticated";

grant trigger on table "public"."supplier_khaata" to "authenticated";

grant truncate on table "public"."supplier_khaata" to "authenticated";

grant update on table "public"."supplier_khaata" to "authenticated";

grant delete on table "public"."supplier_khaata" to "service_role";

grant insert on table "public"."supplier_khaata" to "service_role";

grant references on table "public"."supplier_khaata" to "service_role";

grant select on table "public"."supplier_khaata" to "service_role";

grant trigger on table "public"."supplier_khaata" to "service_role";

grant truncate on table "public"."supplier_khaata" to "service_role";

grant update on table "public"."supplier_khaata" to "service_role";

grant delete on table "public"."supplier_khaata_payments" to "anon";

grant insert on table "public"."supplier_khaata_payments" to "anon";

grant references on table "public"."supplier_khaata_payments" to "anon";

grant select on table "public"."supplier_khaata_payments" to "anon";

grant trigger on table "public"."supplier_khaata_payments" to "anon";

grant truncate on table "public"."supplier_khaata_payments" to "anon";

grant update on table "public"."supplier_khaata_payments" to "anon";

grant delete on table "public"."supplier_khaata_payments" to "authenticated";

grant insert on table "public"."supplier_khaata_payments" to "authenticated";

grant references on table "public"."supplier_khaata_payments" to "authenticated";

grant select on table "public"."supplier_khaata_payments" to "authenticated";

grant trigger on table "public"."supplier_khaata_payments" to "authenticated";

grant truncate on table "public"."supplier_khaata_payments" to "authenticated";

grant update on table "public"."supplier_khaata_payments" to "authenticated";

grant delete on table "public"."supplier_khaata_payments" to "service_role";

grant insert on table "public"."supplier_khaata_payments" to "service_role";

grant references on table "public"."supplier_khaata_payments" to "service_role";

grant select on table "public"."supplier_khaata_payments" to "service_role";

grant trigger on table "public"."supplier_khaata_payments" to "service_role";

grant truncate on table "public"."supplier_khaata_payments" to "service_role";

grant update on table "public"."supplier_khaata_payments" to "service_role";

grant delete on table "public"."supplier_payments" to "anon";

grant insert on table "public"."supplier_payments" to "anon";

grant references on table "public"."supplier_payments" to "anon";

grant select on table "public"."supplier_payments" to "anon";

grant trigger on table "public"."supplier_payments" to "anon";

grant truncate on table "public"."supplier_payments" to "anon";

grant update on table "public"."supplier_payments" to "anon";

grant delete on table "public"."supplier_payments" to "authenticated";

grant insert on table "public"."supplier_payments" to "authenticated";

grant references on table "public"."supplier_payments" to "authenticated";

grant select on table "public"."supplier_payments" to "authenticated";

grant trigger on table "public"."supplier_payments" to "authenticated";

grant truncate on table "public"."supplier_payments" to "authenticated";

grant update on table "public"."supplier_payments" to "authenticated";

grant delete on table "public"."supplier_payments" to "service_role";

grant insert on table "public"."supplier_payments" to "service_role";

grant references on table "public"."supplier_payments" to "service_role";

grant select on table "public"."supplier_payments" to "service_role";

grant trigger on table "public"."supplier_payments" to "service_role";

grant truncate on table "public"."supplier_payments" to "service_role";

grant update on table "public"."supplier_payments" to "service_role";

grant delete on table "public"."suppliers" to "anon";

grant insert on table "public"."suppliers" to "anon";

grant references on table "public"."suppliers" to "anon";

grant select on table "public"."suppliers" to "anon";

grant trigger on table "public"."suppliers" to "anon";

grant truncate on table "public"."suppliers" to "anon";

grant update on table "public"."suppliers" to "anon";

grant delete on table "public"."suppliers" to "authenticated";

grant insert on table "public"."suppliers" to "authenticated";

grant references on table "public"."suppliers" to "authenticated";

grant select on table "public"."suppliers" to "authenticated";

grant trigger on table "public"."suppliers" to "authenticated";

grant truncate on table "public"."suppliers" to "authenticated";

grant update on table "public"."suppliers" to "authenticated";

grant delete on table "public"."suppliers" to "service_role";

grant insert on table "public"."suppliers" to "service_role";

grant references on table "public"."suppliers" to "service_role";

grant select on table "public"."suppliers" to "service_role";

grant trigger on table "public"."suppliers" to "service_role";

grant truncate on table "public"."suppliers" to "service_role";

grant update on table "public"."suppliers" to "service_role";


  create policy "Anyone can create cashier account"
  on "public"."cashier_accounts"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can view cashiers in their store"
  on "public"."cashier_accounts"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Managers can delete cashiers in their store"
  on "public"."cashiers"
  as permissive
  for delete
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can insert cashiers in their store"
  on "public"."cashiers"
  as permissive
  for insert
  to public
with check ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can update cashiers in their store"
  on "public"."cashiers"
  as permissive
  for update
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can view cashiers in their store"
  on "public"."cashiers"
  as permissive
  for select
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Anyone authenticated can view categories"
  on "public"."categories"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Managers can delete categories"
  on "public"."categories"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can insert categories"
  on "public"."categories"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can update categories"
  on "public"."categories"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "customer_payments_delete_policy"
  on "public"."customer_payments"
  as permissive
  for delete
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "customer_payments_insert_policy"
  on "public"."customer_payments"
  as permissive
  for insert
  to public
with check ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "customer_payments_select_policy"
  on "public"."customer_payments"
  as permissive
  for select
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "customer_payments_update_policy"
  on "public"."customer_payments"
  as permissive
  for update
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "Managers can delete expenses in their store"
  on "public"."expenses"
  as permissive
  for delete
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Managers can insert expenses to their store"
  on "public"."expenses"
  as permissive
  for insert
  to public
with check ((store_id = public.get_user_store_id()));



  create policy "Managers can update expenses in their store"
  on "public"."expenses"
  as permissive
  for update
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can view expenses from their store"
  on "public"."expenses"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Anyone can create join request"
  on "public"."join_requests"
  as permissive
  for insert
  to public
with check (true);



  create policy "Managers can update join requests for their store"
  on "public"."join_requests"
  as permissive
  for update
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can view join requests for their store"
  on "public"."join_requests"
  as permissive
  for select
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Anyone can create manager account"
  on "public"."managers"
  as permissive
  for insert
  to public
with check (true);



  create policy "Managers can update their own data"
  on "public"."managers"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Managers can view users in their store"
  on "public"."managers"
  as permissive
  for select
  to public
using (((store_id = public.get_user_store_id()) OR (auth.uid() = id)));



  create policy "Users can insert partial payment customers to their store"
  on "public"."partial_payment_customers"
  as permissive
  for insert
  to public
with check ((store_id = public.get_user_store_id()));



  create policy "Users can update partial payment customers in their store"
  on "public"."partial_payment_customers"
  as permissive
  for update
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can view partial payment customers from their store"
  on "public"."partial_payment_customers"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can insert payments to their store"
  on "public"."payments"
  as permissive
  for insert
  to public
with check ((store_id = public.get_user_store_id()));



  create policy "Users can view payments from their store"
  on "public"."payments"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Managers can delete predefined expenses for their store"
  on "public"."predefined_expenses"
  as permissive
  for delete
  to authenticated
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can insert predefined expenses for their store"
  on "public"."predefined_expenses"
  as permissive
  for insert
  to authenticated
with check ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can update predefined expenses for their store"
  on "public"."predefined_expenses"
  as permissive
  for update
  to authenticated
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can view predefined expenses for their store"
  on "public"."predefined_expenses"
  as permissive
  for select
  to authenticated
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "imeis_store_isolation"
  on "public"."product_imeis"
  as permissive
  for all
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid())
UNION
 SELECT cashier_accounts.store_id
   FROM public.cashier_accounts
  WHERE ((cashier_accounts.id)::text = (auth.jwt() ->> 'sub'::text)))));



  create policy "Users can delete products in their store"
  on "public"."products"
  as permissive
  for delete
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can insert products to their store"
  on "public"."products"
  as permissive
  for insert
  to public
with check ((store_id = public.get_user_store_id()));



  create policy "Users can update products in their store"
  on "public"."products"
  as permissive
  for update
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can view products from their store"
  on "public"."products"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can insert sale items to their store sales"
  on "public"."sale_items"
  as permissive
  for insert
  to public
with check ((sale_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.store_id = public.get_user_store_id()))));



  create policy "Users can view sale items from their store"
  on "public"."sale_items"
  as permissive
  for select
  to public
using ((sale_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.store_id = public.get_user_store_id()))));



  create policy "Users can create sales in their store"
  on "public"."sales"
  as permissive
  for insert
  to public
with check ((store_id = public.get_user_store_id()));



  create policy "Users can update sales in their store"
  on "public"."sales"
  as permissive
  for update
  to public
using ((store_id = public.get_user_store_id()));



  create policy "Users can view sales from their store"
  on "public"."sales"
  as permissive
  for select
  to public
using ((store_id = public.get_user_store_id()));



  create policy "batches_store_isolation"
  on "public"."stock_batches"
  as permissive
  for all
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid())
UNION
 SELECT cashier_accounts.store_id
   FROM public.cashier_accounts
  WHERE ((cashier_accounts.id)::text = (auth.jwt() ->> 'sub'::text)))));



  create policy "Managers can create stores"
  on "public"."stores"
  as permissive
  for insert
  to public
with check ((created_by = auth.uid()));



  create policy "Users can view their own store"
  on "public"."stores"
  as permissive
  for select
  to public
using ((id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Anyone authenticated can view subcategories"
  on "public"."subcategories"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Managers can delete subcategories"
  on "public"."subcategories"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can insert subcategories"
  on "public"."subcategories"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "Managers can update subcategories"
  on "public"."subcategories"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.managers
  WHERE (managers.id = auth.uid()))));



  create policy "supplier_khaata_delete_policy"
  on "public"."supplier_khaata"
  as permissive
  for delete
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_insert_policy"
  on "public"."supplier_khaata"
  as permissive
  for insert
  to public
with check ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_select_policy"
  on "public"."supplier_khaata"
  as permissive
  for select
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_update_policy"
  on "public"."supplier_khaata"
  as permissive
  for update
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_payments_delete_policy"
  on "public"."supplier_khaata_payments"
  as permissive
  for delete
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_payments_insert_policy"
  on "public"."supplier_khaata_payments"
  as permissive
  for insert
  to public
with check ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_payments_select_policy"
  on "public"."supplier_khaata_payments"
  as permissive
  for select
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "supplier_khaata_payments_update_policy"
  on "public"."supplier_khaata_payments"
  as permissive
  for update
  to public
using ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.created_by = auth.uid()))));



  create policy "suppliers_store_isolation"
  on "public"."suppliers"
  as permissive
  for all
  to public
using ((store_id IN ( SELECT managers.store_id
   FROM public.managers
  WHERE (managers.id = auth.uid())
UNION
 SELECT cashier_accounts.store_id
   FROM public.cashier_accounts
  WHERE ((cashier_accounts.id)::text = (auth.jwt() ->> 'sub'::text)))));


CREATE TRIGGER update_aggregated_stock_updated_at BEFORE UPDATE ON public.aggregated_stock FOR EACH ROW EXECUTE FUNCTION public.update_aggregated_stock_timestamp();

CREATE TRIGGER hash_cashier_password_trigger BEFORE INSERT ON public.cashier_accounts FOR EACH ROW EXECUTE FUNCTION public.hash_cashier_password();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_predefined_expenses_timestamp BEFORE UPDATE ON public.predefined_expenses FOR EACH ROW EXECUTE FUNCTION public.update_predefined_expenses_updated_at();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_revert_sale_deletion BEFORE DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.revert_sale_deletion();

CREATE TRIGGER trigger_set_sale_number_store BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_sale_number_store();

CREATE TRIGGER trigger_create_restock_expense AFTER INSERT ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.create_restock_expense();

CREATE TRIGGER trigger_update_aggregated_stock AFTER INSERT OR DELETE OR UPDATE ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.update_aggregated_stock();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_khaata_updated_at BEFORE UPDATE ON public.supplier_khaata FOR EACH ROW EXECUTE FUNCTION public.update_supplier_khaata_updated_at();


