import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CatalogueBook } from '../data/catalogue'
import { apiPost, ApiError, tokenStore } from '../api/client'

// ตะกร้าสินค้าของหน้าร้าน — บันทึกใน localStorage เพื่อให้คงอยู่เมื่อรีเฟรชหน้าจอ
// (คำสั่งซื้อจริงเกิดตอนกดยืนยันที่ `/checkout/payment` ซึ่งเขียนลงฐานข้อมูล)

const CART_STORAGE_KEY = 'bookhaven.cart'
const DISCOUNT_STORAGE_KEY = 'bookhaven.discount'

function loadSavedDiscount(): AppliedDiscount | null {
  try {
    const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.code === 'string' && typeof parsed.discountAmount === 'number') {
      return parsed as AppliedDiscount
    }
  } catch {
    // ignore
  }
  return null
}

function loadSavedCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (line): line is CartLine =>
          Boolean(
            line &&
              line.book &&
              typeof line.book.bookId === 'number' &&
              typeof line.book.price === 'number' &&
              typeof line.qty === 'number' &&
              line.qty > 0,
          ),
      )
    }
  } catch {
    // หากข้อมูลใน localStorage เสียหาย ให้เริ่มจากตะกร้าว่าง
  }
  return []
}

/**
 * สแนปช็อตของหนังสือหนึ่งเล่มในตะกร้า
 *
 * เก็บเท่าที่หน้าจอตะกร้าและหน้าชำระเงินต้องใช้ ไม่ใช่ `CatalogueBook` ทั้งก้อน
 * เพราะแถวในตะกร้าเป็นข้อมูลที่ "ค้างอยู่" ระหว่างที่ผู้ใช้เดินดูหน้าอื่น การถือ
 * ทั้ง DTO ไว้ทำให้ดูเหมือนว่าค่าอย่างคะแนนรีวิวยังสดอยู่ ทั้งที่มันหยุดตั้งแต่ตอนกดเพิ่ม
 *
 * ราคาที่แสดงเป็นราคาตอนหยิบใส่ตะกร้า · **ยอดเงินจริงเซิร์ฟเวอร์คิดใหม่จาก
 * `book.price` ตอนสร้างคำสั่งซื้อเสมอ** หน้าจอจึงกำหนดราคาเองไม่ได้
 */
export interface CartBook {
  bookId: number
  title: string
  author: string
  price: number
  quantityOnHand: number
}

export interface CartLine {
  book: CartBook
  qty: number
}

export interface AppliedDiscount {
  code: string
  rewardName: string
  discountAmount: number
}

interface CartValue {
  lines: CartLine[]
  count: number
  subtotal: number
  appliedDiscount: AppliedDiscount | null
  discountError: string | null
  discountSuccess: string | null
  applyDiscount: (code: string) => Promise<AppliedDiscount>
  removeDiscount: () => void
  setDiscountError: (err: string | null) => void
  setDiscountSuccess: (msg: string | null) => void
  /** คืนจำนวนที่เพิ่มได้จริง — 0 แปลว่าของหมดหรือในตะกร้ามีครบยอดคงเหลือแล้ว */
  addItem: (book: CatalogueBook, qty?: number) => number
  setQty: (bookId: number, qty: number) => void
  removeItem: (bookId: number) => void
  clear: () => void
  /** จำนวนของเล่มนี้ที่อยู่ในตะกร้าแล้ว ใช้กันไม่ให้หยิบเกินยอดคงเหลือ */
  qtyInCart: (bookId: number) => number
}

const CartContext = createContext<CartValue | null>(null)

const snapshot = (book: CatalogueBook): CartBook => ({
  bookId: book.bookId,
  title: book.title,
  author: book.author,
  price: book.price,
  quantityOnHand: book.quantityOnHand,
})

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadSavedCart)
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(loadSavedDiscount)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [discountSuccess, setDiscountSuccess] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (lines.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY)
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines))
      }
    } catch {
      // ignore storage error
    }
  }, [lines])

  useEffect(() => {
    try {
      if (!appliedDiscount) {
        localStorage.removeItem(DISCOUNT_STORAGE_KEY)
      } else {
        localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(appliedDiscount))
      }
    } catch {
      // ignore storage error
    }
  }, [appliedDiscount])

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.book.price * l.qty, 0),
    [lines],
  )

  const value = useMemo<CartValue>(() => {
    const applyDiscount = async (code: string): Promise<AppliedDiscount> => {
      const trimmed = code.trim()
      if (!trimmed) {
        const msg = 'กรุณากรอกโค้ดส่วนลด'
        setDiscountError(msg)
        setDiscountSuccess(null)
        throw new Error(msg)
      }
      if (!tokenStore.get()) {
        const msg = 'กรุณาเข้าสู่ระบบสมาชิกก่อนใช้งานโค้ดส่วนลด'
        setDiscountError(msg)
        setDiscountSuccess(null)
        throw new Error(msg)
      }
      setDiscountError(null)
      setDiscountSuccess(null)
      try {
        const result = await apiPost<AppliedDiscount>('/api/orders/validate-discount', {
          code: trimmed,
          subtotal,
        })
        setAppliedDiscount(result)
        setDiscountSuccess(`ใช้โค้ด ${result.code} สำเร็จ!`)
        return result
      } catch (err) {
        setAppliedDiscount(null)
        setDiscountSuccess(null)
        let msg = 'ไม่สามารถใช้โค้ดส่วนลดนี้ได้'
        if (err instanceof ApiError) {
          if (err.status === 401) {
            msg = 'กรุณาเข้าสู่ระบบสมาชิกก่อนใช้งานโค้ดส่วนลด'
          } else {
            msg = err.message
          }
        } else if (err instanceof Error) {
          msg = err.message
        }
        setDiscountError(msg)
        throw new Error(msg, { cause: err })
      }
    }

    const removeDiscount = () => {
      setAppliedDiscount(null)
      setDiscountError(null)
      setDiscountSuccess(null)
      try {
        localStorage.removeItem(DISCOUNT_STORAGE_KEY)
      } catch {
        // ignore
      }
    }

    const qtyInCart = (bookId: number) =>
      lines.find((l) => l.book.bookId === bookId)?.qty ?? 0

    // หยิบเกินยอดคงเหลือไม่ได้ ไม่งั้นผู้ใช้จะกดสั่งซื้อแล้วไปเจอ 422 ที่หน้าชำระเงิน
    // ซึ่งเป็นจุดที่แก้อะไรไม่ได้แล้ว · เซิร์ฟเวอร์ยังตรวจซ้ำตอนยืนยันสต็อกและตอนแพ็ก
    const addItem = (book: CatalogueBook, qty = 1) => {
      const room = book.quantityOnHand - qtyInCart(book.bookId)
      const adding = Math.min(Math.max(qty, 0), Math.max(room, 0))
      if (adding === 0) return 0

      setLines((prev) => {
        const existing = prev.find((l) => l.book.bookId === book.bookId)
        if (existing) {
          return prev.map((l) =>
            l.book.bookId === book.bookId ? { ...l, qty: l.qty + adding } : l,
          )
        }
        return [...prev, { book: snapshot(book), qty: adding }]
      })
      return adding
    }

    const setQty = (bookId: number, qty: number) =>
      setLines((prev) =>
        prev
          .map((l) =>
            l.book.bookId === bookId
              ? { ...l, qty: Math.min(Math.max(0, qty), l.book.quantityOnHand) }
              : l,
          )
          .filter((l) => l.qty > 0),
      )

    const removeItem = (bookId: number) =>
      setLines((prev) => prev.filter((l) => l.book.bookId !== bookId))

    const clear = () => {
      setLines([])
      setAppliedDiscount(null)
      setDiscountError(null)
      setDiscountSuccess(null)
      try {
        localStorage.removeItem(CART_STORAGE_KEY)
        localStorage.removeItem(DISCOUNT_STORAGE_KEY)
      } catch {
        // ignore
      }
    }

    const count = lines.reduce((n, l) => n + l.qty, 0)

    return {
      lines,
      count,
      subtotal,
      appliedDiscount,
      discountError,
      discountSuccess,
      applyDiscount,
      removeDiscount,
      setDiscountError,
      setDiscountSuccess,
      addItem,
      setQty,
      removeItem,
      clear,
      qtyInCart,
    }
  }, [lines, subtotal, appliedDiscount, discountError, discountSuccess])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
