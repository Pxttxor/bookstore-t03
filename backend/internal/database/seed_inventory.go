// seed_inventory.go — ข้อมูลตั้งต้นของสินค้าคงคลัง (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// ต่างจาก seed_data.go ที่สร้างจาก SEED_* ของ frontend ด้วย tools/gen_seed.py
// ย้ายมาอยู่ที่นี่เพราะ SEED_STOCK_TRANSACTIONS ฝั่ง frontend ถูกลบจนเหลือ [] แล้ว
// ถ้ายังให้สคริปต์สร้างต่อ การรัน gen_seed.py ซ้ำจะลบข้อมูลแปดแถวนี้ทิ้งเงียบ ๆ
//
// ประวัติยกมาก่อนเปิดระบบ ใช้ LEGACY-* เพื่อไม่ชนกับเอกสารสาธิตที่สร้างใหม่
package database

import "bookstore-t03/internal/model"

// seedStockTransactions — ประวัติการเคลื่อนไหวสต็อกที่ทำให้ยอดคงเหลือใน seedInventory สมเหตุสมผล
var seedStockTransactions = []model.StockTransaction{
	{TxnID: 1, BookID: 101, Type: model.StockTxnType("RECEIVE_IN"), QuantityChange: 40, Reason: "รับสินค้าเข้าคลัง", ReferenceDoc: "PO-2401", TxnDate: mustTime("2026-07-08T03:10:00.000Z")},
	{TxnID: 2, BookID: 101, Type: model.StockTxnType("SALE_OUT"), QuantityChange: -37, Reason: "ตัดขายยกมาจากก่อนเปิดระบบ", ReferenceDoc: "LEGACY-SO-1001", TxnDate: mustTime("2026-07-21T07:45:00.000Z")},
	{TxnID: 3, BookID: 104, Type: model.StockTxnType("RECEIVE_IN"), QuantityChange: 20, Reason: "รับสินค้าเข้าคลัง", ReferenceDoc: "PO-2410", TxnDate: mustTime("2026-07-11T04:20:00.000Z")},
	{TxnID: 4, BookID: 104, Type: model.StockTxnType("SALE_OUT"), QuantityChange: -20, Reason: "ตัดขายยกมาจากก่อนเปิดระบบ", ReferenceDoc: "LEGACY-SO-1003", TxnDate: mustTime("2026-07-28T06:05:00.000Z")},
	{TxnID: 5, BookID: 106, Type: model.StockTxnType("RECEIVE_IN"), QuantityChange: 50, Reason: "รับสินค้าเข้าคลัง", ReferenceDoc: "PO-2418", TxnDate: mustTime("2026-07-15T02:30:00.000Z")},
	{TxnID: 6, BookID: 106, Type: model.StockTxnType("ADJUSTMENT"), QuantityChange: -8, Reason: "ปรับปรุงยอดตามผลการตรวจนับเดิม", ReferenceDoc: "LEGACY-DR001", TxnDate: mustTime("2026-07-31T09:00:00.000Z")},
	{TxnID: 7, BookID: 112, Type: model.StockTxnType("RETURN"), QuantityChange: -3, Reason: "ส่งคืนสินค้าชำรุด", ReferenceDoc: "PO-2422", TxnDate: mustTime("2026-07-19T08:15:00.000Z")},
	{TxnID: 8, BookID: 119, Type: model.StockTxnType("ADJUSTMENT"), QuantityChange: -2, Reason: "ปรับปรุงยอดตามผลการตรวจนับเดิม", ReferenceDoc: "LEGACY-DR002", TxnDate: mustTime("2026-07-31T09:05:00.000Z")},
}
