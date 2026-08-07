// Types follow the Review / ReviewReply / ProfanityFilter classes in the analysis
// class diagram (Sub2 — Review). This is a runnable demo of a teammate's subsystem,
// self-contained like the customer-order flow: sales staff (and the store manager)
// moderate customer reviews and reply to them. Reviews reference storefront books by
// slug and snapshot the title, so the queue is readable without joining book data.

import type { BadgeTone } from '../components/StatusBadge'

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED'

export interface ReviewReply {
  replyId: number
  replyText: string
  repliedDate: string // ISO datetime
  repliedBy: string
}

export interface Review {
  reviewId: number
  bookId: string // storefront slug
  bookTitle: string
  customerName: string
  rating: number // 1..5
  comment: string
  status: ReviewStatus
  createdDate: string // ISO datetime
  flagged: boolean // ProfanityFilter result captured at submit time
  reply?: ReviewReply
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'รอตรวจสอบ',
  PUBLISHED: 'เผยแพร่แล้ว',
  HIDDEN: 'ซ่อนไว้',
  REMOVED: 'ลบแล้ว',
}

export const REVIEW_STATUS_TONES: Record<ReviewStatus, BadgeTone> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
  REMOVED: 'danger',
}

// Review.moderate(action) from the class diagram. Each action maps to a target status.
export type ModerateAction = 'PUBLISH' | 'HIDE' | 'REMOVE'

export const MODERATE_ACTION_STATUS: Record<ModerateAction, ReviewStatus> = {
  PUBLISH: 'PUBLISHED',
  HIDE: 'HIDDEN',
  REMOVE: 'REMOVED',
}

export const MODERATE_ACTION_LABELS: Record<ModerateAction, string> = {
  PUBLISH: 'เผยแพร่',
  HIDE: 'ซ่อน',
  REMOVE: 'ลบ',
}

// ProfanityFilter.checkText(text) — returns true when the text contains a banned word.
// A tiny demo word list; production would use the shared moderation service.
const BANNED_WORDS = ['ห่วย', 'กาก', 'โง่', 'ควาย', 'ขยะ', 'trash', 'stupid', 'garbage']

export function checkText(text: string): boolean {
  const lower = text.toLowerCase()
  return BANNED_WORDS.some((word) => lower.includes(word.toLowerCase()))
}

export function formatReviewCode(reviewId: number) {
  return `RV${String(reviewId).padStart(3, '0')}`
}

export const SEED_REVIEWS: Review[] = [
  {
    reviewId: 1,
    bookId: 'the-midnight-library',
    bookTitle: 'The Midnight Library',
    customerName: 'ปวีณา ทองสุข',
    rating: 5,
    comment: 'อ่านแล้วเปลี่ยนมุมมองเรื่องความเสียใจในอดีตไปเลย เล่าได้ละมุนมาก แนะนำสุด ๆ',
    status: 'PENDING',
    createdDate: '2026-08-05T09:20:00.000Z',
    flagged: false,
  },
  {
    reviewId: 2,
    bookId: 'atomic-habits',
    bookTitle: 'Atomic Habits',
    customerName: 'ธนดล วัฒนกิจ',
    rating: 5,
    comment: 'วิธีสร้างนิสัยอธิบายเป็นขั้นตอนชัดเจน นำไปใช้จริงได้ทันที คุ้มค่ามาก',
    status: 'PUBLISHED',
    createdDate: '2026-07-28T14:05:00.000Z',
    flagged: false,
    reply: {
      replyId: 1,
      replyText: 'ขอบคุณสำหรับรีวิวดี ๆ ค่ะ หากสนใจเล่มอื่นในหมวดพัฒนาตนเองแจ้งทางร้านได้เลยนะคะ',
      repliedDate: '2026-07-29T02:30:00.000Z',
      repliedBy: 'พนักงานฝ่ายขาย',
    },
  },
  {
    reviewId: 3,
    bookId: 'dune',
    bookTitle: 'Dune',
    customerName: 'อนุชิต ประเสริฐ',
    rating: 2,
    comment: 'เนื้อเรื่องช่วงแรกยืดยาดไปหน่อย แต่โลกในเรื่องออกแบบมาดี ให้คะแนนกลาง ๆ',
    status: 'PENDING',
    createdDate: '2026-08-06T03:45:00.000Z',
    flagged: false,
  },
  {
    reviewId: 4,
    bookId: 'normal-people',
    bookTitle: 'Normal People',
    customerName: 'ผู้ใช้ไม่ระบุชื่อ',
    rating: 1,
    comment: 'หนังสือห่วยมาก เสียเงินฟรี คนเขียนกากสุด ๆ',
    status: 'PENDING',
    createdDate: '2026-08-06T18:10:00.000Z',
    flagged: true,
  },
  {
    reviewId: 5,
    bookId: 'project-hail-mary',
    bookTitle: 'Project Hail Mary',
    customerName: 'กมลชนก แสงจันทร์',
    rating: 5,
    comment: 'สนุกมาก วิทยาศาสตร์แน่นแต่ตามได้ ลุ้นตั้งแต่ต้นจนจบ',
    status: 'PUBLISHED',
    createdDate: '2026-07-20T08:00:00.000Z',
    flagged: false,
  },
  {
    reviewId: 6,
    bookId: 'circe',
    bookTitle: 'Circe',
    customerName: 'ศิริลักษณ์ พูนผล',
    rating: 4,
    comment: 'สำนวนแปลสวย เล่าตำนานกรีกได้มีชีวิตชีวา ชอบตัวละครนำมาก',
    status: 'PUBLISHED',
    createdDate: '2026-07-15T11:25:00.000Z',
    flagged: false,
  },
  {
    reviewId: 7,
    bookId: 'a-little-life',
    bookTitle: 'A Little Life',
    customerName: 'วีรภัทร อินทนนท์',
    rating: 3,
    comment: 'เนื้อหาหนักและสะเทือนใจ อ่านยากสำหรับบางคน แต่เขียนดี',
    status: 'HIDDEN',
    createdDate: '2026-07-10T16:40:00.000Z',
    flagged: false,
  },
]
