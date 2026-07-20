-- Free-form receipt snapshot used on the service-order form and PDF.
-- This belongs to the order because it describes the equipment on a specific visit.
ALTER TABLE public.orders
  ADD COLUMN equipment_condition TEXT NOT NULL DEFAULT '';
