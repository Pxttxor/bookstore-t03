import Icon from '../../components/Icon'
import './Stepper.css'

// The document stepper from §7 of the UI spec: รออนุมัติ → อนุมัติ → ส่ง → ยืนยัน → รับ.
const PURCHASE_STEPS = ['รออนุมัติ', 'อนุมัติ', 'ส่ง', 'ยืนยัน', 'รับ'] as const

interface StepperProps {
  steps?: readonly string[]
  /** Index of the step in progress. Everything before it counts as done. */
  current: number
  /** Marks the flow as stopped at `current` — used for a rejected requisition. */
  stopped?: boolean
}

export default function Stepper({ steps = PURCHASE_STEPS, current, stopped }: StepperProps) {
  return (
    <ol className="stepper">
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        const modifier = stopped && active ? 'stopped' : done ? 'done' : active ? 'active' : 'idle'

        return (
          <li key={label} className={`stepper__step stepper__step--${modifier}`}>
            <span className="stepper__dot">
              {done ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <span className="stepper__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
