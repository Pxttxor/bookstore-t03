// money.ts — การจัดรูปแบบเงินของทั้งแอป ที่เดียว
//
// ทุกจำนวนเงินในระบบเป็น **บาท** เพราะมาจากคอลัมน์ numeric(12,2) ของ PostgreSQL
// (`book.price` · `customer_order.net_amount` · `purchase_order_item.unit_price`)
//
// เดิมมีตัวจัดรูปแบบสามตัวที่ทำเรื่องเดียวกัน: `formatBaht` ของฝั่งจัดซื้อ ·
// `formatPriceBaht` ของฝั่งข้อมูลหนังสือ · และ `formatPrice` ของหน้าร้านที่เติม `$`
// ให้ตัวเลขบาท ทำให้หนังสือเล่มเดียวอ่านได้ ฿438 ที่หลังร้านแต่ $438.00 หลังสั่งซื้อ
// ตอนนี้ทั้งสามตัวมาจากไฟล์นี้ตัวเดียว

/** ตัวเลขล้วน ไม่มีสัญลักษณ์ — ใช้ในตารางที่หัวคอลัมน์บอกหน่วยไว้แล้ว */
export function formatBaht(amount: number): string {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** จำนวนเงินพร้อมสัญลักษณ์ — ใช้ตรงที่ไม่มีหัวคอลัมน์บอกหน่วย เช่น การ์ดหนังสือหน้าร้าน */
export function formatPrice(amount: number): string {
  return `฿${formatBaht(amount)}`
}
