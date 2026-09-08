import { Link } from 'react-router-dom'
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
}

export default function StatTile({ label, value, note, icon, tone = 'default', to }: StatTileProps) {
  const className = `tile tile--${tone}${to ? ' tile--clickable' : ''}`

  const body = (
    <>
      <header className="tile__head">
        {icon && <Icon name={icon} size={18} />}
        <h3 className="tile__label">{label}</h3>
      </header>

      <p className="tile__value">{value}</p>
      {note && <p className="tile__note">{note}</p>}
    </>
  )

  // The whole card is the link target — no separate "ดูรายละเอียด" row underneath, per
  // the Figma spec's §SCR-01 mock (label + number, nothing else). A real <a> (via Link)
  // keeps Tab/Enter working; an <article onClick> would not be focusable at all.
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return <article className={className}>{body}</article>
}
