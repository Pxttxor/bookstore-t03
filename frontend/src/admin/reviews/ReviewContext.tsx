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

const STORAGE_KEY = 'bookhaven.reviews.v5'

export interface ReplyDraft {
  replyText: string
  repliedBy: string
}

export interface ReportDraft {
  reason: string
  detail?: string
  reportedBy: string
}

interface ReviewValue {
  reviews: Review[]
  pendingCount: number
  approvedCount: number
  deletedCount: number
  unrepliedCount: number
  repliedCount: number
  reportedCount: number
  findById: (reviewId: number) => Review | undefined
  moderate: (reviewId: number, action: ModerateAction) => void
  approveReview: (reviewId: number) => void
  hideReview: (reviewId: number) => void
  removeReview: (reviewId: number) => void
  reply: (reviewId: number, draft: ReplyDraft) => void
  reportToManager: (reviewId: number, draft: ReportDraft) => void
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
        reviews.map((r) => {
          if (r.reviewId !== reviewId) return r
          const newStatus = MODERATE_ACTION_STATUS[action]
          return {
            ...r,
            status: newStatus,
            report: r.report
              ? {
                  ...r.report,
                  managerStatus: action === 'PUBLISH' ? 'APPROVED' : r.report.managerStatus,
                }
              : undefined,
          }
        }),
      )
    }

    const approveReview = (reviewId: number) => {
      moderate(reviewId, 'PUBLISH')
    }

    const hideReview = (reviewId: number) => {
      moderate(reviewId, 'HIDE')
    }

    const removeReview = (reviewId: number) => {
      moderate(reviewId, 'REMOVE')
    }

    const reply = (reviewId: number, draft: ReplyDraft) => {
      persist(
        reviews.map((r) =>
          r.reviewId === reviewId
            ? {
                ...r,
                status: 'PUBLISHED' as const,
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

    const reportToManager = (reviewId: number, draft: ReportDraft) => {
      persist(
        reviews.map((r) =>
          r.reviewId === reviewId
            ? {
                ...r,
                report: {
                  isReported: true,
                  reason: draft.reason,
                  detail: draft.detail,
                  reportedDate: new Date().toISOString(),
                  reportedBy: draft.reportedBy,
                  managerStatus: 'PENDING',
                },
              }
            : r,
        ),
      )
    }

    const pendingCount = reviews.filter((r) => r.status === 'PENDING').length
    const approvedCount = reviews.filter((r) => r.status === 'PUBLISHED').length
    const deletedCount = reviews.filter((r) => r.status === 'REMOVED' || r.status === 'HIDDEN').length
    const unrepliedCount = reviews.filter((r) => !r.reply).length
    const repliedCount = reviews.filter((r) => !!r.reply).length
    const reportedCount = reviews.filter((r) => r.report?.isReported).length

    return {
      reviews,
      pendingCount,
      approvedCount,
      deletedCount,
      unrepliedCount,
      repliedCount,
      reportedCount,
      findById,
      moderate,
      approveReview,
      hideReview,
      removeReview,
      reply,
      reportToManager,
    }
  }, [reviews])

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReviews(): ReviewValue {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReviews must be used within a ReviewProvider')
  return ctx
}
