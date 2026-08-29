# Entity/Model (Go) — จิรพนธ์ อยู่หลาย (B6708429)

Source Code ส่วน Entity/Model ของ 2 ระบบย่อย ในวิชา **ENG23 3031** ทีม T03 แปลงจาก class diagram ระดับ Analysis

- ระบบย่อยที่ 1: **จัดการคำสั่งซื้อลูกค้า** (Order)
- ระบบย่อยที่ 2: **จัดการโปรโมชั่นและส่วนลด** (Promotion)

## วิธีรัน
```bash
cd B6708429-jiraphon
go run .          # รันเดโม
go build ./...    # คอมไพล์
go vet ./...      # ตรวจ static
```

## ตารางแม็ป คลาส → struct (Go)

| คลาสใน diagram | ไทย | struct/type | ไฟล์ |
|---|---|---|---|
| `Order` | คำสั่งซื้อ | `model.Order` | order.go |
| `OrderItem` | รายการสินค้าในคำสั่งซื้อ | `model.OrderItem` | order.go |
| `OrderStatusHistory` | ไทม์ไลน์สถานะคำสั่งซื้อ | `model.OrderStatusHistory` | order.go |
| `OrderChannel` / `OrderStatus` | enum | `model.OrderChannel` / `model.OrderStatus` | order.go |
| `Promotion` | โปรโมชั่น | `model.Promotion` | promotion.go |
| `PromotionType` / `PromotionStatus` | enum | `model.PromotionType` / `model.PromotionStatus` | promotion.go |
| `Book` / `Customer` / คลาสบุคคล | คลาสข้ามระบบ | ดู `shared.go` | shared.go (เจ้าของ: วุฒิภัทร ฯลฯ) |

## หมายเหตุ
- ค่า enum เป็นอังกฤษ SCREAMING_SNAKE ตรงตาม diagram; ป้ายไทยอยู่ใน `labels.go`
- `decimal→float64`, `date/datetime→time.Time`; composition = ฝัง slice, association = FK id
- คลาสที่ diagram อ้างถึงแต่ใช้ผ่าน id (Payment/Shipment/PointTransaction/Review) เก็บเป็น FK int ไม่ประกาศ struct
