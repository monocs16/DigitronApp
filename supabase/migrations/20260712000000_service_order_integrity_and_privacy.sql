-- Service-order integrity, independent equipment, and role-safe inventory views.

-- A tax ID / serial number is optional, but a value that is entered must be unique.
CREATE UNIQUE INDEX customers_tax_id_normalized_unique
  ON public.customers ((lower(btrim(tax_id))))
  WHERE NULLIF(btrim(tax_id), '') IS NOT NULL;

CREATE UNIQUE INDEX equipment_serial_number_normalized_unique
  ON public.equipment ((lower(btrim(serial_number))))
  WHERE NULLIF(btrim(serial_number), '') IS NOT NULL;

-- Equipment is an asset with its own service history. An order, not the asset,
-- records which customer brought it in on a particular visit.
DROP INDEX IF EXISTS public.idx_equipment_client;
ALTER TABLE public.equipment DROP COLUMN client_id;
ALTER TABLE public.equipment DROP COLUMN accessories;

-- Accessories are received with a specific service order, not permanently tied
-- to the equipment record.
ALTER TABLE public.orders
  ADD COLUMN received_accessories TEXT;
ALTER TABLE public.orders
  ALTER COLUMN stage SET DEFAULT 'evaluation';

-- Append-only internal notes form the human-readable service log. The generic
-- audit log remains the technical record of database changes.
CREATE TABLE public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_notes_order_created ON public.order_notes(order_id, created_at DESC);

CREATE POLICY "order_notes_select" ON public.order_notes
  FOR SELECT TO authenticated USING (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.technician_id = auth.uid()
        AND public.has_role(auth.uid(), 'tecnico')
    )
  );
CREATE POLICY "order_notes_insert" ON public.order_notes
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND o.technician_id = auth.uid()
          AND public.has_role(auth.uid(), 'tecnico')
      )
    )
  );
CREATE TRIGGER trg_audit_order_notes AFTER INSERT OR UPDATE OR DELETE ON public.order_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Snapshots are derived inside Postgres so a technician never needs to receive
-- inventory cost or stock to add a required/used part.
CREATE OR REPLACE FUNCTION public.set_order_part_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT unit_cost, stock >= NEW.quantity
    INTO NEW.unit_cost_at_registration, NEW.in_stock_at_registration
  FROM public.parts
  WHERE id = NEW.part_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Part not found'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_order_parts_snapshot
  BEFORE INSERT ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION public.set_order_part_snapshot();

-- Restore inventory when a mistakenly recorded used part is removed.
CREATE OR REPLACE FUNCTION public.restore_part_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.stage = 'used' THEN
    UPDATE public.parts SET stock = stock + OLD.quantity WHERE id = OLD.part_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_order_parts_restore
  AFTER DELETE ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION public.restore_part_stock();

CREATE POLICY "order_parts_delete_assigned" ON public.order_parts
  FOR DELETE TO authenticated USING (
    public.has_any_role(ARRAY['administrativo','super']::public.app_role[])
    OR (
      public.has_role(auth.uid(), 'tecnico')
      AND EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid()
      )
    )
  );

-- The base inventory table is commercial information. Technicians receive only
-- the identifiers and descriptions necessary to select a part.
DROP POLICY IF EXISTS "parts_select" ON public.parts;
CREATE POLICY "parts_select_commercial" ON public.parts
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

CREATE VIEW public.parts_technician AS
  SELECT id, part_code, description FROM public.parts;
GRANT SELECT ON public.parts_technician TO authenticated;

DROP POLICY IF EXISTS "order_parts_select" ON public.order_parts;
CREATE POLICY "order_parts_select_commercial" ON public.order_parts
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['administrativo','super']::public.app_role[]));

CREATE VIEW public.order_parts_technician AS
  SELECT op.id, op.order_id, op.evaluation_id, op.part_id, op.stage, op.quantity, op.created_at
  FROM public.order_parts op
  JOIN public.orders o ON o.id = op.order_id
  WHERE public.has_role(auth.uid(), 'super')
     OR (public.has_role(auth.uid(), 'tecnico') AND o.technician_id = auth.uid());
GRANT SELECT ON public.order_parts_technician TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.order_notes TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
