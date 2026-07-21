-- A repair may consume only parts previously quoted during this order's
-- technical evaluation. Perform a conditional stock decrement so concurrent
-- repairs cannot push inventory below zero or leak the raw CHECK error.
CREATE OR REPLACE FUNCTION public.consume_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage <> 'used' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_parts quoted
    WHERE quoted.order_id = NEW.order_id
      AND quoted.part_id = NEW.part_id
      AND quoted.stage = 'quoted'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El repuesto debe agregarse primero en la etapa de Evaluacion Tecnica';
  END IF;

  UPDATE public.parts
  SET stock = stock - NEW.quantity
  WHERE id = NEW.part_id
    AND stock >= NEW.quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'No hay suficiente inventario para registrar este repuesto como usado';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_part_stock() FROM PUBLIC, anon, authenticated;
