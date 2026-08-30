// seed_review.go — รีวิวลูกค้าตั้งต้น (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// SEED_REVIEWS ของ frontend อ้าง slug ของหน้าร้านและลูกค้าสมมติ (John Doe, Spam Bot)
// ที่ไม่มีอยู่ในตาราง customer จึงให้สคริปต์อ่านไม่ได้ · ชุดนี้เขียนขึ้นใหม่โดยผูกกับ
// ลูกค้า หนังสือ และคำสั่งซื้อจริงในฐานนี้ แต่คงสำนวนและสถานการณ์เดิมไว้
//
// **แถวที่ไม่มี order_id คือรีวิวเก่าที่นำเข้ามา** (Review --> Order เป็น 0..1 ใน diagram)
// ต่างจากเส้นทาง API ที่บังคับให้ต้องมีใบสถานะ "ส่งถึงแล้ว" เสมอ — ดู ReviewService.Submit
package database

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

type seedReviewReply struct {
	ReplyText   string
	RepliedDate string // ISO-8601
	RepliedBy   string
}

type seedReviewReport struct {
	Reason      string
	Detail      string
	ReportedBy  string
	ReportedAt  string // ISO-8601
	Status      model.ApprovalStatus
	DecidedBy   string
	DecidedDate string // ISO-8601 · มีเฉพาะรายงานที่ตัดสินแล้ว
}

type seedReviewRow struct {
	CustomerEmail string
	BookID        int
	OrderID       *int // nil = รีวิวเก่าที่ไม่มีใบสั่งซื้ออ้างอิง
	Rating        int
	Headline      string
	Comment       string
	Status        model.ReviewStatus
	Flagged       bool
	CreatedDate   string // ISO-8601
	Reply         *seedReviewReply
	Report        *seedReviewReport
}

// seedReviews — ห้าแถวที่ครอบทั้งสี่สถานะ และครอบคิวของทั้งฝ่ายขายกับผู้จัดการ
//
// Flagged ของทุกแถวตรงกับผลของ ProfanityFilter บนข้อความจริง (มีคำต้องห้ามอยู่ในเนื้อ)
// ไม่ได้ตั้งค่ามั่ว ๆ ให้ดูเหมือนถูกจับ
var seedReviews = []seedReviewRow{
	{
		// ใบเดียวในข้อมูลตั้งต้นที่ส่งถึงลูกค้าแล้ว จึงเป็นรีวิว "ซื้อสินค้าจริง" แถวเดียว
		CustomerEmail: "somsak@example.com", BookID: 110, OrderID: intPtr(1003),
		Rating:      5,
		Headline:    "เนื้อเรื่องชวนคิดและสร้างแรงบันดาลใจ",
		Comment:     "เรื่องราวสนุกและให้ข้อคิดดีมาก หนังสืออ่านเพลิน การจัดส่งรวดเร็วและการแพ็คแน่นหนาดีครับ",
		Status:      model.ReviewStatusPublished,
		CreatedDate: "2026-08-02T03:00:00.000Z",
		Reply: &seedReviewReply{
			ReplyText:   "ขอบคุณสำหรับรีวิวและกำลังใจครับ ทางเรายินดีอย่างยิ่งที่คุณลูกค้าประทับใจในหนังสือเล่มนี้",
			RepliedDate: "2026-08-02T09:00:00.000Z",
			RepliedBy:   "พนักงานฝ่ายขาย",
		},
	},
	{
		CustomerEmail: "napat@example.com", BookID: 101,
		Rating:      5,
		Headline:    "มีประโยชน์มาก นำไปปรับใช้ได้จริง",
		Comment:     "อ่านง่ายและนำไปใช้ได้จริง เริ่มปรับเปลี่ยนนิสัยได้หลายอย่างแล้ว แนะนำสำหรับคนที่ต้องการพัฒนาตัวเอง",
		Status:      model.ReviewStatusPending,
		CreatedDate: "2026-08-18T09:00:00.000Z",
	},
	{
		// สแปมที่รอผู้จัดการตัดสิน — คิวของหน้าจัดการรายงานต้องมีของตั้งแต่เข้าระบบครั้งแรก
		CustomerEmail: "kanya@example.com", BookID: 113,
		Rating:      1,
		Headline:    "ไม่เกี่ยวกับหนังสือเลย",
		Comment:     "คลิกที่นี่เพื่อหารายได้ต่อวันด้วยการทำงานจากที่บ้าน! แผนการลงทุนที่ดีที่สุดรับประกันผลตอบแทน ไปที่ www.scam-link.biz เพื่อเริ่มรับรายได้ตอนนี้ หนังสือก็โอเคแหละมั้ง",
		Status:      model.ReviewStatusPending,
		Flagged:     true,
		CreatedDate: "2026-08-26T07:30:00.000Z",
		Report: &seedReviewReport{
			Reason:     "สแปม / ไม่เกี่ยวข้อง",
			Detail:     "พบการโพสต์ข้อความหลอกลวงชักชวนลงทุนและแปะลิงก์ภายนอก",
			ReportedBy: "พนักงานฝ่ายขาย",
			ReportedAt: "2026-08-26T08:00:00.000Z",
			Status:     model.ApprovalStatusPending,
		},
	},
	{
		CustomerEmail: "kanya@example.com", BookID: 106,
		Rating:      1,
		Headline:    "ข้อความหยาบคาย",
		Comment:     "คนแปลห่วยมาก อ่านไม่รู้เรื่องเลย เสียเงินเปล่า",
		Status:      model.ReviewStatusHidden,
		Flagged:     true,
		CreatedDate: "2026-08-15T04:20:00.000Z",
		Report: &seedReviewReport{
			Reason:      "เนื้อหาไม่เหมาะสม / มีคำหยาบคาย",
			Detail:      "พบการใช้คำไม่สุภาพในการรีวิว",
			ReportedBy:  "พนักงานฝ่ายขาย",
			ReportedAt:  "2026-08-16T02:00:00.000Z",
			Status:      model.ApprovalStatusApproved,
			DecidedBy:   "ผู้จัดการร้าน",
			DecidedDate: "2026-08-16T06:00:00.000Z",
		},
	},
	{
		CustomerEmail: "napat@example.com", BookID: 108,
		Rating:      1,
		Headline:    "สแปมและคุกคาม",
		Comment:     "โพสต์สแปมข้อความซ้ำ ๆ และข้อความขยะ",
		Status:      model.ReviewStatusRemoved,
		Flagged:     true,
		CreatedDate: "2026-08-10T07:10:00.000Z",
		Report: &seedReviewReport{
			Reason:      "สแปม / ก่อกวน",
			Detail:      "ตรวจสอบพบเป็นบัญชีสร้างสแปม",
			ReportedBy:  "ผู้จัดการร้าน",
			ReportedAt:  "2026-08-11T03:00:00.000Z",
			Status:      model.ApprovalStatusApproved,
			DecidedBy:   "ผู้จัดการร้าน",
			DecidedDate: "2026-08-11T08:00:00.000Z",
		},
	},
}

// seedReviewRows — สร้างรีวิวตั้งต้นพร้อมคำตอบกลับและรายงาน
//
// ต้องรันหลัง seedCustomerOrderRows เสมอ เพราะ review.order_id อ้างถึง customer_order
func seedReviewRows(tx *gorm.DB) (int, error) {
	empty, err := tableEmpty[model.Review](tx, "รีวิว")
	if err != nil || !empty {
		return 0, err
	}

	for _, row := range seedReviews {
		customerID, err := customerIDByEmail(tx, row.CustomerEmail)
		if err != nil {
			return 0, err
		}

		review := model.Review{
			CustomerID:  customerID,
			BookID:      row.BookID,
			OrderID:     row.OrderID,
			Rating:      row.Rating,
			Headline:    row.Headline,
			Comment:     row.Comment,
			Status:      row.Status,
			Flagged:     row.Flagged,
			CreatedDate: mustTime(row.CreatedDate),
		}
		if row.Reply != nil {
			review.Replies = []model.ReviewReply{{
				ReplyText:   row.Reply.ReplyText,
				RepliedDate: mustTime(row.Reply.RepliedDate),
				RepliedBy:   row.Reply.RepliedBy,
			}}
		}
		if err := tx.Create(&review).Error; err != nil {
			return 0, fmt.Errorf("ใส่รีวิวของ %s ไม่สำเร็จ: %w", row.CustomerEmail, err)
		}

		if row.Report == nil {
			continue
		}
		report := model.ReviewReport{
			ReviewID:     review.ReviewID,
			Reason:       row.Report.Reason,
			Detail:       row.Report.Detail,
			ReportedBy:   row.Report.ReportedBy,
			ReportedDate: mustTime(row.Report.ReportedAt),
			Status:       row.Report.Status,
			DecidedBy:    row.Report.DecidedBy,
		}
		if row.Report.DecidedDate != "" {
			decided := mustTime(row.Report.DecidedDate)
			report.DecidedDate = &decided
		}
		if err := tx.Create(&report).Error; err != nil {
			return 0, fmt.Errorf("ใส่รายงานรีวิว %d ไม่สำเร็จ: %w", review.ReviewID, err)
		}
	}
	return len(seedReviews), nil
}
