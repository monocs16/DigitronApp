-- Keep the parent order id in the audit key for order-owned records. This makes
-- new history entries directly addressable without discarding the full row
-- snapshots used by older entries.
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
      'order_id', COALESCE(v_new -> 'order_id', v_old -> 'order_id')
    )),
    v_changed, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

-- Notes already use the generic audit trigger. Photos are also part of the
-- order lifecycle and must appear in the same history.
DROP TRIGGER IF EXISTS trg_audit_order_photos ON public.order_photos;
CREATE TRIGGER trg_audit_order_photos
  AFTER INSERT OR UPDATE OR DELETE ON public.order_photos
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Support both new entries (record_pk.order_id) and legacy entries, whose
-- parent id only exists inside the old/new row snapshots.
CREATE INDEX idx_audit_record_order
  ON public.audit_log ((record_pk ->> 'order_id'), change_ts DESC)
  WHERE record_pk ? 'order_id';
CREATE INDEX idx_audit_new_row_order
  ON public.audit_log ((full_row_new ->> 'order_id'), change_ts DESC)
  WHERE full_row_new ? 'order_id';
CREATE INDEX idx_audit_old_row_order
  ON public.audit_log ((full_row_old ->> 'order_id'), change_ts DESC)
  WHERE full_row_old ? 'order_id';
