-- ============================================================
-- Digitron — core schema (fresh baseline)
-- Enums, helpers, profiles/roles, customers, equipment, parts,
-- orders, evaluations, budgets, order_parts, repairs, payments.
-- RLS is enabled here; policies live in 20260614010003_rls.sql.
-- ============================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('cliente', 'administrativo', 'tecnico', 'super');

CREATE TYPE public.order_stage AS ENUM (
  'intake', 'evaluation', 'budget', 'customer_decision',
  'on_hold', 'repair', 'payment', 'delivered', 'closed'
);

CREATE TYPE public.budget_decision AS ENUM ('approved', 'deferred', 'rejected');

-- ============ SHARED HELPERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

-- ============ PROFILES + ROLES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles live in a dedicated table (never on profiles) per ENGINEERING.md.
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: SECURITY DEFINER to avoid RLS recursion.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Convenience: does the current user have any of the given roles?
CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)
  );
$$;

-- Auto-create profile + role on signup. First user becomes 'super', rest 'tecnico'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  assigned_role := CASE WHEN user_count = 0 THEN 'super' ELSE 'tecnico' END;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  phone1 TEXT,
  phone2 TEXT,
  email TEXT,
  address TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_touch BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EQUIPMENT ============
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  accessories TEXT,
  purchase_invoice TEXT,
  purchase_store TEXT,
  purchase_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- ============ PARTS (inventory) ============
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_parts_touch BEFORE UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT '',
  client_id UUID NOT NULL REFERENCES public.customers(id),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  technician_id UUID REFERENCES public.profiles(id),
  stage public.order_stage NOT NULL DEFAULT 'intake',
  source TEXT,
  reported_fault TEXT NOT NULL,
  general_notes TEXT,
  warranty_origin_id UUID REFERENCES public.orders(id),
  intake_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_at TIMESTAMPTZ,
  authorized BOOLEAN NOT NULL DEFAULT FALSE,
  balance_waived BOOLEAN NOT NULL DEFAULT FALSE,
  received_by TEXT,
  closing_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order number: ORD-YYYY-####, sequential per year.
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  yr TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq INT;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    SELECT COUNT(*) + 1 INTO seq FROM public.orders
      WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.order_number := 'ORD-' || yr || '-' || LPAD(seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_set_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TECHNICAL EVALUATIONS ============
CREATE TABLE public.technical_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.profiles(id),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diagnosis TEXT NOT NULL,
  technical_notes TEXT
);
ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  labor_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  parts_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  freight_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  advances NUMERIC(10,2) NOT NULL DEFAULT 0,
  decision public.budget_decision,
  deferred_reason TEXT,
  decided_at TIMESTAMPTZ,
  customer_comments TEXT,
  budgeted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_budgets_touch BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ORDER PARTS (line items) ============
CREATE TABLE public.order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES public.technical_evaluations(id) ON DELETE SET NULL,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  stage TEXT NOT NULL DEFAULT 'quoted' CHECK (stage IN ('quoted', 'used')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_at_registration NUMERIC(10,2) NOT NULL DEFAULT 0,
  in_stock_at_registration BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_part_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

-- Decrement stock when a part is recorded as used (transactional; CHECK(stock>=0) guards negatives).
CREATE OR REPLACE FUNCTION public.consume_part_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage = 'used' THEN
    UPDATE public.parts SET stock = stock - NEW.quantity WHERE id = NEW.part_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_order_parts_consume AFTER INSERT ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION public.consume_part_stock();

-- ============ REPAIRS ============
CREATE TABLE public.repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  work_description TEXT,
  state TEXT NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_repairs_touch BEFORE UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_by UUID REFERENCES public.profiles(id)
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============ ORDER PHOTOS ============
CREATE TABLE public.order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_photos ENABLE ROW LEVEL SECURITY;
