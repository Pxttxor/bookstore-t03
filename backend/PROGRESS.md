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
| **เฟส** | P0 — สะสาง + วางโครง |
| **ทำต่อที่** | P0 ขั้น 3 — เปลี่ยนชื่อ `/api/orders` → `/api/purchase-orders` |
| **branch** | `feat/backend-46-classes` |
| **verify ล่าสุด** | build ✅ · vet ✅ · gofmt ✅ · test 24/24 ✅ · migrate+seed ✅ · **smoke 51/51 ✅** |
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
| P0 | สะสาง + วางโครง | 🔄 | — | 24/24 | ✅ | 51/51 |
| P1 | Person · Customer · UserAccount | ⬜ | | | | |
| P2 | Category · Book CRUD · BookChangeLog | ⬜ | | | | |
| P3 | Inventory เต็ม (StockCount · Discrepancy) | ⬜ | | | | |
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
| 5 | เปลี่ยนชื่อ `/api/orders` → `/api/purchase-orders` | ⬜ |
| 6 | แตก `Routes()` → `routes.go` + `handler.New(Deps)` | ⬜ |
| 7 | แตก `service/purchasing.go` (855 บรรทัด) → 4 ไฟล์ | ⬜ |
| 8 | แตก `cmd/smoke/main.go` (696 บรรทัด) → `main`/`client`/`env`/`flow_*` | ⬜ |
| 9 | `Seed()` guard ต่อตาราง (`seedIfEmpty[T]`) | ⬜ |
| 10 | `gen_seed.py` — ตัด `seedStockTransactions` · เพิ่ม `seedCategories` | ⬜ |
| 11 | `applyForeignKeys()` ใน `migrate.go` (FK ที่ GORM ไม่สร้างให้) | ⬜ |

---

## คลาสตาม Class Diagram (46)

`✅` เสร็จ · `🔄` กำลังทำ · `⬜` ยังไม่เริ่ม · `—` ไม่มีชั้นนี้

| ระบบย่อย | คลาส | model | repo | service | handler | migrate | seed | smoke |
|---|---|---|---|---|---|---|---|---|
| Supplier | Supplier · SupplierBook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Purchasing | PurchaseRequisition(+Item) · PurchaseOrder(+Item) · GoodsReceipt(+Item) · PurchaseReturn(+Item) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| People | Person · Customer · Member · UserAccount | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| People | Employee (+ view warehouse_staff / store_manager) | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book | Category · Book · BookChangeLog | 🔄 Book อ่านอย่างเดียว | ⬜ | ⬜ | ⬜ | 🔄 | ✅ | ⬜ |
| Inventory | InventoryItem · StockTransaction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | StockCount(+Item) · StockDiscrepancyReport | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
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
