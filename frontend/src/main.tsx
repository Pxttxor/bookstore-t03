import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ScrollToTop from './components/ScrollToTop'
import { CartProvider } from './cart/CartContext'
import { AuthProvider } from './auth/AuthContext'
import { NotificationProvider } from './admin/notifications/NotificationContext'
import { OrderProvider } from './admin/orders/OrderContext'
import { PaymentProvider } from './admin/payments/PaymentContext'
import { MembershipProvider } from './membership/MembershipContext'

// NotificationProvider and OrderProvider sit above both route groups: the storefront
// checkout has to create customer orders and alert staff, and the back office reads and
// advances those same orders. The heavier supplier / inventory / purchasing providers stay
// inside AdminLayout so the storefront never pays for them.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CartProvider>
          <NotificationProvider>
            <OrderProvider>
              <PaymentProvider>
                <MembershipProvider>
                  <App />
                </MembershipProvider>
              </PaymentProvider>
            </OrderProvider>
          </NotificationProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
