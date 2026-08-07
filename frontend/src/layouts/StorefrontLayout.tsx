import { Outlet, useLocation } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Footer from '../components/Footer'
import './StorefrontLayout.css'

export default function StorefrontLayout() {
  const { pathname } = useLocation()
  const showSearch = pathname === '/' || pathname.startsWith('/book')

  return (
    <div className="storefront">
      <TopNav showSearch={showSearch} />
      <main className="storefront__main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
