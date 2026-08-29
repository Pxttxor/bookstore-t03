package middlewares

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger Middleware สำหรับพิมพ์ Log การเรียกใช้งาน API (Method, Path, Status, Duration)
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// ให้ Handler ถัดไปทำงาน
		c.Next()

		duration := time.Since(startTime)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path

		log.Printf("[API] %s | %3d | %12v | %s %s\n",
			c.ClientIP(),
			status,
			duration,
			method,
			path,
		)
	}
}
