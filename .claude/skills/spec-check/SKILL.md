---
name: spec-check
description: Audit an implemented BookHaven screen against the Figma UI spec and the team class diagram — Thai labels verbatim, table columns in order, status transitions, role gating, abnormal flows. Use as the acceptance step after building or changing any /admin screen, e.g. "spec-check SCR-23", "does the PR form match the spec?".
---

# Check a screen against the spec

Takes an SCR number (or a screen name). Reports mismatches; does not silently fix them unless asked.

This project is graded against its own analysis artifacts, so drift from the spec is a real defect —
not a style nit. Wording counts.

## Sources, in precedence order

1. `..\รวมงาน\ClassDiagram\PerPerson\1-อาชัน สง่าศรี\Sub1-Supplier-Management.md` and
   `Sub2-Purchasing.md` — class names, attributes, enum members.
   **The class diagram beats the Figma spec on conflicts.** If they disagree, that is a finding:
   report it, follow the class diagram.
2. `..\New folder\Figma_UI_Spec.md` — the `### SCR-xx` section, plus §2 (roles), §7 (components),
   §8 (status colours).
3. `..\New folder\ActivityDiagrams\U*.drawio.png` — step ordering inside the use case.

`InventoryItem` / `StockTransaction` fields belong to teammate วุฒิภัทร's subsystem in
`..\รวมงาน\ClassDiagram\PerFile\File3-Book-Inventory.md` — check names against that file, not
against our own guesses.

## Checklist

Read the spec section and the implementation side by side, then verify:

**Text** — every Thai label matches the spec **character for character**: page title, table headers,
field labels, button labels, empty-state text, toast messages, validation messages. Paraphrasing is
a finding. Check for Latin digits vs Thai, and stray spaces around `·` separators.

**Table columns** — all present, in the spec's order, nothing extra. Compare against the wireframe
row in the spec, which also fixes the code formats (`SUP01`, `BK01`, `PR-101`, `PO-090`).

**Fields** — every field in the wireframe exists, with the right input type (text / number / select /
datepicker / radio / file). Attribute names match the class diagram.

**Status** — the values used are exactly the enum members from the class diagram; the Thai labels
come from the `*_STATUS_LABELS` map; the `StatusBadge` tone matches §8's colour
(🟢 success · 🟠 warning · 🔴 danger · 🔵 info · ⚪ neutral). No bare Thai status strings at call
sites.

**Transitions** — each action moves the document to the status the spec names, and triggers the side
effects it lists (creating a PO on approval, emitting stock transactions on receipt, notifying the
manager on submit).

**Roles** — matches the §2 permission matrix. Confirm the gate goes through `can.*` in
`src/admin/permissions.ts`, not an inline role comparison. Confirm the disabled-vs-hidden rule:
an action the role owns but may not perform now is **disabled with a `title`**; an action outside
its scope is **hidden**. Spot-check with all four staff accounts.

**Abnormal flows** — every `ยกเว้น` branch in the spec section is handled: disabled buttons, warning
banners, blocked selections, `⚠` tags.

**House patterns** — `Breadcrumb`, `admin-page__head`, `admin-card`, `EmptyState` on lists,
`Pagination` on lists, `useToast()` on every successful mutation, tokens-only CSS, `Icon` not inline
SVG.

## Known deliberate deviations — do not report these

Documented in `CLAUDE.md`:

- No loading skeletons (§7 asks for them; all state is synchronous from `localStorage`).
- No `DataTable` React component (§7 means a *Figma* component; tables are hand-rolled).
- SCR-30 supplier portal skipped — the spec marks it "(ทางเลือก)".
- Email notifications are simulated as flagged entries; nothing is sent.
- The SCR-23 budget figure is a constant; the spec never says where it comes from.
- The spec defines **no URL routes** — the route table in `CLAUDE.md` is this repo's invention.

## Output

Group findings by severity:

- **Mismatch** — wrong label, missing column, wrong status, wrong role gate. Fix these.
- **Gap** — something the spec requires that is not implemented at all.
- **Spec ambiguity** — the spec is silent or self-contradictory; state the assumption the code makes
  and whether it is recorded in `CLAUDE.md`.

Cite the spec line and the code location (`file.tsx:line`) for each finding. If everything passes,
say so plainly rather than inventing nits.
