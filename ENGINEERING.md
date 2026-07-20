# Engineering Guide

Guía de arquitectura y convenciones para desarrollar Digitron App. Para el proceso funcional completo consulte [`docs/service-order-flow.md`](./docs/service-order-flow.md); para entidades y permisos, [`docs/data-model.md`](./docs/data-model.md).

---

## Modelo mental

Digitron es una aplicación full-stack en un único repositorio:

- React 19, TanStack Start y TanStack Router forman el frontend y el servidor SSR.
- Las server functions de TanStack son la API interna RPC; no hay una API REST ni Edge Functions para el flujo normal.
- Supabase aporta Postgres, Auth y Storage.
- La autorización real vive en RLS y se complementa con validaciones de servidor y gates de UI.
- El build puede ejecutarse en Cloudflare Workers con `nodejs_compat` o en Vercel mediante Nitro.
- El navegador y el servidor comparten tipos, pero no todos los módulos pueden cruzar el límite del bundle.

Regla central: una operación sensible debe ejecutarse con identidad autenticada, validación de entrada y autorización server-side. Ocultar un botón nunca sustituye a RLS.

---

## Fuentes de verdad

Cuando dos artefactos contradigan el comportamiento actual, use este orden:

1. Migraciones SQL más recientes.
2. Código TypeScript vigente.
3. [`docs/service-order-flow.md`](./docs/service-order-flow.md).
4. [`docs/data-model.md`](./docs/data-model.md).
5. Esta guía y [`AGENTS.md`](./AGENTS.md).

Antes de modificar el proceso de órdenes, actualice el documento canónico y mantenga alineados:

- `src/lib/digitron.ts`.
- `src/lib/state-machine.ts`.
- `src/lib/orders.functions.ts`.
- Las políticas RLS y triggers.
- La UI de `src/routes/_authenticated/orders/$orderId.tsx`.
- Las traducciones y pruebas.

La implementación actual crea una orden directamente en `evaluation`: el formulario de alta completa la recepción. El enum conserva `intake` y la transición `intake → evaluation` para representar el inicio formal. No cambie uno de estos comportamientos de forma aislada.

---

## Estructura relevante

```text
src/
├── routes/                         # TanStack Router file-based
│   └── _authenticated/             # Layout y rutas protegidas
├── components/                     # Componentes de aplicación y shadcn/ui
├── hooks/                          # Contextos y hooks compartidos
├── integrations/supabase/
│   ├── client.ts                   # Cliente del navegador
│   ├── client.server.ts            # Cliente exclusivamente servidor
│   ├── auth-attacher.ts            # Reenvío del Bearer token
│   ├── auth-middleware.ts          # Validación JWT y cliente bajo RLS
│   └── types.ts                    # Tipos generados de la base
├── lib/
│   ├── repositories/               # Queries/mutaciones normales bajo RLS
│   ├── *.functions.ts              # Server functions sensibles
│   ├── access.ts                   # Matriz de permisos de módulos
│   ├── digitron.ts                 # Roles, etapas y decisiones
│   ├── state-machine.ts            # Transiciones y gates
│   └── service-order-pdf.ts        # Llenado de plantilla PDF
├── locales/                        # Recursos i18n
├── start.ts                        # Middleware global de TanStack Start
└── server.ts                       # Entry y manejo de error SSR

supabase/
├── migrations/                     # Esquema, RLS, auditoría y Storage
├── seed.sql
└── config.toml

e2e/                                # Playwright contra Supabase local
docs/                               # Flujo, modelo y contratos
scripts/                            # Desarrollo local, seeds e importación
```

No edite `src/routeTree.gen.ts`; el plugin del router lo regenera.

---

## Dominio y permisos

### Roles

`src/lib/digitron.ts` declara:

```ts
type AppRole = "cliente" | "administrativo" | "tecnico" | "super";
```

Los roles viven en `user_roles`. `profiles` contiene identidad de presentación, no autorización. Un usuario puede tener varias filas de rol a nivel de esquema, aunque la UI de gestión reemplaza su asignación por un único rol.

Use las funciones Postgres `has_role()` y `has_any_role()` dentro de políticas. Ambas son `SECURITY DEFINER` y tienen `search_path` fijo.

La matriz central de módulos está en `src/lib/access.ts`:

- `levelFor(roles, module)` obtiene el mayor nivel de acceso.
- `canRead`, `canCreate` y `canEdit` controlan acciones de presentación.
- RLS debe reflejar la misma matriz; la matriz del cliente no es una frontera de seguridad.

### Etapas

```ts
type OrderStage =
  | "intake"
  | "evaluation"
  | "budget"
  | "customer_decision"
  | "on_hold"
  | "repair"
  | "payment"
  | "delivered"
  | "closed";
```

`src/lib/state-machine.ts` separa:

- `STAGE_TRANSITIONS`: aristas hacia adelante.
- `STAGE_PREVIOUS`: correcciones directas y auditables.
- `STAGE_ACTOR_ROLES`: rol que puede mover la orden a la etapa destino.
- `gateAllows`: reglas dependientes de presupuesto y saldo.
- `allowedNextStages`/`canTransition`: autorización completa del avance.
- `allowedPreviousStages`: autorización de correcciones.

Gates vigentes:

- Entrar a `repair` requiere `budget.decision === "approved"`.
- Entrar a `delivered` requiere saldo cubierto o `balance_waived`.
- Un técnico no-super solo actúa en una orden asignada a él.

Las transiciones deben pasar por `orders.functions.ts`. No agregue un `ordersRepository.updateStage()` que permita saltarse la máquina de estados.

### Decisiones y ramas

`approved`, `deferred` y `rejected` enrutan automáticamente a `repair`, `on_hold` y `closed`. El diferimiento exige motivo. La garantía no es una etapa: `createWarrantyOrder` crea otra orden enlazada por `warranty_origin_id` desde una orden entregada o cerrada.

---

## Routing

- Rutas file-based en `src/routes/`.
- `_authenticated.tsx` es el layout protegido y redirige a `/login` sin sesión.
- Use `<Link>` y `useNavigate` de `@tanstack/react-router` para navegación interna.
- No use `react-router-dom` ni `<a href>` para rutas de la app.
- No cree `src/pages/`, `app/layout.tsx` ni convenciones de Next.js.
- Los loaders públicos no deben invocar server functions protegidas: durante SSR no disponen del Bearer del navegador.

Las consultas protegidas actuales se realizan principalmente desde componentes mediante TanStack Query. Para una server function, obtenga la función enlazada con `useServerFn` y úsela dentro de `useQuery`/`useMutation`.

---

## Acceso a datos

### Repositorios del navegador

`src/lib/repositories/` centraliza operaciones normales con `@/integrations/supabase/client`. Estas llamadas usan la sesión del navegador y respetan RLS.

Responsabilidades:

- Selecciones consistentes y relaciones requeridas por la UI.
- Manejo uniforme de `data`/`error`.
- Operaciones de Storage y URLs firmadas.
- No contener service role ni importar módulos `.server`.

Los repositorios no reemplazan las server functions cuando una regla necesita:

- Verificar una transición de estado.
- Ejecutar una operación privilegiada.
- Coordinar una regla que RLS no puede expresar.
- Proteger secretos o llamadas externas.

### Server functions autenticadas

Patrón canónico:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const example = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verifique aquí permisos y reglas que RLS no pueda expresar.
    const { error } = await supabase
      .from("orders")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
```

Reglas:

- Ubique las funciones en `src/lib/*.functions.ts`.
- Use `requireSupabaseAuth` en toda función protegida.
- Valide la entrada con Zod antes del handler.
- Use `context.supabase` para operar con el JWT y RLS del usuario.
- Lea `process.env.*` dentro del handler o de una función llamada por él, nunca durante la evaluación top-level del módulo.
- Exponga errores seguros y accionables; no devuelva secretos ni objetos internos del proveedor.
- Documente contratos nuevos en `docs/api-spec.yml`.

`attachSupabaseAuth` en `src/start.ts` reenvía el access token de la sesión a las server functions. `requireSupabaseAuth` valida el Bearer con `getClaims()` y crea un cliente no persistente con la clave publishable.

### Service role

La gestión de usuarios en `users.functions.ts` es el caso privilegiado actual:

1. La función exige sesión mediante `requireSupabaseAuth`.
2. `assertSuper` verifica el rol `super`.
3. Solo entonces se crea el cliente administrativo.
4. El cliente usa `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en servidor.

Nunca:

- Importe `client.server.ts` desde componentes, hooks o repositorios del navegador.
- Exponga el service role con un prefijo `VITE_`.
- Use el service role para evitar diseñar una política RLS correcta.
- Construya el cliente administrativo al importar el módulo.

---

## Base de datos

### Migraciones

- Cada cambio de esquema se entrega en un archivo nuevo `supabase/migrations/<timestamp>_<descripcion>.sql`.
- No reescriba una migración ya aplicada a un entorno compartido.
- Aplique localmente con `supabase migration up` o reinicie con `supabase db reset`.
- Aplique al remoto con `supabase db push` después de revisar el proyecto enlazado.
- Actualice `src/integrations/supabase/types.ts` cuando cambie el esquema.
- No modifique schemas reservados (`auth`, `storage`, `realtime`, etc.) salvo mediante el patrón seguro requerido por Supabase.
- Fije `search_path` en funciones `SECURITY DEFINER` y restrinja sus grants.

RLS debe habilitarse en toda tabla operativa nueva antes de conceder acceso a `authenticated`.

### Integridad vigente

- `customers.tax_id` y `equipment.serial_number` son opcionales, pero únicos si contienen valor, normalizados con trim/lowercase.
- `equipment` no pertenece permanentemente a un cliente; la relación de cada visita vive en `orders`.
- `received_accessories` pertenece a la orden, no al equipo.
- `equipment_condition` captura el estado físico/funcional al recibirlo y alimenta el campo `Estado` del PDF.
- `budgets` es uno-a-uno con la orden.
- `order_notes` es append-only y se diferencia de `audit_log`.
- El costo y disponibilidad de `order_parts` se capturan dentro de Postgres.
- Insertar una pieza `used` descuenta stock; eliminarla lo restaura.
- Las piezas `quoted` sincronizan `budgets.parts_cost`.
- Los pagos no pueden superar presupuesto menos anticipos/pagos previos.
- La numeración de órdenes continúa la secuencia numérica histórica posterior a `47719` bajo advisory lock.

### Privacidad de inventario

La tabla base `parts` contiene stock, costo y proveedor y solo es legible por administrativo/super. Los técnicos seleccionan repuestos mediante `parts_technician` y consultan líneas asignadas mediante `order_parts_technician`. No amplíe estas vistas con información comercial sin una decisión explícita de seguridad.

### Auditoría

`audit_log` es el registro técnico generado por triggers. `order_notes` es el registro humano legible. Una corrección de etapa primero inserta la razón en notas y luego actualiza la orden.

Mantenga triggers de auditoría en nuevas tablas operativas cuando corresponda. No permita que usuarios normales escriban directamente en `audit_log`.

Para condiciones dependientes del tiempo use triggers o lógica de servidor, no un `CHECK` basado en `now()`; los CHECK deben ser inmutables.

---

## Auth y usuarios

`AuthProvider` mantiene sesión, perfil y una lista de roles. Espera la resolución inicial de Supabase y reintenta la carga de perfil/roles para tolerar la inicialización de sesión.

- El primer usuario de una base vacía recibe `super` por trigger.
- Los siguientes reciben inicialmente `tecnico`.
- La pantalla `/usuarios` solo administra cuentas cuando el actor es `super`.
- `createUser` crea una cuenta confirmada, actualiza su nombre y reemplaza el rol inicial.
- Un superusuario no puede quitarse su propio rol super ni eliminar su propia cuenta desde estas funciones.
- No hay signup público ni envío automático de invitaciones.

Si cambia este flujo, pruebe tanto el trigger de creación como las funciones administrativas y las restricciones de auto-modificación.

---

## Storage y fotografías

- Bucket privado: `order-photos`.
- La metadata está en `order_photos` y los objetos en Supabase Storage.
- `photosRepository` genera URLs firmadas por una hora.
- La UI limita formatos a JPEG/PNG/WebP, tamaño a 5 MB y cantidad a 5 fotografías por orden.
- Las políticas de tabla y Storage deben evolucionar juntas.
- Si falla la inserción de metadata después de subir un objeto, considere la compensación para evitar archivos huérfanos al modificar este flujo.

---

## PDF y reportes

`src/lib/service-order-pdf.ts` usa `pdf-lib` para completar `/orden-servicio-digitron.pdf`:

- Conserva los campos editables, sin flatten.
- Completa las copias de cliente y Digitron.
- Normaliza caracteres incompatibles con WinAnsi.
- Se descarga al crear la orden y puede reimprimirse desde el detalle.

Los reportes usan jsPDF y jspdf-autotable. Si cambia una etiqueta de etapa o moneda, revise ambos mecanismos de PDF y las traducciones.

La acción “notificar cliente” solo guarda `decision_notified_at` o `delivery_notified_at`. No existe entrega real de email todavía; no presente el timestamp como confirmación de envío.

---

## UI, estilos e i18n

- Use componentes existentes de `src/components/ui/` y primitives Radix.
- Use React Hook Form con Zod para formularios.
- Use TanStack Query para estado remoto; no duplique datos de base en Redux/Zustand.
- Use `date-fns` para fechas y `sonner` para feedback.
- Mantenga loading, empty, error y disabled states accesibles.
- Los textos visibles deben pasar por i18next cuando exista o corresponda una clave reutilizable.
- Código, nombres y comentarios técnicos en inglés; UI en español y traducción inglesa en `src/locales/en.ts`.

Diseño:

- Tokens semánticos `oklch` en `src/styles.css`.
- No hardcodee `text-white`, `bg-black`, hex o colores de marca en componentes cuando exista un token.
- Variantes con `cva` sobre primitives shadcn.
- Tema mediante `.dark` en `<html>`.
- Preferencia `digitron-theme`; la clave legacy `o3s-theme` solo existe para migración.
- `__root.tsx` aplica el tema antes del primer render para evitar flash.

---

## Runtime y despliegue

### Desarrollo

`pnpm run dev` establece `CF_WORKERS=0`. El plugin Cloudflare se desactiva porque puede ralentizar o colgar el servidor local.

`pnpm run dev:local` es el flujo recomendado para un entorno aislado: inicia Supabase local, aplica migraciones, crea el superusuario e inicia Vite con credenciales locales.

Use `pnpm run dev:cf` solo para comprobar comportamiento específico del runtime Workers.

### Cloudflare

`pnpm run build` activa `@cloudflare/vite-plugin`. `src/server.ts` carga el server entry de TanStack, captura excepciones y reemplaza respuestas SSR catastróficas por una página de error de marca.

Evite dependencias con:

- Binarios nativos pesados.
- Acceso a filesystem real.
- `child_process`.
- Suposiciones de procesos Node de larga duración.

Compruebe siempre compatibilidad con Workers y `nodejs_compat`.

### Vercel

`pnpm run build:vercel` establece `DEPLOY_TARGET=vercel`, omite el plugin Cloudflare y activa Nitro con preset Vercel. Cambios del entry o de variables runtime deben validarse en ambos destinos.

### Electron

Cuando `ELECTRON=true`, Vite usa `base: "./"`. Esto prepara assets relativos, pero el wrapper, actualización y distribución Electron todavía están pendientes.

---

## Testing y verificación

### Unitarias

Vitest cubre actualmente reglas puras como permisos, constantes y máquina de estados:

```bash
pnpm run test:unit
pnpm run test:coverage
```

Agregue pruebas unitarias cuando cambie:

- Matriz de acceso.
- Transiciones, actores o gates.
- Etiquetas/constantes con lógica.
- Funciones puras de cálculo.

### E2E

Playwright ejecuta autenticación, flujo de órdenes y restricciones del técnico contra Supabase local:

```bash
pnpm run test:e2e
```

`e2e/global-setup.ts` levanta/reinicia el stack local, aplica migraciones, crea usuarios y genera credenciales ignoradas. Los proyectos `admin`, `technician` y `no-auth` usan sesiones separadas. Nunca adapte estos helpers para apuntar silenciosamente a producción.

### Checklist proporcional al cambio

Documentación solamente:

- Revisar enlaces y formato Markdown.

UI sin datos sensibles:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:unit
```

Auth, RLS, migraciones, flujo o server functions:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:coverage
pnpm run test:e2e
pnpm run build
```

El pipeline agrupado disponible es:

```bash
pnpm run ci:check
```

Incluye typecheck, lint, auditoría de dependencias y cobertura. `pnpm run test` agrega unitarias y E2E.

Antes de cerrar un cambio sensible, verifique además:

- Comportamiento con administrativo/super y técnico asignado.
- Denegación para técnico no asignado y usuario sin rol suficiente.
- Consola y network del navegador.
- Ausencia de secretos en el diff.
- Tipos Supabase alineados con las migraciones.
- Build del destino afectado.

---

## Errores comunes

1. Guardar o leer el rol desde `profiles` en lugar de `user_roles`.
2. Tratar `cliente` y `equipment` como una relación permanente; la relación de la visita vive en `orders`.
3. Actualizar `orders.stage` directamente y omitir la máquina de estados.
4. Confiar en un botón oculto como autorización.
5. Exponer costos/stock a técnicos desde `parts` en vez de las vistas restringidas.
6. Importar `client.server.ts` o el service role en el bundle del navegador.
7. Leer secretos en top-level de un módulo compartido.
8. Invocar una server function protegida desde un loader público y recibir 401 durante SSR.
9. Usar navegación de otro router o `<a href>` en rutas internas.
10. Editar `src/routeTree.gen.ts`.
11. Cambiar solo la UI del flujo sin alinear server function, RLS, docs y tests.
12. Describir el registro de notificación como email realmente enviado.
13. Modificar una migración aplicada en lugar de crear una nueva.
14. Añadir una dependencia Node-only sin verificar Cloudflare Workers.
15. Commitear `.env`, `.env.local`, `.env.e2e.local`, credenciales o `supabase/.temp/`.

---

## Roadmap técnico

- Wrapper, distribución y auto-update Electron.
- Envío real de notificaciones por email/WhatsApp.
- Integraciones de facturación/Hacienda.
- Modo offline y soporte multi-sucursal.
- Ampliación de recibos y reportes PDF.
