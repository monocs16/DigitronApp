-- ============================================================
-- Digitron — generic, table-agnostic audit log
-- One SECURITY DEFINER trigger function attached to all
-- operational tables. Captures INSERT/UPDATE/DELETE with
-- changed fields and full old/new row snapshots.
-- ============================================================

CREATE TABLE public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  db_user TEXT,
  app_user TEXT,
  record_pk JSONB,
  column_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_fields JSONB,
  full_row_old JSONB,
  full_row_new JSONB
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

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
    jsonb_build_object('id', COALESCE(v_new -> 'id', v_old -> 'id')),
    v_changed, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to all operational tables.
CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_parts AFTER INSERT OR UPDATE OR DELETE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_evaluations AFTER INSERT OR UPDATE OR DELETE ON public.technical_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_budgets AFTER INSERT OR UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_order_parts AFTER INSERT OR UPDATE OR DELETE ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_repairs AFTER INSERT OR UPDATE OR DELETE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
