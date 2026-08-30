// seed_payment.go — บัญชีธนาคารตั้งต้น (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// ระบบย่อยตรวจสอบการชำระเงินไม่มีหน้าจอฝั่ง frontend ให้สคริปต์อ่าน
// (frontend/CLAUDE.md ระบุว่าคำสั่งซื้อของหน้าร้าน "ไม่แตะระบบย่อย Payment")
// จึงเขียนข้อมูลอ้างอิงชุดนี้ขึ้นเอง — เลขบัญชีเป็นตัวอย่างสำหรับงานวิชา ไม่ใช่บัญชีจริง
package database

import "bookstore-t03/internal/model"

// seedBanks — บัญชีที่ร้านเปิดรับโอน (Payment "*" --> "0..1" Bank : via)
var seedBanks = []model.Bank{
	{BankID: 1, Name: "ธนาคารกสิกรไทย", AccountNo: "123-4-56789-0"},
	{BankID: 2, Name: "ธนาคารไทยพาณิชย์", AccountNo: "234-5-67890-1"},
	{BankID: 3, Name: "ธนาคารกรุงเทพ", AccountNo: "345-6-78901-2"},
}
