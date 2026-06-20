# Frontend Implementation Plan: Repository Abstraction Layer

## Overview

Introduce `src/lib/repositories/` as a thin abstraction layer between Supabase and all consumer files (routes, hooks, components). After this change, only repository files and `src/lib/auth.service.ts` may import from `@/integrations/supabase/client`. Server functions (`src/lib/orders.functions.ts` and `src/lib/users.functions.ts`) receive a supabase client through middleware context and are excluded.

---

## Files to Create

### 1. `src/lib/auth.service.ts`

Wraps `supabase.auth.*`. This is the only non-repository file that imports supabase directly (apart from the existing server-side files).

```typescript
import { supabase } from "@/integrations/supabase/client";

export const authService = {
  getSession: () => supabase.auth.getSession(),
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  onAuthStateChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
};
```

### 2. `src/lib/repositories/customers.repository.ts`

Wraps `supabase.from("customers")`. Extract exact query shapes from consumers.

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const customersRepository = {
  // used by use-clients-min.tsx
  listMin: () => supabase.from("customers").select("id, name").order("name"),

  // used by clients.tsx (query)
  listAll: () =>
    supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2, email, address")
      .order("name"),

  // used by clients.tsx (delete mutation)
  deleteById: (id: string) => supabase.from("customers").delete().eq("id", id),

  // used by client-form-dialog.tsx (update mutation)
  updateById: (id: string, payload: TablesUpdate<"customers">) =>
    supabase.from("customers").update(payload).eq("id", id),

  // used by client-form-dialog.tsx (insert mutation)
  insert: (payload: TablesInsert<"customers">) =>
    supabase.from("customers").insert(payload).select("id").single(),
};
```

### 3. `src/lib/repositories/equipment.repository.ts`

Wraps `supabase.from("equipment")`.

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const equipmentRepository = {
  // equipment.tsx — full list
  listAll: () =>
    supabase
      .from("equipment")
      .select(
        "id, type, brand, model, serial_number, accessories, purchase_invoice, purchase_store, purchase_date, client_id, customers(name)",
      )
      .order("created_at", { ascending: false }),

  // equipment.tsx — serial lookup
  searchBySerial: (serial: string) =>
    supabase
      .from("equipment")
      .select(
        "id, type, brand, model, serial_number, customers(name), orders(id, order_number, stage, intake_at)",
      )
      .ilike("serial_number", `%${serial}%`),

  // equipment.tsx (delete) + equipment-form-dialog.tsx (delete)
  deleteById: (id: string) => supabase.from("equipment").delete().eq("id", id),

  // equipment-form-dialog.tsx (update)
  updateById: (id: string, payload: TablesUpdate<"equipment">) =>
    supabase.from("equipment").update(payload).eq("id", id),

  // equipment-form-dialog.tsx (insert)
  insert: (payload: TablesInsert<"equipment">) =>
    supabase.from("equipment").insert(payload).select("id").single(),

  // orders/new.tsx — equipment picker by client
  listByClient: (clientId: string) =>
    supabase.from("equipment").select("id, brand, model, type").eq("client_id", clientId),
};
```

### 4. `src/lib/repositories/orders.repository.ts`

Client-side queries only. Server functions that receive supabase via context are NOT included here.

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const ordersRepository = {
  // orders/index.tsx
  listAll: () =>
    supabase
      .from("orders")
      .select(
        `id, order_number, stage, technician_id, client_id, equipment_id, created_at,
        customers(name), equipment(brand, model),
        technician:profiles!orders_technician_id_fkey(full_name)`,
      )
      .order("created_at", { ascending: false }),

  // dashboard.tsx
  listSummary: () =>
    supabase
      .from("orders")
      .select(
        "id, order_number, stage, technician_id, created_at, updated_at, customers(name), equipment(brand, model)",
      )
      .order("created_at", { ascending: false }),

  // reports.tsx
  listForReports: () =>
    supabase
      .from("orders")
      .select(
        "id, order_number, stage, technician_id, client_id, created_at, warranty_origin_id, customers(name)",
      ),

  // orders/$orderId.tsx — main detail query
  getById: (orderId: string) =>
    supabase
      .from("orders")
      .select(
        `*, customers(id, name, phone1, email), equipment(id, type, brand, model, serial_number)`,
      )
      .eq("id", orderId)
      .single(),

  // orders/$orderId.tsx — assignTech mutation
  updateById: (orderId: string, payload: TablesUpdate<"orders">) =>
    supabase.from("orders").update(payload).eq("id", orderId),

  // orders/new.tsx — create order
  insert: (payload: TablesInsert<"orders">) =>
    supabase.from("orders").insert(payload).select("id").single(),
};
```

### 5. `src/lib/repositories/parts.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const partsRepository = {
  // inventory.tsx + orders/$orderId.tsx (catalog query)
  listAll: () =>
    supabase
      .from("parts")
      .select("id, part_code, description, unit_cost, stock, supplier")
      .order("part_code", { ascending: true }),

  // orders/$orderId.tsx — parts catalog for order detail (narrower select)
  listCatalog: () =>
    supabase
      .from("parts")
      .select("id, part_code, description, unit_cost, stock")
      .order("part_code", { ascending: true }),

  // inventory.tsx
  deleteById: (id: string) => supabase.from("parts").delete().eq("id", id),

  // parts-form-dialog.tsx
  updateById: (id: string, payload: TablesUpdate<"parts">) =>
    supabase.from("parts").update(payload).eq("id", id),

  // parts-form-dialog.tsx
  insert: (payload: TablesInsert<"parts">) =>
    supabase.from("parts").insert(payload).select("id").single(),
};
```

**Note:** Two list methods exist (`listAll` and `listCatalog`) because `inventory.tsx` fetches `supplier` while `$orderId.tsx` does not. Preserve each query shape exactly as in the source file.

### 6. `src/lib/repositories/order-parts.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export const orderPartsRepository = {
  // orders/$orderId.tsx — list parts for one order
  listByOrder: (orderId: string) =>
    supabase
      .from("order_parts")
      .select("id, part_id, stage, quantity, unit_cost_at_registration, in_stock_at_registration")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),

  // reports.tsx — used parts for consumption report
  listUsedForReports: () =>
    supabase
      .from("order_parts")
      .select(
        "part_id, quantity, unit_cost_at_registration, created_at, parts(part_code, description)",
      )
      .eq("stage", "used"),

  // orders/$orderId.tsx — add part to order
  insert: (payload: TablesInsert<"order_parts">) => supabase.from("order_parts").insert(payload),
};
```

### 7. `src/lib/repositories/evaluations.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const evaluationsRepository = {
  // orders/$orderId.tsx
  getByOrder: (orderId: string) =>
    supabase.from("technical_evaluations").select("*").eq("order_id", orderId).maybeSingle(),

  // orders/$orderId.tsx — saveEvaluation (update branch)
  updateById: (id: string, payload: TablesUpdate<"technical_evaluations">) =>
    supabase.from("technical_evaluations").update(payload).eq("id", id),

  // orders/$orderId.tsx — saveEvaluation (insert branch)
  insert: (payload: TablesInsert<"technical_evaluations">) =>
    supabase.from("technical_evaluations").insert(payload),
};
```

### 8. `src/lib/repositories/budgets.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const budgetsRepository = {
  // orders/$orderId.tsx
  getByOrder: (orderId: string) =>
    supabase.from("budgets").select("*").eq("order_id", orderId).maybeSingle(),

  // orders/$orderId.tsx — saveBudget (update branch)
  updateById: (id: string, payload: TablesUpdate<"budgets">) =>
    supabase.from("budgets").update(payload).eq("id", id),

  // orders/$orderId.tsx — saveBudget (insert branch)
  insert: (payload: TablesInsert<"budgets">) => supabase.from("budgets").insert(payload),
};
```

### 9. `src/lib/repositories/repairs.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const repairsRepository = {
  // orders/$orderId.tsx
  getByOrder: (orderId: string) =>
    supabase.from("repairs").select("*").eq("order_id", orderId).maybeSingle(),

  // orders/$orderId.tsx — saveRepair (update branch)
  updateById: (id: string, payload: TablesUpdate<"repairs">) =>
    supabase.from("repairs").update(payload).eq("id", id),

  // orders/$orderId.tsx — saveRepair (insert branch)
  insert: (payload: TablesInsert<"repairs">) =>
    supabase.from("repairs").insert({ state: "in_progress", ...payload }),
};
```

**Note:** The insert always prepends `state: "in_progress"` because the original code does `supabase.from("repairs").insert({ state: "in_progress", ...payload })`. Preserve this default in the repository.

### 10. `src/lib/repositories/payments.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export const paymentsRepository = {
  // orders/$orderId.tsx
  listByOrder: (orderId: string) =>
    supabase
      .from("payments")
      .select("id, amount, method, reference, paid_at, registered_by")
      .eq("order_id", orderId)
      .order("paid_at", { ascending: false }),

  // reports.tsx
  listForReports: () => supabase.from("payments").select("amount, paid_at"),

  // orders/$orderId.tsx — addPayment mutation
  insert: (payload: TablesInsert<"payments">) => supabase.from("payments").insert(payload),
};
```

### 11. `src/lib/repositories/photos.repository.ts`

This repository wraps both the `order_photos` table and the `order-photos` storage bucket.

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export const photosRepository = {
  // orders/$orderId.tsx — list photos for order
  listByOrder: (orderId: string) =>
    supabase.from("order_photos").select("id, storage_path, uploaded_at").eq("order_id", orderId),

  // orders/$orderId.tsx — insert photo record after storage upload
  insertRecord: (payload: TablesInsert<"order_photos">) =>
    supabase.from("order_photos").insert(payload),

  // orders/$orderId.tsx — delete photo record
  deleteById: (id: string) => supabase.from("order_photos").delete().eq("id", id),

  // orders/$orderId.tsx — storage: generate signed URL
  createSignedUrl: (storagePath: string, expiresIn: number) =>
    supabase.storage.from("order-photos").createSignedUrl(storagePath, expiresIn),

  // orders/$orderId.tsx — storage: upload file
  uploadFile: (path: string, file: File) =>
    supabase.storage.from("order-photos").upload(path, file),

  // orders/$orderId.tsx — storage: remove files
  removeFiles: (paths: string[]) => supabase.storage.from("order-photos").remove(paths),
};
```

### 12. `src/lib/repositories/audit.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";

export const auditRepository = {
  // orders/$orderId.tsx
  listByOrder: (orderId: string) =>
    supabase
      .from("audit_log")
      .select("id, operation, change_ts, app_user, changed_fields, full_row_old")
      .eq("table_name", "orders")
      .filter("record_pk->>id", "eq", orderId)
      .order("change_ts", { ascending: false }),
};
```

### 13. `src/lib/repositories/profiles.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";

export const profilesRepository = {
  // use-auth.tsx
  getById: (uid: string) =>
    supabase.from("profiles").select("id, full_name, email, active").eq("id", uid).maybeSingle(),

  // orders/$orderId.tsx — full name lookup for audit log
  listMin: () => supabase.from("profiles").select("id, full_name"),

  // reports.tsx
  listForReports: () => supabase.from("profiles").select("id, full_name"),
};
```

**Note:** `listMin` and `listForReports` produce the same query shape (`id, full_name`). They are aliased separately for semantic clarity at the call site, but you may unify them into a single method if preferred. The important constraint is to not break TypeScript types.

### 14. `src/lib/repositories/user-roles.repository.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";

export const userRolesRepository = {
  // use-auth.tsx
  listByUser: (uid: string) => supabase.from("user_roles").select("role").eq("user_id", uid),

  // use-technicians.tsx
  listByRole: (role: string) =>
    supabase.from("user_roles").select("user_id, role").eq("role", role),
};
```

### 15. `src/lib/repositories/index.ts`

Barrel re-export for all repositories and the auth service.

```typescript
export { authService } from "@/lib/auth.service";
export { customersRepository } from "./customers.repository";
export { equipmentRepository } from "./equipment.repository";
export { ordersRepository } from "./orders.repository";
export { partsRepository } from "./parts.repository";
export { orderPartsRepository } from "./order-parts.repository";
export { evaluationsRepository } from "./evaluations.repository";
export { budgetsRepository } from "./budgets.repository";
export { repairsRepository } from "./repairs.repository";
export { paymentsRepository } from "./payments.repository";
export { photosRepository } from "./photos.repository";
export { auditRepository } from "./audit.repository";
export { profilesRepository } from "./profiles.repository";
export { userRolesRepository } from "./user-roles.repository";
```

---

## Files to Modify

### `src/hooks/use-auth.tsx`

Replace:

- `import { supabase } from "@/integrations/supabase/client";`

With:

- `import { authService } from "@/lib/auth.service";`
- `import { profilesRepository } from "@/lib/repositories/profiles.repository";`
- `import { userRolesRepository } from "@/lib/repositories/user-roles.repository";`

Change call sites:

- `supabase.from("profiles").select(...)` → `profilesRepository.getById(uid)` (returns `{ data: profileRow, error: profileErr }`)
- `supabase.from("user_roles").select(...)` → `userRolesRepository.listByUser(uid)` (returns `{ data: roleRows, error: rolesErr }`)
- `supabase.auth.getSession()` → `authService.getSession()`
- `supabase.auth.onAuthStateChange(...)` → `authService.onAuthStateChange(...)`
- `supabase.auth.signOut()` → `authService.signOut()`

The `loadProfile` function currently calls `Promise.all([...])` with both queries. Keep this pattern, just change the call expression inside each array slot.

### `src/hooks/use-clients-min.tsx`

Replace supabase import with:

```typescript
import { customersRepository } from "@/lib/repositories/customers.repository";
```

Change `queryFn`:

```typescript
queryFn: async () => {
  const { data, error } = await customersRepository.listMin();
  if (error) throw error;
  return data as ClientMinItem[];
},
```

### `src/hooks/use-technicians.tsx`

Replace supabase import with:

```typescript
import { userRolesRepository } from "@/lib/repositories/user-roles.repository";
import { profilesRepository } from "@/lib/repositories/profiles.repository";
```

Change `queryFn`:

- `supabase.from("user_roles").select("user_id, role").eq("role", "tecnico")` → `userRolesRepository.listByRole("tecnico")`
- `supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name")` → this query shape doesn't exist in `profilesRepository` as defined above.

**Additional method needed in `profiles.repository.ts`:**

```typescript
listByIds: (ids: string[]) =>
  supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name"),
```

Add `listByIds` to `profilesRepository` in `profiles.repository.ts`.

### `src/components/client-form-dialog.tsx`

Replace supabase import with:

```typescript
import { customersRepository } from "@/lib/repositories/customers.repository";
```

Change inside `mutationFn`:

- `supabase.from("customers").update(payload).eq("id", editing.id)` → `customersRepository.updateById(editing.id, payload)`
- `supabase.from("customers").insert(payload).select("id").single()` → `customersRepository.insert(payload)`

### `src/components/equipment-form-dialog.tsx`

Replace supabase import with:

```typescript
import { equipmentRepository } from "@/lib/repositories/equipment.repository";
```

Change inside `mutationFn`:

- `supabase.from("equipment").update(payload).eq("id", editing.id)` → `equipmentRepository.updateById(editing.id, payload)`
- `supabase.from("equipment").insert(payload).select("id").single()` → `equipmentRepository.insert(payload)`

### `src/components/parts-form-dialog.tsx`

Replace supabase import with:

```typescript
import { partsRepository } from "@/lib/repositories/parts.repository";
```

Change inside `mutationFn`:

- `supabase.from("parts").update(payload).eq("id", editing.id)` → `partsRepository.updateById(editing.id, payload)`
- `supabase.from("parts").insert(payload).select("id").single()` → `partsRepository.insert(payload)`

### `src/routes/_authenticated/clients.tsx`

Replace supabase import with:

```typescript
import { customersRepository } from "@/lib/repositories/customers.repository";
```

Change:

- `queryFn` in the `useQuery` for clients list: use `customersRepository.listAll()`
- `mutationFn` in the `del` mutation: use `customersRepository.deleteById(id)`

### `src/routes/_authenticated/equipment.tsx`

Replace supabase import with:

```typescript
import { equipmentRepository } from "@/lib/repositories/equipment.repository";
```

Change:

- `queryFn` for `["equipment"]`: use `equipmentRepository.listAll()`
- `queryFn` for `["equipment-history", searchedSerial]`: use `equipmentRepository.searchBySerial(searchedSerial)`
- `mutationFn` for `del`: use `equipmentRepository.deleteById(id)`

### `src/routes/_authenticated/inventory.tsx`

Replace supabase import with:

```typescript
import { partsRepository } from "@/lib/repositories/parts.repository";
```

Change:

- `queryFn` for `["parts"]`: use `partsRepository.listAll()`
- `mutationFn` for `del`: use `partsRepository.deleteById(id)`

### `src/routes/_authenticated/dashboard.tsx`

Replace supabase import with:

```typescript
import { ordersRepository } from "@/lib/repositories/orders.repository";
```

Change:

- `queryFn` for `["orders-summary"]`: use `ordersRepository.listSummary()`

### `src/routes/_authenticated/reports.tsx`

Replace supabase import with:

```typescript
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { paymentsRepository } from "@/lib/repositories/payments.repository";
import { profilesRepository } from "@/lib/repositories/profiles.repository";
import { orderPartsRepository } from "@/lib/repositories/order-parts.repository";
```

Change:

- `queryFn` for `["orders-reports"]`: use `ordersRepository.listForReports()`
- `queryFn` for `["payments-reports"]`: use `paymentsRepository.listForReports()`
- `queryFn` for `["profiles-all"]`: use `profilesRepository.listForReports()`
- `queryFn` for `["used-parts-reports"]`: use `orderPartsRepository.listUsedForReports()`

### `src/routes/_authenticated/orders/index.tsx`

Replace supabase import with:

```typescript
import { ordersRepository } from "@/lib/repositories/orders.repository";
```

Change:

- `queryFn` for `["orders"]`: use `ordersRepository.listAll()`

The `data as unknown as OrderRow[]` cast must be preserved because the joined profiles alias (`technician:profiles!orders_technician_id_fkey`) is not directly inferrable from the generated Supabase types. The repository returns the same raw type, so the cast stays in the consumer.

### `src/routes/_authenticated/orders/new.tsx`

Replace supabase import with:

```typescript
import { equipmentRepository } from "@/lib/repositories/equipment.repository";
import { ordersRepository } from "@/lib/repositories/orders.repository";
```

Change:

- `queryFn` for `["equipment-by-client", clientId]`: use `equipmentRepository.listByClient(clientId)`
- `mutationFn` for `createOrder`: use `ordersRepository.insert({ ... })`

### `src/routes/_authenticated/orders/$orderId.tsx`

This is the largest consumer. Replace supabase import with multiple repository imports:

```typescript
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { evaluationsRepository } from "@/lib/repositories/evaluations.repository";
import { budgetsRepository } from "@/lib/repositories/budgets.repository";
import { repairsRepository } from "@/lib/repositories/repairs.repository";
import { paymentsRepository } from "@/lib/repositories/payments.repository";
import { profilesRepository } from "@/lib/repositories/profiles.repository";
import { auditRepository } from "@/lib/repositories/audit.repository";
import { photosRepository } from "@/lib/repositories/photos.repository";
import { partsRepository } from "@/lib/repositories/parts.repository";
import { orderPartsRepository } from "@/lib/repositories/order-parts.repository";
```

Mapping of each supabase call to its repository method:

| Original call                                                                              | Repository method                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `supabase.from("orders").select("*, customers(...)...").eq("id", orderId).single()`        | `ordersRepository.getById(orderId)`                                       |
| `supabase.from("technical_evaluations").select("*").eq(...).maybeSingle()`                 | `evaluationsRepository.getByOrder(orderId)`                               |
| `supabase.from("budgets").select("*").eq(...).maybeSingle()`                               | `budgetsRepository.getByOrder(orderId)`                                   |
| `supabase.from("repairs").select("*").eq(...).maybeSingle()`                               | `repairsRepository.getByOrder(orderId)`                                   |
| `supabase.from("payments").select("id, amount...").eq(...).order(...)`                     | `paymentsRepository.listByOrder(orderId)`                                 |
| `supabase.from("profiles").select("id, full_name")`                                        | `profilesRepository.listMin()`                                            |
| `supabase.from("audit_log").select("id, operation...").eq(...).filter(...).order(...)`     | `auditRepository.listByOrder(orderId)`                                    |
| `supabase.from("order_photos").select("id, storage_path, uploaded_at").eq(...)`            | `photosRepository.listByOrder(orderId)`                                   |
| `supabase.storage.from("order-photos").createSignedUrl(p.storage_path, 3600)`              | `photosRepository.createSignedUrl(p.storage_path, 3600)`                  |
| `supabase.from("parts").select("id, part_code, description, unit_cost, stock").order(...)` | `partsRepository.listCatalog()`                                           |
| `supabase.from("order_parts").select("id, part_id...").eq(...).order(...)`                 | `orderPartsRepository.listByOrder(orderId)`                               |
| `supabase.from("orders").update({ technician_id: ... }).eq("id", orderId)`                 | `ordersRepository.updateById(orderId, { technician_id: ... })`            |
| `supabase.from("orders").update({ general_notes: ... }).eq("id", orderId)`                 | `ordersRepository.updateById(orderId, { general_notes: ... })`            |
| `supabase.from("orders").update({ balance_waived: true }).eq("id", orderId)`               | `ordersRepository.updateById(orderId, { balance_waived: true })`          |
| `supabase.from("technical_evaluations").update(payload).eq("id", evaluation.id)`           | `evaluationsRepository.updateById(evaluation.id, payload)`                |
| `supabase.from("technical_evaluations").insert(payload)`                                   | `evaluationsRepository.insert(payload)`                                   |
| `supabase.from("budgets").update(payload).eq("id", budget.id)`                             | `budgetsRepository.updateById(budget.id, payload)`                        |
| `supabase.from("budgets").insert(payload)`                                                 | `budgetsRepository.insert(payload)`                                       |
| `supabase.from("repairs").update(payload).eq("id", repair.id)`                             | `repairsRepository.updateById(repair.id, payload)`                        |
| `supabase.from("repairs").insert({ state: "in_progress", ...payload })`                    | `repairsRepository.insert(payload)` (state is embedded in the repository) |
| `supabase.from("payments").insert({ ... })`                                                | `paymentsRepository.insert({ ... })`                                      |
| `supabase.from("order_parts").insert({ ... })`                                             | `orderPartsRepository.insert({ ... })`                                    |
| `supabase.storage.from("order-photos").upload(path, file)`                                 | `photosRepository.uploadFile(path, file)`                                 |
| `supabase.from("order_photos").insert({ order_id, storage_path, uploaded_by })`            | `photosRepository.insertRecord({ order_id, storage_path, uploaded_by })`  |
| `supabase.storage.from("order-photos").remove([p.storage_path])`                           | `photosRepository.removeFiles([p.storage_path])`                          |
| `supabase.from("order_photos").delete().eq("id", p.id)`                                    | `photosRepository.deleteById(p.id)`                                       |

### `src/routes/login.tsx`

Migrate from plain `useState` form to `react-hook-form` + `zod` + `useMutation`.

Replace these imports:

```typescript
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
```

Add these imports:

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { authService } from "@/lib/auth.service";
```

Replace the component body (only the form logic and JSX form part):

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { loading: authLoading, session } = useAuth();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signIn = useMutation({
    mutationFn: async (values: LoginValues) => {
      const { error } = await authService.signIn(values.email, values.password);
      if (error) throw error;
    },
    onSuccess: () => {
      navigate({ to: search.redirect ?? "/dashboard" });
    },
    onError: (e: Error) => {
      toast.error(t("login.failed"), { description: e.message });
    },
  });

  // ... loading/redirect guards unchanged ...

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        {/* CardHeader unchanged */}
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.password")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={signIn.isPending}>
                {signIn.isPending ? t("login.signingIn") : t("login.signIn")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("login.adminOnly")}
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

Remove unused imports: `useState`, `type FormEvent`, `Label` (from `@/components/ui/label` — now handled by `FormLabel`). Keep `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Input`, `Button`, `toast`, `useAuth`, `Navigate`, `useNavigate`, `createFileRoute`, `useTranslation`.

---

## TypeScript Typing Notes

### Return type pattern

All repository methods return the raw Supabase promise (they do not `.then()` or `await`). Consumers continue to destructure `{ data, error }` exactly as before:

```typescript
// Repository (no await, returns promise directly):
listMin: () => supabase.from("customers").select("id, name").order("name"),

// Consumer (no change to destructuring pattern):
const { data, error } = await customersRepository.listMin();
```

### `TablesInsert` / `TablesUpdate` usage

Use the helpers exported from `@/integrations/supabase/types`:

- `TablesInsert<"tableName">` for insert payloads
- `TablesUpdate<"tableName">` for update payloads
- `Tables<"tableName">` is available for row types if needed

### Cast preservation

In `orders/index.tsx`, the `data as unknown as OrderRow[]` cast is required due to the aliased join (`technician:profiles!orders_technician_id_fkey`). The TypeScript generated types do not understand the FK-alias syntax, so the cast must remain in the consumer after the repository call.

### Repair insert special case

`repairsRepository.insert` always applies `state: "in_progress"` at the start:

```typescript
insert: (payload: TablesInsert<"repairs">) =>
  supabase.from("repairs").insert({ state: "in_progress", ...payload }),
```

The consumer in `$orderId.tsx` passes the rest of the payload without `state` (the state overrides happen on update, not insert). This is faithful to the original logic.

---

## Order of Implementation

Work in this order to avoid intermediate broken states:

1. Create `src/lib/auth.service.ts`
2. Create all repository files in `src/lib/repositories/` (all 13 + index)
3. Update `src/hooks/use-auth.tsx`
4. Update `src/hooks/use-clients-min.tsx`
5. Update `src/hooks/use-technicians.tsx`
6. Update `src/components/client-form-dialog.tsx`
7. Update `src/components/equipment-form-dialog.tsx`
8. Update `src/components/parts-form-dialog.tsx`
9. Update `src/routes/_authenticated/clients.tsx`
10. Update `src/routes/_authenticated/equipment.tsx`
11. Update `src/routes/_authenticated/inventory.tsx`
12. Update `src/routes/_authenticated/dashboard.tsx`
13. Update `src/routes/_authenticated/reports.tsx`
14. Update `src/routes/_authenticated/orders/index.tsx`
15. Update `src/routes/_authenticated/orders/new.tsx`
16. Update `src/routes/_authenticated/orders/$orderId.tsx` (largest, do last)
17. Update `src/routes/login.tsx`
18. Run `npx tsc --noEmit` and fix any errors

---

## Constraints and Warnings

- Do NOT touch `src/lib/orders.functions.ts` or `src/lib/users.functions.ts`. They receive a supabase client via middleware context (`requireSupabaseAuth`), not from the client module.
- Do NOT touch `src/integrations/supabase/client.ts`. Keep it as-is; only repository files and `auth.service.ts` import from it.
- Do NOT change any CSS files or test files.
- Do NOT change query shapes (columns selected, filters applied, ordering). Only wrap the calls.
- The `profilesRepository.listMin()` and `profilesRepository.listForReports()` methods are identical in query shape. They may be unified if desired, but keep both names in the barrel or alias one to the other so call sites compile.
- `login.tsx`: Remove the `Label` import from `@/components/ui/label` after migrating to `react-hook-form` (it is replaced by `FormLabel` from `@/components/ui/form`).
- After migration, zero files outside `src/lib/repositories/` and `src/lib/auth.service.ts` should import `supabase` from `@/integrations/supabase/client`. Verify with: `grep -r "from \"@/integrations/supabase/client\"" src/ --include="*.ts" --include="*.tsx" | grep -v "src/lib/repositories/" | grep -v "src/lib/auth.service.ts"`.
- The server-side files `src/integrations/supabase/auth-attacher.ts`, `src/integrations/supabase/auth-middleware.ts`, and `src/integrations/supabase/client.server.ts` will still import from supabase directly — this is expected and correct.
