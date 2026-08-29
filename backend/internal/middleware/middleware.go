// Package middleware — ชั้นห่อ handler: ยืนยันตัวตน ตรวจสิทธิ์ CORS log และกัน panic
package middleware

import (
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
