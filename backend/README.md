# Backend — ระบบจัดการผู้จัดจำหน่าย (U1–U4) และระบบจัดซื้อ (U5–U10)

REST API เขียนด้วย **Go + GORM + PostgreSQL** สำหรับสองระบบย่อยของโครงงานร้านหนังสือออนไลน์ ทีม T03

ตาราง คลาส และชื่อฟิลด์ทั้งหมดยึดตาม class diagram ระดับ Analysis
(`Sub1-Supplier-Management.md`, `Sub2-Purchasing.md`) และตาราง schema 15 ตาราง PK/FK ในเอกสารที่ส่ง
กฎทางธุรกิจยึดตาม use case description และหัวข้อ Abnormal ของ Figma UI Spec §6

---

## เริ่มใช้งาน

```bash
cp .env.example .env        # แล้วกรอก DATABASE_URL กับ JWT_SECRET
go run ./cmd/api -migrate -seed
```

เปิดที่ `http://localhost:8080` · ทดสอบด้วย [api.http](api.http) (ส่วนขยาย REST Client ของ VS Code)

| คำสั่ง | ทำอะไร |
|---|---|
| `go run ./cmd/api` | เปิดเซิร์ฟเวอร์เฉย ๆ |
| `go run ./cmd/api -migrate` | สร้าง/อัปเดต schema ก่อนเปิด |
| `go run ./cmd/api -migrate -seed` | สร้าง schema + ใส่ข้อมูลตั้งต้น (ทำงานเมื่อฐานข้อมูลว่างเท่านั้น) |
| `go run ./cmd/api -migrate -seed -setup-only` | ทำ migrate/seed แล้วจบ ไม่เปิดเซิร์ฟเวอร์ |
| `go run ./cmd/smoke` | เดิน flow U1–U10 ทั้งเส้นทางปกติและผิดปกติ สรุป PASS/FAIL |

### บัญชีทดสอบ

รหัสผ่านทุกบัญชี `staff1234` (เก็บเป็น bcrypt hash ในฐานข้อมูล)

| อีเมล | บทบาท | ทำอะไรได้ |
|---|---|---|
| `warehouse@bookhaven.co.th` | พนักงานคลังสินค้า | U1, U2, U5, U6, U8, U9, U10 |
| `manager@bookhaven.co.th` | ผู้จัดการร้าน | U3, U7 + ดูข้อมูลทั้งหมด |
| `sales@bookhaven.co.th` | พนักงานฝ่ายขาย | ดูข้อมูลผู้จัดจำหน่ายอย่างเดียว |
| `delivery@bookhaven.co.th` | พนักงานจัดส่ง | ไม่มีสิทธิ์ในสองระบบย่อยนี้ |

---

## ติดตั้ง PostgreSQL บน Raspberry Pi

```bash
sudo apt update && sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE ROLE bookstore LOGIN PASSWORD 'รหัสผ่านที่ตั้งเอง';"
sudo -u postgres psql -c "CREATE DATABASE bookstore_t03 OWNER bookstore;"

# เปิดให้ต่อจากเครื่องอื่นในวงเดียวกัน
sudo sed -i "s/^#listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "host bookstore_t03 bookstore 192.168.11.0/24 scram-sha-256" \
  | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
sudo systemctl restart postgresql
sudo ufw allow from 192.168.11.0/24 to any port 5432
```

แล้วตั้ง `DATABASE_URL` ใน `.env` ให้ชี้มาที่เครื่องนี้

---

## โครงสร้างโค้ด

```
cmd/api        เปิดเซิร์ฟเวอร์ · ประกอบ dependency ทั้งหมดไว้ที่ main.go
cmd/smoke      สคริปต์เดิน flow U1–U10 ผ่าน API จริง
internal/
  model        Entity ตาม class diagram + enum + กฎที่ตัดสินได้จากข้อมูลในตัวเอง
  repository   คำสั่ง GORM ทั้งหมด (รับ *gorm.DB เข้ามาได้ เพื่อทำงานในทรานแซกชันเดียวกับ service)
  service      กฎทางธุรกิจที่ต้องอ่านหลายตาราง + ขอบเขตทรานแซกชัน + การแจ้งเตือน
  handler      อ่าน request → เรียก service → เขียน response · ตารางเส้นทางอยู่ที่ handler.go
  middleware   ยืนยันตัวตน (JWT) · ตรวจสิทธิ์ตามบทบาท · CORS · log · กัน panic
  httpx        ตัวช่วยอ่าน/เขียน JSON และแปลง error เป็น HTTP status
  config       อ่านค่าตั้งต้นจาก .env
  database     เปิดการเชื่อมต่อ · สร้าง schema · ใส่ข้อมูลตั้งต้น
```

**กฎอยู่ที่ไหน** — กฎที่ตัดสินได้จากเอกสารใบเดียว (เปลี่ยนสถานะได้ไหม รับครบหรือยัง)
อยู่เป็นเมธอดบน model ตาม method ที่ class diagram กำหนด ส่วนกฎที่ต้องอ่านหลายตาราง
(ชื่อบริษัทซ้ำ ใบสั่งซื้อคงค้าง งบประมาณ คืนเกินจำนวนที่รับ) อยู่ที่ service

---

## Schema

15 ตารางตามเอกสาร บวกตารางส่วนขยายที่หน้าจอต้องใช้ ชื่อตารางเป็น snake_case เอกพจน์
เพื่อให้ `\dt` แมปกับเอกสารได้ทีละแถว

### ตารางตาม class diagram

| ตาราง | PK | FK |
|---|---|---|
| `supplier` | supplier_id | — |
| `supplier_book` | supplier_id, book_id | → supplier, book |
| `book` | book_id | — |
| `purchase_requisition` | pr_id | requested_by_id → employee |
| `purchase_requisition_item` | pr_id, book_id | → purchase_requisition, book |
| `purchase_order` | po_id | supplier_id → supplier · pr_id → PR (nullable) · approved_by_id → employee |
| `purchase_order_item` | po_id, book_id | → purchase_order, book |
| `goods_receipt` | gr_id | po_id → purchase_order |
| `goods_receipt_item` | gr_id, book_id | → goods_receipt, book |
| `purchase_return` | return_id | po_id → purchase_order |
| `purchase_return_item` | return_id, book_id | → purchase_return, book |
| `employee` | employee_id | — |
| `inventory_item` | inventory_id | book_id → book |
| `stock_transaction` | txn_id | book_id → book |

ตารางลูกทั้งห้าใช้ PK ผสม `(รหัสเอกสาร, book_id)` ตามเอกสาร ผลข้างเคียงคือหนังสือเล่มเดียว
ซ้ำในเอกสารฉบับเดียวไม่ได้ — service ตรวจให้ก่อนแล้วคืนข้อความไทย

### ตารางส่วนขยาย

`supplier_edit_log`, `supplier_deactivation`, `notification` — จำเป็นสำหรับ postcondition ของ
U2 (บันทึกประวัติแก้ไข), U3 (เหตุผลยกเลิก) และการแจ้งเตือนของ U6/U7/U9/U10 ซึ่ง class diagram
ระดับ Analysis ไม่ได้ลงรายละเอียดไว้

### enum

เก็บเป็น `varchar` + `CHECK` constraint ไม่ใช้ native enum type เพื่อให้เพิ่มค่าภายหลังได้โดยไม่ต้อง
migrate ชนิดข้อมูล · ค่าทุกตัวเป็น SCREAMING_SNAKE ตรงกับ class diagram และ union type ฝั่ง frontend

| enum | ค่า |
|---|---|
| `SupplierStatus` | ACTIVE, CANCELLED |
| `PRStatus` | DRAFT, SUBMITTED, APPROVED, REJECTED |
| `POStatus` | PENDING_APPROVAL, APPROVED, CONFIRMED, RECEIVED_PARTIAL, RECEIVED_FULL, RETURNED, CANCELLED |
| `GRStatus` | PARTIAL, FULL |
| `ReturnStatus` | TRACKING, ESCALATED, CLOSED |
| `ItemCondition` | NORMAL, DAMAGED |
| `BookStatus` | ACTIVE, INACTIVE |
| `StockTxnType` | RECEIVE_IN, SALE_OUT, RETURN, ADJUSTMENT |

---

## API

ทุกเส้นทางขึ้นต้นด้วย `/api` และต้องมี `Authorization: Bearer <token>` ยกเว้น `/api/health`
กับ `/api/auth/login`

รูปแบบข้อผิดพลาด — `code` เป็นอังกฤษให้หน้าจอ switch ได้ `message` เป็นไทยสำหรับแสดงผล:

```json
{ "error": { "code": "SUPPLIER_HAS_OPEN_ORDERS", "message": "ต้องปิดรายการคงค้างให้ครบก่อน" } }
```

| Method | Path | UC | สิทธิ์ |
|---|---|---|---|
| POST | `/auth/login` | — | เปิดสาธารณะ |
| GET | `/auth/me` | — | พนักงานทุกบทบาท |
| GET | `/suppliers` · `/suppliers/{id}` · `/suppliers/{id}/orders` | U4 | คลัง, ผจก., ฝ่ายขาย |
| POST | `/suppliers` | U1 | คลังสินค้า |
| PUT | `/suppliers/{id}` | U2 | คลังสินค้า |
| POST | `/suppliers/{id}/deactivate` | U3 | ผู้จัดการร้าน |
| GET | `/books` · `/inventory` | — | คลัง, ผจก., ฝ่ายขาย |
| GET | `/inventory/alerts` | U5 | คลังสินค้า |
| PUT | `/inventory/{bookId}/reorder-point` | U5 | คลังสินค้า |
| GET | `/requisitions` · `/requisitions/{id}` | U6, U7 | คลัง, ผจก. |
| POST | `/requisitions` · PUT `/requisitions/{id}` · POST `/requisitions/{id}/submit` | U6 | คลังสินค้า |
| POST | `/requisitions/{id}/approve` · `/requisitions/{id}/reject` | U7 | ผู้จัดการร้าน |
| GET | `/purchasing/budget` | U7 | คลัง, ผจก. |
| GET | `/purchase-orders` · `/purchase-orders/{id}` | U8 | คลัง, ผจก. |
| POST | `/purchase-orders/{id}/send` · `/purchase-orders/{id}/confirm` | U8 | คลังสินค้า |
| GET | `/purchase-orders/{id}/receipts` · `/receipts` | U9 | คลัง, ผจก. |
| POST | `/purchase-orders/{id}/receipts` | U9 | คลังสินค้า |
| GET | `/purchase-orders/{id}/returns` · `/returns` · `/returns/{id}` | U10 | คลัง, ผจก. |
| POST | `/purchase-orders/{id}/returns` · `/returns/{id}/escalate` · `/returns/{id}/compensation` | U10 | คลังสินค้า |
| GET/POST | `/notifications` · `/notifications/{id}/read` · `/notifications/read-all` | — | พนักงานทุกบทบาท |

สิทธิ์ของทุกเส้นทางตรงกับ `can.*` ใน `frontend/src/admin/permissions.ts` — หน้าจอซ่อนหรือปิดปุ่มไว้แล้ว
แต่ backend ตรวจซ้ำเพราะยิง API ตรงได้

---

## กฎทางธุรกิจที่บังคับฝั่งเซิร์ฟเวอร์

| UC | กฎ | ผลถ้าผิด |
|---|---|---|
| U1 | ฟิลด์บังคับครบ · อีเมลถูกรูปแบบ · ชื่อบริษัทไม่ซ้ำ (ไม่สนตัวพิมพ์/ช่องว่าง) | 422 · 409 |
| U2 | บันทึกประวัติทุกครั้งที่แก้ ว่าใครแก้อะไรเมื่อไร | — |
| U3 | ต้องมีเหตุผล · **ห้ามปิดถ้ายังมีใบสั่งซื้อคงค้าง** · ปิดแล้วประวัติยังอ่านได้ | 422 · 409 |
| U5 | ยังไม่ตั้งจุดสั่งซื้อ = ไม่นับว่าต่ำ แต่ยังแสดงพร้อมธง `unconfigured` | — |
| U6 | ผู้จัดจำหน่ายต้อง ACTIVE · จำนวนและราคา > 0 · ห้ามหนังสือซ้ำ · หนังสือต้องอยู่ในรายการที่ผู้จัดจำหน่ายเสนอขาย | 422 |
| U7 | ใบต้องอยู่สถานะรออนุมัติ · เกินงบต้องบันทึกเหตุผลก่อน · **อนุมัติแล้วออก PO อัตโนมัติ** · ตีกลับต้องมีเหตุผล | 409 · 422 |
| U8 | ส่งได้เฉพาะใบที่อนุมัติแล้ว · ยืนยันได้เฉพาะใบที่ส่งไปแล้ว · วันที่ส่งมอบต้องไม่ย้อนหลัง | 409 · 422 |
| U9 | ใบต้องยืนยันแล้วหรือรับไปบางส่วน · รับหนังสือนอกใบสั่งซื้อไม่ได้ · รับ 0 ทุกรายการไม่ได้ · รับครบ → RECEIVED_FULL, ไม่ครบ → RECEIVED_PARTIAL | 409 · 422 |
| U10 | คืนได้ไม่เกินจำนวนที่รับจริงหักที่เคยคืนไปแล้ว · คืนครบทุกหน่วย → PO = RETURNED · ปฏิเสธการรับคืน → ส่งต่อผู้จัดการ | 422 · 409 |

### ทรานแซกชัน

สี่ขั้นตอนนี้ครอบด้วยทรานแซกชันเดียว และล็อกแถวเอกสารด้วย `SELECT ... FOR UPDATE`
กันการยิงซ้อน (เช่นกดปุ่มรับสินค้าสองครั้งพร้อมกัน):

1. **U7 อนุมัติ** — อัปเดต PR + ออก PO + รายการ PO + แจ้งเตือน
2. **U9 รับสินค้า** — ออก GRN + เพิ่มจำนวนที่รับ + ปรับสถานะ PO + เคลื่อนไหวสต็อก + แจ้งเตือน
3. **U10 เปิดใบคืน** — ออกใบคืน + ตัดสต็อก + ปิด PO ถ้าคืนครบ
4. **U10 ชดเชย** — ปิดใบคืน + เพิ่มสต็อกคืนถ้าเป็นสินค้าทดแทน

---

## จุดที่ต่างจาก class diagram (จงใจ พร้อมเหตุผล)

1. **`employee` ตารางเดียวมีคอลัมน์ `role`** — เป็นการ map generalization
   `Person <|- Employee <|- {WarehouseStaff, StoreManager, SalesStaff, DeliveryStaff}`
   แบบ single-table inheritance · เอกสารแยก `WarehouseStaff` กับ `StoreManager` เป็นคนละตาราง
   จึงสร้าง **view สองตัวชื่อเดียวกัน** ทับไว้ให้เห็นใน `\dv` · เพิ่ม `password_hash` สำหรับ JWT
   (คลาส `UserAccount` เต็มรูปเป็นของระบบย่อยสมาชิก ไม่ดึงมาทั้งก้อน)

2. **`stock_transaction.book_id`** — class diagram ไม่มี (ข้อ D4 ใน `ClassDiagram-Review.md`
   ซึ่งเป็นคลาสของระบบย่อยสินค้าคงคลัง) แต่ถ้าไม่มี รายการเคลื่อนไหวจะไม่บอกว่าเป็นหนังสือเล่มไหน
   และใช้งานจริงไม่ได้ · **ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน**

3. **`GRStatus` / `ReturnStatus` / `ItemCondition` เป็น enum** — diagram พิมพ์เป็น `string` เฉย ๆ
   (ข้อ D3 ที่ `ClassDiagram-Review.md` เขียนค้างไว้) · ฝั่ง frontend ทำเป็น union อยู่แล้ว
   จึงยกระดับให้ตรงกันทั้งสองฝั่ง

4. **`purchase_requisition.supplier_id`** — diagram ไม่ได้ใส่ไว้ แต่ U6 ให้เลือกผู้จัดจำหน่ายก่อนเสมอ
   (precondition ระบุว่าผู้จัดจำหน่ายต้อง ACTIVE) และ U7 ต้องใช้ตอนออกใบสั่งซื้อ

5. **`purchase_order.sent_at` / `confirmed_at`** — `POStatus` ไม่มีค่าสำหรับ "รอยืนยัน"
   ใบที่ส่งแล้วแต่ยังไม่ยืนยันจึงเป็น `APPROVED` ที่มี `sent_at` แล้ว API คำนวณ `displayStatus`
   (`AWAITING_SEND` / `AWAITING_CONFIRM`) ให้ ตรงกับ `poDisplayStatus()` ฝั่ง frontend

6. **เงินเป็น `numeric(12,2)` ในฐานข้อมูล แต่เป็น `float64` ใน Go** — คอลัมน์แม่นยำจริง
   ส่วน Go ใช้ float64 เพื่อให้ JSON ออกมาเป็น `number` ตรงกับที่ TypeScript ประกาศไว้
   ระบบที่ใช้งานจริงควรใช้ชนิด decimal ตลอดสาย

7. **ป้ายไทยยึดตาม frontend** — `labels.go` ชุดเดิมของ Go model เขียนต่างจาก TS อยู่ 5 คำ
   (เช่น `SUBMITTED` เดิม "ส่งขออนุมัติ") · ยึดข้อความฝั่งหน้าจอเป็นหลักเพราะเป็นสิ่งที่ผู้ใช้เห็น

---

## ตรวจงาน

```bash
go build ./...     # ต้องสะอาด
go vet ./...       # ต้องสะอาด
gofmt -l .         # ต้องไม่มีไฟล์ขึ้นมา
go test ./...      # ทดสอบ state machine และการคำนวณ (ไม่ต้องมีฐานข้อมูล)
```

ตรวจกับฐานข้อมูลจริง:

```bash
go run ./cmd/api -migrate -seed   # หน้าต่างหนึ่ง
go run ./cmd/smoke                # อีกหน้าต่างหนึ่ง — ต้องได้ PASS ทุกเคส
```

ตรวจ schema ที่เกิดขึ้นจริง:

```sql
\dt                        -- ตารางตามเอกสาร
\dv                        -- warehouse_staff, store_manager
\d purchase_order_item     -- PK ต้องเป็น (po_id, book_id)
SELECT status, count(*) FROM purchase_order GROUP BY status;
```

---

## ข้อมูลตั้งต้น

`internal/database/seed_data.go` ถูก **สร้างด้วยสคริปต์** `tools/gen_seed.py` จาก `SEED_*` ของ frontend
(ผู้จัดจำหน่าย 12 ราย · หนังสือ 23 เล่ม · PR 3 ใบ · PO 10 ใบ · GRN 1 ใบ) เพื่อให้ backend
กับหน้าจอเห็นข้อมูลชุดเดียวกันตอนต่อ API — อย่าแก้ไฟล์นั้นด้วยมือ ให้แก้ที่ frontend แล้วสั่ง `python tools/gen_seed.py` สร้างใหม่

`Seed()` ทำงานเมื่อตาราง `supplier` ยังว่างเท่านั้น รันซ้ำจะข้ามไป และปิดท้ายด้วยการเลื่อน sequence
ให้เลขเอกสารใหม่เริ่มต่อจากข้อมูลตั้งต้น (ผู้จัดจำหน่าย 1–12 · หนังสือ 101–123 · PR 101+ · PO 2380+ · GRN 5001+)

---

## นอกขอบเขต

- ระบบย่อยของเพื่อนร่วมทีม (คำสั่งซื้อลูกค้า ชำระเงิน จัดส่ง รีวิว โปรโมชั่น สมาชิก) —
  `book` / `inventory_item` / `stock_transaction` ใส่ไว้เท่าที่ U5, U9, U10 ต้องใช้เท่านั้น
- การส่งอีเมลจริง — บันทึกลงตาราง `notification` ช่อง `email` ไว้ให้ SCR-27 แสดงเส้นทางเอกสาร
  แต่ไม่ได้ส่งออกไปจริง (เหมือนที่ frontend ทำ)
- การเก็บไฟล์แนบ — หลักฐานการส่งคืนเก็บเป็น data URL ในคอลัมน์ `text`
- การต่อ frontend เข้ากับ API — ยังเป็น `localStorage` อยู่ เป็นงานรอบถัดไป
