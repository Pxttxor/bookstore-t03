import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Book } from '../data/books'

export interface CartLine {
  book: Book
  qty: number
}

interface CartValue {
  lines: CartLine[]
  count: number
  subtotal: number
  addItem: (book: Book, qty?: number) => void
  setQty: (id: string, qty: number) => void
  removeItem: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  const value = useMemo<CartValue>(() => {
    const addItem = (book: Book, qty = 1) =>
      setLines((prev) => {
        const existing = prev.find((l) => l.book.id === book.id)
        if (existing) {
          return prev.map((l) =>
            l.book.id === book.id ? { ...l, qty: l.qty + qty } : l,
          )
        }
        return [...prev, { book, qty }]
      })

    const setQty = (id: string, qty: number) =>
      setLines((prev) =>
        prev
          .map((l) => (l.book.id === id ? { ...l, qty: Math.max(0, qty) } : l))
          .filter((l) => l.qty > 0),
      )

    const removeItem = (id: string) =>
      setLines((prev) => prev.filter((l) => l.book.id !== id))

    const clear = () => setLines([])

    const count = lines.reduce((n, l) => n + l.qty, 0)
    const subtotal = lines.reduce((s, l) => s + l.book.price * l.qty, 0)

    return { lines, count, subtotal, addItem, setQty, removeItem, clear }
  }, [lines])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
