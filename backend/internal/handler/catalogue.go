// catalogue.go — handler ของแคตตาล็อกหน้าร้าน
//
// **สามเส้นทางนี้เปิดสาธารณะโดยตั้งใจ** ลงทะเบียนตรงบน mux ใน routes.go
// ไม่ผ่าน register() เพราะคนเดินดูร้านยังไม่ล็อกอิน · เป็นเส้นทางอ่านอย่างเดียว
// และเห็นเฉพาะหนังสือที่ขายอยู่ (CatalogueService คัดให้แล้ว)
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
)

func (h *Handler) listCatalogue(w http.ResponseWriter, _ *http.Request) {
	rows, err := h.catalogue.List()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCatalogueBookDTOs(rows))
}

func (h *Handler) listCatalogueCategories(w http.ResponseWriter, _ *http.Request) {
	categories, err := h.catalogue.Categories()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, categories)
}

func (h *Handler) getCatalogueBook(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	detail, err := h.catalogue.Get(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCatalogueDetailDTO(*detail))
}
