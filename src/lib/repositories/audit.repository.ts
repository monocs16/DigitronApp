import { supabase } from "@/integrations/supabase/client";

export const auditRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, operation, change_ts, app_user, changed_fields, full_row_old")
      .eq("table_name", "orders")
      .filter("record_pk->>id", "eq", orderId)
      .order("change_ts", { ascending: false });
    if (error) throw error;
    return data;
  },
};
