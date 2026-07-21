ALTER TABLE public.parts
  ADD COLUMN created_from_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX idx_parts_created_from_order
  ON public.parts(created_from_order_id)
  WHERE created_from_order_id IS NOT NULL;

-- An assigned technician may propose a catalog entry only from the active
-- evaluation that they own. Commercial fields remain controlled by admin/super.
CREATE POLICY "parts_insert_assigned_evaluation_technician" ON public.parts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'tecnico')
    AND unit_cost = 0
    AND stock = 0
    AND supplier IS NULL
    AND created_from_order_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = created_from_order_id
        AND o.stage = 'evaluation'
        AND o.technician_id = auth.uid()
    )
  );

-- Associate inventory entries created from an evaluation with that order's
-- audit history while keeping the generic trigger table-agnostic.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_changed JSONB := NULL;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, v_new -> key)
      INTO v_changed
      FROM jsonb_object_keys(v_new) AS key
      WHERE v_new -> key IS DISTINCT FROM v_old -> key;
  END IF;

  INSERT INTO public.audit_log(
    change_ts, schema_name, table_name, operation, db_user, app_user,
    record_pk, changed_fields, full_row_old, full_row_new
  )
  VALUES (
    NOW(), TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, current_user, auth.uid()::TEXT,
    jsonb_strip_nulls(jsonb_build_object(
      'id', COALESCE(v_new -> 'id', v_old -> 'id'),
      'order_id', COALESCE(
        v_new -> 'order_id',
        v_old -> 'order_id',
        v_new -> 'created_from_order_id',
        v_old -> 'created_from_order_id'
      )
    )),
    v_changed, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
