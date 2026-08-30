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
| **เฟส** | **P0–P3 เสร็จแล้ว** (30 ส.ค. 2569) |
| **ทำต่อที่** | **P4** — Order · OrderItem · OrderStatusHistory · Promotion |
| **branch** | `feat/backend-46-classes` |
| **verify ล่าสุด** | build ✅ · vet ✅ · gofmt ✅ · **test 47/47 ✅** · migrate+seed ✅ · **smoke 129/129 ✅ (รันซ้ำได้)** |
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
| P4 | Order · OrderItem · History · Promotion | ⬜ | | | | |
| P5 | Payment · Bank · PaymentReport | ⬜ | | | | |
| P6 | Shipment · Tracking · Carrier · Summary | ⬜ | | | | |
| P7 | MembershipTier · Member · Point · Reward | ⬜ | | | | |
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

**ฐานข้อมูลเดิมยังมีเล่ม 118 เป็น `ACTIVE`** — `Seed()` ข้ามตารางที่มีข้อมูลแล้ว ข้อมูลที่ seed ผิดไปก่อนหน้านี้
จึงไม่ถูกเขียนทับ · จะถูกต้องเมื่อสร้างฐานข้อมูลใหม่ (`docker compose down -v`) ซึ่ง**ยังไม่ได้ทำ เพราะเป็นการลบข้อมูล**
`seed_data_test.go` เฝ้าฝั่งข้อมูลตั้งต้นไว้แล้ว และ smoke ไม่ผูกกับเล่ม 118 อีกต่อไป

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
| People | Member (รอ MembershipTier) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| People | Employee (+ view ครบ 4 บทบาท) | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book | Category · Book · BookChangeLog | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | InventoryItem · StockTransaction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | StockCount(+Item) · StockDiscrepancyReport | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Order | Order · OrderItem · OrderStatusHistory | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Promotion | Promotion | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Payment | Payment · PaymentReport · Bank | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Membership | MembershipTier · PointTransaction · Reward · Redemption | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Delivery | Shipment · ShipmentTracking · ShippingCompany · DeliverySummary | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Review | Review · ReviewReply · ReviewReport · ProfanityFilter | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| ทั่วไป | Notification (ส่วนขยายนอก diagram) | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |

---

## หนี้ / ค้าง

- [ ] `frontend/src/admin/permissions.ts` ยังขาด `can.*` 15 ตัว (7 ตัวหน้า admin เรียกอยู่แล้ว + ใหม่ 8 ตัว) — ทำที่ P9
- [ ] `frontend` build พังอยู่ (`inventory.ts` ขาด `StockCount`/`StockDiscrepancyReport`/`ApprovalStatus` แต่ 4 หน้ายังอ้าง) — **นอกขอบเขตรอบนี้** ผู้ใช้ตัดสินใจแล้ว
- [ ] FK ~28 ตัวที่ diagram วาดเส้นแต่ไม่ระบุ attribute เป็น deviation ที่ **ต้องคุยกับเจ้าของคลาสก่อนรวมงาน**
