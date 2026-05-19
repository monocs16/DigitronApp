# Engineering Guide

Guía de arquitectura y convenciones para trabajar en Digitron App. Léelo antes de tocar código.

---

## Mental model

Digitron App es una **app full-stack en un único repositorio**:

- El frontend (React 19 + TanStack Router) y el backend (TanStack server functions) viven en el mismo proyecto y comparten tipos.
- La base de datos es **Supabase** (Postgres + Auth + Storage). La seguridad principal vive en **RLS de Postgres**, no en el código de la app.
- Todo despliega como un **Worker de Cloudflare** (edge runtime con `nodejs_compat`). Ojo con dependencias que requieran binarios nativos o el filesystem real.

Regla mental: *si una operación toca datos sensibles, debe pasar por una server function con `requireSupabaseAuth` y las tablas deben tener RLS scoped a `auth.uid()`*. RLS es el respaldo, las server functions son la puerta.

---

## Routing (TanStack Router)

- File-based en `src/routes/`. **No editar `src/routeTree.gen.ts`** (lo regenera el plugin).
- Convención plana con puntos: `orders.$orderId.tsx` → `/orders/:orderId`.
- Layouts: un archivo `foo.tsx` con `<Outlet />` actúa como layout para `foo.bar.tsx`.
- Rutas protegidas viven bajo `_authenticated/` cuyo `beforeLoad` redirige a `/login` si no hay sesión.
- Navegar **siempre** con `<Link>` / `useNavigate` de `@tanstack/react-router` — nunca `react-router-dom` ni `<a href>` para rutas internas (provoca full reloads y 404).

---

## Server functions

Patrón canónico para lógica de servidor (queries, mutaciones, llamadas a APIs externas):

```ts
// src/lib/orders.functions.ts
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const listOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ status: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = supabase.from('orders').select('*');
    if (data.status) q.eq('status', data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });
```

Reglas:
- Archivos `*.functions.ts` van en `src/lib/`, **nunca** en `src/server/` (import-protected).
- Leer `process.env.*` **dentro de `.handler()`**, no a nivel de módulo.
- Llamarlas desde componentes con `useServerFn(fn)` + `useQuery`, no desde `loader` de rutas públicas (SSR sin token → 401).
- Loaders solo seguros bajo `_authenticated/`.

**No usar Supabase Edge Functions** para lógica interna. Solo si una integración externa exige un endpoint de Supabase.

---

## Base de datos

- Migraciones SQL en `supabase/migrations/` (timestamp + descripción). Se aplican con Supabase CLI (`supabase db push`) — ver [`supabase/README.md`](./supabase/README.md).
- **Roles en tabla separada** (`user_roles`) con enum `app_role` y función `has_role(uid, role) SECURITY DEFINER`. **Nunca** en `profiles`.
- RLS habilitada en toda tabla con datos de usuario. Políticas usan `auth.uid()` y/o `has_role()`.
- Validaciones temporales (`expire_at > now()`) → **trigger**, no `CHECK constraint` (los CHECK deben ser inmutables).
- No tocar schemas reservados: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

Archivos auto-generados (**NO EDITAR**):
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/types.ts`
- `.env.local` (credenciales locales; nunca commitear)

---

## Diseño

- Tokens semánticos en `src/styles.css` (formato `oklch`). **Nunca** colores hardcoded en componentes (`text-white`, `bg-black`).
- Variantes vía `cva` sobre primitives shadcn.
- Tema: clase `.dark` en `<html>`. El script inline en `__root.tsx` la aplica antes del primer render para evitar flash.
- Paleta: primary = Digitron blue (#1E3A5F → token `--primary`).

---

## Convenciones de código

- TypeScript strict. **Todo import debe resolver** (build falla en imports rotos).
- Components atómicos en `src/components/`, hooks en `src/hooks/`.
- Forms: React Hook Form + Zod resolver. Validar también en server functions.
- Fechas: `date-fns` (sin moment).
- Toasts: `sonner`.
- Estado de servidor: TanStack Query (no Zustand/Redux para datos de la DB).

---

## Errores comunes a evitar

1. Importar `client.server.ts` en código de cliente → fuga del service role key.
2. Llamar server function protegida desde `loader` de ruta pública → 401 en SSR.
3. Usar `<a href="/foo">` para nav interna → full reload + flash + 404.
4. Crear `src/pages/` o `app/layout.tsx` (convenciones de otros frameworks).
5. Trigger en schemas `auth`/`storage` directamente sin función SECURITY DEFINER en `public`.
6. Subir dependencias Node-only (con binarios nativos, `child_process`, `sharp`, etc.) — rompen en Cloudflare Workers.

---

## Testing & verificación

- No hay test suite formal aún. Verificación manual + revisión de consola/network del preview.
- Antes de cerrar un cambio: navegar las rutas afectadas, comprobar que no hay errores en consola, validar políticas RLS con un usuario no-admin.

---

## Roadmap técnico (post-export)

- Empaquetado Electron.
- Generación real de PDFs (los botones actuales son stubs).
- Integraciones WhatsApp / email / Hacienda.
- Inventario, modo offline, multi-sucursal.
