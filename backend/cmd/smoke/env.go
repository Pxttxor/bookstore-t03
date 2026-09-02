// env.go — สถานะที่ flow แต่ละตัวส่งต่อกัน
//
// เก็บ token ของแต่ละบทบาท และรหัสเอกสารที่ flow ก่อนหน้าสร้างไว้ให้ flow ถัดไปใช้ต่อ
// (เช่น คำสั่งซื้อที่ flow ชำระเงินดันเป็น PAID จะถูก flow จัดส่งเอาไปใช้ต่อ)
package main

type env struct {
	// token ต่อบทบาท
	warehouse string
	manager   string
	sales     string
	delivery  string

	// token ของลูกค้าที่ flow สมัครสมาชิกสร้างขึ้นระหว่างทาง
	customer string
}
