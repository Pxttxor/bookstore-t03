# Backend — ระบบร้านหนังสือออนไลน์ ทีม T03

REST API เขียนด้วย **Go + GORM + PostgreSQL** ของโครงงานร้านหนังสือออนไลน์ ทีม T03

แกนหลักคือสองระบบย่อย — **จัดการผู้จัดจำหน่าย (U1–U4)** และ **จัดซื้อ (U5–U10)**
รอบนี้ขยายจนครบ **ทั้ง 46 คลาสของ class diagram** แล้ว (อีก 8 ระบบย่อยที่เหลือ)
ทำเป็นเฟส ดูสถานะที่ [`PROGRESS.md`](PROGRESS.md) — ที่เพิ่มเข้ามาคือ **บุคคล/ลูกค้า/บัญชีผู้ใช้** ·
**ข้อมูลหนังสือ (หมวดหมู่ · หนังสือ · ประวัติการแก้ไข)** ·
**สินค้าคงคลังเต็มรูป (ปรับยอดด้วยมือ · ตรวจนับ · รายงานผลต่าง)** ·
**คำสั่งซื้อลูกค้ากับโปรโมชั่น** · **ตรวจสอบการชำระเงิน (ธนาคาร · สลิป · รายงานรับชำระ)** ·
**จัดการการจัดส่ง (พัสดุ · ติดตามสถานะ · สรุปบัญชีพัสดุ)** ·
**สมาชิกและแต้มสะสม (ระดับ · แต้ม · ของรางวัล · การแลกแต้ม)** และ
**รีวิวลูกค้า (ตรวจสอบ · ตอบกลับ · รายงานให้ผู้จัดการ · ตัวกรองคำหยาบ)**

ตาราง คลาส และชื่อฟิลด์ทั้งหมดยึดตาม class diagram ระดับ Analysis
(`Sub1-Supplier-Management.md`, `Sub2-Purchasing.md` และของเจ้าของคลาสในระบบย่อยอื่น)
กับตาราง schema 15 ตาราง PK/FK ในเอกสารที่ส่ง
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
| `go run ./cmd/smoke` | เดิน flow ทุกระบบย่อยที่ทำแล้ว ทั้งเส้นทางปกติและผิดปกติ สรุป PASS/FAIL |
| `python tools/gen_seed.py` | สร้าง `seed_data.go` ใหม่จาก `SEED_*` ของ frontend |

### บัญชีทดสอบ

รหัสผ่านทุกบัญชี `staff1234` (เก็บเป็น bcrypt hash ในฐานข้อมูล)

| อีเมล | บทบาท | ทำอะไรได้ |
|---|---|---|
| `warehouse@bookhaven.co.th` | พนักงานคลังสินค้า | U1, U2, U5, U6, U8, U9, U10 |
| `manager@bookhaven.co.th` | ผู้จัดการร้าน | U3, U7 + ดูข้อมูลทั้งหมด |
| `sales@bookhaven.co.th` | พนักงานฝ่ายขาย | ดูข้อมูลผู้จัดจำหน่าย · **เจ้าของแคตตาล็อกหนังสือ** · ดูข้อมูลลูกค้า |
| `delivery@bookhaven.co.th` | พนักงานจัดส่ง | ไม่มีสิทธิ์ในสองระบบย่อยนี้ |

บัญชีลูกค้า รหัสผ่าน `customer1234` · สมัครใหม่เองได้ที่ `POST /api/auth/register`
แล้วยืนยันด้วยรหัส OTP โหมดพัฒนา `123456`

| อีเมล | ชื่อ | สถานะบัญชี |
|---|---|---|
| `napat@example.com` | ณภัทร วงศ์สว่าง | `ACTIVE` |
| `kanya@example.com` | กัญญา ศรีสาย | `UNVERIFIED` — ล็อกอินไม่ได้จนกว่าจะยืนยัน |
| `somsak@example.com` | สมศักดิ์ ใจดี | `SUSPENDED` — ถูกผู้จัดการระงับ |

---

## ดูข้อมูลในฐานด้วย pgAdmin

`docker-compose.yml` มี pgAdmin มาให้แล้ว ไม่ต้องลง `psql` บนเครื่อง

```bash
docker compose up -d          # เปิด PostgreSQL (5433) + pgAdmin (5050)
docker compose up -d db       # เอาเฉพาะฐานข้อมูล
```

เปิด `http://localhost:5050` (ถ้ารันบน Pi ใช้ `http://<ip ของ Pi>:5050`)

| | ค่าปริยาย | เปลี่ยนด้วย |
|---|---|---|
| อีเมลเข้า pgAdmin | `admin@bookhaven.co.th` | `PGADMIN_EMAIL` |
| รหัสผ่านเข้า pgAdmin | `bookstore` | `PGADMIN_PASSWORD` |
| รหัสผ่านของ role `bookstore` | `bookstore` | `POSTGRES_PASSWORD` |

เซิร์ฟเวอร์ **bookstore-t03 (db)** ถูกลงทะเบียนไว้ให้แล้วจาก
[`pgadmin-servers.json`](pgadmin-servers.json) — กดเข้าไปแล้วใส่รหัสผ่านของ role `bookstore`
ครั้งเดียว (ติ๊ก *Save Password* ไว้ได้)

**ข้อควรรู้**

- ในหน้าตั้งค่าเซิร์ฟเวอร์ host คือ **`db`** พอร์ต **`5432`** ไม่ใช่ `localhost:5433` —
  สองคอนเทนเนอร์คุยกันในเครือข่ายของ compose ส่วน `5433` เป็นพอร์ตที่ map ออกมาให้เครื่องข้างนอก
- แก้ `pgadmin-servers.json` แล้วต้องลบ volume ของ pgAdmin ก่อนถึงจะมีผล
  (`docker compose down -v` หรือ `docker volume rm bookstore-t03_bookstore_t03_pgadmin`)
  เพราะไฟล์นี้ถูกอ่านตอนสร้างฐานข้อมูลของ pgAdmin ครั้งแรกครั้งเดียว
- **ฐานข้อมูลของทีมที่ใช้อยู่จริงคือ compose ชุดนี้เอง ที่รันอยู่บน Pi 5**
  (`DATABASE_URL` ใน `.env` ชี้ไป `192.168.8.190:5433` ซึ่งตรงกับ `5433:5432` ข้างบน)
  → สั่ง `docker compose up -d` **บน Pi** ทั้งทีมจะได้ pgAdmin ที่ `http://192.168.8.190:5050`
  ต่อเข้าฐานเดียวกันทันที ไม่ต้องตั้งค่าอะไรเพิ่ม
- pgAdmin เปิดพอร์ต 5050 ให้ทั้งวง LAN เข้าถึงได้ · **ตั้ง `PGADMIN_PASSWORD` ให้ไม่ใช่ค่าปริยาย
  ถ้ารันบน Pi** ไม่งั้นใครในวงเดียวกันก็เข้ามาแก้ฐานได้ (หัวข้อ *ติดตั้งบน Pi* ข้างล่างจำกัด
  ฐานข้อมูลไว้ที่ subnet เดียว แต่พอร์ตของ pgAdmin ไม่ได้ถูกจำกัดด้วย)

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
cmd/smoke      สคริปต์เดิน flow ของทุกระบบย่อยผ่าน API จริง (flow_*.go หนึ่งไฟล์ต่อระบบย่อย)
internal/
  model        Entity ตาม class diagram + enum + กฎที่ตัดสินได้จากข้อมูลในตัวเอง
  repository   คำสั่ง GORM ทั้งหมด (รับ *gorm.DB เข้ามาได้ เพื่อทำงานในทรานแซกชันเดียวกับ service)
  service      กฎทางธุรกิจที่ต้องอ่านหลายตาราง + ขอบเขตทรานแซกชัน + การแจ้งเตือน
  handler      อ่าน request → เรียก service → เขียน response · ตารางเส้นทางอยู่ที่ routes.go
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

15 ตารางตามเอกสารที่ส่งอาจารย์ บวกตารางของระบบย่อยที่ทำเพิ่มในรอบนี้ และตารางส่วนขยายที่หน้าจอต้องใช้
ชื่อตารางเป็น snake_case เอกพจน์ เพื่อให้ `\dt` แมปกับเอกสารได้ทีละแถว

### ตารางตาม class diagram

| ตาราง | PK | FK |
|---|---|---|
| `person` | person_id | — |
| `employee` | employee_id | person_id → person |
| `customer` | customer_id | person_id → person |
| `user_account` | account_id | person_id → person |
| `supplier` | supplier_id | — |
| `supplier_book` | supplier_id, book_id | → supplier, book |
| `category` | category_id | — |
| `book` | book_id | category_id → category |
| `book_change_log` | log_id | book_id → book |
| `purchase_requisition` | pr_id | requested_by_id → employee |
| `purchase_requisition_item` | pr_id, book_id | → purchase_requisition, book |
| `purchase_order` | po_id | supplier_id → supplier · pr_id → PR (nullable) · approved_by_id → employee |
| `purchase_order_item` | po_id, book_id | → purchase_order, book |
| `goods_receipt` | gr_id | po_id → purchase_order |
| `goods_receipt_item` | gr_id, book_id | → goods_receipt, book |
| `purchase_return` | return_id | po_id → purchase_order |
| `purchase_return_item` | return_id, book_id | → purchase_return, book |
| `inventory_item` | inventory_id | book_id → book |
| `stock_transaction` | txn_id | book_id → book |
| `stock_count` | count_id | — |
| `stock_count_item` | count_id, book_id | → stock_count, book, stock_discrepancy_report (nullable) |
| `stock_discrepancy_report` | report_id | count_id → stock_count · book_id → book |
| `promotion` | promotion_id | — |
| `customer_order` | order_id | customer_id → customer · promotion_id → promotion (nullable) |
| `customer_order_item` | order_id, book_id | → customer_order, book |
| `customer_order_status_history` | history_id | order_id → customer_order |
| `bank` | bank_id | — |
| `payment` | payment_id | order_id → customer_order (unique) · bank_id → bank (nullable) |
| `payment_report` | report_id | — |
| `shipping_company` | carrier_id | — |
| `shipment` | shipment_id | order_id → customer_order (unique) · carrier_id → shipping_company |
| `shipment_tracking` | tracking_id | shipment_id → shipment |
| `delivery_summary` | summary_id | — |
| `membership_tier` | tier_id | — |
| `member` | member_id | customer_id → customer (unique) · tier_id → membership_tier |
| `point_transaction` | point_txn_id | member_id → member · order_id → customer_order (nullable) |
| `reward` | reward_id | — |
| `redemption` | redemption_id | member_id → member · reward_id → reward |
| `review` | review_id | customer_id → customer · book_id → book · order_id → customer_order (nullable) |
| `review_reply` | reply_id | review_id → review |
| `review_report` | report_id | review_id → review (unique) |

ตารางลูกทั้งเจ็ดใช้ PK ผสม `(รหัสเอกสาร, book_id)` ตามเอกสาร ผลข้างเคียงคือหนังสือเล่มเดียว
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
| `AccountStatus` | UNVERIFIED, ACTIVE, SUSPENDED |
| `StockCountStatus` | DRAFT, DONE |
| `ApprovalStatus` | PENDING, APPROVED, REJECTED |
| `OrderChannel` | WEBSITE, MESSAGE, PHONE |
| `OrderStatus` | PENDING_CONFIRM, STOCK_CONFIRMED, WAITING_PAYMENT, VERIFYING_PAYMENT, PAID, PACKING, READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, REJECTED |
| `PromotionType` | FESTIVAL_DISCOUNT, COUPON, BUY_X_QTY |
| `PromotionStatus` | ACTIVE, INACTIVE, EXPIRED |
| `PaymentStatus` | WAITING, VERIFYING, SUCCESS, REJECTED |
| `ShipmentStatus` | PREPARING, SHIPPED, IN_TRANSIT, DELIVERED, FAILED |
| `PointTxnType` | EARN, REDEEM, EXPIRE, REVERSAL |
| `RewardType` | DISCOUNT, GIFT |
| `ReviewStatus` | PENDING, PUBLISHED, HIDDEN, REMOVED |
| `ModerateAction` | PUBLISH, HIDE, REMOVE (คำสั่งที่ส่งเข้ามา ไม่ได้เก็บลงตาราง) |

---

## API

ทุกเส้นทางขึ้นต้นด้วย `/api` และต้องมี `Authorization: Bearer <token>` ยกเว้นเส้นทางสาธารณะ
สี่กลุ่ม: `/api/health` · `/api/auth/login` · `/api/auth/register` กับ `/api/auth/verify-otp`
(สมัครบัญชีลูกค้า) · และ `/api/catalogue/*` (แคตตาล็อกหน้าร้าน — คนเดินดูหนังสือยังไม่ล็อกอิน)

รูปแบบข้อผิดพลาด — `code` เป็นอังกฤษให้หน้าจอ switch ได้ `message` เป็นไทยสำหรับแสดงผล:

```json
{ "error": { "code": "SUPPLIER_HAS_OPEN_ORDERS", "message": "ต้องปิดรายการคงค้างให้ครบก่อน" } }
```

| Method | Path | UC | สิทธิ์ |
|---|---|---|---|
| POST | `/auth/login` · `/auth/register` · `/auth/verify-otp` | — | เปิดสาธารณะ |
| GET | `/catalogue` · `/catalogue/categories` · `/catalogue/{id}` | — | เปิดสาธารณะ (เฉพาะเล่มที่ขายอยู่) |
| GET | `/catalogue/{id}/cover` | — | เปิดสาธารณะ (สตรีมไบต์ ไม่ใช่ JSON · **ไม่คัดตามสถานะการขาย** ดูข้อ 32) |
| GET | `/auth/me` | — | ทุกคนที่ล็อกอินแล้ว (รวมลูกค้า) |
| GET/PUT | `/customers/me` | — | ลูกค้า |
| GET | `/customers` · `/customers/{id}` | — | ฝ่ายขาย, ผจก. |
| POST | `/accounts/{id}/suspend` · `/accounts/{id}/reactivate` | — | ผู้จัดการร้าน |
| GET | `/suppliers` · `/suppliers/{id}` · `/suppliers/{id}/orders` | U4 | คลัง, ผจก., ฝ่ายขาย |
| POST | `/suppliers` | U1 | คลังสินค้า |
| PUT | `/suppliers/{id}` | U2 | คลังสินค้า |
| POST | `/suppliers/{id}/deactivate` | U3 | ผู้จัดการร้าน |
| GET | `/categories` · `/books` · `/books/{id}` · `/inventory` | — | คลัง, ผจก., ฝ่ายขาย |
| GET | `/books/{id}/change-logs` | — | ฝ่ายขาย, ผจก. |
| GET | `/book-change-logs` | — | ผู้จัดการร้าน (ประวัติการแก้ไขหนังสือทุกเล่มรวมกัน) |
| POST/PUT | `/books` · `/books/{id}` · `/books/{id}/status` | — | ฝ่ายขาย, ผจก. |
| GET | `/inventory/alerts` | U5 | คลังสินค้า |
| GET | `/inventory/low-stock` | — | คลัง, ผจก., ฝ่ายขาย |
| POST | `/inventory/adjust` | — | คลังสินค้า |
| GET | `/stock-counts` · `/stock-counts/{id}` · `/discrepancies` | — | คลัง, ผจก. |
| POST | `/stock-counts` | — | คลังสินค้า |
| POST | `/discrepancies/{id}/approve` · `/discrepancies/{id}/reject` | — | ผู้จัดการร้าน |
| GET | `/orders` · `/orders/{id}` | — | พนักงานทุกบทบาท + ลูกค้า (เห็นเฉพาะใบตัวเอง) |
| POST | `/orders` · `/orders/{id}/payment` | — | ลูกค้า, ฝ่ายขาย |
| POST | `/orders/{id}/confirm-stock` · `/await-payment` · `/verify-payment` · `/reject-payment` | — | ฝ่ายขาย |
| POST | `/orders/{id}/pack` · `/orders/{id}/ready` | — | คลังสินค้า |
| POST | `/orders/{id}/ship` · `/orders/{id}/deliver` | — | ฝ่ายจัดส่ง |
| POST | `/orders/{id}/cancel` | — | ฝ่ายขาย, ผจก. |
| GET/POST/PUT/DELETE | `/promotions` · `/promotions/{id}` · `/promotions/{id}/status` | — | ผู้จัดการร้าน |
| GET | `/banks` | — | ทุกคนที่ล็อกอินแล้ว (ลูกค้าต้องรู้ว่าจะโอนเข้าบัญชีไหน) |
| GET | `/payments` · `/payments/{id}` | — | ฝ่ายขาย, ผจก. |
| GET | `/orders/{id}/payment` | — | พนักงานทุกบทบาท + ลูกค้า (เห็นเฉพาะใบตัวเอง) |
| GET/POST | `/payment-reports` | — | ผู้จัดการร้าน |
| GET | `/carriers` | — | พนักงานทุกบทบาท |
| GET | `/shipments` · `/shipments/{id}` · `/orders/{id}/shipment` | — | พนักงานทุกบทบาท + ลูกค้า (เห็นเฉพาะพัสดุของใบตัวเอง) |
| POST | `/shipments/{id}/tracking` | — | ฝ่ายจัดส่ง |
| GET/POST | `/delivery-summaries` | — | ฝ่ายจัดส่ง, ผจก. |
| GET | `/membership-tiers` · `/rewards` · `/redemptions` | — | ทุกคนที่ล็อกอินแล้ว (ลูกค้าเห็นเฉพาะของตัวเอง) |
| POST/PUT/DELETE | `/membership-tiers` · `/membership-tiers/{id}` | — | ผู้จัดการร้าน |
| POST/PUT/DELETE | `/rewards` · `/rewards/{id}` | — | ผู้จัดการร้าน |
| GET | `/members/me` · POST `/rewards/{id}/redeem` | — | ลูกค้า |
| GET | `/members` · `/members/{id}` | — | ฝ่ายขาย, ผจก. |
| GET | `/members/{id}/point-transactions` | — | ทุกคนที่ล็อกอินแล้ว (ลูกค้าเห็นเฉพาะของตัวเอง) |
| POST | `/members/{id}/point-adjustments` | — | ผู้จัดการร้าน |
| POST | `/reviews` | — | ลูกค้า |
| GET | `/reviews` · `/reviews/{id}` | — | ฝ่ายขาย, ผจก. + ลูกค้า (เห็นเฉพาะรีวิวของตัวเอง) |
| GET | `/books/{id}/reviews` | — | ทุกคนที่ล็อกอินแล้ว (เฉพาะรีวิวที่เผยแพร่แล้ว) |
| POST | `/reviews/{id}/moderate` · `/reviews/{id}/replies` · `/reviews/{id}/report` | — | ฝ่ายขาย, ผจก. |
| GET | `/review-reports` · `/review-reports/{id}` | — | ผู้จัดการร้าน |
| PUT | `/inventory/{bookId}/reorder-point` | U5 | คลังสินค้า |
| GET | `/requisitions` · `/requisitions/{id}` | U6, U7 | คลัง, ผจก. |
| POST | `/requisitions` · PUT `/requisitions/{id}` · POST `/requisitions/{id}/submit` | U6 | คลังสินค้า |
| POST | `/requisitions/{id}/approve` · `/requisitions/{id}/reject` | U7 | ผู้จัดการร้าน |
| GET | `/purchasing/budget` | U7 | คลัง, ผจก. |
| GET | `/purchase-orders` · `/purchase-orders/{id}` | U8 | คลัง, ผจก. |
| POST | `/purchase-orders/{id}/send` · `/purchase-orders/{id}/confirm` | U8 | คลังสินค้า |
| POST | `/purchase-orders/{id}/cancel` | U8 (abnormal) | คลังสินค้า |
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
| U8 | ส่งได้เฉพาะใบที่อนุมัติแล้ว · ยืนยันได้เฉพาะใบที่ส่งไปแล้ว · วันที่ส่งมอบต้องไม่ย้อนหลัง · **ยกเลิกได้จากทุกสถานะที่ยังไม่ปิด ยกเว้นใบที่ปิดแล้ว (RECEIVED_FULL/RETURNED/CANCELLED)** | 409 · 422 |
| U9 | ใบต้องยืนยันแล้วหรือรับไปบางส่วน · รับหนังสือนอกใบสั่งซื้อไม่ได้ · รับ 0 ทุกรายการไม่ได้ · รับครบ → RECEIVED_FULL, ไม่ครบ → RECEIVED_PARTIAL | 409 · 422 |
| U10 | คืนได้ไม่เกินจำนวนที่รับจริงหักที่เคยคืนไปแล้ว · คืนครบทุกหน่วย → PO = RETURNED · ปฏิเสธการรับคืน → ส่งต่อผู้จัดการ | 422 · 409 |
| สมาชิก | อีเมลและชื่อผู้ใช้ห้ามซ้ำ (ไม่สนตัวพิมพ์) · รหัสผ่านอย่างน้อย 8 ตัว · ยังไม่ยืนยัน OTP หรือถูกระงับ = ล็อกอินไม่ได้ | 409 · 422 · 401 |
| หนังสือ | ฟิลด์บังคับครบ · ISBN ไม่ซ้ำ · หมวดหมู่ที่อ้างถึงต้องมีจริง · **แก้ไขแล้วบันทึกประวัติทีละฟิลด์ที่เปลี่ยนจริง** | 422 · 409 · 404 |
| ปรับยอด | ต้องมีเหตุผล · จำนวนที่ปรับไม่เป็นศูนย์ · **ยอดรวมหลังปรับของทุกเล่มต้องไม่ติดลบ (ตรวจให้ครบก่อนเขียน)** | 422 |
| ตรวจนับ | ห้ามหนังสือซ้ำในรอบเดียว · จำนวนที่นับได้ไม่ติดลบ · แถวที่ไม่ตรงเปิดรายงานให้ผู้จัดการอัตโนมัติ | 422 |
| ผลต่าง | ตัดสินได้ครั้งเดียว · ปฏิเสธต้องมีเหตุผล · **อนุมัติแล้วตั้งยอดเท่าที่นับได้ ไม่ใช่บวก variance** | 409 · 422 |
| สั่งซื้อ | ต้องมีสินค้าอย่างน้อยหนึ่งรายการ · ห้ามหนังสือซ้ำ · หนังสือที่ปิดการขายสั่งไม่ได้ · โปรโมชั่นต้องเข้าเงื่อนไข | 422 |
| สถานะคำสั่งซื้อ | เดินตามตารางการเปลี่ยนสถานะเท่านั้น ข้ามขั้นไม่ได้ · ยกเลิก/ปฏิเสธต้องมีเหตุผล · **สต็อกไม่พอ = ยืนยันสต็อกและแพ็กไม่ได้** | 409 · 422 |
| รีวิว | **รีวิวได้เฉพาะเล่มที่มีใบสถานะ `DELIVERED` ของตัวเอง** · หนึ่งรีวิวต่อ (ลูกค้า, เล่ม, ใบ) · คะแนน 1–5 · คำไม่เหมาะสม = ติดธงไม่ใช่ปฏิเสธ · `REMOVED` เป็นปลายทาง | 422 · 409 |
| โปรโมชั่น | ชื่อบังคับ · ส่วนลด > 0 และเปอร์เซ็นต์ไม่เกิน 100 · วันเริ่มไม่หลังวันสิ้นสุด · **ตั้งสถานะ EXPIRED เองไม่ได้** · ใบที่ถูกใช้แล้วลบไม่ได้ | 422 · 409 |

### ทรานแซกชัน

สี่ขั้นตอนนี้ครอบด้วยทรานแซกชันเดียว และล็อกแถวเอกสารด้วย `SELECT ... FOR UPDATE`
กันการยิงซ้อน (เช่นกดปุ่มรับสินค้าสองครั้งพร้อมกัน):

1. **U7 อนุมัติ** — อัปเดต PR + ออก PO + รายการ PO + แจ้งเตือน
2. **U9 รับสินค้า** — ออก GRN + เพิ่มจำนวนที่รับ + ปรับสถานะ PO + เคลื่อนไหวสต็อก + แจ้งเตือน
3. **U10 เปิดใบคืน** — ออกใบคืน + ตัดสต็อก + ปิด PO ถ้าคืนครบ
4. **U10 ชดเชย** — ล็อกแถวใบคืน + ปิดใบคืน + เพิ่มสต็อกคืนถ้าเป็นสินค้าทดแทน
5. **สมัครสมาชิก** — สร้าง `person` + `customer` + `user_account` สามแถวพร้อมกัน
6. **เพิ่มหนังสือ** — สร้าง `book` + `inventory_item` ยอด 0
7. **แก้ไขหนังสือ** — ล็อกแถวหนังสือ + ตรวจ ISBN ซ้ำ + เขียนประวัติทุกฟิลด์ที่เปลี่ยน
8. **ปรับยอดด้วยมือ** — ล็อกแถวสินค้าคงคลัง + ตรวจยอดติดลบทุกเล่ม + ออกรายการเคลื่อนไหว
9. **บันทึกรอบตรวจนับ** — ล็อกยอดคงเหลือ + ออกรอบ + เปิดรายงานผลต่าง + รายการที่นับ + แจ้งเตือน
10. **ตัดสินผลต่าง** — ล็อกรายงาน + บันทึกผล + ปรับยอดให้เท่าที่นับได้ถ้าอนุมัติ
11. **สั่งซื้อ** — ออกใบ + รายการ + timeline แถวแรก + แจ้งฝ่ายขาย
12. **เปลี่ยนสถานะคำสั่งซื้อ** — ล็อกหัวเอกสาร + ตรวจสต็อก + เขียนสถานะกับ timeline + แจ้งเตือน
    (ขั้นแพ็กตัดสต็อกเป็น `SALE_OUT` ในทรานแซกชันเดียวกัน)
13. **แนบสลิป / ตรวจสลิป** — ล็อกทั้งแถว `customer_order` และ `payment` แล้วเขียนพร้อมกัน
    การชำระเงินจึงไม่มีทางไม่ตรงกับสถานะของคำสั่งซื้อ
14. **บันทึกการจัดส่ง** — เปลี่ยนใบเป็น SHIPPED + เปิดแถว `shipment` + ประวัติสองแถว (PREPARING → SHIPPED)
15. **ยืนยันรับสินค้า** — ปิดใบเป็น DELIVERED + ปิดพัสดุ + เขียนประวัติ ในทรานแซกชันเดียว
16. **อัปเดตสถานะพัสดุ** — ล็อกหัวพัสดุ + เขียนสถานะกับประวัติ + แจ้งฝ่ายขายถ้าส่งไม่สำเร็จ
17. **สมัครสมาชิก (ต่อจากข้อ 5)** — เพิ่มแถว `member` เป็นแถวที่สี่ในทรานแซกชันเดียวกัน
18. **ยืนยันรับสินค้า (ต่อจากข้อ 15)** — ล็อกแถวสมาชิก + เติมแต้ม + เลื่อนระดับ ในทรานแซกชันเดียวกัน
19. **แลกของรางวัล** — ล็อกแถวสมาชิก + ตัดแต้ม + ออกรายการแต้ม + ออกใบแลก + เติมรหัสคูปอง
20. **ปรับแต้มด้วยมือ** — ล็อกแถวสมาชิก + หักแต้ม + เขียนรายการ EXPIRE/REVERSAL พร้อมเหตุผล
21. **เขียนรีวิว** — ตรวจใบที่ส่งถึงแล้ว + กันรีวิวซ้ำ + เขียนแถวรีวิว ในทรานแซกชันเดียว
    (ตรวจแล้วเขียนคนละคำสั่งกัน ถ้าไม่ครอบไว้ ลูกค้ากดสองครั้งพร้อมกันจะได้รีวิวซ้ำ)
22. **ตรวจสอบรีวิว** — ล็อกหัวรีวิว + เขียนสถานะ + **ปิดรายงานที่ยังค้างในทรานแซกชันเดียวกัน**
    (เผยแพร่ = รายงานไม่เป็นผล · ซ่อน/ลบ = รายงานเป็นผล)
23. **ตอบกลับรีวิว** — ล็อกหัวรีวิว + เพิ่มแถวคำตอบกลับ + ดันสถานะเป็น PUBLISHED
24. **รายงานรีวิว** — ล็อกหัวรีวิว + กันรายงานซ้ำ + ออกรายงาน + แจ้งผู้จัดการ
25. **U8 ยกเลิก PO** — ล็อกแถว PO + เปลี่ยนสถานะเป็น CANCELLED + แจ้งผู้จัดการ (ไม่คืนสต็อกที่รับแล้ว)
    — ดู deviation ข้อ 30/31

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

8. **`person` เป็นตารางแม่ แต่ `employee` ยังเก็บชื่อ/เบอร์/อีเมลซ้ำไว้** — class diagram วาง
   `Person <|-- Employee` และ `Person <|-- Customer` ไว้ · ทำเป็น class-table inheritance
   แบบ "เพิ่มพ่อ ไม่ย้ายลูก" เพราะ `employee_id` เป็น varchar PK ตามตาราง schema ที่ส่งไปแล้ว
   ถ้าย้ายคอลัมน์ออกต้องรื้อ auth, seed และ smoke ของ U1–U10 ที่ทำเสร็จแล้วทั้งชุด

9. **เพิ่มหนังสือใหม่ = เปิดแถว `inventory_item` ยอด 0 ให้ในทรานแซกชันเดียวกัน** — diagram ผูก
   `Book "1" *-- "1" InventoryItem` เป็น composition · ถ้าไม่สร้างคู่กัน หนังสือเล่มใหม่จะหายไปจาก
   หน้ายอดคงเหลือและจากการตรวจจุดสั่งซื้อของ U5 · ฝั่ง frontend แยกสองโมดูลจึงไม่ได้ทำข้อนี้

10. **`book_change_log.changed_by` เก็บ "ชื่อ" ไม่ใช่ FK ไปยังพนักงาน** — diagram วาดเส้น
    `SalesStaff "1" --> "*" BookChangeLog : records` ไว้แต่ไม่ระบุ attribute
    เก็บเป็นชื่อแบบเดียวกับ `supplier_edit_log.by` · **ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน**

11. **`Category` เป็นข้อมูลอ้างอิงอ่านอย่างเดียว** — diagram ไม่ได้ให้เมธอดจัดการหมวดหมู่ไว้
    และ `BookContext` ฝั่งหน้าจอก็อ่านอย่างเดียว จึงมีแค่ `GET /api/categories`

12. **`stock_count_item.report_id` · `stock_discrepancy_report.count_id` และ `.book_id`** —
    diagram เข้าถึงรายงานผ่าน `StockCountItem.reportId` ทางเดียว การให้รายงานถือรหัสรอบและ
    รหัสหนังสือไว้ด้วยทำให้หน้าจอ "ยอดหนังสือไม่ตรง" ไม่ต้องไล่ย้อนทุกรอบตรวจนับ

13. **`StockCountStatus` เป็น enum** — diagram พิมพ์ `status` ของ `StockCount` เป็น `string` เฉย ๆ
    (deviation แบบเดียวกับข้อ 3) · ค่าที่ระบบออกจริงมีแค่ `DRAFT` กับ `DONE`

14. **`StockLevel` กับ `LowStockThreshold` ไม่มีใน diagram** — เป็นเกณฑ์ของรายงาน
    "หนังสือใกล้หมด" ที่มาจาก activity diagram ของเจ้าของคลาส · **คนละเรื่องกับ `isBelowReorder()`**
    ซึ่งใช้จุดสั่งซื้อรายเล่มของ U5 · สองอันนี้ตอบคนละคำถาม ห้ามยุบรวมกัน

15. **ตารางคำสั่งซื้อลูกค้าชื่อ `customer_order` ไม่ใช่ `order`** — `ORDER` เป็นคำสงวนของ SQL
    ต้องใส่เครื่องหมายคำพูดทุกครั้งที่เขียน query ซึ่งพลาดง่ายมาก · ตารางลูกใช้คำนำหน้าเดียวกัน
    (`customer_order_item`, `customer_order_status_history`) · ชื่อคลาสใน Go ยังเป็น `Order` ตาม diagram

16. **`customer_order_item.book_id` เป็นตัวเลข ไม่ใช่ slug ของหน้าร้าน** — ยึด
    `OrderItem "*" --> "1" Book` ตาม class diagram ตรง ๆ · ตอนทำ P4 หน้าร้านยังเป็นไฟล์ static
    ที่คีย์ด้วย slug และคิดเงินเป็นดอลลาร์ `seed_order.go` จึงแปลงข้อมูลตั้งต้นให้
    **ตั้งแต่หน้าร้านอ่าน `/api/catalogue` แล้ว (4 ก.ย. 69) ทั้งสองฝั่งใช้ `book_id` กับบาทตรงกัน**
    การแปลงเหลืออยู่เฉพาะในข้อมูลตั้งต้นเก่า

17. **สต็อกถูกตัดตอน "แพ็กสินค้า" ไม่ใช่ตอน "ยืนยันสต็อก"** — diagram บอกแค่
    `Order ..> StockTransaction : SALE_OUT` ไม่ได้ระบุจังหวะ · ขั้นยืนยันสต็อกจึงเป็นการ**ตรวจ**ว่ามีของพอ
    ส่วนของออกจากคลังจริงตอนแพ็ก · ตารางการเปลี่ยนสถานะไม่ให้ยกเลิกใบที่แพ็กแล้ว
    จึงไม่มีเส้นทางที่ต้องคืนสต็อกกลับ

18. **โปรโมชั่นต้องระบุ `promotionId` มาเอง ระบบไม่เลือกให้อัตโนมัติ** — diagram ไม่ได้บอกว่าใครเลือก
    ใบที่ไม่เข้าเงื่อนไขจะได้ 422 ตรง ๆ แทนที่จะเงียบแล้วไม่ลดให้

19. **การตรวจสลิปไม่มี endpoint ของตัวเอง** — ใช้ `/orders/{id}/verify-payment` กับ `/reject-payment`
    ที่มีอยู่แล้ว เพราะเป็นเหตุการณ์เดียวกับการเปลี่ยนสถานะคำสั่งซื้อ · `order.slip_file_name` กับ
    `payment.slip_image_url` เก็บค่าเดียวกันโดยตั้งใจ (ตัวแรกเป็นสำเนาสำหรับหน้าจอตามสัญญาเดิม
    กับ frontend ตัวหลังเป็นค่าจริงของระบบย่อยนี้ เขียนพร้อมกันในทรานแซกชันเดียว) ·
    `PaymentReport` เก็บ **ผลลัพธ์** ลงเป็นแถว ไม่ได้คำนวณสดตอนเปิดดู (`generatedDate` ใน diagram)
    และนับจาก `verified_date` เพราะตอบคำถามว่า "รอบนี้ร้านรับเงินเข้ามาเท่าไร" ·
    (ทำครบแล้วใน P5)

21. **การเปิดพัสดุไม่มี endpoint ของตัวเอง เช่นเดียวกัน** — `POST /orders/{id}/ship` เปิดแถว `shipment`
    ในทรานแซกชันเดียวกับการเปลี่ยนสถานะ ตรงกับหน้าจอที่ส่ง `updateStatus(orderId,'SHIPPED',{tracking,carrier})`
    · พัสดุเดินสองก้าว PREPARING → SHIPPED ตอนบันทึก เพื่อให้ `record()` ของ class diagram
    (ที่กำหนดให้เริ่มที่ PREPARING) ยังเป็นจริง และประวัติเล่าเรื่องครบตั้งแต่เปิดรายการ ·
    **`DELIVERED` อัปเดตผ่าน `/shipments/{id}/tracking` ไม่ได้** (422 `DELIVER_VIA_ORDER`)
    เพราะต้องเขียนคู่กับ `customer_order` เสมอ · เส้นทาง tracking รับเฉพาะ `IN_TRANSIT` กับ `FAILED`
    ซึ่งเป็นสถานะที่คำสั่งซื้อไม่มีคู่ให้ตรงกัน (ใบที่พัสดุ `FAILED` ยังเป็น SHIPPED
    เพราะ OrderStatus ตาม diagram ไม่มีค่าสำหรับกรณีนี้)

20. **`user_account.status` เพิ่ม `UNVERIFIED`** — diagram ระบุแค่ ACTIVE/SUSPENDED
    แต่หน้าสมัครสมาชิกมีขั้นยืนยัน OTP จึงต้องมีสถานะระหว่างทาง · รหัส OTP โหมดพัฒนาเป็นค่าคงที่
    `model.DevOtpCode` เช่นเดียวกับที่การส่งอีเมลเป็นการจำลอง

22. **ลูกค้าที่สมัครสำเร็จเป็น `Member` ทันที** — diagram วาง `Customer <|-- Member` ไว้
    โดยไม่ได้บอกว่าใครกลายเป็นสมาชิกเมื่อไร · ในระบบนี้ลูกค้าเกิดจากการสมัครทางเดียว
    และหน้าสมัครก็เรียกตัวเองว่า "สมัครสมาชิก" อยู่แล้ว จึงเปิดแถว `member` ให้เป็นแถวที่สี่
    ในทรานแซกชันเดียวกับ `person` → `customer` → `user_account` (เริ่มที่ระดับต่ำสุด แต้ม 0)
    · ลูกค้าที่สมัครไว้ก่อน P7 ถูกตามเก็บด้วย `backfillMembers()` ใน `migrate.go`

23. **แต้มสะสมเกิดตอนคำสั่งซื้อเป็น `DELIVERED` ที่เดียว** — diagram บอกแค่
    `PointTransaction "*" --> "0..1" Order : from` ไม่ได้ระบุจังหวะ · เลือกขั้นรับสินค้าเพราะเป็น
    สถานะปลายทางที่ยกเลิกต่อไม่ได้ จึงไม่ต้องมีเส้นทางคืนแต้มเมื่อใบถูกยกเลิกภายหลัง ·
    แต้ม = `floor(netAmount × tier.pointRate)` คิดจากยอดหลังหักส่วนลด แล้วเลื่อนระดับตามยอดสะสมใหม่
    · การเพิ่มแต้มไม่มี endpoint ของตัวเอง (เหตุผลเดียวกับการตรวจสลิปในข้อ 19)

24. **`point_transaction.note` ไม่มีใน class diagram** — เพิ่มเพราะการหักแต้มด้วยมือของผู้จัดการ
    (`EXPIRE` / `REVERSAL`) ไม่มีเอกสารต้นทางให้ย้อนดูว่าทำไปทำไม · รูปแบบเดียวกับ `note` ของ
    `OrderStatusHistory` · **ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน** ·
    `membership_tier.point_rate` เป็น `numeric(12,4)` ไม่ใช่ `(12,2)` เหมือนคอลัมน์เงินอื่น
    เพราะอัตราอย่าง 0.015 จะถูกปัดเป็น 0.02 ถ้าเก็บแค่สองตำแหน่ง

25. **`review` เพิ่มสามคอลัมน์ที่ diagram ไม่มี** — `headline` (หน้าจอแสดงหัวข้อรีวิวแยกจากเนื้อ) ·
    `flagged` (ผลของ `ProfanityFilter` ตอนที่ลูกค้าส่งเข้ามา เก็บไว้เพราะรายการคำต้องห้ามเปลี่ยนได้
    แต่ผลที่พนักงานเห็นตอนตรวจต้องเป็นผลของตอนนั้น) · `review_reply.replied_by`
    (กติกาเดียวกับ `book_change_log.changed_by` — บันทึกว่าใครทำ) · **ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน**

26. **`review_report.status` แคบลงเป็น `ApprovalStatus`** — diagram พิมพ์เป็น `string` เฉย ๆ
    (deviation แบบเดียวกับ `StockCount.status`) · ค่าตรงกับ `managerStatus` ฝั่งหน้าจอพอดี
    **ความหมายยึดตาม `SEED_REVIEWS`**: `APPROVED` = รายงานเป็นผล รีวิวถูกซ่อนหรือลบ ·
    `REJECTED` = รายงานไม่เป็นผล รีวิวถูกเผยแพร่ · (`ReviewContext.tsx` เขียนตรงข้ามกับ seed
    ของตัวเอง จึงเลือกฝั่งที่อ่านแล้วสมเหตุสมผล) · การตัดสินไม่มี endpoint ของตัวเอง
    แต่เกิดพร้อมการ moderate เพื่อไม่ให้สถานะรีวิวกับผลรายงานไม่ตรงกัน (เหตุผลเดียวกับข้อ 19)

27. **รีวิวต้องมาจากคำสั่งซื้อที่ได้รับของแล้ว** — diagram วาง `Review "*" --> "0..1" Order`
    ไว้แบบไม่บังคับ · เส้นทาง API บังคับให้ต้องมีใบ `DELIVERED` ที่มีเล่มนั้น แล้วผูก `order_id`
    ให้เอง (= ป้าย "ซื้อสินค้าจริง" ของหน้าจอ) · คอลัมน์ยังเป็น nullable ตาม 0..1 เพราะ
    รีวิวเก่าที่นำเข้ามาไม่มีใบอ้างอิง (ดูข้อมูลตั้งต้น)

28. **`customer_order.customer_name` ไม่มีใน class diagram** — เพิ่มใน PR #11 (merge 5 ก.ย. 69)
    เพื่อเก็บชื่อผู้รับที่กรอกตอนเช็คเอาต์ ซึ่งอาจไม่ใช่ชื่อเจ้าของบัญชีที่ล็อกอิน (สั่งแทนคนอื่น) ·
    ต่างจาก `Shipment.RecipientName` ตรงที่ตัวนี้ผูกกับตัวคำสั่งซื้อเองตั้งแต่วางบิล ก่อนที่จะมีแถว
    `shipment` ด้วยซ้ำ (เปิดตอนแพ็กแล้วส่ง) · nullable ว่างได้ ตกกลับไปใช้ชื่อลูกค้าจากตาราง
    `customer`/`person` เหมือนเดิม · **ต้องตกลงกับเจ้าของคลาส (จิรพนธ์) ก่อนรวมงาน**

29. **ลบรีวิว (`DELETE /api/reviews/{id}`) เป็น hard delete จริง** — เพิ่มใน PR #11 (merge 5 ก.ย. 69)
    ลบทั้งแถว `review`, `review_reply`, `review_report` ที่เกี่ยวข้องออกจากฐานข้อมูล ต่างจาก
    `Review.moderate(REMOVE)` ที่มีอยู่แล้วซึ่งเป็น soft delete (`status = REMOVED`, กู้กลับไม่ได้
    แต่แถวยังอยู่ให้ตรวจสอบย้อนหลังได้) · เส้นทางนี้เจ้าของรีวิว (ลูกค้า) หรือผู้จัดการเรียกได้ ·
    **ผลคือรายงาน `review_report` ที่เคยมีของรีวิวนั้นหายไปพร้อมกัน ไม่เหลือ audit trail** —
    รับไว้ตามที่ผู้ใช้ตัดสินใจตอน merge แต่ **ต้องตกลงกับเจ้าของคลาส (ดวงกมล) ก่อนรวมงาน**
    ว่าจะให้ทั้งสองเส้นทางอยู่คู่กันแบบนี้ หรือยุบเหลือ soft delete เส้นเดียว

30. **`PurchaseOrder.Reject()` เป็นทางเข้า `CANCELLED` ของ U8 ด้วย ไม่ใช่แค่ U7** — diagram ให้
    `+reject()` ไว้สำหรับ PR ที่ยัง `PENDING_APPROVAL` แต่ในโฟลว์จริง `ApproveRequisition` ออก PO
    เป็น `APPROVED` ตรง ๆ เสมอ (ไม่ผ่าน `PENDING_APPROVAL` — ดู deviation ข้อ 5) เมธอดนี้จึงไม่เคย
    ถูกเรียกจริงมาก่อน · **ตรวจพบว่าถ้าผู้จัดจำหน่ายเลิกส่งกลางคัน (`RECEIVED_PARTIAL` ค้างตลอดไป)
    ไม่มีเส้นทางปิดใบเลย** ทำให้ `OutstandingOrderCount` (U3) นับใบนั้นเป็นคงค้างถาวรและปิดใช้งาน
    ผู้จัดจำหน่ายรายนั้นไม่ได้อีกต่อไป (ตรงกับ SCR-24 Abnormal ที่เขียนไว้ว่า "บางรายการหมด →
    ผู้จัดจำหน่ายแจ้งแก้ไข/ยกเลิกบางรายการ") · ใช้ `Reject()` เดิมแทนการเพิ่มเมธอดใหม่ (ยังคง
    `+reject()`/`+approve()` ตรงกับ class diagram ทั้งคู่) ขยาย guard ให้ยกเลิกได้จากทุกสถานะที่
    ยังไม่ปิดเอกสาร (`PENDING_APPROVAL`/`APPROVED`/`CONFIRMED`/`RECEIVED_PARTIAL`) ปิดไม่ได้เฉพาะใบ
    ที่ถึงจุดจบแล้ว (`RECEIVED_FULL`/`RETURNED`/`CANCELLED`) · เพิ่ม `POST /api/purchase-orders/{id}/cancel`
    · **ไม่คืนสต็อกที่รับเข้ามาแล้ว** เพราะของอยู่ในคลังจริง ไม่ใช่ของที่ต้องเคลียร์คืน

31. **ยอดผูกพันงบประมาณของใบ `CANCELLED` คิดจากจำนวนที่รับจริง (`received_qty`) ไม่ใช่ศูนย์** —
    ต่อเนื่องจากข้อ 30 · ถ้ายกเลิกใบที่รับของมาแล้วบางส่วนแล้วนับเป็น 0 ยอดผูกพันจะหายไปทั้งที่ของ
    ยังอยู่ในคลังและเป็นภาระงบประมาณจริง (`CommittedAmount` เดิมทำเป็นฟังก์ชัน Go ล้วนที่ข้าม
    `CANCELLED` ทั้งใบ — ย้ายไปเป็น SQL aggregate ที่ `PurchasingRepository.CommittedAmount` พร้อม
    `CASE` แยกสองกรณีนี้ในคำสั่งเดียว) · ข้อมูลตั้งต้นไม่มีใบ `CANCELLED` เลย ตัวเลขงบที่กรรมการเห็น
    จึงไม่เปลี่ยนจากเดิม

32. **`book` เพิ่มสองคอลัมน์เก็บรูปปกเป็น blob** — `cover_image` (`bytea`) กับ `cover_image_type`
    (`varchar(100)`) เพิ่มใน PR #18 (merge 6 ก.ย. 69) · class diagram มีแค่ attribute ตัวอักษรของ
    `Book` ไม่มีรูปปก · ทั้งคู่ nullable เล่มที่ยังไม่มีปกเป็น NULL · endpoint แยกกลุ่ม
    `GET /api/books/{id}/cover` (roleOffice, สตรีมไบต์ตรง ไม่ใช่ JSON) กับ
    `POST/PUT/DELETE /api/books/{id}/cover` (roleCatalogue, multipart `cover`/`file` ≤ 5 MB
    ตรวจชนิดด้วย `http.DetectContentType`) · `BookRepository.List`/`Find`/`FindForUpdate` ใส่
    `Omit("cover_image","cover_image_type")` กันโหลด blob ตอนอ่านรายการ — query อื่นที่ยังดึงทั้งแถว
    (`BooksByID` · `FindByISBN` · `Preload("Books.Book")` ของผู้จัดจำหน่าย · รีวิว) โหลด blob มาด้วย
    ยอมรับได้เพราะข้อมูลชุดสาธิตเล็ก · **`Book` เป็นคลาสของวุฒิภัทร ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน**

    **PR #21 (merge 6 ก.ย. 69) เพิ่มทางอ่านสาธารณะ `GET /api/catalogue/{id}/cover`** — หน้าร้าน
    ต้องเห็นรูปปกตั้งแต่ยังไม่ล็อกอิน จึงลงทะเบียนบน `mux` ตรง ๆ ในบล็อก "เปิดสาธารณะ" คู่กับ
    `/api/catalogue/*` เส้นอื่น (มี `TestCatalogueIsPublic` คุม ห้ามใส่ใน
    `TestProtectedRoutesRequireToken`) · **ต่างจากเส้นอื่นในกลุ่มตรงที่ไม่คัดตามสถานะการขาย** —
    ใช้ `BookService.GetCover` ตัวเดียวกับหลังร้าน ไม่ได้ผ่าน `CatalogueService` รูปปกของเล่มที่
    `INACTIVE` จึงยังโหลดได้ทั้งที่ `GET /api/catalogue/{id}` ตอบ 404 · ยอมรับไว้เพราะรูปปกไม่ใช่
    ข้อมูลที่ต้องปกปิด และหน้าติดตามคำสั่งซื้อต้องแสดงปกของเล่มที่ถูกปิดการขายไปแล้วได้
    · เปลี่ยน `Cache-Control` ของเส้น `/cover` จาก `public, max-age=3600` เป็น `no-store`
    เพราะฝ่ายขายเปลี่ยนรูปปกได้ตลอด · **ผลข้างเคียงที่ยอมรับไว้**: `<BookCover>` ยิงคำขอหนึ่งครั้ง
    ต่อเล่มต่อการเรนเดอร์ และไม่ผ่านตัวรวมคำขอ (`apiGetBlob` ไม่ได้ใช้ `inFlight` ของ `apiGet`)
    หน้าแคตตาล็อกจึงยิงเท่าจำนวนเล่มทุกครั้ง — เล็กพอสำหรับชุดสาธิต ถ้าข้อมูลโตต้องเปลี่ยนเป็น
    `no-cache` (ให้ revalidate ได้ 304) หรือฝัง URL ปกมากับ DTO ของแคตตาล็อกแทน
    · `cmd/import-covers` เป็นคำสั่งใช้ครั้งเดียวสำหรับย้ายไฟล์ปก 14 เล่มใน
    `frontend/src/assets/covers/` เข้าฐานข้อมูล — **รายชื่อในนั้นซ้ำกับ `frontend/src/data/covers.ts`
    ต้องแก้ทั้งสองที่ถ้าเพิ่มปกใหม่**

---

## ตรวจงาน

```bash
go build ./...             # ต้องสะอาด
go vet ./...               # ต้องสะอาด
test -z "$(gofmt -l .)"    # ต้องไม่มีไฟล์ขึ้นมา — gofmt -l คืน exit 0 เสมอ ต้องห่อด้วย test -z
go test ./...              # state machine · การคำนวณ · ข้อมูลตั้งต้น (ไม่ต้องมีฐานข้อมูล)
```

ตรวจกับฐานข้อมูลจริง:

```bash
go run ./cmd/api -migrate -seed   # หน้าต่างหนึ่ง
go run ./cmd/smoke                # อีกหน้าต่างหนึ่ง — ต้องได้ PASS ทุกเคส
```

ตรวจ schema ที่เกิดขึ้นจริง:

```sql
\dt                        -- ตารางตามเอกสาร
\dv                        -- warehouse_staff, store_manager, sales_staff, delivery_staff
\d purchase_order_item     -- PK ต้องเป็น (po_id, book_id)
SELECT status, count(*) FROM purchase_order GROUP BY status;
```

---

## ข้อมูลตั้งต้น

คนที่ clone โค้ดเวอร์ชันนี้สามารถสร้างข้อมูลสาธิตได้จาก Go โดยไม่ต้องนำ Docker volume
หรือไฟล์ฐานข้อมูลของผู้พัฒนาไปด้วย **clone อย่างเดียวยังไม่สร้างข้อมูล** ต้องรัน seed
กับ PostgreSQL ของตัวเองก่อน (คำสั่งต่อไปนี้รันในโฟลเดอร์ `backend` บน PowerShell):

```powershell
docker compose up -d db
# ใช้ค่าพอร์ตและรหัสผ่านเริ่มต้นของ Compose; ปรับหากตั้ง POSTGRES_PASSWORD เอง
$env:DATABASE_URL = 'postgres://bookstore:bookstore@127.0.0.1:5433/bookstore_t03?sslmode=disable'
go run ./cmd/api -migrate -seed -setup-only
go run ./cmd/api
```

ตรวจสอบ `DATABASE_URL` ก่อนรัน โดยเฉพาะถ้า `.env` เคยชี้ไปฐานข้อมูลร่วมของทีม
คำสั่งด้านบนกำหนด environment variable ให้ชี้ฐาน local แทน `.env` โดยไม่แก้ไฟล์เดิม
ตั้ง `JWT_SECRET` ของเครื่องตนเองสำหรับการใช้งานต่อเนื่องตามหัวข้อการตั้งค่า

สำหรับฐานใหม่ `seed_demo.go` เติมข้อมูลต่อจากชุดเดิมให้ครบทั้ง 44 ตาราง:

- หนังสือ 23 เล่ม / 6 หมวดหมู่ พร้อมคงคลัง ผู้จัดจำหน่าย 12 ราย และเอกสารจัดซื้อเดิม
- พนักงาน 4 บทบาท ลูกค้าและสมาชิก 3 ราย พร้อมตัวอย่างบัญชี active / unverified / suspended
- คำสั่งซื้อรวม 15 ใบ ครบ 11 สถานะและ 3 ช่องทาง พร้อมรายการสินค้าและประวัติสถานะ
- การชำระเงินครบ 4 สถานะ มีเหตุผลปฏิเสธ และรายงานยอดรับชำระที่คำนวณจากข้อมูลจริงในฐานสาธิต
- พัสดุพร้อมประวัติติดตาม ตัวอย่างส่งสำเร็จ/ล้มเหลว และสรุปจำนวนพัสดุรายวัน
- สมุดแต้มยอดยกมา การสะสมจากคำสั่งซื้อที่ส่งถึง และการแลกคูปอง/ของรางวัล โดยยอดแต้มตรงกับสมุดแต้ม
- ใบคืนสินค้า 3 สถานะ รอบตรวจนับและรายงานผลต่างรออนุมัติ/อนุมัติ/ปฏิเสธ
- ประวัติผู้จัดจำหน่าย รีวิว/คำตอบ/รายงาน และแจ้งเตือนสำหรับพนักงานทุกบทบาท

ข้อมูลเพิ่มเติมใช้วันที่อิงวัน seed ครั้งแรกเพื่อให้หน้ารายการล่าสุดมีข้อมูล
ยอดสต็อกตั้งต้นมีรายการยกมา ส่วนการแพ็กสินค้า ส่งคืน และอนุมัติผลต่างจะปรับยอดและบันทึกประวัติคู่กัน
ข้อมูลเก่าบางส่วนเป็น snapshot/ยอดยกมา ไม่ใช่ประวัติการดำเนินงานของร้านจริงทั้งหมด
ชื่อไฟล์สลิปและเลขพัสดุ `DEMO-*` เป็นตัวอย่าง ไม่ใช่หลักฐานโอนหรือเลขติดตามจริง
ช่อง email ในแจ้งเตือนบันทึกในฐานเท่านั้น ไม่ส่งอีเมลออกไป

บัญชีสาธิต: พนักงาน `warehouse@bookhaven.co.th`, `manager@bookhaven.co.th`,
`sales@bookhaven.co.th`, `delivery@bookhaven.co.th` ใช้รหัส `staff1234`;
ลูกค้าที่เข้าใช้งานได้ `napat@example.com` ใช้ `customer1234`.
**ใช้สำหรับพัฒนา/สาธิตเท่านั้น ห้ามเปิดข้อมูลและรหัสผ่านชุดนี้บน production**

ชุดเพิ่มเติมทำงานเฉพาะเมื่อทุกตารางธุรกิจยังว่างก่อนเริ่ม seed
(ยกเว้นหมวดหมู่ ขนส่ง และระดับสมาชิกที่ migration อาจเติมไว้ก่อน)
ฐานเดิมหรือฐานที่มีข้อมูลบางส่วนจะข้ามชุดเพิ่มเติม เพื่อไม่ผสมเอกสารตัวอย่างกับข้อมูลผู้ใช้
รันซ้ำไม่เพิ่มแถวซ้ำ ไม่เปลี่ยนราคา/ยอดคงเหลือ/แต้ม/สถานะที่แก้ไว้ และไม่รีเซ็ตวันที่ตัวอย่าง
หากต้องการทดลองใหม่ ให้สร้างฐานข้อมูลใหม่แยกต่างหากแล้วเปลี่ยน `DATABASE_URL`;
ไม่จำเป็นต้องลบ volume หรือฐานเดิม การ seed อยู่ใน transaction เดียว และย้อนกลับทั้งชุดเมื่อเกิดข้อผิดพลาด
ควรหยุด API ของฐานเป้าหมายก่อนทำ migration/seed

### ทดสอบ seed

```powershell
# ใช้ฐาน PostgreSQL local สำหรับทดสอบเท่านั้น; test สร้าง/ลบเฉพาะ schema ชั่วคราวของตัวเอง
$env:SEED_TEST_DATABASE_URL = 'postgres://bookstore:bookstore@127.0.0.1:5433/bookstore_t03?sslmode=disable'
go test ./internal/database -run TestDemo -count=1 -v
go test ./...
go vet ./...
```

หากไม่ตั้ง `SEED_TEST_DATABASE_URL` ชุด integration test จะถูกข้าม (unit test ยังทำงาน)
ทดสอบความครบทุกตาราง ความสัมพันธ์ยอดเงิน/แต้ม/สต็อก ประวัติสถานะ การรันซ้ำ
การรักษาข้อมูลที่ผู้ใช้แก้ การข้ามฐานที่มีข้อมูลบางส่วน เลขเอกสารถัดไป
และจำลองความล้มเหลวกลาง transaction เพื่อยืนยันว่าไม่เหลือข้อมูลครึ่งชุด

### แหล่งข้อมูลตั้งต้นเดิม

`internal/database/seed_data.go` ถูก **สร้างด้วยสคริปต์** `tools/gen_seed.py` จาก `SEED_*` ของ frontend
(หมวดหมู่ 6 · หนังสือ 23 เล่ม · ประวัติการแก้ไข 1 · ผู้จัดจำหน่าย 12 ราย · PR 3 ใบ · PO 10 ใบ · GRN 1 ใบ)
เพื่อให้ backend กับหน้าจอเห็นข้อมูลชุดเดียวกันตอนต่อ API — อย่าแก้ไฟล์นั้นด้วยมือ
ให้แก้ที่ frontend แล้วสั่ง `python tools/gen_seed.py` สร้างใหม่

`seed_inventory.go` (การเคลื่อนไหวสต็อก) · `seed_person.go` (พนักงาน + ลูกค้า) · `seed_order.go`
(คำสั่งซื้อพร้อมแถวการชำระเงินและพัสดุ) · `seed_payment.go` (บัญชีธนาคาร 3 แห่ง) ·
`seed_delivery.go` (บริษัทขนส่ง 5 แห่ง) · `seed_membership.go` (ระดับสมาชิก 3 · ของรางวัล 5 · สมาชิก 3) ·
`seed_review.go` (รีวิว 5 ชิ้น ครบทั้งสี่สถานะ พร้อมคำตอบกลับและรายงาน) **เขียนด้วยมือ**
เพราะ frontend ไม่มีข้อมูลตั้งต้นให้ · `seed_data_test.go` ตรวจว่าไฟล์ที่สคริปต์สร้างยังครบและ FK ชี้ถูกที่

รีวิวตั้งต้นมีแถวเดียวที่ผูกใบสั่งซื้อ (SO-1003 ในชุดข้อมูลเดิม)
อีกสี่แถวเป็น **รีวิวเก่าที่นำเข้ามา** จึงไม่มี `order_id` ตามที่ diagram อนุญาต (0..1) ·
`SEED_REVIEWS` ของ frontend เอามาใช้ตรง ๆ ไม่ได้เพราะอ้าง slug ของหน้าร้านและลูกค้าสมมติ
ที่ไม่มีในตาราง `customer`

การใส่พนักงานต้องสร้างแถว `person` ให้เองก่อนแล้วผูก `person_id` (`seedEmployeeRows`) เพราะคอลัมน์นั้น
เป็น NOT NULL + unique ตั้งแต่ P1 · `backfillPersons()` ใน `migrate.go` ช่วยได้เฉพาะฐานที่มีพนักงาน
อยู่ก่อนแล้ว ไม่ใช่ฐานเปล่า

`Seed()` ตรวจความว่าง **เป็นรายตาราง** ตารางที่มีข้อมูลแล้วจะถูกข้าม จึงสั่งซ้ำได้เรื่อย ๆ
หากต้องการชุดใหม่ให้ใช้ฐานข้อมูลใหม่แยกจากฐานเดิม · ปิดท้ายด้วยการเลื่อน sequence ให้เลขเอกสารใหม่
เริ่มต่อจากข้อมูลตั้งต้น (ผู้จัดจำหน่าย 1–12 · หนังสือ 101–123 · PR 101+ · PO 2380+ · GRN 5001+)

---

## นอกขอบเขต

- การส่งอีเมลจริง — บันทึกลงตาราง `notification` ช่อง `email` ไว้ให้ SCR-27 แสดงเส้นทางเอกสาร
  แต่ไม่ได้ส่งออกไปจริง (เหมือนที่ frontend ทำ)
- การเก็บไฟล์แนบ — หลักฐานการส่งคืนเก็บเป็น data URL ในคอลัมน์ `text`
- deploy / CI — รันบนเครื่องกับ Pi เท่านั้น

> **การต่อ frontend เข้ากับ API ไม่ใช่ของนอกขอบเขตอีกแล้ว** — ทำเสร็จเมื่อ 2 ก.ย. 69
> ทุกหน้าจอใน `../frontend/` อ่าน/เขียนผ่าน REST ลง PostgreSQL แล้ว
