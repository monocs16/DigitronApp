import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { APP_ROLES, type AppRole } from "@/lib/digitron";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const roleSchema = z.enum(APP_ROLES);

async function assertSuper(supabase: ReturnType<typeof getAdmin>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super")
    .maybeSingle();
  if (!data) {
    throw new Error("Only super users can manage users.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = getAdmin();
    await assertSuper(admin, context.userId);

    const [{ data: profiles, error }, { data: roleRows, error: roleErr }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false }),
      admin.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);
    if (roleErr) throw new Error(roleErr.message);

    const roleByUser = new Map<string, AppRole>();
    for (const r of roleRows ?? []) {
      if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role as AppRole);
    }

    // Fetch emails via auth admin
    const { data: authList, error: authErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error(authErr.message);
    const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: roleByUser.get(p.id) ?? null,
      created_at: p.created_at,
      email: emailById.get(p.id) ?? "",
    }));
  });

/** Replace the user's role with a single role row. */
async function setUserRole(
  supabase: ReturnType<typeof getAdmin>,
  userId: string,
  role: AppRole,
) {
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (insErr) throw new Error(insErr.message);
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(128),
        full_name: z.string().min(1).max(200),
        role: roleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertSuper(admin, context.userId);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user.");

    // Profile is created by trigger; override name and assign the chosen role.
    const { error: upErr } = await admin
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", created.user.id);
    if (upErr) throw new Error(upErr.message);

    await setUserRole(admin, created.user.id, data.role);

    return { id: created.user.id };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: roleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertSuper(admin, context.userId);
    if (data.user_id === context.userId && data.role !== "super") {
      throw new Error("You cannot remove your own super role.");
    }
    await setUserRole(admin, data.user_id, data.role);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = getAdmin();
    await assertSuper(admin, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete yourself.");
    }
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
