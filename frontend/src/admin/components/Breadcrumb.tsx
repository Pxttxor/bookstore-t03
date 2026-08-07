import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import './Breadcrumb.css'

export interface Crumb {
  label: string
  to?: string
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="เส้นทางหน้า">
      {items.map((item, i) => (
        <span key={item.label} className="crumbs__item">
          {i > 0 && <Icon name="chevron-right" size={14} />}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="crumbs__current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
