package middlewares

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware อนุญาตให้ Frontend (React/Vite) เชื่อมต่อ API ข้าม Port ได้
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// อนุญาตให้เข้าถึงได้จากทุก Origin (หรือเจาะจง http://localhost:5173 ได้)
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		// หากเป็น Preflight Request (OPTIONS) ให้ตอบกลับ Status 204 No Content ทันที
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
