-- ============================================================
-- Digitron — storage bucket, storage policies, and indexes
-- ============================================================

-- ---------- order-photos storage bucket ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-photos', 'order-photos', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "order_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_delete" ON storage.objects;

CREATE POLICY "order_photos_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-photos');
CREATE POLICY "order_photos_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-photos');
CREATE POLICY "order_photos_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'order-photos');
CREATE POLICY "order_photos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-photos');

-- ---------- indexes ----------
CREATE INDEX idx_orders_stage ON public.orders(stage);
CREATE INDEX idx_orders_technician ON public.orders(technician_id);
CREATE INDEX idx_orders_client ON public.orders(client_id);
CREATE INDEX idx_orders_equipment ON public.orders(equipment_id);
CREATE INDEX idx_orders_warranty_origin ON public.orders(warranty_origin_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_equipment_client ON public.equipment(client_id);
CREATE INDEX idx_equipment_serial ON public.equipment(serial_number);
CREATE INDEX idx_evaluations_order ON public.technical_evaluations(order_id);
CREATE INDEX idx_budgets_order ON public.budgets(order_id);
CREATE INDEX idx_order_parts_order ON public.order_parts(order_id);
CREATE INDEX idx_order_parts_part ON public.order_parts(part_id);
CREATE INDEX idx_repairs_order ON public.repairs(order_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_audit_table_pk ON public.audit_log(table_name, (record_pk->>'id'));
CREATE INDEX idx_audit_change_ts ON public.audit_log(change_ts DESC);
