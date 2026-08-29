// book.go — ระบบย่อยข้อมูลหนังสือ (เจ้าของ: วุฒิภัทร โกฎแสง)
// อ้างอิง class diagram: Sub1-Book-Management.md
package model

// Book — หนังสือหนึ่งเล่มในแคตตาล็อก
type Book struct {
	BookID      int        `gorm:"column:book_id;primaryKey" json:"bookId"`
	ISBN        string     `gorm:"column:isbn;type:varchar(20);not null;uniqueIndex" json:"isbn"`
	Title       string     `gorm:"column:title;type:varchar(300);not null" json:"title"`
	Author      string     `gorm:"column:author;type:varchar(200);not null" json:"author"`
	Publisher   string     `gorm:"column:publisher;type:varchar(200);not null" json:"publisher"`
	Price       float64    `gorm:"column:price;type:numeric(12,2);not null" json:"price"`
	Description string     `gorm:"column:description;type:text" json:"description"`
	Status      BookStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
}

func (Book) TableName() string { return "book" }
