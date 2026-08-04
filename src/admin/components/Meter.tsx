import './Meter.css'

// A single ratio against a limit. The fill carries severity and the unfilled track is
// a lighter step of the same ramp, so the state reads across the whole bar.
export type MeterTone = 'accent' | 'warning' | 'danger'

interface MeterProps {
  /** 0-100. Values outside the range are clamped so an over-budget bar stays full. */
  percent: number
  tone?: MeterTone
  label: string
}

export default function Meter({ percent, tone = 'accent', label }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={`meter meter--${tone}`}
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="meter__fill" style={{ inlineSize: `${clamped}%` }} />
    </div>
  )
}
