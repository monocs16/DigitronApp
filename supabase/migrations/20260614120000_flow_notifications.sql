-- ============================================================
-- Digitron — recorded customer notifications
-- Captures that the customer was notified at the budget decision
-- and at delivery (timestamp only). Actual email delivery is
-- deferred; the app records and displays these stamps and warns
-- that sending is pending. Audited by the generic audit trigger.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN decision_notified_at TIMESTAMPTZ,
  ADD COLUMN delivery_notified_at TIMESTAMPTZ;
