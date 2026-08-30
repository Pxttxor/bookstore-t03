// errors.go — ข้อผิดพลาดเชิงธุรกิจ
//
// ทุกตัวมี Code อังกฤษ (ให้ frontend switch ได้) + Message ภาษาไทย (ให้ผู้ใช้อ่าน)
// ข้อความไทยคัดจาก Figma UI Spec §6 หัวข้อ Abnormal ของแต่ละหน้าจอ
// วางไว้ในชั้น model เพราะเป็นเลเยอร์ล่างสุดที่ทั้ง service และ handler อ้างถึงได้โดยไม่เกิด import cycle
package model

import "net/http"

// DomainError — ข้อผิดพลาดที่แปลงเป็น HTTP response ได้ตรง ๆ
type DomainError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *DomainError) Error() string { return e.Code + ": " + e.Message }

func newErr(status int, code, message string) *DomainError {
	return &DomainError{Code: code, Message: message, Status: status}
}

// Validation — ข้อมูลที่ผู้ใช้กรอกไม่ผ่านเกณฑ์
func Validation(code, message string) *DomainError {
	return newErr(http.StatusUnprocessableEntity, code, message)
}

// Conflict — สถานะปัจจุบันไม่อนุญาตให้ทำรายการนี้
func Conflict(code, message string) *DomainError {
	return newErr(http.StatusConflict, code, message)
}

// NotFound — ไม่พบข้อมูลที่อ้างถึง
func NotFound(code, message string) *DomainError {
	return newErr(http.StatusNotFound, code, message)
}

// ── ผู้จัดจำหน่าย (U1–U4) ───────────────────────────────────────────────
var (
	ErrSupplierNotFound  = NotFound("SUPPLIER_NOT_FOUND", "ไม่พบข้อมูลผู้จัดจำหน่าย")
	ErrSupplierDuplicate = Conflict("SUPPLIER_DUPLICATE", "มีผู้จัดจำหน่ายชื่อนี้อยู่แล้ว")

	ErrSupplierAlreadyCancelled = Conflict("SUPPLIER_ALREADY_CANCELLED",
		"ผู้จัดจำหน่ายรายนี้ถูกยกเลิกไปแล้ว")

	// SCR-14 Abnormal (U3): ถ้ามีใบสั่งซื้อคงค้าง → ปิดปุ่มยืนยัน + ข้อความนี้
	ErrSupplierHasOpenOrders = Conflict("SUPPLIER_HAS_OPEN_ORDERS",
		"ต้องปิดรายการคงค้างให้ครบก่อน")

	// SCR-21 Abnormal (U6): เลือกผู้จัดจำหน่ายที่ถูกปิดใช้งานไม่ได้
	ErrSupplierInactive = Validation("SUPPLIER_INACTIVE",
		"ผู้จัดจำหน่ายรายนี้ถูกปิดใช้งาน ไม่สามารถเลือกได้")

	ErrInvalidEmail = Validation("INVALID_EMAIL", "รูปแบบอีเมลไม่ถูกต้อง")
)

// ── เอกสารจัดซื้อ (U5–U10) ──────────────────────────────────────────────
var (
	ErrRequisitionNotFound = NotFound("REQUISITION_NOT_FOUND", "ไม่พบใบขอสั่งซื้อ")
	ErrOrderNotFound       = NotFound("ORDER_NOT_FOUND", "ไม่พบใบสั่งซื้อ")
	ErrReturnNotFound      = NotFound("RETURN_NOT_FOUND", "ไม่พบใบส่งคืน")
	ErrBookNotFound        = NotFound("BOOK_NOT_FOUND", "ไม่พบข้อมูลหนังสือ")
	ErrEmployeeNotFound    = NotFound("EMPLOYEE_NOT_FOUND", "ไม่พบข้อมูลพนักงาน")
	ErrInventoryNotFound   = NotFound("INVENTORY_NOT_FOUND", "ไม่พบข้อมูลสินค้าคงคลังของหนังสือเล่มนี้")

	ErrEmptyItems              = Validation("EMPTY_ITEMS", "ต้องมีรายการหนังสืออย่างน้อย 1 รายการ")
	ErrDuplicateBookInDocument = Validation("DUPLICATE_BOOK", "มีหนังสือเล่มเดียวกันซ้ำในเอกสาร")
	ErrInvalidQuantity         = Validation("INVALID_QUANTITY", "จำนวนต้องมากกว่า 0")
	ErrInvalidUnitPrice        = Validation("INVALID_UNIT_PRICE", "ราคาต่อหน่วยต้องมากกว่า 0")
	ErrReasonRequired          = Validation("REASON_REQUIRED", "ต้องระบุเหตุผล")

	// SCR-23 Abnormal (U7): ยอดเกินงบ ต้องปรับลดหรือบันทึกเหตุผลก่อนอนุมัติ
	ErrOverBudget = Validation("OVER_BUDGET",
		"เกินงบประมาณ ต้องปรับลดรายการหรือบันทึกเหตุผลก่อนอนุมัติ")

	ErrExpectedDateInPast = Validation("EXPECTED_DATE_IN_PAST",
		"วันที่คาดว่าจะได้รับสินค้าต้องไม่เป็นวันที่ผ่านมาแล้ว")

	ErrReturnExceedsReceived = Validation("RETURN_EXCEEDS_RECEIVED",
		"จำนวนที่ส่งคืนมากกว่าจำนวนที่รับเข้าคลัง")

	ErrNothingReceived = Validation("NOTHING_RECEIVED",
		"ต้องระบุจำนวนที่รับอย่างน้อย 1 รายการ")

	ErrOrderNotSent = Conflict("ORDER_NOT_SENT",
		"ต้องส่งใบสั่งซื้อให้ผู้จัดจำหน่ายก่อนจึงจะยืนยันได้")

	ErrBookNotOfferedBySupplier = Validation("BOOK_NOT_OFFERED",
		"ผู้จัดจำหน่ายรายนี้ไม่ได้เสนอขายหนังสือเล่มนี้")
)

// ── สิทธิ์และการเข้าสู่ระบบ ─────────────────────────────────────────────
var (
	ErrInvalidCredentials = newErr(http.StatusUnauthorized, "INVALID_CREDENTIALS",
		"อีเมลหรือรหัสผ่านไม่ถูกต้อง")
	ErrUnauthenticated = newErr(http.StatusUnauthorized, "UNAUTHENTICATED",
		"กรุณาเข้าสู่ระบบ")
	ErrForbidden = newErr(http.StatusForbidden, "FORBIDDEN",
		"คุณไม่มีสิทธิ์ทำรายการนี้")
)

// ── บัญชีผู้ใช้และลูกค้า ────────────────────────────────────────────────
var (
	ErrPersonNotFound   = NotFound("PERSON_NOT_FOUND", "ไม่พบข้อมูลบุคคล")
	ErrCustomerNotFound = NotFound("CUSTOMER_NOT_FOUND", "ไม่พบข้อมูลลูกค้า")
	ErrAccountNotFound  = NotFound("ACCOUNT_NOT_FOUND", "ไม่พบบัญชีผู้ใช้")

	ErrEmailTaken = Conflict("EMAIL_TAKEN",
		"อีเมลนี้ถูกใช้สมัครไปแล้ว")
	ErrUsernameTaken = Conflict("USERNAME_TAKEN",
		"ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว")

	ErrPasswordTooShort = Validation("PASSWORD_TOO_SHORT",
		"รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
	ErrInvalidOtp = Validation("INVALID_OTP",
		"รหัสยืนยันไม่ถูกต้อง")

	ErrAccountNotVerified = newErr(http.StatusUnauthorized, "ACCOUNT_NOT_VERIFIED",
		"กรุณายืนยันตัวตนก่อนเข้าสู่ระบบ")
	ErrAccountSuspended = newErr(http.StatusUnauthorized, "ACCOUNT_SUSPENDED",
		"บัญชีนี้ถูกระงับการใช้งาน")
	ErrAccountAlreadySuspended = Conflict("ACCOUNT_ALREADY_SUSPENDED",
		"บัญชีนี้ถูกระงับไปแล้ว")
	ErrAccountNotSuspended = Conflict("ACCOUNT_NOT_SUSPENDED",
		"บัญชีนี้ไม่ได้ถูกระงับอยู่")
)

// ── ข้อมูลหนังสือ (ระบบย่อยของวุฒิภัทร) ─────────────────────────────────
var (
	ErrCategoryNotFound = NotFound("CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่หนังสือ")

	ErrInvalidBookStatus = Validation("INVALID_BOOK_STATUS", "สถานะหนังสือไม่ถูกต้อง")
	ErrInvalidBookPrice  = Validation("INVALID_BOOK_PRICE", "ราคาปกต้องมากกว่า 0")
)

// IsbnTaken — ISBN ซ้ำกับหนังสือเล่มที่มีอยู่แล้ว
// ข้อความคัดจาก toast ของหน้าฟอร์มหนังสือ ("พบ ISBN ซ้ำ — <isbn> เป็นของ <ชื่อเรื่อง>")
func IsbnTaken(isbn, title string) *DomainError {
	return Conflict("ISBN_TAKEN", "พบ ISBN ซ้ำ — "+isbn+" เป็นของ "+title)
}
