-- Continue the legacy numeric service-order sequence after imported order 47719.
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_number BIGINT;
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    -- Serialize number allocation so concurrent order creation cannot pick the
    -- same MAX value. Imported orders supply their legacy number explicitly.
    PERFORM pg_advisory_xact_lock(hashtext('public.orders.order_number'));

    SELECT GREATEST(
      47719,
      COALESCE(MAX(order_number::BIGINT), 0)
    ) + 1
    INTO next_number
    FROM public.orders
    WHERE order_number ~ '^[0-9]+$';

    NEW.order_number := next_number::TEXT;
  END IF;
  RETURN NEW;
END;
$$;
