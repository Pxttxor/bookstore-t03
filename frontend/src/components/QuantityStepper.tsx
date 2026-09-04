import Icon from './Icon'
import './QuantityStepper.css'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: QuantityStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className="qty">
      <button
        type="button"
        className="qty__btn"
        onClick={dec}
        disabled={value <= min}
        aria-label="ลดจำนวน"
      >
        <Icon name="minus" size={16} />
      </button>
      <span className="qty__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="qty__btn"
        onClick={inc}
        disabled={value >= max}
        aria-label="เพิ่มจำนวน"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
