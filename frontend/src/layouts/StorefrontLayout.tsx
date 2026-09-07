import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import { CatalogueProvider } from '../catalogue/CatalogueContext'
import './StorefrontLayout.css'

export default function StorefrontLayout() {
  const { pathname } = useLocation()
  const isLoginRoute = pathname === '/login'
  const isSignupRoute = pathname === '/signup'
  const showSearch = pathname === '/' || pathname.startsWith('/book') || isLoginRoute || isSignupRoute

  return (
    // แคตตาล็อกครอบทั้งหน้าร้าน แต่ไม่ขึ้นไป main.tsx — หลังร้านมี BookContext
    // ของตัวเองที่อ่าน /api/books พร้อมสถานะและประวัติการแก้ไขอยู่แล้ว
    <CatalogueProvider>
      <div className="storefront">
        <TopNav showSearch={showSearch} />
        <main className="storefront__main">
          {/* Checkout / tracking / profile are lazy chunks; null fallback keeps the
              "no loading skeletons" deviation intact. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        {/* /login และ /signup เรนเดอร์ HomePage เป็นฉากหลัง (ดู App.tsx) แล้วให้กล่องนี้
            ลอยทับตาม pathname — ไม่ lazy() เพราะเป็น overlay เล็ก ไม่ใช่หน้าจอเต็มที่โหลดแยก */}
        {(isLoginRoute || isSignupRoute) && (
          <AuthModal mode={isLoginRoute ? 'login' : 'signup'} />
        )}
      </div>
    </CatalogueProvider>
  )
}
