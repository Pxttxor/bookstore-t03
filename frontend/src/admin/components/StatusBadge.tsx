import './StatusBadge.css'

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info'
  | 'amber'
  | 'cyan'
  | 'orange'
  | 'violet'
  | 'blue'
  | 'purple'
  | 'teal'
  | 'indigo'
  | 'rose'

interface StatusBadgeProps {
  tone: BadgeTone
  children: React.ReactNode
}

export default function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
