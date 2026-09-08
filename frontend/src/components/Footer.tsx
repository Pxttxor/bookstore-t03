import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner page-shell">
        <div className="footer__brand-col">
          <Link to="/" className="footer__brand">
            BookHaven
          </Link>
          <p className="footer__copy">© 2026 BookHaven. All rights reserved.</p>
        </div>

        <div className="footer__info-row">
          <div className="footer__info-item">
            <span className="footer__info-title">About Us</span>
            <span className="footer__info-text">Curated books with free nationwide delivery</span>
          </div>

          <div className="footer__info-item">
            <span className="footer__info-title">Contact</span>
            <span className="footer__info-text">
              Manager: Piyaporn Wongthong <br />
              Tel: 081-100-1002
            </span>
          </div>

          <div className="footer__info-item">
            <span className="footer__info-title">Privacy Policy</span>
            <span className="footer__info-text">Secure checkout and protected customer data</span>
          </div>

          <div className="footer__info-item">
            <span className="footer__info-title">Terms of Service</span>
            <span className="footer__info-text">Standard ordering, refund and rewards policy</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
