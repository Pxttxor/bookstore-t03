import { useEffect, useRef, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

export default function Modal({ title, onClose, footer, children }: ModalProps) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
      onClose()
    }
    mouseDownTargetRef.current = null
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="modal__close" aria-label="ปิด" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}
