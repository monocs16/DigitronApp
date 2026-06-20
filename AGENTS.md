# AGENTS.md — Digitron App

Instrucciones para agentes de IA (Cursor, Claude Code, etc.) que trabajen en este repositorio.
**Léelo antes de cambiar backend, auth, base de datos, variables de entorno o rutas.**

Documentación extendida: [`ENGINEERING.md`](./ENGINEERING.md) · setup humano: [`README.md`](./README.md) · migraciones: [`supabase/README.md`](./supabase/README.md)

---

## Qué es este proyecto

**Digitron App** (`digitron-app`) — sistema de órdenes de servicio técnico (clientes, equipos, órdenes, técnicos, fotos, reportes). UI en **español**. Marca en pantalla: **Digitron**.

- **Stack:** TanStack Start (Vite 7 + React 19), TanStack Router, TanStack Query, Tailwind v4, shadcn/ui, Supabase (Postgres + Auth + Storage + RLS).
- **Backend de la app:** TanStack `createServerFn` — **no** Supabase Edge Functions para lógica interna.
- **Deploy opcional:** Cloudflare Workers (`wrangler.jsonc`, `src/server.ts`).

---

## Supabase — clientes y cuándo usarlos

| Cliente                               | Import                                                                                                                 | Uso                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Browser / componentes**             | `@/integrations/supabase/client`                                                                                       | Auth en cliente, queries directas en rutas, Storage, realtime            |
| **Server function con usuario (RLS)** | `requireSupabaseAuth` en middleware → `context.supabase`                                                               | Mutaciones y lecturas que deben respetar RLS del usuario                 |
| **Admin (bypass RLS)**                | `process.env.SUPABASE_SERVICE_ROLE_KEY` solo dentro de `.handler()` en `*.functions.ts`, o `client.server` en servidor | Crear usuarios, tareas de confianza — **nunca en el bundle del cliente** |

**Reglas críticas:**

- **Nunca** importar `@/integrations/supabase/client.server` desde componentes, hooks o código que llegue al navegador.
- **Nunca** poner `SUPABASE_SERVICE_ROLE_KEY` (ni ningún secreto) en variables `VITE_*`.
- Los archivos en `src/integrations/supabase/` están pensados como integración centralizada; si los editas, mantén el patrón env-based (sin URLs ni JWT hardcodeados).

---

## Variables de entorno

- Plantilla: [`.env.example`](./.env.example) → copiar a **`.env.local`** (gitignored).
- Cliente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (clave **anon** / publishable).
- Servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Misma URL y anon key en pares VITE\_ / sin prefijo.
- **No commitear** `.env`, `.env.local` ni secretos en código, migraciones o `config.toml` (usa `supabase link` o placeholder en `project_id`).

---

## Lógica de servidor

Patrón obligatorio para operaciones sensibles:

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const example = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // ...
  });
```

- Archivos: `src/lib/*.functions.ts` (ej. [`users.functions.ts`](./src/lib/users.functions.ts)).
- Leer `process.env.*` **dentro del `.handler()`**, no al top-level del módulo.
- Consumir desde UI con `useServerFn` + TanStack Query — **no** desde `loader` de rutas públicas (SSR sin Bearer → 401).
- Auth en server functions: el middleware `attachSupabaseAuth` en [`src/start.ts`](./src/start.ts) reenvía el token de sesión.

Operaciones que hoy usan **service role** (solo servidor): gestión de usuarios en `/usuarios`.

---

## Base de datos

- Migraciones: `supabase/migrations/*.sql` — aplicar con `supabase db push` (orden por timestamp; ver [`supabase/README.md`](./supabase/README.md)).
- Seguridad: **RLS** en tablas de negocio; roles vía `user_roles` + `has_role()` — **no** guardar rol solo en `profiles`.
- No modificar a mano schemas reservados (`auth`, `storage`, …) sin función `SECURITY DEFINER` en `public` cuando haga falta.
- Constantes de dominio (estados de orden, etiquetas): [`src/lib/digitron.ts`](./src/lib/digitron.ts).

---

## Routing y UI

- Rutas file-based en `src/routes/` — **no editar** `src/routeTree.gen.ts`.
- Rutas protegidas: prefijo `_authenticated/` (redirige a `/login` sin sesión).
- Navegación interna: `<Link>` / `useNavigate` de `@tanstack/react-router` — no `<a href>` para rutas de la app.
- Estilos: tokens en `src/styles.css` (oklch); sin colores hardcoded tipo `text-white` / `bg-black`.
- Tema: `localStorage` key `digitron-theme` (legacy `o3s-theme` migrado en código).

---

## Comandos

```bash
bun install
bun run dev      # http://localhost:5173 (CF_WORKERS=0, sin plugin Cloudflare en dev)
bun run dev:cf   # dev con runtime Cloudflare Workers (solo si hace falta)
bun run build    # producción (CF_WORKERS=1)
bun run lint
```

En dev, el plugin Cloudflare + Bun puede colgar el arranque; por eso `dev` usa `CF_WORKERS=0`.

---

## No hacer

1. Hardcodear URLs `*.supabase.co` o JWT (`eyJ...`) en fuente.
2. Exponer service role al cliente o renombrarlo a `VITE_*`.
3. Usar Edge Functions de Supabase para flujos que ya cubren las server functions.
4. Crear `src/pages/` o patrones de Next.js — este proyecto es TanStack Start.
5. Añadir dependencias con binarios nativos pesados sin comprobar compatibilidad con Cloudflare Workers.
6. Reintroducir paquetes o docs de **Lovable** (`@lovable.dev/*`, `.lovable/`, registries privados en lockfile).
7. Commitear secretos o el archivo `.env`.

---

## Checklist antes de cerrar un cambio

- [ ] ¿Toca datos sensibles? → server function + `requireSupabaseAuth` o service role solo en servidor.
- [ ] ¿Nueva tabla/columna? → migración SQL + políticas RLS.
- [ ] ¿Imports resuelven y el build pasa?
- [ ] ¿Rutas afectadas probadas en navegador sin errores en consola?
- [ ] ¿Sin secretos en el diff?

---

## Estructura rápida

```
src/routes/              # páginas
src/lib/*.functions.ts   # API servidor
src/lib/digitron.ts      # enums / labels ES
src/integrations/supabase/
supabase/migrations/
vite.config.ts           # TanStack Start + Cloudflare; base ./ si ELECTRON=true
```
