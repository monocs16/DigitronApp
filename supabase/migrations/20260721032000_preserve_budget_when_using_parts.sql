-- Recording a part as used during repair must not recalculate an already
-- quoted/approved budget. Only changes to quoted lines affect parts_cost.
CREATE OR REPLACE FUNCTION public.sync_quoted_parts_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_parts_cost NUMERIC(10,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage <> 'quoted' THEN
      RETURN NEW;
    END IF;
    v_order_id := NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.stage <> 'quoted' THEN
      RETURN OLD;
    END IF;
    v_order_id := OLD.order_id;
  ELSE
    IF OLD.stage <> 'quoted' AND NEW.stage <> 'quoted' THEN
      RETURN NEW;
    END IF;
    v_order_id := NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(quantity * unit_cost_at_registration), 0)
    INTO v_parts_cost
  FROM public.order_parts
  WHERE order_id = v_order_id
    AND stage = 'quoted';

  INSERT INTO public.budgets (order_id, parts_cost)
  VALUES (v_order_id, v_parts_cost)
  ON CONFLICT (order_id) DO UPDATE
    SET parts_cost = EXCLUDED.parts_cost;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Repair budgets changed by the old trigger. It produced a budget UPDATE and
-- a used-part INSERT for the same order at the same transaction timestamp.
WITH affected_budget AS (
  SELECT DISTINCT ON (budget.id)
    budget.id,
    (budget_audit.full_row_old ->> 'parts_cost')::NUMERIC(10,2) AS previous_parts_cost
  FROM public.budgets budget
  JOIN public.audit_log budget_audit
    ON budget_audit.table_name = 'budgets'
   AND budget_audit.operation = 'UPDATE'
   AND budget_audit.record_pk ->> 'id' = budget.id::TEXT
  WHERE budget_audit.changed_fields ? 'parts_cost'
    AND budget.parts_cost = (budget_audit.full_row_new ->> 'parts_cost')::NUMERIC(10,2)
    AND EXISTS (
      SELECT 1
      FROM public.audit_log part_audit
      WHERE part_audit.table_name = 'order_parts'
        AND part_audit.operation = 'INSERT'
        AND part_audit.change_ts = budget_audit.change_ts
        AND part_audit.full_row_new ->> 'order_id' = budget.order_id::TEXT
        AND part_audit.full_row_new ->> 'stage' = 'used'
    )
  ORDER BY budget.id, budget_audit.change_ts DESC
)
UPDATE public.budgets budget
SET parts_cost = affected_budget.previous_parts_cost
FROM affected_budget
WHERE budget.id = affected_budget.id;
