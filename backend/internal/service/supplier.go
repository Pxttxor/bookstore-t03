// supplier.go — กฎทางธุรกิจของระบบย่อยจัดการข้อมูลผู้จัดจำหน่าย (U1–U4)
package service

import (
	"net/mail"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type SupplierService struct {
	db         *gorm.DB
	suppliers  *repository.SupplierRepository
	purchasing *repository.PurchasingRepository
	inventory  *repository.InventoryRepository
}

func NewSupplierService(
	db *gorm.DB,
	suppliers *repository.SupplierRepository,
	purchasing *repository.PurchasingRepository,
	inventory *repository.InventoryRepository,
) *SupplierService {
	return &SupplierService{db: db, suppliers: suppliers, purchasing: purchasing, inventory: inventory}
}

// SupplierBookInput — หนังสือหนึ่งเล่มที่ผู้จัดจำหน่ายเสนอขาย (รับจากฟอร์ม SCR-12/13)
type SupplierBookInput struct {
	BookID       int     `json:"bookId"`
	SupplyPrice  float64 `json:"supplyPrice"`
	LeadTimeDays int     `json:"leadTimeDays"`
}

// SupplierInput — ข้อมูลที่ฟอร์มเพิ่ม/แก้ไขผู้จัดจำหน่ายส่งมา
type SupplierInput struct {
	CompanyName string              `json:"companyName"`
	ContactName string              `json:"contactName"`
	Phone       string              `json:"phone"`
	Email       string              `json:"email"`
	Address     string              `json:"address"`
	TradeTerms  string              `json:"tradeTerms"`
	CreditTerms string              `json:"creditTerms"`
	Books       []SupplierBookInput `json:"books"`
}

// DeactivateInput — เหตุผลปิดใช้งาน (SCR-14)
type DeactivateInput struct {
	Reason string `json:"reason"`
	Note   string `json:"note"`
}

// List / Get — U4 ค้นหาและเรียกดูข้อมูล
func (s *SupplierService) List(filter repository.SupplierFilter) ([]model.Supplier, error) {
	return s.suppliers.List(filter)
}

func (s *SupplierService) Get(supplierID int) (*model.Supplier, error) {
	return s.suppliers.FindByID(supplierID)
}

// OrdersFor — ประวัติการสั่งซื้อของผู้จัดจำหน่ายรายนี้ (แท็บหนึ่งของ SCR-11)
func (s *SupplierService) OrdersFor(supplierID int) ([]model.PurchaseOrder, error) {
	if _, err := s.suppliers.FindByID(supplierID); err != nil {
		return nil, err
	}
	return s.purchasing.ListOrders(repository.OrderFilter{SupplierID: supplierID})
}

// Create — U1 เพิ่มข้อมูลผู้จัดจำหน่าย
//
// ลำดับตรงกับ sequence diagram SD-U1: ตรวจความครบถ้วน → ตรวจชื่อซ้ำ → สร้าง → ตั้งสถานะ ACTIVE
// → สร้าง SupplierBook ให้ครบทุกเล่ม
func (s *SupplierService) Create(input SupplierInput) (*model.Supplier, error) {
	if err := s.validate(input); err != nil {
		return nil, err
	}

	existing, err := s.suppliers.FindByCompanyName(input.CompanyName, 0)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, model.ErrSupplierDuplicate
	}

	supplier := &model.Supplier{
		CompanyName: strings.TrimSpace(input.CompanyName),
		ContactName: strings.TrimSpace(input.ContactName),
		Phone:       strings.TrimSpace(input.Phone),
		Email:       strings.TrimSpace(input.Email),
		Address:     strings.TrimSpace(input.Address),
		TradeTerms:  strings.TrimSpace(input.TradeTerms),
		CreditTerms: strings.TrimSpace(input.CreditTerms),
		Books:       toSupplierBooks(input.Books),
	}
	supplier.Register()

	if err := s.suppliers.Create(supplier); err != nil {
		return nil, err
	}
	return s.suppliers.FindByID(supplier.SupplierID)
}

// Update — U2 แก้ไขข้อมูลผู้จัดจำหน่าย พร้อมบันทึกประวัติว่าใครแก้อะไรเมื่อไร
func (s *SupplierService) Update(supplierID int, input SupplierInput, by string) (*model.Supplier, error) {
	current, err := s.suppliers.FindByID(supplierID)
	if err != nil {
		return nil, err
	}
	// ฟอร์มแก้ไขไม่ให้เปลี่ยนชื่อบริษัท จึงเติมชื่อเดิมกลับไปก่อนตรวจความครบถ้วน
	if strings.TrimSpace(input.CompanyName) == "" {
		input.CompanyName = current.CompanyName
	}
	if err := s.validate(input); err != nil {
		return nil, err
	}

	duplicate, err := s.suppliers.FindByCompanyName(input.CompanyName, supplierID)
	if err != nil {
		return nil, err
	}
	if duplicate != nil {
		return nil, model.ErrSupplierDuplicate
	}

	updated := *current
	updated.UpdateInfo(
		strings.TrimSpace(input.ContactName),
		strings.TrimSpace(input.Phone),
		strings.TrimSpace(input.Email),
		strings.TrimSpace(input.Address),
		strings.TrimSpace(input.TradeTerms),
		strings.TrimSpace(input.CreditTerms),
	)
	updated.Books = toSupplierBooks(input.Books)

	entry := &model.SupplierEditLog{
		SupplierID: supplierID,
		At:         time.Now().UTC(),
		By:         by,
		Summary:    describeChanges(current, &updated),
	}
	if err := s.suppliers.Update(&updated, entry); err != nil {
		return nil, err
	}
	return s.suppliers.FindByID(supplierID)
}

// Deactivate — U3 ปิดใช้งานผู้จัดจำหน่าย
//
// precondition ของ use case: ต้องไม่มีใบสั่งซื้อคงค้าง
// ตรวจในทรานแซกชันเดียวกับการเขียน เพื่อไม่ให้ใบสั่งซื้อใหม่แทรกเข้ามาระหว่างตรวจกับเขียน
func (s *SupplierService) Deactivate(supplierID int, input DeactivateInput, by string) (*model.Supplier, error) {
	if strings.TrimSpace(input.Reason) == "" {
		return nil, model.ErrReasonRequired
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		supplier, err := s.suppliers.FindByIDTx(tx, supplierID)
		if err != nil {
			return err
		}
		outstanding, err := s.purchasing.OutstandingOrderCount(tx, supplierID)
		if err != nil {
			return err
		}
		if outstanding > 0 {
			return model.ErrSupplierHasOpenOrders
		}
		if err := supplier.Deactivate(); err != nil {
			return err
		}

		return s.suppliers.Deactivate(supplierID, &model.SupplierDeactivation{
			SupplierID: supplierID,
			Reason:     strings.TrimSpace(input.Reason),
			Note:       strings.TrimSpace(input.Note),
			At:         time.Now().UTC(),
			By:         by,
		})
	})
	if err != nil {
		return nil, err
	}
	return s.suppliers.FindByID(supplierID)
}

// validate — ความครบถ้วนของฟอร์ม (SCR-12 Abnormal U1, SCR-13 Abnormal U2)
func (s *SupplierService) validate(input SupplierInput) error {
	required := map[string]string{
		"ชื่อบริษัท":     input.CompanyName,
		"ผู้ติดต่อ":      input.ContactName,
		"เบอร์โทร":       input.Phone,
		"อีเมล":          input.Email,
		"ที่อยู่":        input.Address,
		"เงื่อนไขการค้า": input.TradeTerms,
		"เงื่อนไขเครดิต": input.CreditTerms,
	}
	missing := make([]string, 0, len(required))
	for label, value := range required {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, label)
		}
	}
	if len(missing) > 0 {
		return model.Validation("MISSING_FIELDS", "กรอกข้อมูลไม่ครบ: "+strings.Join(missing, ", "))
	}

	if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
		return model.ErrInvalidEmail
	}

	seen := make(map[int]bool, len(input.Books))
	for _, book := range input.Books {
		if seen[book.BookID] {
			return model.ErrDuplicateBookInDocument
		}
		seen[book.BookID] = true

		exists, err := s.inventory.BookExists(book.BookID)
		if err != nil {
			return err
		}
		if !exists {
			return model.ErrBookNotFound
		}
		if book.SupplyPrice <= 0 {
			return model.Validation("INVALID_SUPPLY_PRICE", "ราคาส่งต้องมากกว่า 0")
		}
		if book.LeadTimeDays < 0 {
			return model.Validation("INVALID_LEAD_TIME", "ระยะเวลาส่งมอบต้องไม่ติดลบ")
		}
	}
	return nil
}

func toSupplierBooks(inputs []SupplierBookInput) []model.SupplierBook {
	books := make([]model.SupplierBook, len(inputs))
	for i, input := range inputs {
		books[i] = model.SupplierBook{
			BookID:       input.BookID,
			SupplyPrice:  input.SupplyPrice,
			LeadTimeDays: input.LeadTimeDays,
		}
	}
	return books
}

// describeChanges — สรุปว่าการบันทึกครั้งนี้แก้อะไรบ้าง ไว้แสดงในประวัติการแก้ไข
// รูปแบบข้อความตรงกับ describeChanges() ใน SupplierContext ฝั่ง frontend
func describeChanges(before, after *model.Supplier) string {
	type field struct {
		label  string
		before string
		after  string
	}
	fields := []field{
		{"ผู้ติดต่อ", before.ContactName, after.ContactName},
		{"เบอร์โทร", before.Phone, after.Phone},
		{"อีเมล", before.Email, after.Email},
		{"ที่อยู่", before.Address, after.Address},
		{"เงื่อนไขการค้า", before.TradeTerms, after.TradeTerms},
		{"เงื่อนไขเครดิต", before.CreditTerms, after.CreditTerms},
	}

	changed := make([]string, 0, len(fields)+1)
	for _, f := range fields {
		if f.before != f.after {
			changed = append(changed, f.label)
		}
	}
	if len(before.Books) != len(after.Books) {
		changed = append(changed, "รายการหนังสือ")
	}
	if len(changed) == 0 {
		return "บันทึกข้อมูลโดยไม่มีการเปลี่ยนแปลง"
	}
	return "แก้ไข " + strings.Join(changed, ", ")
}
