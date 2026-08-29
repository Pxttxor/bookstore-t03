// document.go — ตัวช่วยเกี่ยวกับเอกสารจัดซื้อที่หลายเลเยอร์ใช้ร่วมกัน
// รูปแบบรหัสเอกสารตรงกับ formatPRCode/formatPOCode/formatGRCode/formatReturnCode ฝั่ง frontend
package model

import "fmt"

// PurchaseBudget — งบประมาณจัดซื้อประจำงวด ใช้เตือน "เกินงบประมาณ" ตอนอนุมัติ (U7 / SCR-23)
//
// Figma spec แสดงตัวเลขงบไว้แต่ไม่ได้บอกที่มา · ค่านี้ตรงกับ PURCHASE_BUDGET ฝั่ง frontend
// ซึ่งเลือก 500,000 เพราะทำให้ตัวอย่างในสเปก (เหลือ ฿340,000 = 68%) ออกมาตรง
const PurchaseBudget float64 = 500000

func FormatSupplierCode(supplierID int) string { return fmt.Sprintf("SUP%02d", supplierID) }
func FormatPRCode(prID int) string             { return fmt.Sprintf("PR-%d", prID) }
func FormatPOCode(poID int) string             { return fmt.Sprintf("PO-%d", poID) }
func FormatGRCode(grID int) string             { return fmt.Sprintf("GR-%d", grID) }
func FormatReturnCode(returnID int) string     { return fmt.Sprintf("RT-%d", returnID) }

// Line — อะไรก็ได้ที่มีจำนวนและราคาต่อหน่วย ใช้คิดยอดรวมเอกสาร
type Line interface {
	LineQuantity() int
	LineUnitPrice() float64
}

func (i PurchaseRequisitionItem) LineQuantity() int      { return i.Quantity }
func (i PurchaseRequisitionItem) LineUnitPrice() float64 { return i.UnitPrice }
func (i PurchaseOrderItem) LineQuantity() int            { return i.Quantity }
func (i PurchaseOrderItem) LineUnitPrice() float64       { return i.UnitPrice }

// DocumentTotal — ยอดรวมของเอกสาร (Σ จำนวน × ราคาต่อหน่วย)
func DocumentTotal[T Line](lines []T) float64 {
	var total float64
	for _, line := range lines {
		total += float64(line.LineQuantity()) * line.LineUnitPrice()
	}
	return total
}

// CommittedAmount — ยอดผูกพันจากใบสั่งซื้อที่ยังไม่ถูกยกเลิก ใช้คิดงบคงเหลือบน SCR-23
func CommittedAmount(orders []PurchaseOrder) float64 {
	var total float64
	for _, po := range orders {
		if po.Status == POStatusCancelled {
			continue
		}
		total += DocumentTotal(po.Items)
	}
	return total
}
