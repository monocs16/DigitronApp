import { supabase } from "@/integrations/supabase/client";

const ORDER_AUDIT_COLUMNS =
  "id, table_name, operation, change_ts, app_user, changed_fields, full_row_old, full_row_new";

const ORDER_CHILD_TABLES = [
  "technical_evaluations",
  "budgets",
  "order_parts",
  "repairs",
  "payments",
  "parts",
  "order_notes",
  "order_photos",
] as const;

export const auditRepository = {
  getByOrderId: async (orderId: string) => {
    const [orderChanges, childChanges] = await Promise.all([
      supabase
        .from("audit_log")
        .select(ORDER_AUDIT_COLUMNS)
        .eq("table_name", "orders")
        .filter("record_pk->>id", "eq", orderId),
      supabase
        .from("audit_log")
        .select(ORDER_AUDIT_COLUMNS)
        .in("table_name", [...ORDER_CHILD_TABLES])
        .or(
          `record_pk->>order_id.eq.${orderId},full_row_new->>order_id.eq.${orderId},full_row_old->>order_id.eq.${orderId}`,
        ),
    ]);

    if (orderChanges.error) throw orderChanges.error;
    if (childChanges.error) throw childChanges.error;

    return [...(orderChanges.data ?? []), ...(childChanges.data ?? [])].sort(
      (a, b) => Date.parse(b.change_ts) - Date.parse(a.change_ts),
    );
  },
};
