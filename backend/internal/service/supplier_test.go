package service

import (
	"testing"

	"bookstore-t03/internal/model"
)

// describeChanges ต้องจับการแก้ราคาส่ง/lead time ของหนังสือ ไม่ใช่แค่จำนวนเล่มที่เปลี่ยน
func TestDescribeChangesDetectsBookEdits(t *testing.T) {
	base := func() *model.Supplier {
		return &model.Supplier{
			ContactName: "ก",
			Books: []model.SupplierBook{
				{BookID: 101, SupplyPrice: 200, LeadTimeDays: 7},
				{BookID: 102, SupplyPrice: 250, LeadTimeDays: 10},
			},
		}
	}

	tests := []struct {
		name    string
		mutate  func(*model.Supplier)
		wantHit bool
	}{
		{"ไม่เปลี่ยนอะไร", func(*model.Supplier) {}, false},
		{"แก้ราคาส่ง จำนวนเล่มเท่าเดิม", func(s *model.Supplier) { s.Books[0].SupplyPrice = 210 }, true},
		{"แก้ lead time", func(s *model.Supplier) { s.Books[1].LeadTimeDays = 12 }, true},
		{"เพิ่มเล่ม", func(s *model.Supplier) {
			s.Books = append(s.Books, model.SupplierBook{BookID: 103, SupplyPrice: 100, LeadTimeDays: 5})
		}, true},
		{"สลับ bookId", func(s *model.Supplier) { s.Books[0].BookID = 999 }, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before, after := base(), base()
			tt.mutate(after)
			got := describeChanges(before, after)
			hit := got != "บันทึกข้อมูลโดยไม่มีการเปลี่ยนแปลง"
			if hit != tt.wantHit {
				t.Errorf("describeChanges() = %q, ต้องการ detected=%v", got, tt.wantHit)
			}
		})
	}
}
