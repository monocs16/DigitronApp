import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(supabase: ReturnType<typeof getAdmin>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.role !== "admin") {
    throw new Error("Solo administradores pueden gestionar usuarios.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = getAdmin();
    await assertAdmin(admin, context.userId);
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Fetch emails via auth admin
    const { data: authList, error: authErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error(authErr.message);
    const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

    return (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      created_at: p.created_at,
      email: emailById.get(p.id) ?? "",
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(128),
        full_name: z.string().min(1).max(200),
        role: z.enum(["admin", "technician"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertAdmin(admin, context.userId);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear");

    // Trigger created profile w/ default role "technician" — override + name
    const { error: upErr } = await admin
      .from("profiles")
      .update({ role: data.role, full_name: data.full_name })
      .eq("id", created.user.id);
    if (upErr) throw new Error(upErr.message);

    return { id: created.user.id };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "technician"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertAdmin(admin, context.userId);
    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("No puede quitarse el rol de administrador a sí mismo.");
    }
    const { error } = await admin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertAdmin(admin, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("No puede eliminarse a sí mismo.");
    }
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
