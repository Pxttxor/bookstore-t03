import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import Icon, { type IconName } from '../../components/Icon'
import './Toast.css'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastValue {
  notify: (tone: ToastTone, message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check-circle',
  error: 'alert-triangle',
  warning: 'alert-triangle',
  info: 'help',
}

const DISMISS_AFTER = 5000

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const value = useMemo<ToastValue>(
    () => ({
      notify: (tone, message, action) => {
        const id = nextId++
        setToasts((current) => [...current, { id, tone, message, action }])
        window.setTimeout(() => dismiss(id), DISMISS_AFTER)
      },
    }),
    [dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon name={TONE_ICON[toast.tone]} size={20} />
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast__close"
              aria-label="ปิดการแจ้งเตือน"
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
