import { supabase } from "@/integrations/supabase/client";
import { getPageRange, type PageRequest, type PaginatedResult } from "@/lib/pagination";
import { buildIlikeOrFilter } from "./query-helpers";

const CUSTOMER_LIST_SELECT = "id, name, tax_id, phone1, phone2, email, address";

export type CustomerListRow = {
  id: string;
  name: string;
  tax_id: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
};

function customerSearchFilter(term: string): string {
  return buildIlikeOrFilter(["name", "phone1", "phone2", "tax_id"], term);
}

export const customersRepository = {
  getPage: async ({
    page,
    pageSize,
    search = "",
  }: PageRequest): Promise<PaginatedResult<CustomerListRow>> => {
    const { from, to } = getPageRange(page, pageSize);
    let query = supabase.from("customers").select(CUSTOMER_LIST_SELECT, { count: "exact" });

    if (search.trim()) query = query.or(customerSearchFilter(search));

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { rows: data, count: count ?? 0 };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_LIST_SELECT)
      .order("name");
    if (error) throw error;
    return data;
  },

  getAllMin: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id")
      .order("name");
    if (error) throw error;
    return data;
  },

  search: async (term: string) => {
    const value = term.trim();
    if (value.length < 2) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2")
      .or(customerSearchFilter(value))
      .order("name")
      .limit(20);
    if (error) throw error;
    return data;
  },

  searchWithHistory: async (term: string) => {
    const value = term.trim();
    if (!value) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2, orders(id, order_number, stage, intake_at)")
      .or(customerSearchFilter(value))
      .order("name")
      .limit(50);
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    name: string;
    tax_id: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    address: string | null;
  }) => {
    const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
    if (error) throw error;
    return data.id as string;
  },

  update: async (
    id: string,
    payload: {
      name: string;
      tax_id: string | null;
      phone1: string | null;
      phone2: string | null;
      email: string | null;
      address: string | null;
    },
  ) => {
    const { error } = await supabase.from("customers").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};
