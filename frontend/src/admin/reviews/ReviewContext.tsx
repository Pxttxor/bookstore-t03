import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import { useOrders } from '../orders/OrderContext'
import { ORDER_STATUS_LABELS, formatOrderCode } from '../orders/orders'
import type { ModerateAction, Review, ReviewReply, ReviewStatus } from './reviews'

// ข้อมูลอยู่ในตาราง review / review_reply / review_report ของ PostgreSQL แล้ว
// เดิมเก็บใน localStorage คีย์ bookhaven.reviews.v5
//
// Book metadata comes from reviewDTO's existing database join. Order metadata
// is joined from OrderContext; absent relationships stay absent, never mocked.
interface ReviewApiReply {
  replyId: number
  replyText: string
  repliedDate: string
  repliedBy: string
}

interface ReviewApiReport {
  reportId: number
  reviewId: number
  reason: string
  detail?: string
  reportedBy: string
  reportedDate: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

interface ReviewApiRow {
  reviewId: number
  customerName: string
  bookId: number
  bookTitle: string
  author?: string
  isbn?: string
  price?: number
  orderCode?: string
  verifiedPurchase: boolean
  rating: number
  headline?: string
  comment: string
  status: ReviewStatus
  flagged: boolean
  createdDate: string
  replies: ReviewApiReply[]
  report?: ReviewApiReport
}

// เก็บคำตอบกลับล่าสุดเป็น `reply` ตัวเดียวตามที่หน้าจอออกแบบไว้
// (ฐานข้อมูลเก็บได้หลายแถวตาม 1..* ใน class diagram)
const latestReply = (replies: ReviewApiReply[]): ReviewReply | undefined => {
  if (!replies.length) return undefined
  const last = replies[replies.length - 1]
  return {
    replyId: last.replyId,
    replyText: last.replyText,
    repliedDate: last.repliedDate,
    repliedBy: last.repliedBy,
  }
}

const toReview = (row: ReviewApiRow): Review => ({
  reviewId: row.reviewId,
  bookId: row.bookId,
  bookTitle: row.bookTitle,
  author: row.author,
  isbn: row.isbn,
  price: row.price,
  customerName: row.customerName,
  verifiedPurchase: row.verifiedPurchase,
  rating: row.rating,
  headline: row.headline,
  comment: row.comment,
  status: row.status,
  createdDate: row.createdDate,
  flagged: row.flagged,
  reply: latestReply(row.replies),
  orderId: row.orderCode,
  report: row.report
    ? {
        isReported: true,
        reason: row.report.reason,
        detail: row.report.detail,
        reportedDate: row.report.reportedDate,
        reportedBy: row.report.reportedBy,
        managerStatus: row.report.status,
      }
    : undefined,
})

const loadReviews = async () => {
  const rows = await apiGet<ReviewApiRow[]>('/api/reviews')
  return rows.map(toReview)
}

export interface ReplyDraft {
  replyText: string
}

export interface ReportDraft {
  reason: string
  detail?: string
}

interface ReviewValue {
  reviews: Review[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  pendingCount: number
  approvedCount: number
  deletedCount: number
  unrepliedCount: number
  repliedCount: number
  reportedCount: number
  findById: (reviewId: number) => Review | undefined
  /**
   * Review.moderate()
   *
   * การตัดสินรายงานที่ยังค้างเกิดพร้อมกันในทรานแซกชันเดียวฝั่งเซิร์ฟเวอร์
   * (เผยแพร่ = รายงานไม่เป็นผล · ซ่อน/ลบ = รายงานเป็นผล) — ห้ามแยกเป็นสองปุ่ม
   */
  moderate: (reviewId: number, action: ModerateAction) => Promise<void>
  approveReview: (reviewId: number) => Promise<void>
  hideReview: (reviewId: number) => Promise<void>
  removeReview: (reviewId: number) => Promise<void>
  /** ผู้ตอบกลับมาจาก JWT · เซิร์ฟเวอร์ดันสถานะรีวิวเป็น PUBLISHED ให้ด้วย */
  reply: (reviewId: number, draft: ReplyDraft) => Promise<void>
  reportToManager: (reviewId: number, draft: ReportDraft) => Promise<void>
}

const ReviewContext = createContext<ReviewValue | null>(null)

export function ReviewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { orders } = useOrders()
  const { data, loading, error, reload, apply } = useResource(loadReviews, !!user && can.moderateReview(user.role))

  const value = useMemo<ReviewValue>(() => {
    const ordersByCode = new Map(orders.map((order) => [formatOrderCode(order.orderId), order]))
    const reviews = (data ?? []).map((review) => {
      const order = review.orderId ? ordersByCode.get(review.orderId) : undefined
      return {
        ...review,
        orderDate: order?.orderDate,
        deliveryStatus: order ? ORDER_STATUS_LABELS[order.status] : undefined,
      }
    })

    // ตรวจสอบและตอบกลับคืน reviewDTO แถวเดิมที่อัปเดตแล้ว (ตัวเดียวกับที่ลิสต์ใช้)
    // แปลงด้วย toReview ตัวเดียวกันแล้วต่อลงชุดเดิม — รวมผลของรายงานที่ปิดไปพร้อมกันด้วย
    const replace = (row: ReviewApiRow) => {
      const updated = toReview(row)
      return (list: Review[]) =>
        list.map((entry) => (entry.reviewId === updated.reviewId ? updated : entry))
    }

    const moderate = async (reviewId: number, action: ModerateAction) => {
      const row = await apiPost<ReviewApiRow>(`/api/reviews/${reviewId}/moderate`, { action })
      apply(replace(row))
    }

    return {
      reviews,
      loading,
      error,
      reload,
      pendingCount: reviews.filter((r) => r.status === 'PENDING').length,
      approvedCount: reviews.filter((r) => r.status === 'PUBLISHED').length,
      deletedCount: reviews.filter((r) => r.status === 'REMOVED' || r.status === 'HIDDEN')
        .length,
      unrepliedCount: reviews.filter((r) => !r.reply).length,
      repliedCount: reviews.filter((r) => !!r.reply).length,
      reportedCount: reviews.filter((r) => r.report?.isReported).length,
      findById: (reviewId: number) => reviews.find((r) => r.reviewId === reviewId),
      moderate,
      approveReview: (reviewId: number) => moderate(reviewId, 'PUBLISH'),
      hideReview: (reviewId: number) => moderate(reviewId, 'HIDE'),
      removeReview: (reviewId: number) => moderate(reviewId, 'REMOVE'),
      reply: async (reviewId: number, draft: ReplyDraft) => {
        const row = await apiPost<ReviewApiRow>(`/api/reviews/${reviewId}/replies`, {
          replyText: draft.replyText.trim(),
        })
        apply(replace(row))
      },
      // เส้นทางนี้คืน reportDTO ไม่ใช่ reviewDTO — ประกอบฟิลด์ report เองมีโอกาสไม่ตรง
      // กับที่เซิร์ฟเวอร์เห็น จึงโหลดลิสต์ใหม่ตามเดิม
      reportToManager: async (reviewId: number, draft: ReportDraft) => {
        await apiPost(`/api/reviews/${reviewId}/report`, {
          reason: draft.reason,
          detail: draft.detail ?? '',
        })
        await reload()
      },
    }
  }, [data, loading, error, reload, apply, orders])

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReviews(): ReviewValue {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReviews must be used within a ReviewProvider')
  return ctx
}
