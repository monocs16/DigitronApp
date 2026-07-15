-- Keeps customer name/ID lookup responsive as the register grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX customers_name_search_idx ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX customers_tax_id_search_idx ON public.customers USING gin (tax_id gin_trgm_ops);
