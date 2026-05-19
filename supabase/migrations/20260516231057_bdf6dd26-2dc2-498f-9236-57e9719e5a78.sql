
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'technician');

CREATE TYPE public.order_status AS ENUM (
  'received', 'diagnosis', 'repair', 'waiting_part',
  'ready', 'delivered', 'closed', 'warranty'
);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'technician',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role helper (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role
  );
$$;

-- Auto-create profile on signup. First user becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    assigned_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: anyone authenticated can read profiles; users update own non-role fields; admins manage all
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_auth" ON public.clients FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "clients_insert_auth" ON public.clients FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "clients_update_auth" ON public.clients FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "clients_delete_admin" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ EQUIPMENT ============
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_select_auth" ON public.equipment FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "equipment_insert_auth" ON public.equipment FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "equipment_update_auth" ON public.equipment FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "equipment_delete_admin" ON public.equipment FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT '',
  client_id UUID NOT NULL REFERENCES public.clients(id),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  technician_id UUID REFERENCES public.profiles(id),
  status public.order_status NOT NULL DEFAULT 'received',
  problem_description TEXT NOT NULL,
  part_waiting_for TEXT,
  estimated_cost NUMERIC(10,2),
  final_cost NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order number trigger
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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

CREATE TRIGGER trg_orders_set_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_clients_touch BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: everyone authenticated can read & create orders; technicians can update own; admins can do all; status transitions to delivered/closed/warranty are admin-only
CREATE POLICY "orders_select_auth" ON public.orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "orders_insert_auth" ON public.orders FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders_tech_update_assigned" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'technician')
    AND technician_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'technician')
    AND technician_id = auth.uid()
    AND status NOT IN ('delivered', 'closed', 'warranty')
  );

-- ============ ORDER PHOTOS ============
CREATE TABLE public.order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select_auth" ON public.order_photos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "photos_insert_auth" ON public.order_photos FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "photos_delete_auth" ON public.order_photos FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_auth" ON public.audit_log FOR SELECT TO authenticated USING (TRUE);
-- inserts go via trigger (SECURITY DEFINER), no policy needed for direct insert; deny by omission

-- Audit trigger
CREATE OR REPLACE FUNCTION public.log_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'created', NULL, NULL, NEW.order_number);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'status_changed', 'status', OLD.status::TEXT, NEW.status::TEXT);
  END IF;
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'field_changed', 'technician_id', OLD.technician_id::TEXT, NEW.technician_id::TEXT);
  END IF;
  IF NEW.part_waiting_for IS DISTINCT FROM OLD.part_waiting_for THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'field_changed', 'part_waiting_for', OLD.part_waiting_for, NEW.part_waiting_for);
  END IF;
  IF NEW.estimated_cost IS DISTINCT FROM OLD.estimated_cost THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'field_changed', 'estimated_cost', OLD.estimated_cost::TEXT, NEW.estimated_cost::TEXT);
  END IF;
  IF NEW.final_cost IS DISTINCT FROM OLD.final_cost THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'field_changed', 'final_cost', OLD.final_cost::TEXT, NEW.final_cost::TEXT);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.audit_log(order_id, user_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, uid, 'field_changed', 'notes', OLD.notes, NEW.notes);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_audit
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_changes();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-photos', 'order-photos', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "order_photos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-photos');
CREATE POLICY "order_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-photos');
CREATE POLICY "order_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-photos');

-- Indexes
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_technician ON public.orders(technician_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_equipment_client ON public.equipment(client_id);
CREATE INDEX idx_audit_order ON public.audit_log(order_id, created_at DESC);
