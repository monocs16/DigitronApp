-- Attach handle_new_user trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage policies for order-photos bucket
DROP POLICY IF EXISTS "order_photos_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "order_photos_delete_auth" ON storage.objects;

CREATE POLICY "order_photos_select_auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-photos');

CREATE POLICY "order_photos_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "order_photos_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'order-photos');

CREATE POLICY "order_photos_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'order-photos');
