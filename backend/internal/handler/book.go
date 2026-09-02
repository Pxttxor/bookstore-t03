// book.go — handler ของหมวดหมู่ หนังสือ และประวัติการแก้ไข (ระบบย่อยข้อมูลหนังสือ)
package handler

import (
	"net/http"
	"strconv"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// registerBookRoutes — แคตตาล็อกหนังสือ
//
// อ่านเปิดให้ทุกบทบาทหลังร้าน เพราะ U5–U10 ต้องรู้ชื่อเรื่องของหนังสือที่สั่งซื้อ
// ส่วนการเขียนเป็นของฝ่ายขาย (เจ้าของแคตตาล็อก) และผู้จัดการ ตามตารางสิทธิ์ของหน้าจอ
func (h *Handler) registerBookRoutes(register registrar) {
	register("GET /api/categories", roleOffice, h.listCategories)
	register("GET /api/books", roleOffice, h.listBooks)
	register("GET /api/books/{id}", roleOffice, h.getBook)
	register("GET /api/books/{id}/change-logs", roleCatalogue, h.bookChangeLogs)
	register("POST /api/books", roleCatalogue, h.createBook)                // Book.add()
	register("PUT /api/books/{id}", roleCatalogue, h.updateBook)            // Book.update()
	register("POST /api/books/{id}/status", roleCatalogue, h.setBookStatus) // เปิด/ปิดการขาย
}

func (h *Handler) listCategories(w http.ResponseWriter, _ *http.Request) {
	categories, err := h.books.Categories()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, categories)
}

func (h *Handler) listBooks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	// categoryId ที่ไม่ใช่ตัวเลขถือว่าไม่ได้กรอง — หน้าจอส่งค่าว่างมาเมื่อเลือก "ทุกหมวดหมู่"
	categoryID, _ := strconv.Atoi(query.Get("categoryId"))

	books, err := h.books.List(repository.BookFilter{
		Query:      query.Get("q"),
		CategoryID: categoryID,
		Status:     model.BookStatus(query.Get("status")),
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toBookDTOs(books))
}

func (h *Handler) getBook(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.books.Get(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toBookDTO(*view))
}

func (h *Handler) bookChangeLogs(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	logs, err := h.books.ChangeLogs(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toChangeLogDTOs(logs))
}

func (h *Handler) createBook(w http.ResponseWriter, r *http.Request) {
	var body model.BookDraft
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.books.Create(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toBookDTO(*view))
}

func (h *Handler) updateBook(w http.ResponseWriter, r *http.Request) {
	h.writeBook(w, r, func(id int, by string, r *http.Request) (*service.BookView, error) {
		var body model.BookDraft
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		return h.books.Update(id, body, by)
	})
}

func (h *Handler) setBookStatus(w http.ResponseWriter, r *http.Request) {
	h.writeBook(w, r, func(id int, by string, r *http.Request) (*service.BookView, error) {
		var body service.StatusInput
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		return h.books.SetStatus(id, body.Status, by)
	})
}

// writeBook — โครงร่วมของ handler ที่แก้หนังสือหนึ่งเล่ม (อ่านรหัส → อ่านผู้ทำรายการ → ตอบ)
func (h *Handler) writeBook(
	w http.ResponseWriter, r *http.Request,
	apply func(id int, by string, r *http.Request) (*service.BookView, error),
) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := apply(id, current.Name, r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toBookDTO(*view))
}
