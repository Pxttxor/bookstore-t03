// Package httpx — ตัวช่วยระดับ HTTP ที่ handler ทุกตัวใช้ร่วมกัน
//
// รูปแบบ response ตายตัวสองแบบ:
//
//	สำเร็จ  → เนื้อหาของทรัพยากรตรง ๆ (array หรือ object)
//	ผิดพลาด → {"error": {"code": "SUPPLIER_DUPLICATE", "message": "มีผู้จัดจำหน่ายชื่อนี้อยู่แล้ว"}}
//
// code เป็นอังกฤษให้ frontend เอาไป switch ได้ ส่วน message เป็นไทยสำหรับแสดงบนหน้าจอ
package httpx

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"bookstore-t03/internal/model"
)

// errorBody — โครงสร้าง response ตอนเกิดข้อผิดพลาด
type errorBody struct {
	Error *model.DomainError `json:"error"`
}

// JSON — เขียน response สำเร็จ
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// header ส่งไปแล้ว แก้อะไรไม่ได้ ได้แค่บันทึกไว้
		log.Printf("[httpx] เขียน response ไม่สำเร็จ: %v", err)
	}
}

// OK / Created / NoContent — ทางลัดที่ใช้บ่อย
func OK(w http.ResponseWriter, payload any)      { JSON(w, http.StatusOK, payload) }
func Created(w http.ResponseWriter, payload any) { JSON(w, http.StatusCreated, payload) }
func NoContent(w http.ResponseWriter)            { w.WriteHeader(http.StatusNoContent) }

// Error — แปลง error เป็น response
//
// DomainError รู้สถานะและข้อความไทยของตัวเอง ส่วน error อื่นถือเป็นความผิดพลาดของระบบ
// ตอบ 500 พร้อมข้อความกลาง ๆ และบันทึกรายละเอียดจริงลง log ไม่ส่งออกไปให้ผู้ใช้เห็น
func Error(w http.ResponseWriter, err error) {
	var domain *model.DomainError
	if errors.As(err, &domain) {
		JSON(w, domain.Status, errorBody{Error: domain})
		return
	}
	log.Printf("[httpx] ข้อผิดพลาดที่ไม่ได้จัดการ: %v", err)
	JSON(w, http.StatusInternalServerError, errorBody{Error: &model.DomainError{
		Code:    "INTERNAL_ERROR",
		Message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
		Status:  http.StatusInternalServerError,
	}})
}

// Decode — อ่าน JSON body เข้า struct
// ปฏิเสธฟิลด์ที่ไม่รู้จัก เพื่อให้พิมพ์ชื่อฟิลด์ผิดกลายเป็น error ทันทีแทนที่จะเงียบหาย
func Decode(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return model.Validation("INVALID_BODY", "รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง: "+err.Error())
	}
	return nil
}

// PathInt — อ่านพารามิเตอร์ตัวเลขจาก path เช่น /api/suppliers/{id}
func PathInt(r *http.Request, name string) (int, error) {
	raw := r.PathValue(name)
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, model.Validation("INVALID_PATH_PARAM", "รหัสในลิงก์ต้องเป็นตัวเลข: "+raw)
	}
	return value, nil
}

// QueryInt — อ่าน query string ที่เป็นตัวเลข คืน fallback เมื่อไม่ได้ส่งมา
func QueryInt(r *http.Request, name string, fallback int) int {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}
