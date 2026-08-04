# BookHaven — CLAUDE.md

Front end for team T03's online bookstore, coursework for **ENG23 3031 System Analysis and Design**.
Owner of this repo: อาชัน สง่าศรี (B6706418), whose two subsystems are:

- **U1–U4 จัดการข้อมูลผู้จัดจำหน่าย** (supplier management) — done
- **U5–U10 จัดซื้อจากผู้จัดจำหน่าย** (purchasing) — in progress

There is **no backend**. Every piece of state lives in `localStorage`. This is a UI deliverable for a
design course, not a production app.

> **Work log:** บันทึกความคืบหน้าทุกครั้งที่ทำงานลง [`../WORKLOG.md`](../WORKLOG.md) (ไฟล์เดียว ครอบทั้งโปรเจกต์)
> ก่อนลงมือเสมอ — ดูกฎ + คู่มือระดับโปรเจกต์ที่ [`../CLAUDE.md`](../CLAUDE.md)

## Commands

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  — THE TYPE-CHECK GATE, run after every change
npm run lint     # eslint
```

`npm run build` is how types get checked; there is no separate `typecheck` script. **There is no test
runner and that is deliberate** — do not add Vitest/Jest/Testing Library. Verification is
`npm run build` + `npm run lint` clean, then walking the flow in the browser.

## Source of truth

The team's analysis artifacts live one level up in `D:\WorkSmartBoy\SA`. When they disagree, the
precedence is:

1. **Class diagram** — `รวมงาน\ClassDiagram\PerPerson\1-อาชัน สง่าศรี\Sub1-Supplier-Management.md`
   and `Sub2-Purchasing.md`. Class names, attribute names and enum members come from here.
   **The class diagram beats the Figma spec on conflicts.**
2. **Figma UI spec** — `New folder\Figma_UI_Spec.md`. Screen layouts, Thai labels, table columns,
   the role permission matrix (§2), status colours (§8), abnormal flows.
3. **Activity diagrams** — `New folder\ActivityDiagrams\U*.drawio.png`, for step ordering inside a
   use case.

`InventoryItem` and `StockTransaction` belong to teammate วุฒิภัทร's subsystem
(`รวมงาน\ClassDiagram\PerFile\File3-Book-Inventory.md`). U5 and U9 touch them — reuse his field
names (`quantityOnHand`, `reorderPoint`, `lastUpdated`, `StockTxnType`), never invent parallel ones.

The Figma spec defines **no URL routes**. The route table below is this repo's invention, mirroring
the spec's sitemap (§5).

## Language rule

- **User-facing strings are Thai.** Labels, buttons, table headers, toasts, validation messages.
  Copy them verbatim from the Figma spec — the grader compares them.
- **Code is English.** Identifiers, types, comments, commit messages, file names.
- Status enums are English `SCREAMING_SNAKE` unions paired with a
  `*_STATUS_LABELS: Record<T, string>` map holding the Thai label. See
  `src/admin/suppliers/suppliers.ts` (`SUPPLIER_STATUS_LABELS`, `PO_STATUS_LABELS`). Never hardcode
  a Thai status string at a call site — go through the map.

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 7 · **plain CSS**. No UI library, no CSS framework,
no CSS-in-JS, no state library. Do not add dependencies without asking.

## Architecture

```
src/
  main.tsx          BrowserRouter > AuthProvider > CartProvider > NotificationProvider
                    > OrderProvider > App
  App.tsx           all routes, three groups: auth / admin / storefront
  auth/             AuthContext (accounts + session), roles.ts (Role union, ROLE_LABELS)
  cart/             storefront cart
  components/       shared: Icon, BookCard, TopNav, Footer, RatingStars, …
  layouts/          StorefrontLayout, AuthLayout
  pages/            storefront screens
  admin/            back office
    AdminLayout     auth + isEmployee gate, then the provider stack and the shell
    components/     AdminTopBar, AdminSidebar, Breadcrumb, StatusBadge, Modal,
                    Pagination, EmptyState, ToastContext, DataTable.css, AdminForm.css
    permissions.ts  the `can.*` role rules
    suppliers/      suppliers.ts (types + seed) + SupplierContext
    orders/         orders.ts (types + seed) + OrderContext — customer-order flow
```

**Provider placement.** Most back-office providers (Supplier / Inventory / Purchasing / Toast)
live inside `AdminLayout` so the storefront never pays for them. The exceptions are
`NotificationProvider` and `OrderProvider`, hoisted to `main.tsx`: the storefront checkout has
to place customer orders and alert staff, and the back office reads and advances those same
orders, so both sides need them.

### Back-office routes

| Route | Screen |
|---|---|
| `/admin` | SCR-01 Dashboard |
| `/admin/orders` · `/orders/:id` | คำสั่งซื้อลูกค้า — list + detail (Order/Delivery flow, no SCR) |
| `/admin/suppliers` · `/new` · `/:id` · `/:id/edit` | SCR-10 / 12 / 11 / 13 |
| `/admin/alerts` | SCR-20 แจ้งเตือนสินค้าถึงจุดสั่งซื้อ (U5) |
| `/admin/purchasing` | SCR-22 เอกสารจัดซื้อ — the purchasing hub |
| `/admin/purchasing/pr/new` · `/pr/:id` | SCR-21 ใบขอสั่งซื้อ (U6) |
| `/admin/purchasing/pr/:id/approve` | SCR-23 อนุมัติใบสั่งซื้อ (U7, manager only) |
| `/admin/purchasing/po/:id` | SCR-24 ใบสั่งซื้อ + ส่ง/ยืนยัน (U8) |
| `/admin/purchasing/receipts` · `/po/:id/receive` | SCR-25 รับสินค้าเข้าคลัง (U9) |
| `/admin/purchasing/returns/new` · `/returns/:id` | SCR-26 ส่งคืนสินค้า (U10) |
| `/admin/contacts` | SCR-27 ศูนย์การติดต่อ |

### State pattern

One context per subsystem, all identical in shape — copy `src/admin/suppliers/SupplierContext.tsx`
when adding another:

- module-level `STORAGE_KEY`, `read()` falling back to the `SEED_*` array, `write()`
- `useState(read)` + a `persist()` that writes then sets
- everything wrapped in one `useMemo` keyed on the state
- a `useXxx()` hook that throws if used outside its provider, with the existing
  `// eslint-disable-next-line react-refresh/only-export-components` above it

`localStorage` keys are **versioned** (`bookhaven.suppliers.v2`, `bookhaven.purchasing.v1`,
`bookhaven.orders.v1`, …).
When a persisted shape changes, bump the version instead of migrating — a stale blob from an earlier
session otherwise deserialises into a type that no longer matches.

Providers nest inside `AdminLayout` (not `main.tsx`) so the storefront never pays for back-office
state. Order matters: `PurchasingProvider` calls `useInventory()`, so it must sit inside
`InventoryProvider`.

## House patterns

Follow what U1–U4 already does. Concretely:

- **Page shell** — `<div className="admin-page">` → `<Breadcrumb items={…} />` →
  `<div className="admin-page__head">` (h1 `admin-page__title` + p `admin-page__subtitle` +
  `admin-page__actions`) → `<section className="admin-card">`. See
  `src/admin/pages/SupplierListPage.tsx`.
- **Tables are hand-rolled.** `<table className="data-table">` with `import '../components/DataTable.css'`.
  There is deliberately **no `DataTable.tsx`** — only the stylesheet. Do not build one.
- **Every list** gets a `filter-bar`, an `EmptyState` when there are no rows, and `Pagination`.
- **Status** always renders through `<StatusBadge tone="success|warning|danger|neutral|info">`
  with the Thai label from the `*_STATUS_LABELS` map.
- **Every successful mutation** fires `useToast().notify(tone, message)`.
- **Role gating** goes through `can.*` in `src/admin/permissions.ts` — never inline a
  `role === 'manager'` check in a component. Per spec §2.1, an action a role owns but may not
  perform is rendered **disabled with a `title`**, not hidden; an action outside the role's scope
  entirely is hidden.
- **Icons** are a closed union in `src/components/Icon.tsx`. Need a new one? Add a 24×24
  stroke path to `PATHS` and the name to `IconName`. Never inline an `<svg>` in a page.
- **CSS** — one `.css` file per component/page, imported by that file. BEM-ish
  `block__element--modifier`. Colours, radii, shadows and fonts come **only** from the tokens at
  the top of `src/index.css`; shared `.btn` / `.btn-primary` / `.btn-sm` classes live there too.

## Gotchas

- `verbatimModuleSyntax` is on — type-only imports must be `import type { X }`.
- `noUnusedLocals` and `noUnusedParameters` are on — dead code fails `npm run build`, not just lint.
- `erasableSyntaxOnly` is on — no TS `enum`, no parameter properties. Use union types + `const` maps.
- Seed data is only used when the `localStorage` key is missing. After changing a `SEED_*` array,
  clear the key in DevTools or the app keeps serving the old blob.
- Staff cannot sign up; `AuthContext` seeds four staff accounts on first read. Passwords are plain
  text on purpose — do not "fix" this.

## Test accounts

Password for all staff: `staff1234`. Customers register at `/signup`.

| Email | Role | Supplier rights |
|---|---|---|
| warehouse@bookhaven.co.th | พนักงานคลังสินค้า | view, add, edit |
| manager@bookhaven.co.th | ผู้จัดการร้าน | view, deactivate |
| sales@bookhaven.co.th | พนักงานฝ่ายขาย | view only |
| delivery@bookhaven.co.th | พนักงานจัดส่ง | none for suppliers — but owns shipping on customer orders |

All four staff roles see the **คำสั่งซื้อลูกค้า** menu (`can.viewOrders`); the actions inside are
split — sales confirm intake + payment, warehouse packs, delivery records the shipment and confirms
delivery. This is the delivery role's only active area.

Signing in as staff redirects to `/admin`; customers go to the storefront.

## Deliberate deviations from the Figma spec

Recorded so nobody "fixes" them later:

- **No loading skeletons.** The spec asks for them (§7), but all state reads synchronously from
  `localStorage` — there is no loading state to render.
- **No `DataTable` React component.** §7 lists it as a *Figma* component; in code the tables are
  hand-rolled, matching U1–U4.
- **SCR-30 supplier portal is skipped** — the spec itself marks it "(ทางเลือก)". The warehouse role
  sets "ยืนยันแล้ว" and the delivery date manually on SCR-24.
- **Email notifications are simulated**, stored as flagged notification entries. Nothing is sent.
- **The customer-order flow (Order + Delivery) is a demo of teammates' subsystems.** จิรพนธ์ owns
  Order and ดวงกมล owns Delivery; this repo implements a runnable flow against their class names so
  the storefront prototype is complete end to end. A `CustomerOrder` is **self-contained**: it
  snapshots book title/price/qty and does **not** link to วุฒิภัทร's `InventoryItem` (storefront keys
  books by slug, inventory by numeric id) nor touch บัญชาการ's `Payment` subsystem. Customer orders
  therefore do not deduct stock. Amounts are the storefront's USD (`formatPrice`), not ฿.
- **The purchase budget on SCR-23 is a constant** in `src/admin/purchasing/purchasing.ts`. The spec
  shows the figure but never says where it comes from.

## Out of scope

No backend or API, no real auth, no i18n (Thai only), no dark mode, no mobile beyond the spec's
requirement that SCR-01 / SCR-10 / SCR-20 work under 768px.
