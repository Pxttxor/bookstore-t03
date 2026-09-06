import { Link, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from '../../components/Icon'
import './StatTile.css'

// Stat tile contract: label · value · optional note. The number is the chart — there
// is no sparkline behind it because this project keeps no history to plot.
export type TileTone = 'default' | 'accent' | 'warning' | 'danger'

interface StatTileProps {
  label: string
  value: string | number
  note?: string
  icon?: IconName
  tone?: TileTone
  to?: string
  linkLabel?: string
}

export default function StatTile({
  label,
  value,
  note,
  icon,
  tone = 'default',
  to,
  linkLabel,
}: StatTileProps) {
  const navigate = useNavigate()

  return (
    <article
      className={`tile tile--${tone}${to ? ' tile--clickable' : ''}`}
      onClick={
        to
          ? (e) => {
              if ((e.target as HTMLElement).closest('a')) return
              navigate(to)
            }
          : undefined
      }
    >
      <header className="tile__head">
        {icon && <Icon name={icon} size={18} />}
        <h3 className="tile__label">{label}</h3>
      </header>

      <p className="tile__value">{value}</p>
      {note && <p className="tile__note">{note}</p>}

      {to && (
        <Link to={to} className="tile__link">
          {linkLabel ?? 'ดูรายละเอียด'}
          <Icon name="arrow-right" size={16} />
        </Link>
      )}
    </article>
  )
}
