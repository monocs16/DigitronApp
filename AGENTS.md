# AGENTS.md — Digitron App

Instrucciones para agentes de IA (Cursor, Claude Code, etc.) que trabajen en este repositorio.
**Léelo antes de cambiar backend, auth, base de datos, variables de entorno o rutas.**

Documentación extendida: [`ENGINEERING.md`](./ENGINEERING.md) · setup humano: [`README.md`](./README.md) · migraciones: [`supabase/README.md`](./supabase/README.md)

---

## Qué es este proyecto

**Digitron App** (`digitron-app`) — sistema de órdenes de servicio técnico (clientes, equipos, órdenes, técnicos, fotos, reportes). UI en **español**. Marca en pantalla: **Digitron**.

- **Stack:** TanStack Start (Vite 7 + React 19), TanStack Router, TanStack Query, Tailwind v4, shadcn/ui, Supabase (Postgres + Auth + Storage + RLS).
- **Backend de la app:** TanStack `createServerFn` para operaciones sensibles; el CRUD normal usa Supabase Data API/PostgREST bajo RLS.
- **Producción:** Vercel/Nitro mediante `.github/workflows/cd.yml`; Cloudflare Workers continúa soportado como build alternativo (`wrangler.jsonc`, `src/server.ts`).

---

## Supabase — clientes y cuándo usarlos

| Cliente                               | Import                                                                                                                 | Uso                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Browser / repositorios**            | `@/integrations/supabase/client` desde `src/lib/repositories/`                                                         | CRUD normal vía Data API/PostgREST, Storage y realtime bajo JWT + RLS    |
| **Server function con usuario (RLS)** | `requireSupabaseAuth` en middleware → `context.supabase`                                                               | Mutaciones y lecturas que deben respetar RLS del usuario                 |
| **Admin (bypass RLS)**                | `process.env.SUPABASE_SERVICE_ROLE_KEY` solo dentro de `.handler()` en `*.functions.ts`, o `client.server` en servidor | Crear usuarios, tareas de confianza — **nunca en el bundle del cliente** |

**Reglas críticas:**

- **Nunca** importar `@/integrations/supabase/client.server` desde componentes, hooks o código que llegue al navegador.
- **Nunca** poner `SUPABASE_SERVICE_ROLE_KEY` (ni ningún secreto) en variables `VITE_*`.
- Los archivos en `src/integrations/supabase/` están pensados como integración centralizada; si los editas, mantén el patrón env-based (sin URLs ni JWT hardcodeados).
- El flujo habitual es `componente → TanStack Query → repositorio → supabase-js → Data API`. Por ejemplo, `/equipment` llama `equipmentRepository.getAll()`; no existe una ruta REST propia para esa consulta.
- Los repositorios deben propagar el error. Una consulta fallida **no** se convierte en `[]` ni se presenta como “sin datos”: la UI debe distinguir loading, empty y error, mostrar el mensaje seguro y ofrecer reintento.

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

Dentro del runtime de la app, la gestión de usuarios en `/usuarios` es el único flujo que usa **service role**. La importación histórica también lo usa como herramienta administrativa explícita, nunca desde el bundle del navegador.

Las transiciones de órdenes, decisiones de presupuesto, notificaciones registradas, entrega y garantías usan [`src/lib/orders.functions.ts`](./src/lib/orders.functions.ts). No actualices `orders.stage` directamente desde un repositorio.

---

## Base de datos

- Migraciones: `supabase/migrations/*.sql` — aplicar con `supabase db push` (orden por timestamp; ver [`supabase/README.md`](./supabase/README.md)).
- Seguridad: **RLS** en tablas de negocio; roles vía `user_roles` + `has_role()` — **no** guardar rol solo en `profiles`.
- No modificar a mano schemas reservados (`auth`, `storage`, …). Si una función `SECURITY DEFINER` es realmente necesaria, fija `search_path`, valida al actor, revoca `EXECUTE` a `PUBLIC`/roles no requeridos y prefiere un schema no expuesto cuando sea viable.
- Constantes de dominio (estados de orden, etiquetas): [`src/lib/digitron.ts`](./src/lib/digitron.ts).
- Todo cambio de esquema se entrega como una unidad: migración nueva, aplicación local, regeneración de [`src/integrations/supabase/types.ts`](./src/integrations/supabase/types.ts), aplicación remota y verificación de la consulta dependiente **antes** de desplegar la UI.
- El CD no ejecuta `supabase db push`. Un error como `Could not find '<column>' ... in the schema cache` normalmente indica que el código selecciona una columna cuya migración aún no llegó al proyecto consultado. Verifica `supabase migration list`, aplica la migración y vuelve a probar; no ocultes el error con un estado vacío.
- Para tablas nuevas expuestas por Data API, confirma grants para los roles requeridos y RLS antes de consumirlas.

Cambios recientes que forman parte del contrato vigente:

- `equipment.description` es opcional y proviene de `20260723000631_add_equipment_description.sql`; se muestra en `/equipment` y participa en la búsqueda junto con marca, modelo y serie.
- El flujo usa `awaiting_withdrawal`, no `delivered`. Rechazo y pago resuelto llegan a pendiente de retiro; registrar la entrega cierra la orden.
- Solo líneas de repuesto `quoted` recalculan `budgets.parts_cost`. Registrar una línea `used` exige cotización previa y stock suficiente, y no modifica el presupuesto aprobado.
- El saldo pagable se calcula con el presupuesto persistido. Un formulario de presupuesto con cambios sin guardar no puede habilitar un pago engañoso.

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
pnpm install
pnpm run dev             # http://localhost:5173, sin plugin Cloudflare
pnpm run dev:local       # Supabase local + migraciones + superusuario + Vite
pnpm run dev:local:fresh # igual, eliminando y recreando los datos locales
pnpm run dev:cf          # dev con runtime Cloudflare Workers
pnpm run build           # build alternativo para Cloudflare
pnpm run build:vercel    # build Vercel/Nitro usado por producción
pnpm run ci:check        # typecheck + lint + audit + cobertura
pnpm run test:e2e        # Playwright contra Supabase local
pnpm run test:e2e:ui     # Playwright UI
pnpm run lint
```

En dev, el plugin Cloudflare puede colgar el arranque; por eso `dev` usa `CF_WORKERS=0`.

El hook `pre-push` siempre ejecuta `ci:check`. También ejecuta E2E cuando encuentra Supabase CLI y Docker; `SKIP_E2E_HOOK=1` omite únicamente ese paso. En GitHub, CI valida los PR a `main`; después de un push exitoso a `main`, CD ejecuta E2E con Supabase local y solo entonces despliega a Vercel.

Los módulos del detalle de una orden son colapsables. En Playwright, expande el módulo relevante con los helpers de `e2e/helpers/` y acota los locators al card correspondiente. Al sembrar datos, respeta los triggers: una línea `quoted` puede crear/upsert el presupuesto, por lo que el presupuesto debe sembrarse primero cuando el escenario requiere valores específicos.

---

## Importación histórica

`node scripts/import-production-orders.mjs <xlsx>` valida en modo dry-run la importación legada de las órdenes `47670–47719`. `--execute` usa service role y **reemplaza datos operativos** —incluidos órdenes, equipos, clientes, repuestos y auditoría— aunque conserva usuarios y roles.

Antes de usar `--execute`: verifica el proyecto destino, respalda la base, ejecuta el dry-run y confirma que existe el perfil activo `Technician Digitron`. No generalices este script como importador público.

---

## No hacer

1. Hardcodear URLs `*.supabase.co` o JWT (`eyJ...`) en fuente.
2. Exponer service role al cliente o renombrarlo a `VITE_*`.
3. Usar Edge Functions de Supabase para flujos que ya cubren las server functions.
4. Crear `src/pages/` o patrones de Next.js — este proyecto es TanStack Start.
5. Añadir dependencias con binarios nativos pesados sin comprobar compatibilidad con Cloudflare Workers.
6. Reintroducir paquetes o docs de **Lovable** (`@lovable.dev/*`, `.lovable/`, registries privados en lockfile).
7. Commitear secretos o el archivo `.env`.
8. Eliminar o ampliar a ciegas los overrides y `auditConfig` de `pnpm-workspace.yaml`: la excepción legacy de `brace-expansion@1` existe porque ESLint/minimatch 3 espera su API CommonJS invocable; forzar v5 rompe lint.

---

## Checklist antes de cerrar un cambio

- [ ] ¿Toca datos sensibles? → server function + `requireSupabaseAuth` o service role solo en servidor.
- [ ] ¿Nueva tabla/columna? → migración SQL + políticas RLS.
- [ ] ¿El código selecciona una columna nueva? → migración aplicada local y remotamente antes del deploy + tipos regenerados.
- [ ] ¿Imports resuelven y el build pasa?
- [ ] ¿Loading, empty y error son estados distintos y existe reintento cuando corresponde?
- [ ] ¿Rutas afectadas probadas en navegador sin errores en consola/network?
- [ ] ¿`pnpm run ci:check` pasa? ¿E2E si cambia auth, RLS, migraciones o flujo?
- [ ] ¿Sin secretos en el diff?

---

## Estructura rápida

```
src/routes/              # páginas
src/lib/repositories/    # CRUD browser → Supabase Data API bajo RLS
src/lib/*.functions.ts   # API servidor
src/lib/digitron.ts      # enums / labels ES
src/integrations/supabase/
supabase/migrations/
e2e/                     # Playwright + Supabase local
.github/workflows/       # CI y CD a Vercel
vite.config.ts           # TanStack Start + Cloudflare; base ./ si ELECTRON=true
```
