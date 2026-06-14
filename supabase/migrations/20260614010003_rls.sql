-- ============================================================
-- Digitron — RLS policies encoding the role/permission matrix
-- (docs/data-model.md §5). super = full; administrativo / tecnico
-- per module; cliente = no operational access.
-- ============================================================

-- ---------- profiles ----------
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_super_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

-- ---------- user_roles (Seguridad) ----------
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_select_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "user_roles_super_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

-- ---------- customers (Clientes) ----------
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "customers_write" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- equipment (Equipo): admin/super edit, tecnico read ----------
CREATE POLICY "equipment_select" ON public.equipment
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super','tecnico']::public.app_role[]));
CREATE POLICY "equipment_write" ON public.equipment
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- parts (Inventario): admin/super edit, tecnico read ----------
CREATE POLICY "parts_select" ON public.parts
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super','tecnico']::public.app_role[]));
CREATE POLICY "parts_write" ON public.parts
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- orders (Apertura/Cierre admin; tecnico read+transition assigned) ----------
CREATE POLICY "orders_select_admin" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "orders_select_tech_assigned" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'tecnico') AND technician_id = auth.uid());
CREATE POLICY "orders_admin_all" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "orders_tech_update_assigned" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'tecnico') AND technician_id = auth.uid())
  WITH CHECK (
    public.has_role(auth.uid(), 'tecnico')
    AND technician_id = auth.uid()
    AND stage NOT IN ('delivered', 'closed')
  );

-- ---------- technical_evaluations (Evaluación: tecnico INGRESO assigned) ----------
CREATE POLICY "evaluations_select" ON public.technical_evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "evaluations_insert_tech" ON public.technical_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super')
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "evaluations_super_all" ON public.technical_evaluations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

-- ---------- budgets (Presupuesto: admin INGRESO, super MOD) ----------
CREATE POLICY "budgets_select" ON public.budgets
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "budgets_write" ON public.budgets
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- order_parts (quoted in Evaluación, used in Reparación; tecnico assigned) ----------
CREATE POLICY "order_parts_select" ON public.order_parts
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "order_parts_insert" ON public.order_parts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "order_parts_super_all" ON public.order_parts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

-- ---------- repairs (Reparación: tecnico INGRESO assigned, admin read) ----------
CREATE POLICY "repairs_select" ON public.repairs
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "repairs_insert_tech" ON public.repairs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super')
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );
CREATE POLICY "repairs_update_tech" ON public.repairs
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super')
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super')
    OR (public.has_role(auth.uid(), 'tecnico')
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()))
  );

-- ---------- payments (admin INGRESO, super MOD) ----------
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));
CREATE POLICY "payments_write" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- order_photos ----------
CREATE POLICY "order_photos_select" ON public.order_photos
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super','tecnico']::public.app_role[]));
CREATE POLICY "order_photos_insert" ON public.order_photos
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "order_photos_delete" ON public.order_photos
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'super'));

-- ---------- audit_log (read-only; inserts via SECURITY DEFINER trigger) ----------
CREATE POLICY "audit_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

-- ---------- function grants / hardening ----------
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_part_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(public.app_role[]) TO authenticated;
