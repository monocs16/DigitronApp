-- Flatten the order-list relations so PostgREST can combine search, filters,
-- ordering, exact count, and range in one request. security_invoker keeps all
-- underlying table grants and RLS policies in force for the authenticated user.
CREATE VIEW public.orders_list
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  orders.id,
  orders.order_number,
  orders.stage,
  orders.technician_id,
  orders.client_id,
  orders.equipment_id,
  orders.created_at,
  customers.name AS customer_name,
  equipment.brand AS equipment_brand,
  equipment.model AS equipment_model,
  profiles.full_name AS technician_name
FROM public.orders
LEFT JOIN public.customers ON customers.id = orders.client_id
LEFT JOIN public.equipment ON equipment.id = orders.equipment_id
LEFT JOIN public.profiles ON profiles.id = orders.technician_id;

REVOKE ALL ON TABLE public.orders_list FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.orders_list TO authenticated, service_role;

COMMENT ON VIEW public.orders_list IS
  'RLS-preserving read model for server-side order list search, filters, count, sorting, and pagination.';

-- Existing pg_trgm support is established by the customer-search migration.
-- These indexes cover the list searches introduced by the paginated screens.
CREATE INDEX orders_order_number_search_idx
  ON public.orders USING gin (order_number gin_trgm_ops);
CREATE INDEX equipment_description_search_idx
  ON public.equipment USING gin (description gin_trgm_ops);
CREATE INDEX equipment_brand_search_idx
  ON public.equipment USING gin (brand gin_trgm_ops);
CREATE INDEX equipment_model_search_idx
  ON public.equipment USING gin (model gin_trgm_ops);
CREATE INDEX equipment_serial_search_idx
  ON public.equipment USING gin (serial_number gin_trgm_ops);
CREATE INDEX parts_code_search_idx
  ON public.parts USING gin (part_code gin_trgm_ops);
CREATE INDEX parts_description_search_idx
  ON public.parts USING gin (description gin_trgm_ops);
CREATE INDEX parts_technician_code_search_idx
  ON public.parts_technician USING gin (part_code gin_trgm_ops);
CREATE INDEX parts_technician_description_search_idx
  ON public.parts_technician USING gin (description gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
