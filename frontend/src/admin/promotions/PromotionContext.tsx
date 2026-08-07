import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SEED_PROMOTIONS, type Promotion } from './promotions'

const STORAGE_KEY = 'bookhaven.promotions.v1'

export type PromotionDraft = Omit<Promotion, 'promotionId' | 'status'>

interface PromotionValue {
  promotions: Promotion[]
  findById: (promotionId: number) => Promotion | undefined
  findByName: (name: string, ignoreId?: number) => Promotion | undefined
  add: (draft: PromotionDraft) => Promotion
  update: (promotionId: number, draft: PromotionDraft) => Promotion
  setActive: (promotionId: number, active: boolean) => void
  remove: (promotionId: number) => void
}

const PromotionContext = createContext<PromotionValue | null>(null)

function read(): Promotion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED_PROMOTIONS
    const parsed = JSON.parse(raw) as Promotion[]
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_PROMOTIONS
  } catch {
    return SEED_PROMOTIONS
  }
}

function write(promotions: Promotion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions))
}

const key = (name: string) => name.trim().toLowerCase()

export function PromotionProvider({ children }: { children: ReactNode }) {
  const [promotions, setPromotions] = useState<Promotion[]>(read)

  const value = useMemo<PromotionValue>(() => {
    const persist = (next: Promotion[]) => {
      write(next)
      setPromotions(next)
    }

    const findById = (promotionId: number) =>
      promotions.find((p) => p.promotionId === promotionId)

    const findByName = (name: string, ignoreId?: number) =>
      promotions.find((p) => key(p.name) === key(name) && p.promotionId !== ignoreId)

    const add = (draft: PromotionDraft) => {
      const nextId = promotions.reduce((max, p) => Math.max(max, p.promotionId), 0) + 1
      const promotion: Promotion = { ...draft, promotionId: nextId, status: 'ACTIVE' }
      persist([...promotions, promotion])
      return promotion
    }

    const update = (promotionId: number, draft: PromotionDraft) => {
      const current = promotions.find((p) => p.promotionId === promotionId)
      if (!current) throw new Error('ไม่พบข้อมูลโปรโมชั่น')
      const updated: Promotion = { ...current, ...draft }
      persist(promotions.map((p) => (p.promotionId === promotionId ? updated : p)))
      return updated
    }

    const setActive = (promotionId: number, active: boolean) => {
      persist(
        promotions.map((p) =>
          p.promotionId === promotionId
            ? { ...p, status: active ? ('ACTIVE' as const) : ('INACTIVE' as const) }
            : p,
        ),
      )
    }

    const remove = (promotionId: number) => {
      persist(promotions.filter((p) => p.promotionId !== promotionId))
    }

    return { promotions, findById, findByName, add, update, setActive, remove }
  }, [promotions])

  return <PromotionContext.Provider value={value}>{children}</PromotionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePromotions(): PromotionValue {
  const ctx = useContext(PromotionContext)
  if (!ctx) throw new Error('usePromotions must be used within a PromotionProvider')
  return ctx
}
