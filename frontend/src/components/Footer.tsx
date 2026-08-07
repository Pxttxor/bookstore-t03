import { Link } from 'react-router-dom'
import './Footer.css'

const FOOTER_LINKS = ['About Us', 'Contact', 'Privacy Policy', 'Terms of Service']

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner page-shell">
        <div className="footer__brand-col">
          <Link to="/" className="footer__brand">
            BookHaven
          </Link>
          <p className="footer__copy">© 2024 BookHaven. All rights reserved.</p>
        </div>
        <nav className="footer__links">
          {FOOTER_LINKS.map((label) => (
            <span key={label} className="footer__link">
              {label}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  )
}
