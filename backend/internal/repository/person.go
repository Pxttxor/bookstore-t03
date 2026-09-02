// person.go — คำสั่ง GORM ของบุคคล ลูกค้า และบัญชีผู้ใช้
package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

type PersonRepository struct{ db *gorm.DB }

func NewPersonRepository(db *gorm.DB) *PersonRepository {
	return &PersonRepository{db: db}
}

// CustomerFilter — ตัวกรองของหน้ารายชื่อลูกค้า
type CustomerFilter struct {
	Query string
}

// CustomerRow — ลูกค้าพร้อมข้อมูลติดต่อจาก person และสถานะบัญชี
//
// สามตารางนี้ถูกอ่านคู่กันเสมอ (หน้าจอต้องการชื่อและอีเมลซึ่งอยู่ใน person)
// จึง join ให้เสร็จตั้งแต่ชั้น repository แทนที่จะให้ service ไล่ preload ทีละตัว
type CustomerRow struct {
	Customer model.Customer
	Person   model.Person
	Account  *model.UserAccount
}

// ListCustomers — รายชื่อลูกค้า ค้นจากชื่อ อีเมล หรือเบอร์โทร
func (r *PersonRepository) ListCustomers(filter CustomerFilter) ([]CustomerRow, error) {
	query := r.db.Model(&model.Customer{}).
		Joins("JOIN person p ON p.person_id = customer.person_id")

	if term := strings.TrimSpace(filter.Query); term != "" {
		like := "%" + strings.ToLower(term) + "%"
		query = query.Where(
			"lower(p.first_name || ' ' || p.last_name) LIKE ? OR lower(p.email) LIKE ? OR p.phone LIKE ?",
			like, like, like)
	}

	var customers []model.Customer
	if err := query.Order("customer.customer_id").Find(&customers).Error; err != nil {
		return nil, err
	}
	return r.attach(customers)
}

// FindCustomer — ลูกค้าหนึ่งรายพร้อมข้อมูลติดต่อและบัญชี
func (r *PersonRepository) FindCustomer(customerID int) (*CustomerRow, error) {
	var customer model.Customer
	err := r.db.First(&customer, "customer_id = ?", customerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrCustomerNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.attach([]model.Customer{customer})
	if err != nil {
		return nil, err
	}
	return &rows[0], nil
}

// attach — เติม person และ user_account ให้ลูกค้าทั้งชุดด้วยคำสั่งละหนึ่งครั้ง (เลี่ยง N+1)
func (r *PersonRepository) attach(customers []model.Customer) ([]CustomerRow, error) {
	rows := make([]CustomerRow, len(customers))
	if len(customers) == 0 {
		return rows, nil
	}

	ids := make([]int, len(customers))
	for i, c := range customers {
		ids[i] = c.PersonID
	}

	var persons []model.Person
	if err := r.db.Find(&persons, "person_id IN ?", ids).Error; err != nil {
		return nil, err
	}
	byPerson := make(map[int]model.Person, len(persons))
	for _, p := range persons {
		byPerson[p.PersonID] = p
	}

	var accounts []model.UserAccount
	if err := r.db.Find(&accounts, "person_id IN ?", ids).Error; err != nil {
		return nil, err
	}
	byAccount := make(map[int]model.UserAccount, len(accounts))
	for _, a := range accounts {
		byAccount[a.PersonID] = a
	}

	for i, c := range customers {
		rows[i] = CustomerRow{Customer: c, Person: byPerson[c.PersonID]}
		if account, ok := byAccount[c.PersonID]; ok {
			rows[i].Account = &account
		}
	}
	return rows, nil
}

// PersonEmailTaken — มีคนใช้อีเมลนี้อยู่แล้วหรือไม่ (ไม่สนตัวพิมพ์ ตรงกับ unique index)
func (r *PersonRepository) PersonEmailTaken(tx *gorm.DB, email string) (bool, error) {
	var count int64
	err := tx.Model(&model.Person{}).
		Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).
		Count(&count).Error
	return count > 0, err
}

// UsernameTaken — มีคนใช้ชื่อผู้ใช้นี้อยู่แล้วหรือไม่
func (r *PersonRepository) UsernameTaken(tx *gorm.DB, username string) (bool, error) {
	var count int64
	err := tx.Model(&model.UserAccount{}).
		Where("lower(username) = ?", strings.ToLower(strings.TrimSpace(username))).
		Count(&count).Error
	return count > 0, err
}

// CreateCustomer — สร้าง person → customer → user_account ตามลำดับ FK
// ต้องเรียกในทรานแซกชันเดียว ไม่งั้นอาจได้ person ลอยที่ไม่มีลูกค้าผูกอยู่
func (r *PersonRepository) CreateCustomer(
	tx *gorm.DB, person *model.Person, customer *model.Customer, account *model.UserAccount,
) error {
	if err := tx.Create(person).Error; err != nil {
		return err
	}
	customer.PersonID = person.PersonID
	if err := tx.Create(customer).Error; err != nil {
		return err
	}
	if account == nil {
		return nil
	}
	account.PersonID = person.PersonID
	return tx.Create(account).Error
}

// UpdatePerson — แก้ข้อมูลติดต่อ (ลูกค้าแก้โปรไฟล์ตัวเอง)
func (r *PersonRepository) UpdatePerson(person *model.Person) error {
	return r.db.Model(&model.Person{}).
		Where("person_id = ?", person.PersonID).
		Updates(map[string]any{
			"first_name": person.FirstName,
			"last_name":  person.LastName,
			"phone":      person.Phone,
		}).Error
}

// UpdateCustomerAddress — ที่อยู่จัดส่งของลูกค้า
func (r *PersonRepository) UpdateCustomerAddress(customerID int, address string) error {
	return r.db.Model(&model.Customer{}).
		Where("customer_id = ?", customerID).
		Update("address", address).Error
}

// FindAccountByUsername — ใช้ตอนล็อกอินฝั่งลูกค้า (ชื่อผู้ใช้หรืออีเมลก็ได้)
func (r *PersonRepository) FindAccountByUsername(username string) (*model.UserAccount, error) {
	term := strings.ToLower(strings.TrimSpace(username))

	var account model.UserAccount
	err := r.db.Where("lower(username) = ?", term).First(&account).Error
	if err == nil {
		return &account, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// ยอมให้กรอกอีเมลแทนชื่อผู้ใช้ได้ เพราะหน้าล็อกอินของ frontend ถามเป็น "อีเมล"
	err = r.db.
		Joins("JOIN person p ON p.person_id = user_account.person_id").
		Where("lower(p.email) = ?", term).
		First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrAccountNotFound
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// FindAccount — บัญชีตามรหัส
func (r *PersonRepository) FindAccount(accountID int) (*model.UserAccount, error) {
	var account model.UserAccount
	err := r.db.First(&account, "account_id = ?", accountID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrAccountNotFound
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// FindPerson — บุคคลตามรหัส
func (r *PersonRepository) FindPerson(personID int) (*model.Person, error) {
	var person model.Person
	err := r.db.First(&person, "person_id = ?", personID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrPersonNotFound
	}
	if err != nil {
		return nil, err
	}
	return &person, nil
}

// FindCustomerByPersonID — ใช้ตอนแปลง token ของลูกค้าเป็นตัวตน
func (r *PersonRepository) FindCustomerByPersonID(personID int) (*model.Customer, error) {
	var customer model.Customer
	err := r.db.First(&customer, "person_id = ?", personID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrCustomerNotFound
	}
	if err != nil {
		return nil, err
	}
	return &customer, nil
}

// SaveAccount — บันทึกสถานะและเวลาเข้าสู่ระบบล่าสุด
func (r *PersonRepository) SaveAccount(account *model.UserAccount) error {
	return r.db.Model(&model.UserAccount{}).
		Where("account_id = ?", account.AccountID).
		Updates(map[string]any{
			"status":     account.Status,
			"last_login": account.LastLogin,
		}).Error
}
