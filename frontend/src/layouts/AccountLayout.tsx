import { Navigate, Outlet, useLocation } from 'react-router-dom'
import AccountNav from '../components/AccountNav'
import LoadingState from '../admin/components/LoadingState'
import { useAuth } from '../auth/AuthContext'
import './AccountLayout.css'

// เลย์เอาต์ร่วมของหน้าบัญชี — /profile, /orders, /member/points, /member/rewards —
// แถบเมนูซ้าย (AccountNav) ค้างอยู่ทุกหน้า แบบตัวอย่าง SE-ED ที่ผู้ใช้ส่งมา (คำขอ 7 ก.ย. 69)
// เดิมแต่ละหน้ามี guard `if (!user) return <Navigate to="/login" .../>` ของตัวเอง — ยกมา
// รวมไว้ที่นี่ที่เดียว เพราะแถบเมนูเองก็ต้องใช้ `user` มาแสดงชื่อ/อีเมล ถ้าไม่กันตรงนี้ก่อน
// แถบเมนูจะพยายามอ่าน user ที่เป็น null ก่อนที่ guard ของหน้าลูกจะทำงาน
export default function AccountLayout() {
  const { user, initialising } = useAuth()
  const { pathname } = useLocation()

  // มี token ค้างอยู่แต่ยังไม่รู้ผลจาก GET /api/auth/me — ถ้าเด้งออกตอนนี้ ผู้ใช้ที่ยัง
  // ล็อกอินอยู่จะโดนส่งไปหน้าเข้าสู่ระบบทุกครั้งที่รีเฟรชหน้าบัญชี (แพทเทิร์นเดียวกับ AdminLayout)
  if (initialising) {
    return (
      <div className="account account--booting page-shell">
        <LoadingState label="กำลังตรวจสอบสิทธิ์การใช้งาน…" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />

  return (
    <div className="account page-shell">
      <AccountNav user={user} />
      <div className="account__main">
        <Outlet />
      </div>
    </div>
  )
}
