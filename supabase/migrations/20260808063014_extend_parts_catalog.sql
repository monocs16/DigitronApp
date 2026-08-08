-- Extend the parts catalog with operational metadata and mirror only the
-- technician-safe fields into the RLS-protected read model. Commercial data
-- (stock, unit_cost, supplier) remains available only through public.parts.

ALTER TABLE public.parts
  ADD COLUMN location TEXT,
  ADD COLUMN datasheet TEXT,
  ADD COLUMN nte_substitute TEXT,
  ADD COLUMN image TEXT;

COMMENT ON COLUMN public.parts.location IS
  'Physical storage location for the part.';
COMMENT ON COLUMN public.parts.datasheet IS
  'Optional external URL for the part datasheet.';
COMMENT ON COLUMN public.parts.nte_substitute IS
  'Optional NTE substitute or equivalent part reference.';
COMMENT ON COLUMN public.parts.image IS
  'Optional external URL for a part image.';

ALTER TABLE public.parts_technician
  ADD COLUMN location TEXT,
  ADD COLUMN datasheet TEXT,
  ADD COLUMN nte_substitute TEXT,
  ADD COLUMN image TEXT;

CREATE OR REPLACE FUNCTION private.sync_parts_technician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.parts_technician(
    id,
    part_code,
    location,
    description,
    datasheet,
    nte_substitute,
    image
  )
  VALUES (
    NEW.id,
    NEW.part_code,
    NEW.location,
    NEW.description,
    NEW.datasheet,
    NEW.nte_substitute,
    NEW.image
  )
  ON CONFLICT (id) DO UPDATE SET
    part_code = EXCLUDED.part_code,
    location = EXCLUDED.location,
    description = EXCLUDED.description,
    datasheet = EXCLUDED.datasheet,
    nte_substitute = EXCLUDED.nte_substitute,
    image = EXCLUDED.image;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.sync_parts_technician()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER trg_sync_parts_technician ON public.parts;
CREATE TRIGGER trg_sync_parts_technician
  AFTER INSERT OR UPDATE OF
    part_code,
    location,
    description,
    datasheet,
    nte_substitute,
    image
  ON public.parts
  FOR EACH ROW EXECUTE FUNCTION private.sync_parts_technician();

UPDATE public.parts_technician AS technician_part
SET
  location = part.location,
  datasheet = part.datasheet,
  nte_substitute = part.nte_substitute,
  image = part.image
FROM public.parts AS part
WHERE part.id = technician_part.id;

COMMENT ON TABLE public.parts_technician IS
  'RLS-protected read model containing only technician-safe inventory fields; maintained from public.parts by an internal trigger.';

NOTIFY pgrst, 'reload schema';
