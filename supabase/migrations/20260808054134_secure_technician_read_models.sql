-- Replace the privileged technician views with transactionally maintained,
-- RLS-protected read models. Keeping the relation names and public columns
-- preserves the Data API contract while removing SECURITY DEFINER views.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

DROP VIEW public.parts_technician;

CREATE TABLE public.parts_technician (
  id UUID PRIMARY KEY REFERENCES public.parts(id) ON DELETE CASCADE,
  part_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

ALTER TABLE public.parts_technician ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parts_technician_select_authorized" ON public.parts_technician
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_any_role(
      ARRAY['administrativo','super','tecnico']::public.app_role[]
    ))
  );

CREATE OR REPLACE FUNCTION private.sync_parts_technician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.parts_technician(id, part_code, description)
  VALUES (NEW.id, NEW.part_code, NEW.description)
  ON CONFLICT (id) DO UPDATE SET
    part_code = EXCLUDED.part_code,
    description = EXCLUDED.description;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.sync_parts_technician()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_sync_parts_technician
  AFTER INSERT OR UPDATE OF part_code, description ON public.parts
  FOR EACH ROW EXECUTE FUNCTION private.sync_parts_technician();

INSERT INTO public.parts_technician(id, part_code, description)
SELECT id, part_code, description
FROM public.parts;

REVOKE ALL ON TABLE public.parts_technician
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.parts_technician TO authenticated, service_role;

COMMENT ON TABLE public.parts_technician IS
  'RLS-protected read model containing only technician-safe inventory fields; maintained from public.parts by an internal trigger.';

DROP VIEW public.order_parts_technician;

CREATE TABLE public.order_parts_technician (
  id UUID PRIMARY KEY REFERENCES public.order_parts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES public.technical_evaluations(id) ON DELETE SET NULL,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  stage TEXT NOT NULL CHECK (stage IN ('quoted', 'used')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.order_parts_technician ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_order_parts_technician_order_created
  ON public.order_parts_technician(order_id, created_at);

CREATE POLICY "order_parts_technician_select_authorized"
  ON public.order_parts_technician
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'super'))
    OR (
      (SELECT public.has_role((SELECT auth.uid()), 'tecnico'))
      AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = order_parts_technician.order_id
          AND o.technician_id = (SELECT auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION private.sync_order_parts_technician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.order_parts_technician(
    id, order_id, evaluation_id, part_id, stage, quantity, created_at
  )
  VALUES (
    NEW.id, NEW.order_id, NEW.evaluation_id, NEW.part_id,
    NEW.stage, NEW.quantity, NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    evaluation_id = EXCLUDED.evaluation_id,
    part_id = EXCLUDED.part_id,
    stage = EXCLUDED.stage,
    quantity = EXCLUDED.quantity,
    created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.sync_order_parts_technician()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_sync_order_parts_technician
  AFTER INSERT OR UPDATE OF order_id, evaluation_id, part_id, stage, quantity, created_at
  ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION private.sync_order_parts_technician();

INSERT INTO public.order_parts_technician(
  id, order_id, evaluation_id, part_id, stage, quantity, created_at
)
SELECT id, order_id, evaluation_id, part_id, stage, quantity, created_at
FROM public.order_parts;

REVOKE ALL ON TABLE public.order_parts_technician
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.order_parts_technician TO authenticated, service_role;

COMMENT ON TABLE public.order_parts_technician IS
  'RLS-protected read model containing only technician-safe order-part fields; maintained from public.order_parts by an internal trigger.';

NOTIFY pgrst, 'reload schema';
