# PROGRESS — ขยาย backend ให้ครบ 46 คลาสตาม Class Diagram

ไฟล์นี้คือ **สถานะการทำงาน** ที่ commit เข้า repo เพื่อให้กลับมาทำต่อได้ถูกจุดเมื่อเซสชันขาด
(ต่างจาก `../../WORKLOG.md` ที่เป็นบันทึกตามเวลา และอยู่นอก repo)

> **แผนเต็ม:** 10 เฟส P0–P9 · 46 คลาส · 4 ชั้น (model → repository → service → handler)

---

## ⚡ กลับมาทำต่อ — ทำตามนี้ก่อนแตะอะไร

```bash
cd d:/WorkSmartBoy/SA/bookstore-t03
git status                          # มี untracked ค้างไหม → git add -A ทันที
git log --oneline -5                # commit ล่าสุดตรงกับตาราง "เฟส" ข้างล่างไหม
tail -20 ../WORKLOG.md              # อ่านของที่พัง/ค้างล่าสุด

# เปิดฐานข้อมูล (Postgres ใน Docker บน Pi 5)
ssh pxttxor@192.168.8.190 'cd ~/bookstore-t03 && docker compose up -d && docker compose ps'

cd backend
go build ./... && go vet ./... && go test ./...    # ยืนยัน baseline
```

**กฎเหล็กกันงานหาย** — เคยหายมาแล้ว 3 รอบจาก "Discard all changes" (`git checkout . && git clean -fd`)
1. **สร้างไฟล์ใหม่เสร็จ → `git add -A` ทันที** (ไม่ต้อง commit) — ไฟล์ที่ add แล้วรอดทั้ง `checkout` และ `clean`
2. **จบเฟส → commit** · ทำงานบน branch `feat/backend-46-classes` ไม่ใช่ `main`

---

## สถานะล่าสุด

| | |
|---|---|
| **เฟส** | **P0–P7 เสร็จแล้ว** |
| **ทำต่อที่** | **P8** — Review · ReviewReply · ReviewReport · ProfanityFilter |
| **branch** | `feat/backend-46-classes` |
| **verify ล่าสุด** | build ✅ · vet ✅ · gofmt ✅ · **test 84/84 ✅** · migrate+seed **บนฐานใหม่** ✅ · **smoke 261/261 ✅ (รันซ้ำได้)** |
| **ฐานข้อมูล** | Postgres 17 (Docker) บน Pi 5 `192.168.8.190:5433` · db `bookstore_t03` · user `bookstore` |

---

## เกณฑ์จบของทุกเฟส (ห้ามข้าม)

```bash
cd backend
go build ./... && go vet ./...
test -z "$(gofmt -l .)"                      # หมายเหตุ: gofmt -l คืน exit 0 เสมอ ต้องเช็คด้วย test -z
go test ./...
go run ./cmd/api -migrate -seed -setup-only  # ต้องไม่ error
go run ./cmd/api        # หน้าต่าง 1
go run ./cmd/smoke      # หน้าต่าง 2 — ต้อง PASS ทุกเคส
git add -A && git commit
```

---

## เฟส

| # | เฟส | สถานะ | commit | test | migrate+seed | smoke |
|---|---|---|---|---|---|---|
| P0 | สะสาง + วางโครง | ✅ | (ดู git log) | 24/24 | ✅ | 51/51 |
| P1 | Person · Customer · UserAccount | ✅ | (ดู git log) | 32/32 | ✅ | 79/79 |
| P2 | Category · Book CRUD · BookChangeLog | ✅ | (ดู git log) | 41/41 | ✅ | 103/103 |
| P3 | Inventory เต็ม (StockCount · Discrepancy) | ✅ | (ดู git log) | 47/47 | ✅ | 129/129 |
| P4 | Order · OrderItem · History · Promotion | ✅ | (ดู git log) | 59/59 | ✅ | 171/171 |
| P5 | Payment · Bank · PaymentReport | ✅ | (ดู git log) | 66/66 | ✅ | 191/191 |
| P6 | Shipment · Tracking · Carrier · Summary | ✅ | (ดู git log) | 74/74 | ✅ | 217/217 |
| P7 | MembershipTier · Member · Point · Reward | ✅ | (ดู git log) | 84/84 | ✅ | 261/261 |
| P8 | Review · Reply · Report · ProfanityFilter | ⬜ | | | | |
| P9 | เก็บงาน (เอกสาร · permissions.ts · verify รวม) | ⬜ | | | | |

### P0 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | ลบ dead code `main.go` + `model/` (578 บรรทัด) | ✅ |
| 2 | `docker-compose.yml` + เปิด DB บน Pi 5 + `.env`/`.env.example` | ✅ |
| 3 | แก้ line ending (`*.go text eol=lf`) — `gofmt -l` เคยขึ้นทุกไฟล์เพราะ CRLF | ✅ |
| 4 | แก้ FK กลับทางที่ `SupplierBook.Book` (`-:migration`) | ✅ |
| 5 | เปลี่ยนชื่อ `/api/orders` → `/api/purchase-orders` | ✅ |
| 6 | แตก `Routes()` → `routes.go` + `handler.New(Deps)` | ✅ |
| 7 | แตก `service/purchasing.go` (855 บรรทัด) → 4 ไฟล์ | ✅ |
| 8 | แตก `cmd/smoke/main.go` (696 บรรทัด) → `main`/`client`/`env`/`flow_*` | ✅ |
| 9 | `Seed()` guard ต่อตาราง (`seedIfEmpty[T]`) | ✅ |
| 10 | `gen_seed.py` — ตัด `seedStockTransactions` ออก (ย้ายไป `seed_inventory.go` เขียนมือ) | ✅ |
| 10b | `gen_seed.py` — เพิ่ม `seedCategories` | เลื่อนไป P2 (ยังไม่มี `model.Category`) |
| 11 | `applyForeignKeys()` ใน `migrate.go` (FK ที่ GORM ไม่สร้างให้) | ✅ |

### P1 — รายการย่อย (หยุดกลางทาง)

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/person.go` — Person · Employee(ย้ายมา) · Customer · UserAccount + เมธอด | ✅ |
| 2 | แตก `model/shared.go` → `book.go` / `inventory.go` / `notification.go` (ลบ shared.go แล้ว) | ✅ |
| 3 | `model/enums_team.go` + `labels_team.go` — `AccountStatus` · `RoleCustomer` · `EmployeeRoles()` · `Role.IsEmployee()` | ✅ |
| 4 | `model/errors.go` — error ของบัญชี/ลูกค้า 11 ตัว | ✅ |
| 5 | `migrate.go` — entity ใหม่ 3 ตัว · `backfillPersons()` · CHECK `user_account.status` · unique index อีเมล/ชื่อผู้ใช้ · FK 3 เส้น · view ครบ 4 ตัว | ✅ |
| 6 | `repository/person.go` — ลูกค้า/บุคคล/บัญชี (join ครบ ไม่ N+1) | ✅ |
| 7 | `service/auth.go` — ล็อกอินลูกค้า · claim `pid`/`cid` · `Me(Identity)` · `Identity.IsCustomer()` | ✅ |
| 8 | `service/person.go` — สมัคร · ยืนยัน OTP · โปรไฟล์ · ระงับ/ปลดระงับบัญชี | ✅ |
| 9 | `handler/person.go` + `dto_person.go` + เส้นทาง 8 เส้น + ต่อสายใน `cmd/api` | ✅ |
| 10 | `model/person_test.go` — 7 เคส (test รวม 24 → 32) | ✅ |
| 11 | `handler_test.go` — เพิ่ม 7 path ใหม่เข้า `TestProtectedRoutesRequireToken` | ✅ |
| 12 | `internal/database/seed_person.go` — ลูกค้าตั้งต้น 3 ราย ครบทั้งสามสถานะบัญชี | ✅ |
| 13 | `cmd/smoke/flow_person.go` — 28 เคส (สมัคร · OTP · ล็อกอิน · โปรไฟล์ · ระงับบัญชี · สิทธิ์) | ✅ |
| 14 | รัน smoke ทั้งชุด — **79/79 ผ่าน รันซ้ำได้** | ✅ |

**ลูกค้าตั้งต้นที่ seed ไว้** — ชื่อและที่อยู่คัดจาก `SEED_ORDERS` ของ frontend ตรงตัว
(`frontend/src/admin/orders/orders.ts`) เพื่อให้ **P4 ผูกคำสั่งซื้อเข้ากับ `customer_id` ได้เลย
ไม่ต้องแก้ข้อมูลย้อนหลัง** · รหัสผ่านทุกบัญชี `customer1234` (คนละตัวกับพนักงาน)

| อีเมล | ชื่อ | สถานะบัญชี |
|---|---|---|
| `napat@example.com` | ณภัทร วงศ์สว่าง | `ACTIVE` |
| `kanya@example.com` | กัญญา ศรีสาย | `UNVERIFIED` |
| `somsak@example.com` | สมศักดิ์ ใจดี | `SUSPENDED` |

`sequences` ใน `seed.go` เพิ่ม `person` · `customer` · `user_account` แล้ว (ทั้งสามมี id อัตโนมัติ)

### P2 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/book.go` — `Category` · `BookChangeLog` · `Book.CategoryID` · `BookDraft` · `Book.Update()` ที่คืน log ทีละฟิลด์ · `Book.SetStatus()` | ✅ |
| 2 | `model/labels_team.go` — `BookFieldLabels` ตรงกับ `BOOK_FIELD_LABELS` ของ TS · `BookStatus.Label()` | ✅ |
| 3 | `model/errors.go` — `IsbnTaken()` · `ErrCategoryNotFound` · `ErrInvalidBookStatus` · `ErrInvalidBookPrice` | ✅ |
| 4 | `tools/gen_seed.py` — อ่าน categoryId (เดิมจับไว้แต่ทิ้ง) · อ่าน status · `seedCategories` (ข้อ 10b ของ P0) · `seedBookChangeLogs` | ✅ |
| 5 | `database/seed.go` — หมวดหมู่ก่อนหนังสือ · ประวัติหลังหนังสือ · sequence 2 ตัว · สรุปท้ายวนตามลิสต์ | ✅ |
| 6 | `database/migrate.go` — 2 entity ใหม่ · `backfillBookCategories()` · FK 2 เส้น · unique index ชื่อหมวดหมู่ | ✅ |
| 7 | `repository/book.go` — ย้ายคำสั่งของ `book` ออกจาก `InventoryRepository` + CRUD + ประวัติ + หมวดหมู่ | ✅ |
| 8 | `service/book.go` — ตรวจ ISBN ซ้ำ · หมวดหมู่ต้องมีจริง · เพิ่มหนังสือแล้วเปิดแถวสินค้าคงคลัง | ✅ |
| 9 | `handler/book.go` + `dto_book.go` + 7 เส้นทาง + `Deps.Books` + ต่อสายใน `cmd/api` | ✅ |
| 10 | `model/book_test.go` (5 เคส) + `database/seed_data_test.go` (4 เคส) — test 32 → 41 | ✅ |
| 11 | `handler_test.go` — เพิ่ม 8 path เข้า `TestProtectedRoutesRequireToken` | ✅ |
| 12 | `cmd/smoke/flow_book.go` — 24 เคส (smoke 79 → 103) | ✅ |

### P2 — สิ่งที่เจอเพิ่มระหว่างทำ

| # | เจออะไร | แก้ยังไง |
|---|---|---|
| A | `gen_seed.py` **ไม่เคยอ่าน argument `status`** ของ `book(...)` เลย หนังสือทุกเล่มจึงถูกเขียนเป็น `ACTIVE` ทั้งที่เล่ม 118 (`ดาวเคราะห์สีคราม`) ปิดการขายอยู่ฝั่งหน้าจอ · regex เดียวจับ argument ท้าย ๆ ที่เป็นค่าไม่บังคับไม่ไหว | เพิ่มตัวตัด `book(...)` แบบนับวงเล็บ แล้ว `assert` ว่าต้องมีเล่มที่ปิดการขาย = `[118]` เท่านั้น · เพิ่ม `seed_data_test.go` ให้ `go test` จับได้ตั้งแต่ไม่มีฐานข้อมูล |
| B | `applyForeignKeys()` สร้าง `book.category_id → category` ไม่ได้ ถ้า `category` ยังว่าง (Migrate รันก่อน Seed เสมอ) | `backfillBookCategories()` ใส่หมวดหมู่ตั้งต้นให้ก่อนถ้าตารางยังว่าง — เหตุผลเดียวกับที่ `backfillPersons()` สร้างแถว `person` ให้พนักงาน |
| C | คำสั่งของตาราง `book` อยู่ใน `InventoryRepository` (ยืมใช้ตั้งแต่ตอนทำ U5) พอทำ CRUD เต็มจะกลายเป็นสองที่ | ย้ายไป `repository/book.go` ทั้งหมด · `SupplierService`/`PurchasingService` รับ `*BookRepository` แทน |

**ปิดแล้วตอน P5** — ล้าง volume แล้ว seed ใหม่ เล่ม 118 เป็น `INACTIVE` ถูกต้องในฐานข้อมูลจริงแล้ว
(`seed_data_test.go` ยังเฝ้าฝั่งข้อมูลตั้งต้นไว้เหมือนเดิม และ smoke ไม่ผูกกับเล่ม 118)

### P3 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/enums_team.go` — `StockCountStatus` · `ApprovalStatus` · `StockLevel` · `LowStockThreshold` | ✅ |
| 2 | `model/labels_team.go` — ป้ายไทยสามชุด (กู้ข้อความจาก `git show` ของ `inventory.ts` ที่ถูก revert ไปแล้ว) | ✅ |
| 3 | `model/inventory.go` — `StockCount` · `StockCountItem` (PK ผสม) · `StockDiscrepancyReport` · `ComputeVariance()` · `Decide()` · `StockLevelOf()` · `FormatCountCode/ReportCode` | ✅ |
| 4 | `model/errors.go` — 6 ตัว (`NEGATIVE_STOCK` ข้อความตรงกับ abnormal flow ของหน้าจอ) | ✅ |
| 5 | `migrate.go` — 3 entity ใหม่ · CHECK 2 ตัว · FK 4 เส้น · `seed.go` เพิ่ม sequence 2 ตัว | ✅ |
| 6 | `repository/inventory.go` — `ApplyStrictStockChanges` (ไม่ปัดยอดขึ้นศูนย์) · `LockItemsByBook` · CRUD ของรอบตรวจนับและรายงาน | ✅ |
| 7 | `service/inventory.go` — ปรับยอดด้วยมือ · บันทึกรอบตรวจนับ + เปิดรายงาน + แจ้งผู้จัดการ · ตัดสินผลต่าง · รายงานใกล้หมด | ✅ |
| 8 | `service/notify.go` — แยก `pushBothChannels` ให้ระบบย่อยอื่นใช้ร่วมได้ | ✅ |
| 9 | `handler/stock.go` + `dto_stock.go` + 8 เส้นทาง + `roleStock` + `Deps.Stock` | ✅ |
| 10 | `model/inventory_test.go` 6 เคส (test 41 → 47) + `handler_test.go` เพิ่ม 8 path | ✅ |
| 11 | `cmd/smoke/flow_inventory.go` — 26 เคส (smoke 103 → 129) | ✅ |

### P3 — บันทึกระหว่างทำ

| # | เรื่อง | รายละเอียด |
|---|---|---|
| A | ป้ายไทยของ `StockCountStatus`/`ApprovalStatus`/`StockLevel` หายไปจาก frontend | `inventory.ts` ถูก revert เมื่อ 7 ส.ค. เหลือแค่ `InventoryItem`/`StockTransaction` · กู้ข้อความเดิมด้วย `git show 28c4fdf:frontend/src/admin/inventory/inventory.ts` แล้วคัดมาตรงตัว |
| B | `ApplyStockChanges` เดิมปัดยอดติดลบขึ้นเป็นศูนย์ | ถูกสำหรับ U9/U10 แต่จะกลืน abnormal flow ของการปรับยอดด้วยมือ → แยกเป็น `ApplyStrictStockChanges` และให้ service ตรวจยอดรวมทุกเล่มก่อนเขียน |
| C | อนุมัติผลต่าง = **ตั้งยอดเท่าที่นับได้** ไม่ใช่บวก `variance` | ระหว่างรอผู้จัดการตัดสิน หนังสืออาจเคลื่อนไหวไปแล้ว `variance` ที่เก็บไว้จึงล้าสมัย (พฤติกรรมเดียวกับ `decide()` ฝั่งหน้าจอ) |
| D | `stock_count_item` ต้องเขียนหลัง `stock_discrepancy_report` | เพราะถือ `report_id` เป็น FK · ลำดับในทรานแซกชันคือ หัวเอกสาร → รายงาน → รายการที่นับ |

### P4 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/enums_team.go` + `labels_team.go` — `OrderChannel` · `OrderStatus` (11 ค่า) · `PromotionType` · `PromotionStatus` + ป้ายไทยตรงกับ TS | ✅ |
| 2 | `model/order.go` — `Order` · `OrderItem` (PK ผสม) · `OrderStatusHistory` · ตารางการเปลี่ยนสถานะ + `UpdateStatus()`/`AddItem()`/`CalcTotal()` | ✅ |
| 3 | `model/promotion.go` — `IsApplicable()` · `CalcDiscount()` · `Overlaps()` · `DisplayStatus()` | ✅ |
| 4 | `model/errors.go` — 12 ตัว + `OrderTransitionRejected()` ที่บอกสถานะต้นทาง/ปลายทางเป็นไทย | ✅ |
| 5 | `migrate.go` — 4 entity ใหม่ · CHECK 5 ตัว · FK 3 เส้น · `seed.go` เพิ่ม sequence 3 ตัว | ✅ |
| 6 | `tools/gen_seed.py` — อ่าน `SEED_PROMOTIONS` เพิ่ม (โปรโมชั่น 6 ใบ) | ✅ |
| 7 | `database/seed_order.go` (เขียนมือ) — คำสั่งซื้อตั้งต้น 3 ใบ แปลง slug/ดอลลาร์ของหน้าร้านเป็น `book_id`/บาท · ผูกลูกค้าด้วยอีเมล | ✅ |
| 8 | `repository/order.go` — `OrderRepository` + `PromotionRepository` (ล็อกหัวเอกสารแยกจาก Preload) | ✅ |
| 9 | `service/order.go` — สั่งซื้อ · 10 การเปลี่ยนสถานะผ่าน `advance()` · ตรวจสต็อก · ตัด `SALE_OUT` ตอนแพ็ก · แจ้งเตือน 3 จุด | ✅ |
| 10 | `service/promotion.go` — CRUD + guard EXPIRED + ห้ามลบใบที่ถูกใช้แล้ว | ✅ |
| 11 | `handler/order.go` + `dto_order.go` + 19 เส้นทาง + 4 ชุดบทบาทใหม่ | ✅ |
| 12 | `model/order_test.go` (7) + `promotion_test.go` (5) — test 47 → 59 | ✅ |
| 13 | `cmd/smoke/flow_order.go` — 42 เคส (smoke 129 → 171) | ✅ |

### P4 — บันทึกระหว่างทำ

| # | เรื่อง | รายละเอียด |
|---|---|---|
| A | ตารางคำสั่งซื้อชื่อ `customer_order` ไม่ใช่ `order` | `ORDER` เป็นคำสงวนของ SQL · ตารางลูกใช้คำนำหน้าเดียวกัน ส่วนชื่อคลาสใน Go ยังเป็น `Order` ตาม diagram |
| B | ชื่อชนกับระบบจัดซื้อ 5 จุด | `OrderFilter`/`orderDTO`/`toOrderDTO(s)`/`listOrders`/`getOrder` เป็นของใบสั่งซื้อผู้จัดจำหน่ายอยู่ก่อน → เปลี่ยนเป็น `PurchaseOrderFilter`/`purchaseOrderDTO`/`toPurchaseOrderDTO(s)`/`listPurchaseOrders`/`getPurchaseOrder` ต่อเนื่องจากการ rename `/api/orders`→`/api/purchase-orders` ใน P0 |
| C | `OrderItem.bookId` เป็นตัวเลข ไม่ใช่ slug | ฝั่งหน้าจอเก็บ slug เพราะ storefront ไม่มีตารางหนังสือจริง · ฝั่งนี้ยึด class diagram · `seed_order.go` แปลงข้อมูลให้ |
| D | สต็อกถูกตัดตอน "แพ็ก" ไม่ใช่ "ยืนยันสต็อก" | ขั้นยืนยันสต็อกเป็นการตรวจว่ามีของพอ · ของออกจากคลังจริงตอนแพ็ก · ยกเลิกใบที่แพ็กแล้วไม่ได้ จึงไม่ต้องมีเส้นทางคืนสต็อก |
| E | smoke ตัดสต็อกจริงทุกรอบ | รอบแรกคืนยอดแค่เล่มเดียวทั้งที่ใบมีสองเล่ม อีกเล่มจึงลดลงทีละหนึ่งจนหมดและ smoke ล้ม → เปลี่ยนไปใช้เล่มที่มีของเยอะ (113/116) และคืนยอด **ทุกเล่มในใบ** |

### P5 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/payment.go` — `Bank` · `Payment` (+`UploadSlip`/`Verify`/`Reject`) · `PaymentReport` · `FormatPaymentCode`/`FormatPaymentReportCode` | ✅ |
| 2 | `model/enums_team.go` + `labels_team.go` — `PaymentStatus` (WAITING/VERIFYING/SUCCESS/REJECTED) + ป้ายไทย | ✅ |
| 3 | `model/errors.go` — 6 ตัว (`PAYMENT_ALREADY_VERIFIED` · `PAYMENT_NOT_VERIFIABLE` · `REPORT_PERIOD_RANGE` ฯลฯ) | ✅ |
| 4 | `migrate.go` — 3 entity ใหม่ · CHECK `payment.status` · FK 2 เส้น · `seed.go` เพิ่ม sequence 3 ตัว | ✅ |
| 5 | `repository/payment.go` — CRUD + `SummarizeSuccess()` สำหรับรายงาน + `PaymentsByOrder()` | ✅ |
| 6 | `service/payment.go` + ต่อเข้า `service/order.go` (เปิดแถว payment ตอนสั่งซื้อ · `UploadSlip` ตอนแนบสลิป · `Verify`/`Reject` ตอนฝ่ายขายตัดสิน) | ✅ |
| 6b | `database/seed_payment.go` (ธนาคาร 3 แห่ง) + `seed_order.go` สร้างแถว payment ให้คำสั่งซื้อตั้งต้น | ✅ |
| 7 | `handler/payment.go` + `dto_payment.go` + 6 เส้นทาง + `Deps.Payments` | ✅ |
| 8 | `model/payment_test.go` — 7 เคส (test 59 → 66) + เพิ่ม 6 path เข้า `handler_test.go` | ✅ |
| 9 | `cmd/smoke/flow_payment.go` — 20 เคส (smoke 171 → 191) | ✅ |
| 10 | ล้าง volume + `-migrate -seed` บนฐานใหม่ + smoke ทั้งชุดผ่าน 191/191 รันซ้ำได้ | ✅ |

**สิ่งที่ตัดสินใจไว้และทำตามนั้น:**

- เส้นทางที่เปิด — `GET /api/banks` (ทุกคนที่ล็อกอิน รวมลูกค้า เพราะต้องรู้ว่าจะโอนเข้าบัญชีไหน) ·
  `GET /api/payments` + `/payments/{id}` (ฝ่ายขาย, ผจก.) · `GET /api/orders/{id}/payment`
  (ลูกค้าเห็นเฉพาะใบตัวเอง) · `GET`/`POST /api/payment-reports` (ผจก.)
- **การตรวจผ่าน/ปฏิเสธไม่มีเส้นทางของตัวเอง** — ใช้ `/api/orders/{id}/verify-payment`
  กับ `/reject-payment` ที่มีอยู่แล้ว เพราะเป็นเหตุการณ์เดียวกับการเปลี่ยนสถานะคำสั่งซื้อ
  แยกเป็นสองปุ่มเมื่อไรก็มีโอกาสที่ `payment` กับ `customer_order` ไม่ตรงกัน
- `Order.slip_file_name` กับ `Payment.slip_image_url` เก็บค่าเดียวกันโดยตั้งใจ —
  ตัวแรกเป็นสำเนาสำหรับหน้าจอ (สัญญาเดิมกับ frontend) ตัวหลังเป็นค่าจริงของระบบย่อยนี้
  เขียนพร้อมกันในทรานแซกชันเดียว
- รายงานเก็บ **ผลลัพธ์** ลงเป็นแถว ไม่ได้คำนวณสดตอนเปิดดู (`generatedDate` ใน diagram)
  และนับจาก `verified_date` เพราะตอบคำถามว่า "รอบนี้ร้านรับเงินเข้ามาเท่าไร"
- `PaymentService` รับ `*repository.OrderRepository` เข้ามาด้วย เพื่อเช็คเจ้าของใบเองใน `ForOrder`
  (เดิมรับ `ownerID` เป็นพารามิเตอร์ ซึ่งบังคับให้ handler ไปอ่านคำสั่งซื้อมาก่อนโดยไม่จำเป็น)

### P5 — สิ่งที่เจอเพิ่มระหว่างทำ

| # | เจออะไร | แก้ยังไง |
|---|---|---|
| A | **`Seed()` ล้มบนฐานข้อมูลเปล่า** — `seedIfEmpty` ใส่พนักงานทั้งสี่คนด้วย `person_id = 0` แล้วชน unique index `uq_employee_person` ที่ P1 สร้างไว้ · ไม่เคยเจอมาก่อนเพราะฐานเดิมมีพนักงานอยู่ตั้งแต่ก่อน P1 แล้ว `backfillPersons()` จึงเติมให้ทัน (เท่ากับเส้นทาง "ฐานใหม่ทั้งหมด" ไม่เคยถูกทดสอบเลยตั้งแต่ P1) | เขียน `seedEmployeeRows()` ใน `seed_person.go` ให้สร้างแถว `person` ก่อนแล้วผูก `person_id` — รูปแบบเดียวกับ `seedCustomerRows()` |
| B | คำสั่งซื้อตั้งต้น 3 ใบไม่มีแถว `payment` บนฐานเดิม | `Seed()` ข้ามตารางที่มีข้อมูลแล้ว จึงต้องล้าง volume ถึงจะได้ข้อมูลชุดใหม่ · ผู้ใช้อนุมัติให้ล้าง — ปิดหนี้เล่ม 118 ที่เป็น `ACTIVE` ผิดไปพร้อมกัน (ตรวจแล้วทั้งสองข้อ) |

### P6 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/enums_team.go` + `labels_team.go` — `ShipmentStatus` 5 ค่า + `ShipmentStatuses()` + ป้ายไทยตรง `SHIPMENT_STATUS_LABELS` ของ TS | ✅ |
| 2 | `model/delivery.go` — `ShippingCompany` · `Shipment` (+ตารางการเปลี่ยนสถานะ · `Record()` · `UpdateStatus()` · `Track()` · `IsClosed()`) · `ShipmentTracking` · `DeliverySummary.Generate()` · `FormatShipmentCode`/`FormatSummaryCode` | ✅ |
| 3 | `model/errors.go` — 6 ตัว + `ShipmentTransitionRejected()` + `ErrDeliverViaOrder` · `enums.go` เพิ่ม `NotifyShipmentFailed` | ✅ |
| 4 | `migrate.go` — 4 entity ใหม่ · CHECK 2 · FK 3 เส้น · `backfillCarriers()` · `seed.go` เพิ่ม sequence 4 ตัว | ✅ |
| 5 | `database/seed_delivery.go` — บริษัทขนส่ง 5 แห่ง (จาก `CARRIERS` ของ frontend) + `seedShipmentFor()` · `seed_order.go` เพิ่มพัสดุของ SO-1003 พร้อมประวัติ 4 แถว | ✅ |
| 6 | `repository/delivery.go` — CRUD พัสดุ · `FindForUpdate`/`FindByOrderForUpdate` · `AddTracking` · `ShippedOn` · สรุปพัสดุ | ✅ |
| 7 | `service/delivery.go` — อ่านพัสดุ (กรองตามเจ้าของ) · `UpdateTracking` · `GenerateSummary` | ✅ |
| 8 | `service/order.go` — `Ship(orderID, ShipmentInput, by)` เปิดพัสดุในทรานแซกชันเดียวกัน · `Deliver` ปิดพัสดุด้วย | ✅ |
| 9 | `handler/delivery.go` + `dto_delivery.go` + 7 เส้นทาง + `roleDeliveryAdmin` + `Deps.Deliveries` | ✅ |
| 10 | `model/delivery_test.go` 8 เคส (test 66 → 74) + `handler_test.go` เพิ่ม 7 path | ✅ |
| 11 | `cmd/smoke/flow_delivery.go` 26 เคส (smoke 191 → 217) + แก้ `flow_order.go` ให้ส่ง body ตอน ship | ✅ |

### P6 — บันทึกระหว่างทำ

| # | เรื่อง | รายละเอียด |
|---|---|---|
| A | **`POST /api/orders/{id}/ship` เปลี่ยนสัญญา** — เดิมไม่มี body ตอนนี้ต้องส่ง `{carrierId, trackingNumber, recipientName?}` | พัสดุกับใบต้องเกิดพร้อมกัน ไม่งั้นมีใบ SHIPPED ที่ไม่มีเลขติดตามพัสดุ · `recipientName` เว้นได้ ระบบเติมชื่อลูกค้าให้ (ตรงกับ `OrderContext.tsx` ฝั่งหน้าจอ) |
| B | พัสดุเดินสองก้าวตอนบันทึก PREPARING → SHIPPED | `record()` ใน diagram กำหนดให้เริ่มที่ PREPARING · เดินสองก้าวจึงได้ทั้งความจริงตาม diagram และประวัติที่เล่าเรื่องครบ |
| C | **`DELIVERED` อัปเดตผ่านเส้นทาง tracking ไม่ได้** (422 `DELIVER_VIA_ORDER`) | ต้องเขียนคู่กับ `customer_order` เสมอ · เส้นทาง tracking รับเฉพาะ `IN_TRANSIT`/`FAILED` ซึ่งคำสั่งซื้อไม่มีสถานะคู่ให้ตรงกัน (ใบที่พัสดุ FAILED ยังเป็น SHIPPED เพราะ OrderStatus ตาม diagram ไม่มีค่าสำหรับกรณีนี้) |
| D | ป้ายไทยของ `ShipmentStatus` ในไฟล์ของเพื่อน (`SourceCode/`) ไม่ตรงกับ frontend | ยึดฝั่ง frontend ตามกติกาโปรเจกต์ (`PREPARING` = "กำลังเตรียม" ไม่ใช่ "กำลังเตรียมพัสดุ") · มีเทสต์คุมไว้ |
| E | `Seed()` ข้ามตารางที่มีข้อมูลแล้ว พัสดุของ SO-1003 จึงไม่ถูกสร้างบนฐานที่มีคำสั่งซื้ออยู่ก่อน | ล้าง volume แล้ว seed ใหม่ (รอบที่สองของเซสชันนี้) · เป็นข้อจำกัดเดิมของ `seedIfEmpty` ที่ต้องระวังทุกครั้งที่เพิ่มข้อมูลตั้งต้นให้ตารางที่ seed ไปแล้ว |

### P7 — รายการย่อย

| # | งาน | สถานะ |
|---|---|---|
| 1 | `model/enums_team.go` + `labels_team.go` — `PointTxnType` 4 ค่า + `RewardType` 2 ค่า + `PointTxnTypes()`/`RewardTypes()` + ป้ายไทย (ยึด `SourceCode/` ของเพื่อน เพราะไม่มีหน้าจอฝั่ง frontend) | ✅ |
| 2 | `model/membership.go` — `MembershipTier` · `Member` · `PointTransaction` · `Reward` · `Redemption` + `EarnPoints()`/`RedeemPoints()`/`CheckPoints()`/`Adjust()` + `PickTier()`/`PointsFor()` + `FormatMemberCode`/`FormatCouponCode` | ✅ |
| 3 | `model/errors.go` — 13 ตัว (`INSUFFICIENT_POINTS` · `TIER_IN_USE` · `REWARD_REDEEMED` ฯลฯ) | ✅ |
| 4 | `migrate.go` — 5 entity ใหม่ · CHECK 2 · FK 6 เส้น · index 2 · `backfillTiers()` + `backfillMembers()` · `seed.go` เพิ่ม sequence 5 ตัว | ✅ |
| 5 | `database/seed_membership.go` — ระดับ 3 · ของรางวัล 5 · สมาชิกของลูกค้าตั้งต้น 3 ราย (ระดับเลือกด้วย `PickTier` จากยอดสะสม ไม่ได้ระบุตรง ๆ) | ✅ |
| 6 | `repository/membership.go` — ระดับ/สมาชิก/แต้ม/ของรางวัล/การแลก · `MemberRow` join ครบไม่ N+1 · `FindMemberForUpdate` | ✅ |
| 7 | `service/membership.go` — CRUD ระดับ + ของรางวัล · อ่านสมาชิก/ประวัติแต้ม (กรองตามเจ้าของ) · `Redeem` · `AdjustPoints` | ✅ |
| 8 | `service/person.go` — `enroll()` เปิดแถวสมาชิกเป็นแถวที่ 4 ของการสมัคร | ✅ |
| 9 | `service/order.go` — `earnPoints()` ใน `Deliver()` ทรานแซกชันเดียวกับการปิดพัสดุ | ✅ |
| 10 | `handler/membership.go` + `dto_membership.go` + **15 เส้นทาง** + `Deps.Members` + ต่อสายใน `cmd/api` | ✅ |
| 11 | `model/membership_test.go` 10 เคส (test 74 → 84) + `handler_test.go` เพิ่ม 15 path | ✅ |
| 12 | `cmd/smoke/flow_membership.go` — 44 เคส (smoke 217 → 261) | ✅ |

### P7 — บันทึกระหว่างทำ

| # | เรื่อง | รายละเอียด |
|---|---|---|
| A | **ลูกค้าทุกคนเป็นสมาชิกตั้งแต่สมัคร** (ผู้ใช้เลือก) | ระบบนี้สร้างลูกค้าได้ทางเดียวคือการสมัคร และหน้าสมัครเรียกตัวเองว่า "สมัครสมาชิก" อยู่แล้ว · `/api/members/me` จึงใช้ได้เสมอ ไม่ต้องมีเคส "ยังไม่เป็นสมาชิก" · ฐานเดิมตามเก็บด้วย `backfillMembers()` |
| B | **แต้มเกิดตอน `DELIVERED` เท่านั้น** (ผู้ใช้เลือก) | เป็นสถานะปลายทาง ยกเลิกต่อไม่ได้ จึงไม่ต้องมีเส้นทางคืนแต้ม · ถ้าเปิดให้ยกเลิกใบที่ส่งถึงแล้วเมื่อไร ต้องเขียนการคืนแต้มด้วย (กติกาเดียวกับการคืนสต็อกของ P4) |
| C | คิดแต้มด้วยอัตราของระดับ **ก่อน** เลื่อนระดับ | ลูกค้าได้แต้มตามสิทธิ์ที่มีตอนซื้อ ระดับใหม่มีผลกับใบถัดไป · ถ้าเลื่อนก่อนคิด ใบที่ทำให้เลื่อนระดับจะได้อัตราใหม่ย้อนหลัง ซึ่งอธิบายให้ลูกค้าฟังยาก |
| D | `service` ไม่เรียก `service` | `OrderService` รับ `*repository.MembershipRepository` เข้ามาตรง ๆ แล้วเขียนเอง — รูปแบบเดียวกับ `decidePayment` (P5) และ `closeShipment` (P6) |
| E | `point_transaction.note` เป็น deviation | การหักแต้มด้วยมือไม่มีเอกสารต้นทาง ต้องเก็บเหตุผลไว้ · บันทึกไว้ใน README ข้อ 24 แล้ว |
| F | `membership_tier.point_rate` ต้องเป็น `numeric(12,4)` | `(12,2)` ปัด 0.015 เป็น 0.02 ทำให้ระดับ Gold ให้แต้มเท่า Platinum |
| G | `seedMemberRows()` ไม่ทำงานบนฐานเดิม | `backfillMembers()` ใน migrate เปิดแถวสมาชิกให้ลูกค้าเดิมไปก่อนแล้ว ตาราง `member` จึงไม่ว่างตอน `Seed()` · ข้อจำกัดเดิมของ `seedIfEmpty` ที่เจอมาแล้วทั้ง P5 และ P6 · **ปิดแล้ว** — ผู้ใช้อนุมัติให้ล้าง volume แล้ว seed ใหม่ ตรวจแล้วว่าเส้นทาง "ฐานเปล่าทั้งหมด" ใช้ได้จริง (สมาชิก 3 · ณภัทร Gold 68 แต้ม · กัญญา Silver 0 · สมศักดิ์ Platinum 145) และ smoke 261/261 ผ่านสองรอบติดบนฐานใหม่ |

### P0 — สิ่งที่เจอเพิ่มระหว่างทำ (ไม่ได้อยู่ในแผนเดิม)

| # | เจออะไร | แก้ยังไง |
|---|---|---|
| A | `gofmt -l .` ขึ้นชื่อ **ทุกไฟล์** — `core.autocrlf=true` เช็คเอาต์ `.go` เป็น CRLF · verify gate ใช้ไม่ได้จริงมาตลอด | ปัก `*.go text eol=lf` ใน `.gitattributes` + แปลงไฟล์ในเครื่อง |
| B | `gofmt -l` คืน exit code 0 เสมอ → `gofmt -l . && echo OK` ผ่านหลอกทุกครั้ง | เปลี่ยนเป็น `test -z "$(gofmt -l .)"` ทุกที่ |
| C | GORM สร้าง FK **กลับทาง** `book.book_id → supplier_book.book_id` ทำให้ AutoMigrate ล้มตั้งแต่ตารางแรก | `-:migration` บน `SupplierBook.Book` + ประกาศ FK จริงใน `foreignKeys` |
| D | ฐานข้อมูลถูก init เป็น `SQL_ASCII` (จาก `LANG: C` ที่ใส่เองใน compose) → driver ปฏิเสธคำสั่ง | `POSTGRES_INITDB_ARGS: --encoding=UTF8 --locale=C.UTF-8` + สร้าง volume ใหม่ |
| E | `cmd/smoke` ไม่ idempotent — เคส U5 ผ่านเฉพาะรอบแรก เพราะรอบก่อนตั้งจุดสั่งซื้อเล่ม 115 ไปแล้ว | เพิ่มขั้นเตรียมข้อมูล ล้างจุดสั่งซื้อก่อนตรวจ |

---

## คลาสตาม Class Diagram (46)

`✅` เสร็จ · `🔄` กำลังทำ · `⬜` ยังไม่เริ่ม · `—` ไม่มีชั้นนี้

| ระบบย่อย | คลาส | model | repo | service | handler | migrate | seed | smoke |
|---|---|---|---|---|---|---|---|---|
| Supplier | Supplier · SupplierBook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Purchasing | PurchaseRequisition(+Item) · PurchaseOrder(+Item) · GoodsReceipt(+Item) · PurchaseReturn(+Item) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| People | Person · Customer · UserAccount | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| People | Member | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| People | Employee (+ view ครบ 4 บทบาท) | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book | Category · Book · BookChangeLog | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | InventoryItem · StockTransaction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | StockCount(+Item) · StockDiscrepancyReport | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Order | Order · OrderItem · OrderStatusHistory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Promotion | Promotion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment | Payment · PaymentReport · Bank | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Membership | MembershipTier · PointTransaction · Reward · Redemption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delivery | Shipment · ShipmentTracking · ShippingCompany · DeliverySummary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Review | Review · ReviewReply · ReviewReport · ProfanityFilter | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| ทั่วไป | Notification (ส่วนขยายนอก diagram) | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |

---

## หนี้ / ค้าง

- [ ] `frontend/src/admin/permissions.ts` ยังขาด `can.*` 15 ตัว (7 ตัวหน้า admin เรียกอยู่แล้ว + ใหม่ 8 ตัว) — ทำที่ P9
- [ ] `frontend` build พังอยู่ (`inventory.ts` ขาด `StockCount`/`StockDiscrepancyReport`/`ApprovalStatus` แต่ 4 หน้ายังอ้าง) — **นอกขอบเขตรอบนี้** ผู้ใช้ตัดสินใจแล้ว
- [ ] FK ~28 ตัวที่ diagram วาดเส้นแต่ไม่ระบุ attribute เป็น deviation ที่ **ต้องคุยกับเจ้าของคลาสก่อนรวมงาน**
