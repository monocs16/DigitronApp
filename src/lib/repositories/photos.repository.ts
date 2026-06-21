import { supabase } from "@/integrations/supabase/client";

export const photosRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("order_photos")
      .select("id, storage_path, uploaded_at")
      .eq("order_id", orderId);
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: signed } = await supabase.storage.from("order-photos").createSignedUrls(
      rows.map((p) => p.storage_path),
      3600,
    );

    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return rows.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) ?? "" }));
  },

  upload: async (orderId: string, storagePath: string, file: File, uploadedBy: string | null) => {
    const { error: upErr } = await supabase.storage.from("order-photos").upload(storagePath, file);
    if (upErr) throw upErr;

    const { error } = await supabase
      .from("order_photos")
      .insert({ order_id: orderId, storage_path: storagePath, uploaded_by: uploadedBy });
    if (error) throw error;
  },

  delete: async (id: string, storagePath: string) => {
    const { error: storageErr } = await supabase.storage.from("order-photos").remove([storagePath]);
    if (storageErr) throw storageErr;

    const { error } = await supabase.from("order_photos").delete().eq("id", id);
    if (error) throw error;
  },
};
