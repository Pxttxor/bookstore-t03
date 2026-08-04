---
name: scr-screen
description: Scaffold a new BookHaven back-office screen (an SCR-xx from the Figma UI spec) to the house pattern — page + CSS pair, Breadcrumb, admin-page head, admin-card, filter-bar, data-table, EmptyState, Pagination, role gate, route registration, sidebar entry. Use when adding any /admin screen, e.g. "build SCR-22", "add the purchasing list page", "create the GRN screen".
---

# Scaffold a back-office screen

Every `/admin` screen in this project has the same skeleton. Follow it exactly — U1–U4 already
does, and consistency is what gets graded. Do **not** invent a new layout.

## 1. Read the spec first

Open `..\New folder\Figma_UI_Spec.md` (relative to the repo root) and find the `### SCR-xx` section.
Take from it, **verbatim**:

- the screen title and subtitle
- every table column heading, in order
- every form field label
- every button label
- the abnormal flows (`ยกเว้น` / validation rules)

Then check the class diagram at
`..\รวมงาน\ClassDiagram\PerPerson\1-อาชัน สง่าศรี\Sub2-Purchasing.md` for the entity's real field
names. **The class diagram wins when the two disagree.**

## 2. Create two files

`src/admin/pages/<Name>Page.tsx` and `src/admin/pages/<Name>Page.css`. The page imports its own CSS
plus `'../components/DataTable.css'` if it renders a table.

## 3. List-screen skeleton

Copy the structure from `src/admin/pages/SupplierListPage.tsx` — it is the reference implementation.

```tsx
export default function XxxPage() {
  const { user } = useAuth()
  const role = user!.role          // AdminLayout guarantees a user
  const mayEdit = can.someAction(role)

  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(() => /* … */, [rows, term])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ชื่อหน้า' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ชื่อหน้า</h1>
          <p className="admin-page__subtitle">คำอธิบายสั้น ๆ พร้อมจำนวนรายการ</p>
        </div>
        {mayEdit && <div className="admin-page__actions">{/* primary action */}</div>}
      </div>

      <section className="admin-card">
        <div className="filter-bar">{/* search + selects + ล้างตัวกรอง */}</div>

        {rows.length === 0 ? (
          <EmptyState title="ไม่พบข้อมูล…" description="…" action={…} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">{/* thead / tbody */}</table>
            </div>
            <Pagination
              page={currentPage} pageCount={pageCount} pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            />
          </>
        )}
      </section>
    </div>
  )
}
```

Any filter change must also `setPage(1)`.

## 4. Rules that are not optional

- **No `DataTable` component.** Hand-roll `<table className="data-table">`. Only the stylesheet
  exists, deliberately.
- **Status** renders as `<StatusBadge tone="…">{XXX_STATUS_LABELS[value]}</StatusBadge>`. Never a
  bare Thai string.
- **Role gating** comes from `can.*` in `src/admin/permissions.ts`. Add a new rule there rather than
  writing `role === 'manager'` inline. An action the role owns but may not perform right now is
  **disabled with a `title`**; an action outside the role's scope is **hidden**.
- **Every successful mutation** calls `useToast().notify('success', '…')`.
- **Icons** come from `Icon` (`src/components/Icon.tsx`). If the one you need is missing, add a
  24×24 stroke path to `PATHS` and its name to the `IconName` union. Never inline an `<svg>`.
- **CSS** uses only the tokens at the top of `src/index.css` and the shared `.btn*` classes. BEM-ish
  `block__element--modifier`. No new colour literals.
- **All user-facing text is Thai**; identifiers, types and comments are English.

## 5. Register the screen

1. Import and add the `<Route>` inside the `admin` route group in `src/App.tsx`.
2. In `src/admin/components/AdminSidebar.tsx`, add or update the `MENU` entry — set `ready: true`
   and point `allowed` at the right `can.*` rule.
3. If the screen belongs to a use case listed in `README.md` under "ที่ยังไม่ได้ทำ", move it out.

## 6. Verify

```bash
npm run build   # tsc -b && vite build — must be clean
npm run lint
```

`noUnusedLocals` is on, so a stray import fails the build. Then run `/spec-check SCR-xx`.
