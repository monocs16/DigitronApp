-- One budget per order lets advances and quoted parts be safely synchronized.
CREATE UNIQUE INDEX budgets_order_unique ON public.budgets(order_id);

CREATE OR REPLACE FUNCTION public.sync_quoted_parts_budget()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID := COALESCE(NEW.order_id, OLD.order_id);
  v_parts_cost NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(quantity * unit_cost_at_registration), 0)
    INTO v_parts_cost
  FROM public.order_parts
  WHERE order_id = v_order_id AND stage = 'quoted';

  INSERT INTO public.budgets (order_id, parts_cost)
  VALUES (v_order_id, v_parts_cost)
  ON CONFLICT (order_id) DO UPDATE
    SET parts_cost = EXCLUDED.parts_cost;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_order_parts_sync_budget
  AFTER INSERT OR DELETE OR UPDATE OF quantity, part_id, stage ON public.order_parts
  FOR EACH ROW EXECUTE FUNCTION public.sync_quoted_parts_budget();

-- Payments may not exceed the approved budget, including an advance registered
-- when the order was opened.
CREATE OR REPLACE FUNCTION public.prevent_payment_overcollection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total NUMERIC(10,2);
  v_paid NUMERIC(10,2);
BEGIN
  SELECT COALESCE(labor_cost, 0) + COALESCE(parts_cost, 0) + COALESCE(freight_cost, 0) + COALESCE(other_charges, 0),
         COALESCE(advances, 0)
    INTO v_total, v_paid
  FROM public.budgets
  WHERE order_id = NEW.order_id;

  SELECT v_paid + COALESCE(SUM(amount), 0)
    INTO v_paid
  FROM public.payments
  WHERE order_id = NEW.order_id;

  IF v_total IS NULL OR v_paid + NEW.amount > v_total THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente de la orden';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_prevent_overcollection
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_overcollection();
