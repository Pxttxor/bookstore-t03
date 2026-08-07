import { useState } from 'react'
import Icon from './Icon'
import './RatingStars.css'

interface RatingStarsProps {
  value?: number
  size?: number
  interactive?: boolean
  onChange?: (value: number) => void
}

export default function RatingStars({
  value = 0,
  size = 18,
  interactive = false,
  onChange,
}: RatingStarsProps) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div
      className={'rating' + (interactive ? ' rating--interactive' : '')}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rating ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(active)
        return interactive ? (
          <button
            key={n}
            type="button"
            className="rating__star"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange?.(n)}
          >
            <Icon name="star" size={size} filled={filled} />
          </button>
        ) : (
          <span key={n} className="rating__star">
            <Icon name="star" size={size} filled={filled} />
          </span>
        )
      })}
    </div>
  )
}
