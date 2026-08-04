import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../components/Icon'
import './ContactCard.css'

export interface ContactChannel {
  icon: IconName
  label: string
}

interface ContactCardProps {
  icon: IconName
  name: string
  /** What this contact is reached about — their part in the purchasing process. */
  duty: string
  channels: ContactChannel[]
  to?: string
  linkLabel?: string
}

export default function ContactCard({
  icon,
  name,
  duty,
  channels,
  to,
  linkLabel,
}: ContactCardProps) {
  return (
    <article className="contact">
      <header className="contact__head">
        <span className="contact__avatar">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h3 className="contact__name">{name}</h3>
          <p className="contact__duty">{duty}</p>
        </div>
      </header>

      <ul className="contact__channels">
        {channels.map((channel) => (
          <li key={channel.label}>
            <Icon name={channel.icon} size={15} />
            {channel.label}
          </li>
        ))}
      </ul>

      {to && (
        <Link to={to} className="contact__link">
          {linkLabel ?? 'ดูรายละเอียด'}
          <Icon name="arrow-right" size={15} />
        </Link>
      )}
    </article>
  )
}
