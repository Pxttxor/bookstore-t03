# BookHaven

ส่วนติดต่อผู้ใช้ของระบบร้านขายหนังสือออนไลน์ วิชา ENG23 3031 System Analysis and Design ทีม T03

ประกอบด้วยสองฝั่ง

- **หน้าร้าน** สำหรับลูกค้า: หน้าแรก/แคตตาล็อก, รายละเอียดหนังสือ, ชำระเงิน, ติดตามคำสั่งซื้อ, สมัครสมาชิก/เข้าสู่ระบบ, โปรไฟล์
- **หลังร้าน** (`/admin`) สำหรับพนักงาน: ระบบจัดการข้อมูลผู้จัดจำหน่าย (U1–U4) และระบบจัดซื้อจากผู้จัดจำหน่าย
  (U5–U10)

ยังไม่มี backend ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์

## เทคโนโลยี

Vite 8 · React 19 · TypeScript · React Router 7 · CSS ธรรมดา (ตัวแปรสีอยู่ใน `src/index.css`)

## คำสั่ง

```bash
npm install
npm run dev      # เปิดที่ http://localhost:5173
npm run build    # ตรวจ type แล้ว build ลง dist/
npm run lint
```

## บัญชีสำหรับทดสอบ

พนักงานสมัครเองไม่ได้ ระบบใส่บัญชีเริ่มต้นให้ตอนเปิดครั้งแรก รหัสผ่านทั้งหมดคือ `staff1234`

| อีเมล | ตำแหน่ง | ผู้จัดจำหน่าย | จัดซื้อ |
|---|---|---|---|
| warehouse@bookhaven.co.th | พนักงานคลังสินค้า | ดู เพิ่ม แก้ไข | แจ้งเตือน, สร้าง PR, ส่ง PO, รับสินค้า, ส่งคืน |
| manager@bookhaven.co.th | ผู้จัดการร้าน | ดู ปิดใช้งาน | อนุมัติ/ตีกลับ + ดูงบประมาณ |
| sales@bookhaven.co.th | พนักงานฝ่ายขาย | ดูอย่างเดียว | ไม่มีสิทธิ์ (เห็นเฉพาะทำเนียบผู้ติดต่อ) |
| delivery@bookhaven.co.th | พนักงานจัดส่ง | ไม่มีสิทธิ์ เมนูถูกปิด | ไม่มีสิทธิ์ |

ลูกค้าให้กด "Create account" ที่หน้า `/signup` เพื่อสมัครใหม่

เข้าสู่ระบบด้วยบัญชีพนักงานแล้วระบบจะพาไป `/admin` ให้อัตโนมัติ ส่วนบัญชีลูกค้าจะกลับไปหน้าร้าน

## โครงไฟล์

```
src/
  admin/            หลังร้าน
    AdminLayout     กรอบหน้า (แถบบน + เมนูข้าง) พร้อมตรวจสิทธิ์และ provider ทั้งหมด
    components/     แถบบน เมนูข้าง breadcrumb badge modal toast pagination
                    stepper รายการสินค้า meter stat tile contact card กระดิ่งแจ้งเตือน
    pages/          หน้าจอหลังร้านทั้งหมด (ดูตารางเส้นทางด้านล่าง)
    suppliers/      ชนิดข้อมูลและ state ของผู้จัดจำหน่าย
    purchasing/     ชนิดข้อมูลและ state machine ของ PR/PO/GRN/ใบส่งคืน
    inventory/      สินค้าคงคลังและรายการเคลื่อนไหวสต็อก
    notifications/  การแจ้งเตือนในระบบและสำเนาอีเมล (จำลอง)
    permissions.ts  กฎสิทธิ์ตามตำแหน่งงาน
  auth/             บัญชีผู้ใช้และตำแหน่งงาน
  cart/             ตะกร้าสินค้าของหน้าร้าน
  components/       ส่วนประกอบที่ใช้ร่วมกัน
  layouts/          กรอบหน้าร้านและหน้าเข้าสู่ระบบ
  pages/            หน้าจอฝั่งลูกค้า
```

### เส้นทางฝั่งหลังร้าน

Figma spec ไม่ได้กำหนด URL ไว้ เส้นทางเหล่านี้อ้างอิงผังเว็บไซต์ในหัวข้อ 5 ของ spec

| เส้นทาง | หน้าจอ |
|---|---|
| `/admin` | SCR-01 หน้าหลัก (แสดงตามตำแหน่งงาน) |
| `/admin/suppliers` · `/new` · `/:id` · `/:id/edit` | SCR-10 / 12 / 11 / 13 |
| `/admin/alerts` | SCR-20 แจ้งเตือนสินค้าถึงจุดสั่งซื้อ (U5) |
| `/admin/purchasing` | SCR-22 เอกสารจัดซื้อ (ศูนย์รวม) |
| `/admin/purchasing/pr/new` · `/pr/:id` | SCR-21 ใบขอสั่งซื้อ (U6) |
| `/admin/purchasing/pr/:id/approve` | SCR-23 อนุมัติใบสั่งซื้อ (U7 · ผจก. เท่านั้น) |
| `/admin/purchasing/po/:id` | SCR-24 ใบสั่งซื้อ + ส่ง/ยืนยัน (U8) |
| `/admin/purchasing/receipts` · `/po/:id/receive` | SCR-25 รับสินค้าเข้าคลัง (U9) |
| `/admin/purchasing/returns/new` · `/returns/:id` | SCR-26 ส่งคืนสินค้า (U10) |
| `/admin/contacts` | SCR-27 ศูนย์การติดต่อ |

ชื่อชนิดข้อมูลใน `src/admin/suppliers/suppliers.ts` (`Supplier`, `SupplierBook`, `SupplierStatus`)
และ `src/admin/purchasing/purchasing.ts` (`PurchaseRequisition`, `PurchaseOrder`, `GoodsReceipt`,
`PurchaseReturn`, `PRStatus`, `POStatus`) ตั้งตาม Class Diagram ระดับ Analysis ของทีม

## หมายเหตุ

- ใบสั่งซื้อย้ายไปอยู่ในระบบจัดซื้อ ไม่ได้ฝังอยู่ใน `Supplier` แล้ว หน้า SCR-11 และ SCR-14
  อ่านผ่าน `usePurchasing().ordersForSupplier()`
- คีย์ localStorage มีเลขเวอร์ชัน (`bookhaven.suppliers.v2`, `bookhaven.purchasing.v1`,
  `bookhaven.inventory.v1`, `bookhaven.notifications.v1`) ถ้าโครงสร้างข้อมูลเปลี่ยนให้ขึ้นเวอร์ชันใหม่
  แทนการเขียน migration
- อีเมลเป็นการจำลอง ระบบบันทึกไว้ให้ดูในแท็บ "การแจ้งเตือน" ของ SCR-27 เท่านั้น ไม่ได้ส่งจริง
- หน้าฝั่งผู้จัดจำหน่าย (SCR-30) เป็นทางเลือกใน spec โปรเจกต์นี้ไม่ได้ทำ พนักงานคลังกรอกสถานะ
  "ยืนยันแล้ว" และกำหนดวันส่งเองที่ SCR-24

ข้อตกลงการเขียนโค้ด: ชื่อคลาส/attribute/enum เป็นภาษาอังกฤษ · ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย (คัดจาก Figma UI spec)
ลำดับความสำคัญของเอกสารอ้างอิง: Class diagram → Figma UI spec → Activity diagrams
