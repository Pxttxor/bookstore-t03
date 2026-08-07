import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  MODERATE_ACTION_STATUS,
  SEED_REVIEWS,
  type ModerateAction,
  type Review,
} from './reviews'

const STORAGE_KEY = 'bookhaven.reviews.v1'

export interface ReplyDraft {
  replyText: string
  repliedBy: string
}

interface ReviewValue {
  reviews: Review[]
  pendingCount: number
  findById: (reviewId: number) => Review | undefined
  moderate: (reviewId: number, action: ModerateAction) => void
  reply: (reviewId: number, draft: ReplyDraft) => void
}

const ReviewContext = createContext<ReviewValue | null>(null)

function read(): Review[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED_REVIEWS
    const parsed = JSON.parse(raw) as Review[]
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_REVIEWS
  } catch {
    return SEED_REVIEWS
  }
}

function write(reviews: Review[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>(read)

  const value = useMemo<ReviewValue>(() => {
    const persist = (next: Review[]) => {
      write(next)
      setReviews(next)
    }

    const findById = (reviewId: number) => reviews.find((r) => r.reviewId === reviewId)

    const moderate = (reviewId: number, action: ModerateAction) => {
      persist(
        reviews.map((r) =>
          r.reviewId === reviewId ? { ...r, status: MODERATE_ACTION_STATUS[action] } : r,
        ),
      )
    }

    const reply = (reviewId: number, draft: ReplyDraft) => {
      persist(
        reviews.map((r) =>
          r.reviewId === reviewId
            ? {
                ...r,
                reply: {
                  replyId: (r.reply?.replyId ?? 0) + 1,
                  replyText: draft.replyText.trim(),
                  repliedDate: new Date().toISOString(),
                  repliedBy: draft.repliedBy,
                },
              }
            : r,
        ),
      )
    }

    const pendingCount = reviews.filter((r) => r.status === 'PENDING').length

    return { reviews, pendingCount, findById, moderate, reply }
  }, [reviews])

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReviews(): ReviewValue {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReviews must be used within a ReviewProvider')
  return ctx
}
