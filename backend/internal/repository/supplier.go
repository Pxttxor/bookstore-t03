// Package repository — ชั้นเข้าถึงข้อมูลด้วย GORM
//
// แยกจาก service เพราะ service ของระบบจัดซื้อต้องอ่านข้อมูลผู้จัดจำหน่ายและสินค้าคงคลังด้วย
// ทุกเมธอดรับ *gorm.DB เข้ามาได้ เพื่อให้เรียกจากใน transaction เดียวกับ service ได้
package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

type SupplierRepository struct{ db *gorm.DB }

func NewSupplierRepository(db *gorm.DB) *SupplierRepository {
	return &SupplierRepository{db: db}
}

// SupplierFilter — เงื่อนไขค้นหาของ SCR-10 (U4)
type SupplierFilter struct {
	Query  string               // ค้นจากชื่อบริษัท ผู้ติดต่อ หรือรหัส
	Status model.SupplierStatus // ว่าง = ทุกสถานะ
}

// List — รายการผู้จัดจำหน่ายพร้อมหนังสือที่เสนอขาย เรียงตามรหัส
func (r *SupplierRepository) List(filter SupplierFilter) ([]model.Supplier, error) {
	query := r.db.Model(&model.Supplier{}).
		Preload("Books").
		Preload("Books.Book").
		Preload("Deactivation").
		Order("supplier_id")

	if term := strings.TrimSpace(filter.Query); term != "" {
		like := "%" + strings.ToLower(term) + "%"
		query = query.Where(
			"lower(company_name) LIKE ? OR lower(contact_name) LIKE ? OR CAST(supplier_id AS TEXT) LIKE ?",
			like, like, like)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var suppliers []model.Supplier
	if err := query.Find(&suppliers).Error; err != nil {
		return nil, err
	}
	return suppliers, nil
}

// FindByID — ผู้จัดจำหน่ายหนึ่งรายพร้อมหนังสือ ประวัติแก้ไข และข้อมูลการปิดใช้งาน
func (r *SupplierRepository) FindByID(supplierID int) (*model.Supplier, error) {
	return r.findWith(r.db, supplierID)
}

// FindByIDTx — เหมือน FindByID แต่ล็อกแถวไว้ในทรานแซกชัน (SELECT ... FOR UPDATE)
func (r *SupplierRepository) FindByIDTx(tx *gorm.DB, supplierID int) (*model.Supplier, error) {
	return r.findWith(tx, supplierID)
}

func (r *SupplierRepository) findWith(db *gorm.DB, supplierID int) (*model.Supplier, error) {
	var supplier model.Supplier
	err := db.
		Preload("Books", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") }).
		Preload("Books.Book").
		Preload("EditHistory", func(q *gorm.DB) *gorm.DB { return q.Order("at") }).
		Preload("Deactivation").
		First(&supplier, "supplier_id = ?", supplierID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrSupplierNotFound
	}
	if err != nil {
		return nil, err
	}
	return &supplier, nil
}

// FindByCompanyName — ใช้ตรวจชื่อบริษัทซ้ำตอน U1/U2
//
// เทียบแบบไม่สนตัวพิมพ์และช่องว่างหัวท้าย ให้ตรงกับ unique index ที่ migrate.go สร้างไว้
// ignoreID > 0 = ข้ามรายนั้น (ตอนแก้ไขตัวเอง ไม่ถือว่าชนกับชื่อเดิมของตัวเอง)
func (r *SupplierRepository) FindByCompanyName(companyName string, ignoreID int) (*model.Supplier, error) {
	query := r.db.Where("lower(btrim(company_name)) = ?",
		strings.ToLower(strings.TrimSpace(companyName)))
	if ignoreID > 0 {
		query = query.Where("supplier_id <> ?", ignoreID)
	}

	var supplier model.Supplier
	err := query.First(&supplier).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &supplier, nil
}

// Create — บันทึกผู้จัดจำหน่ายรายใหม่พร้อมรายการหนังสือ (GORM สร้างแถวลูกให้เอง)
func (r *SupplierRepository) Create(supplier *model.Supplier) error {
	return r.db.Create(supplier).Error
}

// Update — เขียนทับข้อมูลผู้จัดจำหน่าย แทนที่รายการหนังสือทั้งชุด และต่อประวัติการแก้ไข
//
// รายการหนังสือใช้วิธีลบทิ้งแล้วใส่ใหม่ เพราะ PK เป็น (supplier_id, book_id) การแก้ทีละแถว
// ต้องแยกกรณีเพิ่ม/ลบ/แก้เอง ซึ่งซับซ้อนกว่าและได้ผลเท่ากันในขนาดข้อมูลระดับนี้
func (r *SupplierRepository) Update(supplier *model.Supplier, entry *model.SupplierEditLog) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		fields := map[string]any{
			"contact_name": supplier.ContactName,
			"phone":        supplier.Phone,
			"email":        supplier.Email,
			"address":      supplier.Address,
			"trade_terms":  supplier.TradeTerms,
			"credit_terms": supplier.CreditTerms,
		}
		if err := tx.Model(&model.Supplier{}).
			Where("supplier_id = ?", supplier.SupplierID).
			Updates(fields).Error; err != nil {
			return err
		}

		if err := tx.Where("supplier_id = ?", supplier.SupplierID).
			Delete(&model.SupplierBook{}).Error; err != nil {
			return err
		}
		if len(supplier.Books) > 0 {
			for i := range supplier.Books {
				supplier.Books[i].SupplierID = supplier.SupplierID
			}
			if err := tx.Create(&supplier.Books).Error; err != nil {
				return err
			}
		}
		return tx.Create(entry).Error
	})
}

// Deactivate — ตั้งสถานะเป็น CANCELLED พร้อมบันทึกเหตุผล (U3)
// ตรวจว่าไม่มีใบสั่งซื้อคงค้างอยู่ที่ service ก่อนเรียกเมธอดนี้
func (r *SupplierRepository) Deactivate(supplierID int, deactivation *model.SupplierDeactivation) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Supplier{}).
			Where("supplier_id = ?", supplierID).
			Update("status", model.SupplierStatusCancelled).Error; err != nil {
			return err
		}
		// ปิดใช้งานซ้ำไม่ได้อยู่แล้ว แต่ใช้ Save เพื่อให้เขียนทับได้ถ้าเคยมีแถวค้าง
		return tx.Save(deactivation).Error
	})
}
