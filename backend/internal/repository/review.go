// review.go — รีวิวลูกค้า ข้อความตอบกลับ และรายงานรีวิวผิดปกติ
// (ระบบย่อยของดวงกมล กองพันธ์)
package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type ReviewRepository struct{ db *gorm.DB }

func NewReviewRepository(db *gorm.DB) *ReviewRepository {
	return &ReviewRepository{db: db}
}

// ReviewFilter — ตัวกรองของหน้าตรวจสอบรีวิว
//
// Flagged/Reported เป็น *bool เพราะ "ไม่กรอง" ต่างจาก "กรองเอาเฉพาะที่เป็น false"
// (เหตุผลเดียวกับ InventoryItem.ReorderPoint ที่เป็น *int)
type ReviewFilter struct {
	Status     model.ReviewStatus
	BookID     int
	CustomerID int
	Flagged    *bool
	Reported   *bool
}

// ReviewRow — รีวิวพร้อมชื่อลูกค้า ชื่อหนังสือ และรายงาน (ถ้ามี)
// หน้าจอต้องแสดงครบชุดนี้เสมอ จึง join ให้เสร็จที่ชั้นนี้ ไม่ปล่อยให้ service ยิง N+1
type ReviewRow struct {
	Review   model.Review
	Customer model.Person
	Book     model.Book
	Report   *model.ReviewReport
}

func (r *ReviewRepository) List(filter ReviewFilter) ([]ReviewRow, error) {
	query := r.db.
		Preload("Replies", func(db *gorm.DB) *gorm.DB { return db.Order("replied_date, reply_id") }).
		Order("review_id DESC")

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.BookID > 0 {
		query = query.Where("book_id = ?", filter.BookID)
	}
	if filter.CustomerID > 0 {
		query = query.Where("customer_id = ?", filter.CustomerID)
	}
	if filter.Flagged != nil {
		query = query.Where("flagged = ?", *filter.Flagged)
	}
	if filter.Reported != nil {
		exists := "EXISTS (SELECT 1 FROM review_report rr WHERE rr.review_id = review.review_id)"
		if !*filter.Reported {
			exists = "NOT " + exists
		}
		query = query.Where(exists)
	}

	var reviews []model.Review
	if err := query.Find(&reviews).Error; err != nil {
		return nil, err
	}
	return r.attach(reviews)
}

// RatingSummary — คะแนนรวมของหนังสือหนึ่งเล่ม นับเฉพาะรีวิวที่เผยแพร่แล้ว
type RatingSummary struct {
	Average float64
	Count   int
}

// RatingsByBook — คะแนนเฉลี่ยของทุกเล่มในคำสั่งเดียว
//
// หน้าร้านแสดงดาวบนการ์ดทุกใบ ถ้าถามทีละเล่มจะเป็น N+1 จึง GROUP BY ทีเดียว
// นับเฉพาะ PUBLISHED เหมือน ForBook() — รีวิวที่รอตรวจหรือถูกซ่อนต้องไม่มีผลกับคะแนนที่ลูกค้าเห็น
func (r *ReviewRepository) RatingsByBook() (map[int]RatingSummary, error) {
	var rows []struct {
		BookID  int
		Average float64
		Count   int
	}
	err := r.db.Model(&model.Review{}).
		Select("book_id, AVG(rating) AS average, COUNT(*) AS count").
		Where("status = ?", model.ReviewStatusPublished).
		Group("book_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	summary := make(map[int]RatingSummary, len(rows))
	for _, row := range rows {
		summary[row.BookID] = RatingSummary{Average: row.Average, Count: row.Count}
	}
	return summary, nil
}

func (r *ReviewRepository) Find(db *gorm.DB, reviewID int) (*ReviewRow, error) {
	review, err := r.find(db, reviewID)
	if err != nil {
		return nil, err
	}
	rows, err := r.attach([]model.Review{*review})
	if err != nil {
		return nil, err
	}
	return &rows[0], nil
}

func (r *ReviewRepository) find(db *gorm.DB, reviewID int) (*model.Review, error) {
	var review model.Review
	err := db.
		Preload("Replies", func(db *gorm.DB) *gorm.DB { return db.Order("replied_date, reply_id") }).
		First(&review, "review_id = ?", reviewID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrReviewNotFound
	}
	if err != nil {
		return nil, err
	}
	return &review, nil
}

// FindForUpdate — อ่านพร้อมล็อกแถวหัวเอกสาร กันกดปุ่มตรวจสอบซ้อนกัน
//
// Preload กับ FOR UPDATE ใช้พร้อมกันไม่ได้ จึงล็อกหัวเอกสารก่อนแล้วค่อยอ่านคำตอบกลับ
// (เหตุผลเดียวกับ DeliveryRepository.FindForUpdate)
func (r *ReviewRepository) FindForUpdate(tx *gorm.DB, reviewID int) (*model.Review, error) {
	var review model.Review
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&review, "review_id = ?", reviewID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrReviewNotFound
	}
	if err != nil {
		return nil, err
	}
	err = tx.Order("replied_date, reply_id").Find(&review.Replies, "review_id = ?", reviewID).Error
	if err != nil {
		return nil, err
	}
	return &review, nil
}

// ExistsFor — ลูกค้ารายนี้รีวิวเล่มนี้จากใบนี้ไปแล้วหรือยัง
// (คู่กับ unique index uq_review_customer_book_order ที่กันอีกชั้นในฐานข้อมูล)
func (r *ReviewRepository) ExistsFor(db *gorm.DB, customerID, bookID, orderID int) (bool, error) {
	var count int64
	err := db.Model(&model.Review{}).
		Where("customer_id = ? AND book_id = ? AND order_id = ?", customerID, bookID, orderID).
		Count(&count).Error
	return count > 0, err
}

func (r *ReviewRepository) Create(db *gorm.DB, review *model.Review) error {
	return db.Create(review).Error
}

// Save — เขียนสถานะและธงคำไม่เหมาะสมกลับลงหัวเอกสาร
// เนื้อรีวิวไม่แก้หลังส่งแล้ว (หน้าจอไม่มีปุ่มแก้ไข) จึงไม่อยู่ในชุดที่เขียนกลับ
func (r *ReviewRepository) Save(tx *gorm.DB, review *model.Review) error {
	return tx.Model(&model.Review{}).
		Where("review_id = ?", review.ReviewID).
		Updates(map[string]any{
			"status":  review.Status,
			"flagged": review.Flagged,
		}).Error
}

// AddReplies — บันทึกคำตอบกลับที่เพิ่งเพิ่มเข้ามา
func (r *ReviewRepository) AddReplies(tx *gorm.DB, rows []model.ReviewReply) error {
	if len(rows) == 0 {
		return nil
	}
	return tx.Create(&rows).Error
}

// ── รายงานรีวิวผิดปกติ ──────────────────────────────────────────────────

// ReportRow — รายงานพร้อมรีวิวต้นเรื่อง ชื่อลูกค้า และชื่อหนังสือ
type ReportRow struct {
	Report model.ReviewReport
	Review ReviewRow
}

func (r *ReviewRepository) ListReports(status model.ApprovalStatus) ([]ReportRow, error) {
	query := r.db.Order("report_id DESC")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var reports []model.ReviewReport
	if err := query.Find(&reports).Error; err != nil {
		return nil, err
	}
	return r.attachReports(reports)
}

func (r *ReviewRepository) FindReport(db *gorm.DB, reportID int) (*ReportRow, error) {
	var report model.ReviewReport
	err := db.First(&report, "report_id = ?", reportID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrReviewReportNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.attachReports([]model.ReviewReport{report})
	if err != nil {
		return nil, err
	}
	return &rows[0], nil
}

// FindReportByReview — รายงานของรีวิวหนึ่งชิ้น (0..1 ตาม diagram)
// คืน nil โดยไม่เป็น error ถ้ารีวิวนั้นยังไม่ถูกรายงาน
func (r *ReviewRepository) FindReportByReview(db *gorm.DB, reviewID int) (*model.ReviewReport, error) {
	var report model.ReviewReport
	err := db.First(&report, "review_id = ?", reviewID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ReviewRepository) CreateReport(tx *gorm.DB, report *model.ReviewReport) error {
	return tx.Create(report).Error
}

func (r *ReviewRepository) SaveReport(tx *gorm.DB, report *model.ReviewReport) error {
	return tx.Model(&model.ReviewReport{}).
		Where("report_id = ?", report.ReportID).
		Updates(map[string]any{
			"status":       report.Status,
			"decided_by":   report.DecidedBy,
			"decided_date": report.DecidedDate,
		}).Error
}

// ── ตัวช่วยเติมข้อมูลที่หน้าจอต้องใช้ ───────────────────────────────────

func (r *ReviewRepository) attach(reviews []model.Review) ([]ReviewRow, error) {
	rows := make([]ReviewRow, len(reviews))
	if len(reviews) == 0 {
		return rows, nil
	}

	customerIDs := make([]int, 0, len(reviews))
	bookIDs := make([]int, 0, len(reviews))
	reviewIDs := make([]int, 0, len(reviews))
	for _, review := range reviews {
		customerIDs = append(customerIDs, review.CustomerID)
		bookIDs = append(bookIDs, review.BookID)
		reviewIDs = append(reviewIDs, review.ReviewID)
	}

	var customers []model.Customer
	if err := r.db.Find(&customers, "customer_id IN ?", customerIDs).Error; err != nil {
		return nil, err
	}
	personIDs := make([]int, 0, len(customers))
	personOf := make(map[int]int, len(customers))
	for _, customer := range customers {
		personIDs = append(personIDs, customer.PersonID)
		personOf[customer.CustomerID] = customer.PersonID
	}

	byPerson := map[int]model.Person{}
	if len(personIDs) > 0 {
		var persons []model.Person
		if err := r.db.Find(&persons, "person_id IN ?", personIDs).Error; err != nil {
			return nil, err
		}
		for _, person := range persons {
			byPerson[person.PersonID] = person
		}
	}

	var books []model.Book
	if err := r.db.Find(&books, "book_id IN ?", bookIDs).Error; err != nil {
		return nil, err
	}
	byBook := make(map[int]model.Book, len(books))
	for _, book := range books {
		byBook[book.BookID] = book
	}

	var reports []model.ReviewReport
	if err := r.db.Find(&reports, "review_id IN ?", reviewIDs).Error; err != nil {
		return nil, err
	}
	byReview := make(map[int]model.ReviewReport, len(reports))
	for _, report := range reports {
		byReview[report.ReviewID] = report
	}

	for i, review := range reviews {
		row := ReviewRow{
			Review:   review,
			Customer: byPerson[personOf[review.CustomerID]],
			Book:     byBook[review.BookID],
		}
		if report, ok := byReview[review.ReviewID]; ok {
			row.Report = &report
		}
		rows[i] = row
	}
	return rows, nil
}

func (r *ReviewRepository) attachReports(reports []model.ReviewReport) ([]ReportRow, error) {
	rows := make([]ReportRow, len(reports))
	if len(reports) == 0 {
		return rows, nil
	}

	reviewIDs := make([]int, len(reports))
	for i, report := range reports {
		reviewIDs[i] = report.ReviewID
	}

	var reviews []model.Review
	err := r.db.
		Preload("Replies", func(db *gorm.DB) *gorm.DB { return db.Order("replied_date, reply_id") }).
		Find(&reviews, "review_id IN ?", reviewIDs).Error
	if err != nil {
		return nil, err
	}
	reviewRows, err := r.attach(reviews)
	if err != nil {
		return nil, err
	}
	byReview := make(map[int]ReviewRow, len(reviewRows))
	for _, row := range reviewRows {
		byReview[row.Review.ReviewID] = row
	}

	for i, report := range reports {
		rows[i] = ReportRow{Report: report, Review: byReview[report.ReviewID]}
	}
	return rows, nil
}
