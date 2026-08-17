import { supabase } from "@/integrations/supabase/client";
import { getPageRange, type PageRequest, type PaginatedResult } from "@/lib/pagination";
import { buildIlikeOrFilter } from "./query-helpers";

export type CommercialPartListRow = {
  id: string;
  part_code: string;
  stock: number;
  location: string | null;
  description: string;
  datasheet: string | null;
  nte_substitute: string | null;
  image: string | null;
  unit_cost: number;
  supplier: string | null;
};

export type TechnicianPartListRow = Omit<CommercialPartListRow, "stock" | "unit_cost" | "supplier">;

const COMMERCIAL_SELECT =
  "id, part_code, stock, location, description, datasheet, nte_substitute, image, unit_cost, supplier";
const TECHNICIAN_SELECT = "id, part_code, location, description, datasheet, nte_substitute, image";

function partSearchFilter(search: string, includeCommercial: boolean) {
  const columns = ["part_code", "location", "description", "nte_substitute"];
  if (includeCommercial) columns.push("supplier");
  return buildIlikeOrFilter(columns, search);
}

export const partsRepository = {
  getPage: async ({
    page,
    pageSize,
    search = "",
  }: PageRequest): Promise<PaginatedResult<CommercialPartListRow>> => {
    const { from, to } = getPageRange(page, pageSize);
    let query = supabase.from("parts").select(COMMERCIAL_SELECT, { count: "exact" });
    if (search.trim()) query = query.or(partSearchFilter(search, true));

    const { data, error, count } = await query
      .order("part_code", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { rows: data, count: count ?? 0 };
  },

  getTechnicianPage: async ({
    page,
    pageSize,
    search = "",
  }: PageRequest): Promise<PaginatedResult<TechnicianPartListRow>> => {
    const { from, to } = getPageRange(page, pageSize);
    let query = supabase.from("parts_technician").select(TECHNICIAN_SELECT, { count: "exact" });
    if (search.trim()) query = query.or(partSearchFilter(search, false));

    const { data, error, count } = await query
      .order("part_code", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { rows: data, count: count ?? 0 };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("parts")
      .select(COMMERCIAL_SELECT)
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data;
  },

  getTechnicianCatalog: async (): Promise<
    {
      id: string;
      part_code: string;
      location: string | null;
      description: string;
      datasheet: string | null;
      nte_substitute: string | null;
      image: string | null;
    }[]
  > => {
    const { data, error } = await supabase
      .from("parts_technician")
      .select(TECHNICIAN_SELECT)
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  create: async (payload: {
    part_code: string;
    location: string | null;
    description: string;
    datasheet: string | null;
    nte_substitute: string | null;
    image: string | null;
    unit_cost: number;
    stock: number;
    supplier: string | null;
    created_from_order_id?: string | null;
  }) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("parts").insert({ ...payload, id });
    if (error) throw error;
    return id;
  },

  update: async (
    id: string,
    payload: {
      part_code: string;
      location: string | null;
      description: string;
      datasheet: string | null;
      nte_substitute: string | null;
      image: string | null;
      unit_cost: number;
      stock: number;
      supplier: string | null;
    },
  ) => {
    const { error } = await supabase.from("parts").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) throw error;
  },
};
