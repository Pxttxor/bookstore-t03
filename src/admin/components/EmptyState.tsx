import Icon, { type IconName } from '../../components/Icon'
import './EmptyState.css'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({
  icon = 'search',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__text">{description}</p>}
      {action && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
