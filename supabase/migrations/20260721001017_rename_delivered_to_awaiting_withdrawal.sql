-- Orders remain actionable after payment or a rejected repair estimate until
-- the customer physically withdraws the equipment.
ALTER TYPE public.order_stage
  RENAME VALUE 'delivered' TO 'awaiting_withdrawal';

NOTIFY pgrst, 'reload schema';
