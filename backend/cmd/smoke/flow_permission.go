// flow_permission.go — ตรวจว่า role guard ของทุกเส้นทางตรงกับ can.* ใน permissions.ts
package main

// runPermissionFlow — สิทธิ์การใช้งาน
func runPermissionFlow(e *env) {
	warehouse, sales := e.warehouse, e.sales

	section("สิทธิ์การใช้งาน (permissions.ts)")
	check("ไม่ส่ง token → 401", func() error {
		return expectStatus("GET", "/api/suppliers", "", nil, 401)
	})
	check("ฝ่ายขายเพิ่มผู้จัดจำหน่ายไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/suppliers", sales, supplierBody("ร้านทดสอบสิทธิ์"), 403)
	})
	check("คลังสินค้าปิดใช้งานผู้จัดจำหน่ายไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/suppliers/1/deactivate", warehouse,
			map[string]any{"reason": "เลิกกิจการ"}, 403)
	})
	check("คลังสินค้าอนุมัติใบขอสั่งซื้อไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/requisitions/101/approve", warehouse,
			map[string]any{}, 403)
	})
}
