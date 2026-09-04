// Package middleware — ชั้นห่อ handler: ยืนยันตัวตน ตรวจสิทธิ์ CORS บีบอัด log และกัน panic
package middleware

import (
	"compress/gzip"
	"context"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type contextKey string

const identityKey contextKey = "identity"

// Authenticator — สิ่งที่ตรวจ token ได้ (service.AuthService เป็นตัวจริง)
type Authenticator interface {
	Verify(token string) (*service.Identity, error)
}

// RequireAuth — ต้องมี Bearer token ที่ถูกต้อง แล้วฝากตัวตนไว้ใน context
func RequireAuth(auth Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, found := strings.CutPrefix(header, "Bearer ")
			if !found || strings.TrimSpace(token) == "" {
				httpx.Error(w, model.ErrUnauthenticated)
				return
			}

			identity, err := auth.Verify(strings.TrimSpace(token))
			if err != nil {
				httpx.Error(w, err)
				return
			}
			next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
		})
	}
}

// RequireRole — จำกัดบทบาทที่เรียก endpoint นี้ได้
//
// กฎเดียวกับ can.* ใน frontend/src/admin/permissions.ts — หน้าจอซ่อน/ปิดปุ่มให้แล้ว
// แต่ backend ต้องตรวจซ้ำ เพราะผู้ใช้ยิง API ตรงได้
func RequireRole(roles ...model.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			identity, ok := IdentityFrom(r.Context())
			if !ok {
				httpx.Error(w, model.ErrUnauthenticated)
				return
			}
			if !slices.Contains(roles, identity.Role) {
				httpx.Error(w, model.ErrForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// WithIdentity / IdentityFrom — เก็บและอ่านผู้ใช้ปัจจุบันจาก context
func WithIdentity(ctx context.Context, identity *service.Identity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}

func IdentityFrom(ctx context.Context) (*service.Identity, bool) {
	identity, ok := ctx.Value(identityKey).(*service.Identity)
	return identity, ok
}

// CORS — อนุญาตให้ dev server ของ frontend เรียก API ข้ามพอร์ตได้
func CORS(origins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(origins, origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Compress — บีบอัด response ด้วย gzip เมื่อผู้เรียกรับได้
//
// ข้อความที่ API ตอบกลับเป็นภาษาไทยเกือบทั้งหมด ซึ่ง UTF-8 ใช้ 3 ไบต์ต่อตัวอักษร
// รายการผู้จัดจำหน่ายพร้อมหนังสือที่เสนอขาย หรือใบสั่งซื้อทั้งชุด จึงหนักกว่าที่เห็นบนจอมาก
// และฐานข้อมูลกับผู้ใช้อยู่คนละเครือข่าย (Pi) ระยะทางจึงเป็นต้นทุนจริง
//
// เบราว์เซอร์ส่ง Accept-Encoding ให้เองทุกคำขอ ส่วน http.Client ของ cmd/smoke
// ปล่อยให้ Transport เติมเองแล้วคลายกลับให้อัตโนมัติ จึงไม่ต้องแก้ฝั่งผู้เรียกเลยสักที่
func Compress(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		// ตั้ง Vary ทุกครั้งที่ผลลัพธ์ขึ้นกับ header นี้ ไม่ใช่เฉพาะตอนที่บีบอัดจริง
		// ไม่งั้น cache ตัวกลางอาจส่งเนื้อหาที่บีบอัดแล้วให้ผู้เรียกที่รับไม่ได้
		w.Header().Add("Vary", "Accept-Encoding")

		writer := &gzipWriter{ResponseWriter: w}
		defer func() {
			if err := writer.Close(); err != nil {
				log.Printf("[gzip] ปิดตัวบีบอัดไม่สำเร็จ: %v", err)
			}
		}()
		next.ServeHTTP(writer, r)
	})
}

// gzipWriter — สร้าง *gzip.Writer ตอนรู้สถานะแล้วเท่านั้น
//
// 204 (httpx.NoContent) กับ 304 ห้ามมี body ตามสเปก HTTP ถ้าสร้างตัวบีบอัดไว้ล่วงหน้า
// การปิดมันจะเขียน header กับ trailer ของ gzip ลงไปเป็น body ของ response ที่ห้ามมี
type gzipWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	wroteHeader bool
}

func (w *gzipWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true

	if status != http.StatusNoContent && status != http.StatusNotModified {
		// ความยาวหลังบีบอัดไม่เท่าของเดิม ปล่อยให้ Go ใช้ chunked encoding แทน
		w.Header().Del("Content-Length")
		w.Header().Set("Content-Encoding", "gzip")
		w.gz = gzip.NewWriter(w.ResponseWriter)
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *gzipWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.gz == nil {
		return w.ResponseWriter.Write(b)
	}
	return w.gz.Write(b)
}

func (w *gzipWriter) Close() error {
	if w.gz == nil {
		return nil
	}
	return w.gz.Close()
}

// Recover — กัน panic ของ handler ไม่ให้ล้มทั้งเซิร์ฟเวอร์
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("[panic] %s %s: %v", r.Method, r.URL.Path, recovered)
				httpx.Error(w, model.Conflict("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequestLog — บันทึกทุก request พร้อมสถานะและเวลาที่ใช้
func RequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		log.Printf("%s %s → %d (%s)", r.Method, r.URL.Path, recorder.status, time.Since(started).Round(time.Millisecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// Chain — ห่อ handler ด้วย middleware หลายชั้น ตัวแรกในลิสต์อยู่นอกสุด
func Chain(handler http.Handler, wrappers ...func(http.Handler) http.Handler) http.Handler {
	for i := len(wrappers) - 1; i >= 0; i-- {
		handler = wrappers[i](handler)
	}
	return handler
}
