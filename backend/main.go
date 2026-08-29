// main.go — เดโมการใช้งานโมเดล เดินตาม flow จัดซื้อจริง:
//
//	ขึ้นทะเบียนผู้จัดจำหน่าย → ทำใบขอสั่งซื้อ (PR) → ออกใบสั่งซื้อ (PO) → อนุมัติ+ยืนยัน
//	→ รับสินค้าเข้าคลัง (สร้างรายการสต็อก) → ส่งคืนสินค้าที่ชำรุด
//
// รัน: go run .   (จากโฟลเดอร์ backend)
package main

import (
	"fmt"
	"time"

	"bookstore-t03/model"
)

func main() {
	// ───────── ระบบย่อยที่ 1: ขึ้นทะเบียนผู้จัดจำหน่าย ─────────
	supplier := &model.Supplier{
		SupplierID:  1,
		CompanyName: "สำนักพิมพ์ตัวอย่าง จำกัด",
		ContactName: "คุณสมชาย ใจดี",
		Phone:       "021234567",
		Email:       "contact@example-pub.co.th",
		Address:     "กรุงเทพมหานคร",
		TradeTerms:  "ส่งฟรีเมื่อสั่งเกิน 50 เล่ม",
		CreditTerms: "เครดิต 30 วัน",
	}
	supplier.Register()

	book := model.Book{
		BookID: 101, ISBN: "978-616-000-000-1", Title: "เรียน Go ให้สนุก",
		Author: "ธนวัฒน์ ศรีสุข", Publisher: "สำนักพิมพ์ตัวอย่าง", Price: 350,
		Status: model.BookStatusActive,
	}
	supplier.Books = append(supplier.Books, model.SupplierBook{
		BookID: book.BookID, SupplyPrice: 250, LeadTimeDays: 7,
	})
	fmt.Printf("ผู้จัดจำหน่าย: %s | สถานะ: %s | ขายหนังสือ %d รายการ\n",
		supplier.CompanyName, supplier.Status, len(supplier.Books))

	// ───────── ระบบย่อยที่ 2: ทำใบขอสั่งซื้อ (PR) ─────────
	warehouse := &model.WarehouseStaff{StaffID: 10, Name: "พนักงานคลัง A"}
	manager := &model.StoreManager{StaffID: 20, Name: "ผู้จัดการ B"}

	pr := &model.PurchaseRequisition{
		PRID:             500,
		CreatedDate:      time.Now(),
		Status:           model.PRStatusDraft,
		CreatedByStaffID: warehouse.StaffID,
		Items: []model.PurchaseRequisitionItem{
			{BookID: book.BookID, Quantity: 100, UnitPrice: 250},
		},
	}
	must(pr.Submit())
	must(pr.Approve())
	fmt.Printf("ใบขอสั่งซื้อ PR-%d | สถานะ: %s\n", pr.PRID, pr.Status)

	// ───────── ออกใบสั่งซื้อ (PO) อ้างอิงจาก PR ─────────
	po := &model.PurchaseOrder{
		POID:                 700,
		OrderDate:            time.Now(),
		ExpectedDeliveryDate: time.Now().AddDate(0, 0, 7),
		Status:               model.POStatusPendingApproval,
		SupplierID:           supplier.SupplierID,
		RequisitionID:        pr.PRID,
		Items: []model.PurchaseOrderItem{
			{BookID: book.BookID, Quantity: 100, UnitPrice: 250},
		},
	}
	po.RecalculateTotal()
	fmt.Printf("ใบสั่งซื้อ PO-%d | ยอดรวม: %.2f บาท | สถานะ: %s\n",
		po.POID, po.TotalAmount, po.Status)

	// ───────── ผู้จัดการอนุมัติ แล้วผู้จัดจำหน่ายยืนยัน ─────────
	must(manager.ApprovePO(po))
	must(po.Confirm())
	fmt.Printf("หลังอนุมัติ+ยืนยัน PO-%d | ผู้อนุมัติ: %d | สถานะ: %s\n",
		po.POID, po.ApprovedByManagerID, po.Status)

	// ───────── รับสินค้าเข้าคลัง (สั่ง 100 รับ 98 ชำรุด 2) ─────────
	gr := &model.GoodsReceipt{
		GRID:         900,
		POID:         po.POID,
		ReceivedDate: time.Now(),
		Status:       "RECEIVED",
		Items: []model.GoodsReceiptItem{
			{BookID: book.BookID, OrderedQty: 100, ReceivedQty: 98, Condition: "ดี"},
		},
	}
	txns := warehouse.ReceiveGoods(po, gr)
	fmt.Printf("รับสินค้า GR-%d | สร้างรายการสต็อก %d รายการ | สถานะ PO: %s\n",
		gr.GRID, len(txns), po.Status)
	for _, t := range txns {
		fmt.Printf("   • %s จำนวน %d (%s)\n", t.Type, t.QuantityChange, t.ReferenceDoc)
	}

	// ───────── ส่งคืนสินค้าที่ชำรุด ─────────
	ret := &model.PurchaseReturn{
		ReturnID:   1000,
		POID:       po.POID,
		ReturnDate: time.Now(),
		Reason:     "หนังสือชำรุดจากการขนส่ง",
		Status:     "SUBMITTED",
		Items: []model.PurchaseReturnItem{
			{BookID: book.BookID, Quantity: 2, Reason: "ปกฉีก"},
		},
	}
	fmt.Printf("ใบส่งคืน RT-%d | เหตุผล: %s | จำนวนรายการ: %d\n",
		ret.ReturnID, ret.Reason, len(ret.Items))
}

// must หยุดโปรแกรมพร้อมแจ้ง error ถ้า transition ในเดโมล้มเหลว (ใช้เฉพาะในเดโม)
func must(err error) {
	if err != nil {
		panic(err)
	}
}
