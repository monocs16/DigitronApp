# Engineering Guide

Guía de arquitectura y convenciones para desarrollar Digitron App. Para el proceso funcional completo consulte [`docs/service-order-flow.md`](./docs/service-order-flow.md); para entidades y permisos, [`docs/data-model.md`](./docs/data-model.md).

---

## Modelo mental

Digitron es una aplicación full-stack en un único repositorio:

- React 19, TanStack Start y TanStack Router forman el frontend y el servidor SSR.
- Las server functions de TanStack son la API interna RPC sensible. No hay una API REST propia ni Edge Functions para el flujo normal; los repositorios del navegador sí consumen Supabase Data API/PostgREST.
- Supabase aporta Postgres, Auth y Storage.
- La autorización real vive en RLS y se complementa con validaciones de servidor y gates de UI.
- Producción se despliega automáticamente en Vercel/Nitro; Cloudflare Workers con `nodejs_compat` continúa como destino alternativo soportado.
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
│   └── order-report-builder.tsx    # Selector, filtros, tabla y exportación de reportes
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
│   ├── order-report.ts             # Campos, operadores y evaluación pura de filtros
│   ├── order-report-export.ts      # Serialización segura de CSV y SpreadsheetML
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
  | "awaiting_withdrawal"
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
- Avanzar de `payment` a `awaiting_withdrawal` requiere saldo cubierto o `balance_waived`.
- Un técnico no-super solo actúa en una orden asignada a él.

Las transiciones deben pasar por `orders.functions.ts`. No agregue un `ordersRepository.updateStage()` que permita saltarse la máquina de estados.

### Decisiones y ramas

`approved`, `deferred` y `rejected` enrutan automáticamente a `repair`, `on_hold` y `awaiting_withdrawal`. El diferimiento exige motivo, lo persiste en el presupuesto y lo copia a notas internas para que también aparezca en el historial.

Una orden rechazada sigue abierta hasta que el cliente retire el equipo. `deliverOrder` exige `received_by`, registra `delivery_at` y notas de cierre opcionales, y mueve `awaiting_withdrawal → closed`.

La garantía no es una etapa: `createWarrantyOrder` crea otra orden enlazada por `warranty_origin_id`, pero solo acepta una orden origen en `closed`. La capacidad existe en servidor; no suponga que toda ruta ya expone una acción de UI para invocarla.

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

`src/lib/repositories/` centraliza operaciones normales con `@/integrations/supabase/client`. `supabase-js` convierte estas llamadas en requests a Supabase Data API/PostgREST con la sesión del navegador; RLS define el alcance real.

Ejemplo concreto del inventario de equipos:

```text
src/routes/_authenticated/equipment.tsx
  useQuery(["equipment", { page, pageSize, search }])
    → equipmentRepository.getPage(...)
      → supabase.from("equipment").select(..., { count: "exact" }).range(...)
        → Supabase Data API/PostgREST
```

No existe un endpoint REST propio ni una server function para esa lectura. La consulta selecciona `description`, por lo que el proyecto consultado debe tener aplicada `20260723000631_add_equipment_description.sql`.

El inventario sigue el mismo patrón, pero el repositorio elige la relación según el rol:

```text
/inventory → partsRepository.getPage()           → public.parts
           → partsRepository.getTechnicianPage() → public.parts_technician
```

`public.parts` contiene el contrato comercial completo. `public.parts_technician` conserva solo `id`, `part_code`, `location`, `description`, `datasheet`, `nte_substitute` e `image`; requiere las migraciones `20260808054134_secure_technician_read_models.sql` y `20260808063014_extend_parts_catalog.sql`.

Responsabilidades:

- Selecciones consistentes y relaciones requeridas por la UI.
- Propagar los errores de Supabase; no convertirlos en una colección vacía.
- Operaciones de Storage y URLs firmadas.
- No contener service role ni importar módulos `.server`.

Los listados principales usan `MAX_PAGE_SIZE = 50`, conteo exacto y `.range(from, to)` después de aplicar búsqueda, filtros y ordenamiento. Sus `queryKey` incluyen página y todos los criterios activos. `public.orders_list` es una vista `security_invoker` de solo lectura para combinar campos de orden, cliente, equipo y técnico en la búsqueda PostgREST; las políticas de las tablas subyacentes siguen evaluándose con el JWT del usuario y una relación no legible queda nula en el `LEFT JOIN`.

La pantalla consumidora debe tratar por separado loading, empty y error. Un error accionable muestra el mensaje seguro y un reintento; un fallo de consulta nunca debe hacer parecer que la tabla realmente está vacía.

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

Dentro del runtime de la aplicación, la gestión de usuarios en `users.functions.ts` es el caso privilegiado actual:

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

El orden de entrega para código dependiente del esquema es:

1. Crear y probar la migración local.
2. Regenerar los tipos Supabase desde el esquema migrado.
3. Verificar RLS y, para tablas nuevas, grants/exposición en Data API.
4. Aplicar la migración al proyecto remoto correcto.
5. Verificar una consulta real contra ese proyecto.
6. Desplegar el código que selecciona la columna o tabla nueva.

GitHub CD **no** ejecuta `supabase db push`. Si la UI reporta `Could not find '<column>' ... in the schema cache`, compare `supabase migration list` y el esquema remoto: normalmente el frontend fue desplegado antes que la migración. No lo “corrija” ocultando el error ni convirtiéndolo en un estado vacío.

### Integridad vigente

- `customers.tax_id` y `equipment.serial_number` son opcionales, pero únicos si contienen valor, normalizados con trim/lowercase.
- `equipment` no pertenece permanentemente a un cliente; la relación de cada visita vive en `orders`.
- `equipment.description` es texto opcional; el formulario limita 2000 caracteres y las búsquedas combinan descripción, marca, modelo y serie.
- `received_accessories` pertenece a la orden, no al equipo.
- `equipment_condition` captura el estado físico/funcional al recibirlo y alimenta el campo `Estado` del PDF.
- `budgets` es uno-a-uno con la orden.
- `order_notes` es append-only y se diferencia de `audit_log`.
- El costo y disponibilidad de `order_parts` se capturan dentro de Postgres.
- `parts.location`, `parts.datasheet`, `parts.nte_substitute` y `parts.image` son metadatos opcionales. La UI trata `datasheet` e `image` como URLs externas y solo crea enlaces para protocolos HTTP/HTTPS.
- Un técnico asignado puede proponer un repuesto durante `evaluation`; se crea ligado por `created_from_order_id`, con costo y stock cero y sin proveedor hasta que administración complete los datos comerciales.
- Insertar una pieza `used` requiere una línea `quoted` previa para esa orden, descuenta stock de forma condicional y concurrente, y eliminarla lo restaura.
- Solo los cambios en piezas `quoted` sincronizan `budgets.parts_cost`; una pieza `used` nunca recalcula ni altera el presupuesto aprobado.
- Los pagos usan el presupuesto persistido, no los valores sin guardar del formulario, y no pueden superar presupuesto menos anticipos/pagos previos.
- La numeración de órdenes continúa la secuencia numérica histórica posterior a `47719` bajo advisory lock.

### Privacidad de inventario

La tabla base `parts` contiene stock, costo y proveedor y solo es legible por administrativo/super. Los técnicos seleccionan repuestos mediante las tablas físicas de lectura derivadas `parts_technician` y `order_parts_technician`, protegidas por RLS y mantenidas por triggers internos desde las tablas comerciales. Sustituyeron las antiguas vistas con privilegios del creador para que la autorización se evalúe mediante las políticas RLS de la tabla consultada.

Las funciones de sincronización viven en el schema no expuesto `private`, fijan `search_path` y revocan `EXECUTE` a `PUBLIC`, `anon`, `authenticated` y `service_role`; solo se invocan como triggers. No escriba directamente en estas proyecciones, no las convierta otra vez en vistas `SECURITY DEFINER` y no agregue stock, costo, proveedor ni snapshots comerciales sin una decisión explícita de seguridad.

### Auditoría

`audit_log` es el registro técnico generado por triggers. `order_notes` es el registro humano legible y usuarios autorizados pueden seguir agregando notas después del cierre. Una corrección de etapa primero inserta la razón en notas y luego actualiza la orden.

El trigger conserva `record_pk.order_id` para registros hijos. `auditRepository` reúne cambios de orden, evaluación, presupuesto, reparación, pagos, repuestos, fotos y notas, y mantiene compatibilidad con entradas históricas cuyo `order_id` solo estaba en el snapshot anterior/nuevo. El motivo de diferimiento se copia a notas y aparece junto con el cambio de decisión en el historial.

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
- Usa `equipment_condition` para el campo `Estado`.
- Registra un anticipo positivo como `Cancela <monto> CRC de revision` en `Observaciones`; si no hay anticipo, indica que no se registró.
- Se descarga al crear la orden y puede reimprimirse desde el detalle.

`/reports` usa `ordersRepository.getAllForReports()` bajo la sesión y RLS del navegador. El repositorio solicita órdenes y relaciones en páginas de 1.000 filas, propaga cualquier error y entrega el conjunto permitido a `OrderReportBuilder`; no existe una server function ni un bypass de RLS para esta lectura.

El constructor agrupa campos de orden, cliente, equipo, evaluación, presupuesto, reparación y pagos. `src/lib/order-report.ts` mantiene la lógica pura para:

- operadores de texto sin distinción de mayúsculas ni acentos;
- comparaciones numéricas reales, no lexicográficas;
- comparaciones de fechas por día calendario;
- operadores booleanos y de valores vacíos;
- grupos de condiciones **Y** separados por alternativas **O**.

La selección ordenada de encabezados es la fuente común para la tabla y las tres exportaciones:

- CSV con BOM UTF-8, escape de comillas/saltos y neutralización de fórmulas;
- Excel `.xls` mediante SpreadsheetML, con números tipados y texto XML escapado;
- PDF mediante jsPDF y jspdf-autotable, con orientación horizontal cuando hay más de cinco columnas.

Los filtros y la generación de archivos se ejecutan en el navegador sobre las filas ya autorizadas. Si se agrega o renombra un campo reportable, mantenga alineados `REPORT_SELECT`, `createReportFields`, las traducciones ES/EN, las pruebas unitarias y el E2E de `/reports`.

La acción “notificar cliente” solo guarda `decision_notified_at` o `delivery_notified_at`. No existe entrega real de email todavía; no presente el timestamp como confirmación de envío.

---

## UI, estilos e i18n

- Use componentes existentes de `src/components/ui/` y primitives Radix.
- Use React Hook Form con Zod para formularios.
- Use TanStack Query para estado remoto; no duplique datos de base en Redux/Zustand.
- Use `date-fns` para fechas y `sonner` para feedback.
- Mantenga loading, empty, error y disabled states accesibles. Los errores de consulta deben incluir contexto seguro y reintento cuando la operación sea repetible.
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

`pnpm run build:vercel` establece `DEPLOY_TARGET=vercel`, omite el plugin Cloudflare y activa Nitro con preset Vercel. Es el equivalente local del destino automatizado de producción.

El pipeline remoto es secuencial:

1. `.github/workflows/ci.yml` valida instalación congelada, tipos, lint, auditoría y cobertura.
2. En un push exitoso a `main`, `.github/workflows/cd.yml` ejecuta Playwright contra Supabase local.
3. Solo si E2E pasa, CD despliega el SHA exacto a producción mediante una versión fijada de Vercel CLI.

El deploy envía el código fuente para que Vercel construya con su entorno. No aplica migraciones al Supabase remoto; coordine esos cambios antes de fusionar/desplegar código dependiente del esquema. Cambios del entry o de variables runtime deben validarse en Vercel y en cualquier destino Cloudflare afectado.

### Electron

Cuando `ELECTRON=true`, Vite usa `base: "./"`. Esto prepara assets relativos, pero el wrapper, actualización y distribución Electron todavía están pendientes.

---

## Importación histórica de producción

[`scripts/import-production-orders.mjs`](./scripts/import-production-orders.mjs) es una herramienta de migración puntual para el workbook histórico:

```bash
node scripts/import-production-orders.mjs <ruta.xlsx>           # dry-run
node scripts/import-production-orders.mjs <ruta.xlsx> --execute # escritura destructiva
```

El script valida exactamente las órdenes `47670–47719`, normaliza fechas y seriales placeholder, deduplica clientes, crea un equipo independiente por orden, traduce estados legados y asigna el perfil activo `Technician Digitron`. Acepta un XLSX o su directorio extraído y usa `unzip` del sistema; no introduce una dependencia XLSX al bundle.

`--execute` requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` y reemplaza tablas operativas —incluidos órdenes, equipos, clientes, repuestos y `audit_log`— aunque preserva perfiles Auth y roles. Antes de ejecutarlo:

1. Confirme dos veces el proyecto destino y el perfil técnico.
2. Obtenga y verifique un respaldo recuperable.
3. Ejecute el dry-run y revise conteos/etapas.
4. Reserve una ventana de mantenimiento y valide las órdenes importadas.

No reutilice este script como importador general ni lo ejecute desde el navegador.

---

## Dependencias y cadena de suministro

`pnpm-workspace.yaml` centraliza overrides de dependencias transitivas revisadas por auditoría. El hook local y GitHub CI ejecutan `pnpm audit --audit-level moderate`.

Existe una excepción documentada para el camino de desarrollo ESLint → minimatch 3 → `brace-expansion@1.1.16`: minimatch 3 espera la API CommonJS invocable de v1, mientras v5 exporta `{ expand }`. Forzar globalmente `brace-expansion@5` rompe lint; los consumidores compatibles usan la versión parcheada v5 y el advisory del camino legacy se ignora explícitamente en `auditConfig`.

No elimine ni amplíe una excepción sin:

- Confirmar la ruta con `pnpm why`.
- Probar typecheck y lint.
- Ejecutar la auditoría.
- Documentar por qué el riesgo no llega al runtime y cuál es el plan de salida.

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
- Operadores, agrupación lógica o serialización de reportes.

### E2E

Playwright ejecuta autenticación, flujo de órdenes y restricciones del técnico contra Supabase local:

```bash
pnpm run test:e2e
pnpm run test:e2e:ui
```

Playwright arranca `webServer` antes de `globalSetup`; por eso `scripts/e2e-web-server.sh` asegura que Supabase exista y exporta sus credenciales antes de iniciar Vite. Después, `e2e/global-setup.ts` reinicia la base, reaplica todas las migraciones, crea usuarios y genera credenciales ignoradas. Los proyectos `admin`, `technician` y `no-auth` usan sesiones separadas. Nunca adapte estos helpers para apuntar silenciosamente a producción.

Convenciones derivadas del flujo actual:

- Los módulos del detalle son colapsables. Use los helpers de `e2e/helpers/order-ui.ts` para expandir el módulo antes de interactuar.
- Acote locators y expectativas al card relevante (`budget-card`, `history-card`, `internal-notes-card`, etc.) para no coincidir con contenido oculto o repetido.
- Si el escenario necesita un presupuesto con valores específicos, siémbrelo antes de las líneas `quoted`; su trigger puede crear/upsert `budgets`.
- Pruebe el saldo con datos persistidos. Cambios de presupuesto aún no guardados deben bloquear pagos y no crear un balance aparente.
- En `/reports`, verifique que el orden de encabezados llegue a la tabla y a CSV/Excel/PDF, y que cada descarga use el formato esperado.

Para inspección manual del módulo de reportes puede sembrar escenarios idempotentes con:

```bash
pnpm run seed:reports
```

`scripts/seed-report-data.mjs` usa service role exclusivamente como herramienta local, rechaza destinos no loopback y presupone los perfiles creados por `seed:admin`. No adapte esa protección para apuntar a un proyecto remoto.

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

`.githooks/pre-push` ejecuta siempre `ci:check`. Si Supabase CLI y Docker están disponibles, también ejecuta E2E; `SKIP_E2E_HOOK=1` omite únicamente E2E. Un salto local no elimina el gate remoto: CD vuelve a ejecutar la suite completa antes de Vercel.

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
16. Desplegar una selección de columna nueva antes de aplicar la migración remota y confundir el error de schema cache con una tabla vacía.
17. Convertir un error de repositorio en `[]` y mostrar un empty state engañoso.
18. Recalcular el presupuesto al registrar una pieza `used`; solo las líneas `quoted` afectan `parts_cost`.
19. Escribir un E2E contra contenido colapsado o usar locators globales cuando el mismo texto aparece en varios módulos.
20. Ejecutar la importación histórica con `--execute` sin validar destino, respaldo y dry-run.

---

## Roadmap técnico

- Wrapper, distribución y auto-update Electron.
- Envío real de notificaciones por email/WhatsApp.
- Integraciones de facturación/Hacienda.
- Modo offline y soporte multi-sucursal.
- Ampliación de recibos y reportes PDF.
