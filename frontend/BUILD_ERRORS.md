# BUILD_ERRORS — `npm run build` ของ frontend ยังไม่ผ่าน

บันทึกรายการ error ไว้ให้ครบ เพื่อให้กลับมาแก้ได้โดยไม่ต้องรันแล้วไล่อ่านเอง
**ไม่ใช่รายการงานที่กำลังทำอยู่** — เป็นหนี้ที่รู้ตัวแล้วและยังไม่ตัดสินใจว่าจะแก้ทางไหน
(คู่กับหัวข้อ "หนี้ / ค้าง" ใน [`../backend/PROGRESS.md`](../backend/PROGRESS.md))

| | |
|---|---|
| บันทึกเมื่อ | 30 ส.ค. 2026 · commit `f93c3e2` · branch `feat/backend-46-classes` |
| `npm run build` | ❌ **46 error** ออกจาก `tsc -b` ทั้งหมด (`vite build` ไม่ได้เริ่มรันเลย) |
| `npm run lint` | ✅ **สะอาด** — พังเฉพาะ type-check ไม่ใช่ eslint |
| ไฟล์ที่พัง | 7 ไฟล์ใน `src/admin/pages/` ซึ่ง **ไม่มี route ไม่มีเมนู และไม่มีไฟล์ไหน import** |
| กระทบการใช้งานไหม | ไม่ — `npm run dev` เปิดหน้าเว็บได้ตามปกติ เพราะ Vite คอมไพล์เฉพาะไฟล์ที่ต่อจาก entry |

ตรวจซ้ำว่าตัวเลขยังเท่าเดิมไหม:

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"   # 46 ถ้ายังไม่มีใครแก้
npx eslint src                                                     # ต้องสะอาด
```

---

## ทำไมถึงพัง

โมดูล `admin/inventory` เคยมีของครบ (สร้างใน `28c4fdf` เมื่อ 7 ส.ค. 2026) แล้วถูก **ตัดออก**
ในภายหลัง แต่ **หน้าจอที่เรียกใช้ของพวกนั้นไม่ได้ถูกลบตามไปด้วย** จึงเหลือไฟล์ที่ import
ของที่ไม่มีอยู่แล้ว

| | |
|---|---|
| commit ที่ตัดออก | **`634200d`** — *"Refactor inventory & enhance review moderation UI"* (29 ส.ค. 2026) |
| ผู้เขียน | `diecoolkid <duangkamonkongphan1@gmail.com>` = **ดวงกมล กองพันธ์** (เพื่อนร่วมทีม เจ้าของระบบย่อยรีวิว) |
| ตัดอะไรไปบ้าง | `inventory.ts` −207 บรรทัด · `InventoryContext.tsx` −231 บรรทัด · `App.tsx` −23 (route หาย) · `AdminSidebar.tsx` (เมนูหาย) · `permissions.ts` −19 (`can.*` 7 ตัว — เติมกลับแล้วใน P9) · `Icon.tsx` (ไอคอนสองตัว) |
| ไม่ได้ตัด | ไฟล์หน้าจอทั้ง 7 หน้า → กลายเป็น **ไฟล์กำพร้า** |
| ทำไม `tsc` ยังจับได้ | `tsconfig.app.json` ตรวจทั้งโฟลเดอร์ `src` ไม่ได้ตรวจเฉพาะที่ต่อจาก entry ไฟล์กำพร้าจึงยังถูกคอมไพล์ |

> **หมายเหตุแก้ข้อมูลเดิม** — เอกสารรอบก่อนเขียนว่า *"`inventory.ts` ถูก revert เมื่อ 7 ส.ค."*
> ซึ่งไม่ตรงกับ git · 7 ส.ค. (`28c4fdf`) คือวันที่ **สร้าง** โมดูลชุดนี้ ไม่ใช่วันที่ลบ
> commit นั้นจึงเป็น "แหล่งกู้คืน" ที่ถูกต้อง แต่ไม่ใช่ต้นเหตุ

---

## log ดิบ (46 บรรทัด ครบทุกตัว ไม่ตัดทอน)

```text
src/admin/pages/BookDetailPage.tsx(21,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_LEVEL_LABELS'.
src/admin/pages/BookDetailPage.tsx(23,3): error TS2724: '"../inventory/inventory"' has no exported member named 'STOCK_TXN_TYPE_TONES'. Did you mean 'STOCK_TXN_TYPE_LABELS'?
src/admin/pages/BookDetailPage.tsx(24,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'stockLevel'.
src/admin/pages/BookDetailPage.tsx(41,25): error TS2339: Property 'transactionsForBook' does not exist on type 'InventoryValue'.
src/admin/pages/BookDetailPage.tsx(226,33): error TS7006: Parameter 'txn' implicitly has an 'any' type.
src/admin/pages/BookDetailPage.tsx(231,26): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<StockTxnType, string>'.
src/admin/pages/StockAdjustPage.tsx(13,29): error TS2305: Module '"../inventory/InventoryContext"' has no exported member 'AdjustLine'.
src/admin/pages/StockAdjustPage.tsx(30,25): error TS2339: Property 'adjustStock' does not exist on type 'InventoryValue'.
src/admin/pages/StockCountDetailPage.tsx(10,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'APPROVAL_STATUS_LABELS'.
src/admin/pages/StockCountDetailPage.tsx(11,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'APPROVAL_STATUS_TONES'.
src/admin/pages/StockCountDetailPage.tsx(13,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'formatCountCode'.
src/admin/pages/StockCountDetailPage.tsx(14,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'formatReportCode'.
src/admin/pages/StockCountDetailPage.tsx(15,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_COUNT_STATUS_LABELS'.
src/admin/pages/StockCountDetailPage.tsx(16,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_COUNT_STATUS_TONES'.
src/admin/pages/StockCountDetailPage.tsx(25,11): error TS2339: Property 'findCount' does not exist on type 'InventoryValue'.
src/admin/pages/StockCountDetailPage.tsx(25,22): error TS2339: Property 'reports' does not exist on type 'InventoryValue'.
src/admin/pages/StockCountDetailPage.tsx(58,13): error TS2322: Type '"clipboard"' is not assignable to type 'IconName | undefined'.
src/admin/pages/StockCountDetailPage.tsx(71,41): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/admin/pages/StockCountDetailPage.tsx(115,33): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/admin/pages/StockCountDetailPage.tsx(117,46): error TS7006: Parameter 'entry' implicitly has an 'any' type.
src/admin/pages/StockCountFormPage.tsx(14,10): error TS2305: Module '"../inventory/inventory"' has no exported member 'computeVariance'.
src/admin/pages/StockCountFormPage.tsx(29,25): error TS2339: Property 'saveStockCount' does not exist on type 'InventoryValue'.
src/admin/pages/StockCountFormPage.tsx(144,13): error TS2322: Type '"clipboard"' is not assignable to type 'IconName | undefined'.
src/admin/pages/StockCountListPage.tsx(12,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'formatCountCode'.
src/admin/pages/StockCountListPage.tsx(13,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_COUNT_STATUS_LABELS'.
src/admin/pages/StockCountListPage.tsx(14,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_COUNT_STATUS_TONES'.
src/admin/pages/StockCountListPage.tsx(22,11): error TS2339: Property 'counts' does not exist on type 'InventoryValue'.
src/admin/pages/StockCountListPage.tsx(78,13): error TS2322: Type '"clipboard"' is not assignable to type 'IconName | undefined'.
src/admin/pages/StockCountListPage.tsx(104,59): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/admin/pages/StockDiscrepancyPage.tsx(14,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'APPROVAL_STATUS_LABELS'.
src/admin/pages/StockDiscrepancyPage.tsx(15,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'APPROVAL_STATUS_TONES'.
src/admin/pages/StockDiscrepancyPage.tsx(17,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'formatCountCode'.
src/admin/pages/StockDiscrepancyPage.tsx(18,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'formatReportCode'.
src/admin/pages/StockDiscrepancyPage.tsx(30,11): error TS2339: Property 'reports' does not exist on type 'InventoryValue'.
src/admin/pages/StockDiscrepancyPage.tsx(30,34): error TS2339: Property 'findCount' does not exist on type 'InventoryValue'.
src/admin/pages/StockDiscrepancyPage.tsx(30,45): error TS2339: Property 'resolveDiscrepancy' does not exist on type 'InventoryValue'.
src/admin/pages/StockDiscrepancyPage.tsx(30,65): error TS2339: Property 'rejectDiscrepancy' does not exist on type 'InventoryValue'.
src/admin/pages/StockDiscrepancyPage.tsx(61,30): error TS7006: Parameter 'report' implicitly has an 'any' type.
src/admin/pages/StockDiscrepancyPage.tsx(63,44): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/admin/pages/StockDiscrepancyPage.tsx(111,45): error TS7006: Parameter 'r' implicitly has an 'any' type.
src/admin/pages/StockListPage.tsx(16,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'LOW_STOCK_THRESHOLD'.
src/admin/pages/StockListPage.tsx(17,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_LEVEL_LABELS'.
src/admin/pages/StockListPage.tsx(18,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'STOCK_LEVEL_TONES'.
src/admin/pages/StockListPage.tsx(19,3): error TS2305: Module '"../inventory/inventory"' has no exported member 'stockLevel'.
src/admin/pages/StockListPage.tsx(20,8): error TS2305: Module '"../inventory/inventory"' has no exported member 'StockLevel'.
src/admin/pages/StockListPage.tsx(150,11): error TS2322: Type '"trending-down"' is not assignable to type 'IconName | undefined'.
```

**แยกตามไฟล์** — `StockCountDetailPage` 12 · `StockDiscrepancyPage` 11 · `StockListPage` 6 ·
`StockCountListPage` 6 · `BookDetailPage` 6 · `StockCountFormPage` 3 · `StockAdjustPage` 2

**แยกตามรหัส** — TS2305 22 · TS2339 10 · TS7006 8 · TS2322 4 · TS7053 1 · TS2724 1

---

## 46 error มาจากราก 3 อย่าง

| # | ราก | หายอะไรไป | error ที่ตามมา |
|---|---|---|---|
| 1 | **`inventory.ts` เหลือ 8 export** (เดิม 28) | `stockLevel` · `StockLevel` · `STOCK_LEVEL_LABELS` · `STOCK_LEVEL_TONES` · `LOW_STOCK_THRESHOLD` · `STOCK_TXN_TYPE_TONES` · `APPROVAL_STATUS_LABELS` · `APPROVAL_STATUS_TONES` · `STOCK_COUNT_STATUS_LABELS` · `STOCK_COUNT_STATUS_TONES` · `formatCountCode` · `formatReportCode` · `computeVariance` · type `ApprovalStatus`/`StockCount`/`StockCountItem`/`StockDiscrepancyReport` · seed `SEED_STOCK_COUNTS`/`SEED_DISCREPANCY_REPORTS` | TS2305 · TS2724 (23) |
| 2 | **`InventoryValue` เหลือ 6 สมาชิก** | `adjustStock` · `saveStockCount` · `findCount` · `counts` · `reports` · `resolveDiscrepancy` · `rejectDiscrepancy` · `transactionsForBook` · type `AdjustLine` | TS2339 (10) |
| 3 | **`IconName` ไม่มีสองชื่อ** | `clipboard` · `trending-down` | TS2322 (4) |
| — | *ผลพลอยได้ ไม่ใช่รากของตัวเอง* | callback param อนุมานชนิดไม่ได้ เพราะ import ข้างบนพังไปแล้ว | TS7006 · TS7053 (9) — **หายเองเมื่อแก้ 1–3** |

ของที่หายทั้งหมดในข้อ 1 และ 2 **มีอยู่ครบใน `28c4fdf`** (ตรวจแล้ว) — ดูได้ด้วย

```bash
git show 28c4fdf:frontend/src/admin/inventory/inventory.ts
git show 28c4fdf:frontend/src/admin/inventory/InventoryContext.tsx
```

---

## จะแก้ทางไหนดี — สามทาง

### ทาง 1 · กู้คืนโมดูลเดิม (ได้หน้าจอกลับมา งานเยอะสุด)

เอา `inventory.ts` กับ `InventoryContext.tsx` จาก `28c4fdf` กลับมา **แล้วต้องเติมของที่
`634200d` ตัดไปด้วย ไม่งั้นได้แค่คอมไพล์ผ่านแต่เข้าหน้าจอไม่ได้**:

- `App.tsx` — route ของ `/admin/books*` และ `/admin/stock*` (11 เส้นทาง)
- `AdminSidebar.tsx` — เมนูสองกลุ่ม
- `Icon.tsx` — `clipboard` · `trending-down`
- `AdminLayout.tsx` — `634200d` จัดลำดับ provider ใหม่ · `InventoryProvider` ต้องครอบ `PurchasingProvider`
- `NotificationContext.tsx` — `634200d` ถอด `STOCK_DISCREPANCY` ออกจากชนิดการแจ้งเตือน
- `permissions.ts` — **ไม่ต้องทำ** เติมกลับไปแล้วใน P9

**ข้อดี** — ได้หน้าจอ Book/Inventory (ระบบย่อยของวุฒิภัทร) กลับมา และตรงกับ backend
ที่ทำ API ให้ครบแล้วใน P2/P3 (`/api/books` · `/api/stock-counts` · `/api/discrepancies`)
**ข้อเสีย** — เป็นการรื้อ commit ของเพื่อนร่วมทีม ต้องคุยกันก่อน

### ทาง 2 · ลบไฟล์กำพร้าทิ้ง (build เขียวทันที)

ลบหน้าจอกำพร้า **9 หน้า = 18 ไฟล์** (`.tsx` + `.css` ของแต่ละหน้า) — 7 หน้าที่พัง บวก
`BookListPage`/`BookFormPage` ที่ยังคอมไพล์ผ่านแต่ไม่มีใครเรียกเหมือนกัน · ยืนยันแล้วว่า
**ไม่มีไฟล์ไหนใน `src` import ทั้ง 9 หน้า**

ลบแล้วจะมีอีกสามอย่างกลายเป็น dead code ตามไปด้วย ต้องตัดสินใจพร้อมกัน:
`admin/components/BookPicker.tsx` (ใช้เฉพาะสองหน้าที่จะลบ) · `admin/books/BookContext.tsx` ·
`admin/books/books.ts` (เหลือแต่ `BookPicker` ที่จะตายตามกัน)

**ข้อดี** — `npm run build` ผ่านทันที ไม่ต้องแตะโค้ดของใคร
**ข้อเสีย** — ทิ้งงานหน้าจอที่ทำไว้เมื่อ 7 ส.ค. (กู้จาก git ได้ แต่ก็คือถอยกลับไปทาง 1 อยู่ดี)

### ทาง 3 · ปล่อยไว้ตามนี้ (สถานะปัจจุบัน)

`npm run dev` ใช้งานได้ · `npm run lint` สะอาด · เสียแค่ `npm run build`
เหมาะถ้ายังไม่ได้คุยกับเจ้าของ commit และไม่มีใครต้อง build เพื่อส่งงานตอนนี้

---

## ก่อนตัดสินใจ

`634200d` เป็น commit ของ **ดวงกมล** และไปแตะไฟล์ร่วมหลายไฟล์ในก้อนเดียวกับงาน
review moderation UI ของเขา — **ทาง 1 กับทาง 2 ควรคุยกับเจ้าของก่อน** ว่าตั้งใจตัดออกถาวร
หรือแค่พลาดตอนรวมงาน เพราะสองทางนั้นให้ผลตรงข้ามกัน (ทางหนึ่งเอากลับ อีกทางลบทิ้งถาวร)
