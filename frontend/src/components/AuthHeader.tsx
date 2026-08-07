import { Link } from 'react-router-dom'
import Icon from './Icon'
import './AuthHeader.css'

export default function AuthHeader() {
  return (
    <header className="auth-header">
      <div className="auth-header__inner page-shell">
        <Link to="/" className="auth-header__brand">
          <Icon name="book" size={26} />
          <span>BookHaven</span>
        </Link>
        <Link to="/" className="auth-header__back">
          <Icon name="arrow-left" size={16} />
          <span>Back to store</span>
        </Link>
      </div>
    </header>
  )
}
