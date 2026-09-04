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

// ── ข้อมูลหนังสือ ──────────────────────────────────────────────────
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

// ── การตรวจนับสต็อก (ระบบย่อยสินค้าคงคลัง) ──────────────────────────────
var (
	ErrStockCountNotFound  = NotFound("STOCK_COUNT_NOT_FOUND", "ไม่พบรอบการตรวจนับ")
	ErrDiscrepancyNotFound = NotFound("DISCREPANCY_NOT_FOUND", "ไม่พบรายงานผลต่างสต็อก")

	// ข้อความคัดจาก abnormal flow ของหน้าปรับปรุงจำนวนสินค้าคงคลัง
	ErrNegativeStock = Validation("NEGATIVE_STOCK", "ยอดคงเหลือติดลบ ไม่สามารถบันทึกได้")

	ErrNoStockLines       = Validation("NO_STOCK_LINES", "ต้องเลือกหนังสืออย่างน้อยหนึ่งเล่ม")
	ErrNegativeCountedQty = Validation("INVALID_COUNTED_QTY", "จำนวนที่นับได้ต้องไม่ติดลบ")

	ErrReportAlreadyDecided = Conflict("REPORT_ALREADY_DECIDED", "รายงานนี้ถูกตัดสินไปแล้ว")
)

// ── คำสั่งซื้อลูกค้าและโปรโมชั่น ─────────────────────────────────
var (
	ErrCustomerOrderNotFound = NotFound("CUSTOMER_ORDER_NOT_FOUND", "ไม่พบคำสั่งซื้อ")
	ErrPromotionNotFound     = NotFound("PROMOTION_NOT_FOUND", "ไม่พบโปรโมชั่น")

	ErrInvalidOrderStatus  = Validation("INVALID_ORDER_STATUS", "สถานะคำสั่งซื้อไม่ถูกต้อง")
	ErrInvalidOrderChannel = Validation("INVALID_ORDER_CHANNEL", "ช่องทางการสั่งซื้อไม่ถูกต้อง")
	ErrNoOrderItems        = Validation("NO_ORDER_ITEMS", "ต้องมีสินค้าอย่างน้อยหนึ่งรายการ")
	ErrAddressRequired     = Validation("ADDRESS_REQUIRED", "กรุณาระบุที่อยู่จัดส่ง")
	ErrSlipRequired        = Validation("SLIP_REQUIRED", "กรุณาแนบหลักฐานการชำระเงิน")

	// หนังสือที่ปิดการขายแล้วสั่งซื้อไม่ได้ (Book.status = INACTIVE)
	ErrBookNotForSale = Validation("BOOK_NOT_FOR_SALE", "หนังสือเล่มนี้ปิดการขายแล้ว")

	// SCR สต็อกไม่พอตอนฝ่ายขายยืนยันคำสั่งซื้อ
	ErrInsufficientStock = Conflict("INSUFFICIENT_STOCK", "สินค้าคงคลังไม่พอสำหรับคำสั่งซื้อนี้")

	ErrPromotionNotApplicable = Validation("PROMOTION_NOT_APPLICABLE",
		"คำสั่งซื้อนี้ไม่เข้าเงื่อนไขของโปรโมชั่นที่เลือก")
	ErrPromotionDateRange = Validation("PROMOTION_DATE_RANGE",
		"วันเริ่มต้นต้องไม่หลังวันสิ้นสุด")
)

// OrderTransitionRejected — เปลี่ยนสถานะข้ามขั้นตอน
// บอกทั้งสถานะปัจจุบันและปลายทางเป็นภาษาไทย เพราะหน้าจอเอาไปแสดงตรง ๆ
func OrderTransitionRejected(from, to OrderStatus) *DomainError {
	return Conflict("ORDER_TRANSITION_REJECTED",
		"เปลี่ยนสถานะจาก \""+from.Label()+"\" เป็น \""+to.Label()+"\" ไม่ได้")
}

// ── ตรวจสอบการชำระเงิน ──────────────────────────────────────────────
var (
	ErrPaymentNotFound       = NotFound("PAYMENT_NOT_FOUND", "ไม่พบข้อมูลการชำระเงิน")
	ErrPaymentReportNotFound = NotFound("PAYMENT_REPORT_NOT_FOUND", "ไม่พบรายงานการรับชำระเงิน")
	ErrBankNotFound          = NotFound("BANK_NOT_FOUND", "ไม่พบบัญชีธนาคารที่เลือก")

	ErrPaymentAlreadyVerified = Conflict("PAYMENT_ALREADY_VERIFIED",
		"การชำระเงินนี้ตรวจสอบผ่านไปแล้ว")
	ErrPaymentNotVerifiable = Conflict("PAYMENT_NOT_VERIFIABLE",
		"การชำระเงินนี้ไม่ได้อยู่ในสถานะที่ตรวจสอบได้")

	ErrReportPeriodRange = Validation("REPORT_PERIOD_RANGE",
		"วันเริ่มต้นของรอบรายงานต้องไม่หลังวันสิ้นสุด")
)

// ── จัดการการจัดส่ง ──────────────────────────────────────────────────
var (
	ErrShipmentNotFound      = NotFound("SHIPMENT_NOT_FOUND", "ไม่พบรายการจัดส่ง")
	ErrCarrierNotFound       = NotFound("CARRIER_NOT_FOUND", "ไม่พบบริษัทขนส่งที่เลือก")
	ErrShipmentExists        = Conflict("SHIPMENT_EXISTS", "คำสั่งซื้อนี้มีรายการจัดส่งอยู่แล้ว")
	ErrTrackingRequired      = Validation("TRACKING_REQUIRED", "กรุณากรอกเลขติดตามพัสดุ")
	ErrRecipientRequired     = Validation("RECIPIENT_REQUIRED", "กรุณาระบุชื่อผู้รับ")
	ErrInvalidShipmentStatus = Validation("INVALID_SHIPMENT_STATUS", "สถานะการจัดส่งไม่ถูกต้อง")

	// ยืนยันรับสินค้าต้องเขียนทั้งคำสั่งซื้อและพัสดุพร้อมกัน จึงบันทึกที่คำสั่งซื้อที่เดียว
	ErrDeliverViaOrder = Validation("DELIVER_VIA_ORDER",
		"การยืนยันรับสินค้าให้บันทึกที่คำสั่งซื้อ เพื่อให้สถานะของใบกับพัสดุตรงกัน")
)

// ShipmentTransitionRejected — อัปเดตสถานะพัสดุข้ามขั้นตอน
func ShipmentTransitionRejected(from, to ShipmentStatus) *DomainError {
	return Conflict("SHIPMENT_TRANSITION_REJECTED",
		"เปลี่ยนสถานะพัสดุจาก \""+from.Label()+"\" เป็น \""+to.Label()+"\" ไม่ได้")
}

// ── ระบบสมาชิกและแต้มสะสม ────────────────────────────────────────────
//
// ระบบย่อยนี้ไม่มีหน้าจอใน Figma spec ให้คัดข้อความ Abnormal มาตรง ๆ
// จึงเขียนให้เข้าคู่กับชุดที่มีอยู่แล้ว (สั้น บอกสิ่งที่ผู้ใช้ต้องทำต่อ)
var (
	ErrMemberNotFound = NotFound("MEMBER_NOT_FOUND", "ไม่พบข้อมูลสมาชิก")
	ErrTierNotFound   = NotFound("TIER_NOT_FOUND", "ไม่พบระดับสมาชิก")
	ErrRewardNotFound = NotFound("REWARD_NOT_FOUND", "ไม่พบของรางวัล")

	ErrInsufficientPoints = Conflict("INSUFFICIENT_POINTS", "แต้มสะสมไม่พอสำหรับรายการนี้")
	ErrTierNameTaken      = Conflict("TIER_NAME_TAKEN", "มีระดับสมาชิกชื่อนี้อยู่แล้ว")

	// ลบระดับที่ยังมีสมาชิกอยู่ไม่ได้ เพราะ member.tier_id เป็น NOT NULL
	ErrTierInUse = Conflict("TIER_IN_USE", "ยังมีสมาชิกอยู่ในระดับนี้ ลบไม่ได้")

	// กติกาเดียวกับโปรโมชั่นที่ถูกใช้ไปแล้ว — ประวัติการแลกต้องอ่านย้อนหลังได้
	ErrRewardRedeemed = Conflict("REWARD_REDEEMED", "ของรางวัลนี้ถูกแลกไปแล้ว ลบไม่ได้")

	ErrInvalidPointTxnType  = Validation("INVALID_POINT_TXN_TYPE", "ประเภทรายการแต้มไม่ถูกต้อง")
	ErrInvalidRewardType    = Validation("INVALID_REWARD_TYPE", "ประเภทของรางวัลไม่ถูกต้อง")
	ErrPointsMustBePositive = Validation("POINTS_MUST_BE_POSITIVE", "จำนวนแต้มต้องมากกว่าศูนย์")
	ErrInvalidPointCost     = Validation("INVALID_POINT_COST", "แต้มที่ใช้แลกต้องมากกว่าศูนย์")
	ErrInvalidPointRate     = Validation("INVALID_POINT_RATE", "อัตราการให้แต้มต้องมากกว่าศูนย์")
	ErrInvalidMinPurchase   = Validation("INVALID_MIN_PURCHASE", "ยอดสะสมขั้นต่ำต้องไม่ติดลบ")
	ErrInvalidDiscountValue = Validation("INVALID_DISCOUNT_VALUE", "มูลค่าส่วนลดต้องมากกว่าศูนย์")
)

// ── ระบบย่อยรีวิวลูกค้า ──────────────────────────────────────────────
//
// ข้อความคัดจากหน้าจอ /admin/reviews และหน้าเขียนรีวิวของหน้าร้าน
var (
	ErrReviewNotFound       = NotFound("REVIEW_NOT_FOUND", "ไม่พบรีวิวที่ต้องการ")
	ErrReviewReportNotFound = NotFound("REVIEW_REPORT_NOT_FOUND", "ไม่พบรายงานรีวิวที่ต้องการ")

	// ยึดตามที่ผู้ใช้เลือก: รีวิวได้เฉพาะเล่มที่สั่งซื้อและได้รับของแล้วเท่านั้น
	ErrReviewNotPurchased = Validation("REVIEW_NOT_PURCHASED",
		"รีวิวได้เฉพาะหนังสือที่สั่งซื้อและได้รับสินค้าแล้ว")

	ErrReviewDuplicated = Conflict("REVIEW_DUPLICATED", "คุณรีวิวหนังสือเล่มนี้จากคำสั่งซื้อนี้ไปแล้ว")

	// REMOVED เป็นปลายทาง — รีวิวที่ลบแล้วแก้ต่อไม่ได้ ต้องให้ลูกค้าเขียนใหม่
	ErrReviewRemoved = Conflict("REVIEW_REMOVED", "รีวิวนี้ถูกลบไปแล้ว ทำรายการต่อไม่ได้")

	ErrReviewReported = Conflict("REVIEW_REPORTED", "รีวิวนี้ถูกรายงานให้ผู้จัดการพิจารณาอยู่แล้ว")

	ErrInvalidRating         = Validation("INVALID_RATING", "กรุณาให้คะแนนระหว่าง 1 ถึง 5 ดาว")
	ErrEmptyReviewComment    = Validation("EMPTY_REVIEW_COMMENT", "กรุณากรอกข้อความรีวิว")
	ErrEmptyReplyText        = Validation("EMPTY_REPLY_TEXT", "กรุณากรอกข้อความตอบกลับ")
	ErrEmptyReportReason     = Validation("EMPTY_REPORT_REASON", "กรุณาระบุเหตุผลที่รายงาน")
	ErrInvalidModerateAction = Validation("INVALID_MODERATE_ACTION", "คำสั่งตรวจสอบรีวิวไม่ถูกต้อง")
	ErrInvalidReviewStatus   = Validation("INVALID_REVIEW_STATUS", "สถานะรีวิวไม่ถูกต้อง")
)

// ErrInvalidApprovalStatus — ผลการตัดสินต้องเป็น APPROVED หรือ REJECTED เท่านั้น
// ใช้ร่วมกันทั้งรายงานผลต่างสต็อก (P3) และรายงานรีวิว (P8)
var ErrInvalidApprovalStatus = Validation("INVALID_APPROVAL_STATUS", "ผลการตัดสินไม่ถูกต้อง")
