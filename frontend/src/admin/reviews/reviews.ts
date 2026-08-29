import atomicHabitsCover from '../../assets/covers/atomic-habits-591d57.png'
import circeCover from '../../assets/covers/circe-3ea9d1.png'
import duneCover from '../../assets/covers/dune-41c1d5.png'
import normalPeopleCover from '../../assets/covers/normal-people-641378.png'
import projectHailMaryCover from '../../assets/covers/project-hail-mary-60c35e.png'
import midnightLibraryCover from '../../assets/covers/the-midnight-library-1b6823.png'
import type { BadgeTone } from '../components/StatusBadge'

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED'

export interface ReviewReply {
  replyId: number
  replyText: string
  repliedDate: string // ISO datetime
  repliedBy: string
}

export interface ReviewReport {
  isReported: boolean
  reason?: string
  detail?: string
  reportedDate?: string
  reportedBy?: string
  managerStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface Review {
  reviewId: number
  bookId: string // storefront slug
  bookTitle: string
  author?: string
  isbn?: string
  price?: number
  coverUrl?: string
  customerName: string
  username?: string
  avatarUrl?: string
  verifiedPurchase?: boolean
  rating: number // 1..5
  headline?: string
  comment: string
  status: ReviewStatus
  createdDate: string // ISO datetime
  flagged: boolean // ProfanityFilter result
  reply?: ReviewReply
  orderId?: string
  orderDate?: string
  deliveryStatus?: string
  report?: ReviewReport
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'รอตรวจสอบ',
  PUBLISHED: 'ตอบกลับแล้ว',
  HIDDEN: 'ซ่อนไว้',
  REMOVED: 'ลบแล้ว',
}

export const REVIEW_STATUS_TONES: Record<ReviewStatus, BadgeTone> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
  REMOVED: 'danger',
}

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
    author: 'Matt Haig',
    isbn: '978-0525559474',
    price: 380,
    coverUrl: midnightLibraryCover,
    customerName: 'John Doe',
    username: '@johndoe',
    verifiedPurchase: true,
    rating: 3,
    headline: 'หนังสือมีตำหนิเล็กน้อย',
    comment: 'เนื้อเรื่องโอเค แต่ปกมีรอยพับตอนมาส่ง เรื่องราวชวนให้คิดแม้ว่าช่วงกลางจะดำเนินเรื่องช้าไปหน่อย อยากได้เล่มใหม่หรือคืนเงินบางส่วน',
    status: 'PENDING',
    createdDate: '2023-08-24T10:00:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-08501',
    orderDate: '2026-08-02T14:15:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
  },
  {
    reviewId: 2,
    bookId: 'project-hail-mary',
    bookTitle: 'Project Hail Mary',
    author: 'Andy Weir',
    isbn: '978-0593135204',
    price: 450,
    coverUrl: projectHailMaryCover,
    customerName: 'Sarah Adams',
    username: '@sarah_reads',
    verifiedPurchase: true,
    rating: 5,
    headline: 'สุดยอดมาก!',
    comment: 'เป็นหนังสือที่สนุกมาก วิทยาศาสตร์เข้าใจง่ายและตัวเอกตลกดี จัดส่งเร็วมากด้วย!',
    status: 'PUBLISHED',
    createdDate: '2023-08-24T14:30:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-07240',
    orderDate: '2026-07-22T09:10:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    reply: {
      replyId: 1,
      replyText: 'ขอบคุณสำหรับรีวิวดีๆ ค่ะซาร่าห์! ดีใจที่คุณสนุกกับการเดินทางของ Ryland Grace ขอให้อ่านหนังสือให้สนุกนะคะ!',
      repliedDate: '2023-08-25T09:00:00.000Z',
      repliedBy: 'ฝ่ายขาย',
    },
  },
  {
    reviewId: 3,
    bookId: 'dune',
    bookTitle: 'Dune',
    author: 'Frank Herbert',
    isbn: '978-0441172719',
    price: 520,
    coverUrl: duneCover,
    customerName: 'Unknown User',
    username: '@anon123',
    verifiedPurchase: false,
    rating: 1,
    headline: 'แย่มาก',
    comment: '[รีวิวนี้ถูกซ่อนเนื่องจากมีเนื้อหาไม่เหมาะสม]',
    status: 'HIDDEN',
    createdDate: '2023-08-20T11:20:00.000Z',
    flagged: true,
    orderId: 'ORD-2026-08102',
    orderDate: '2026-07-30T11:20:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'เนื้อหาไม่เหมาะสม / มีคำหยาบคาย',
      detail: 'พบการใช้คำไม่สุภาพในการรีวิว ขอส่งให้ผู้จัดการตรวจสอบ',
      reportedDate: '2023-08-21T09:00:00.000Z',
      reportedBy: 'พนักงานฝ่ายขาย',
      managerStatus: 'PENDING',
    },
  },
  {
    reviewId: 4,
    bookId: 'normal-people',
    bookTitle: 'Normal People',
    author: 'Sally Rooney',
    isbn: '978-0525633471',
    price: 320,
    coverUrl: normalPeopleCover,
    customerName: 'ผู้ใช้ไม่ระบุชื่อ',
    username: '@anon_user',
    verifiedPurchase: false,
    rating: 1,
    headline: 'หนังสือห่วยมาก เสียเงินฟรี',
    comment: 'หนังสือห่วยมาก เสียเงินฟรี คนเขียนกากสุด ๆ ปกยับและยับหักตรงมุม คาดว่าเกิดจากการแพ็คที่ไม่แน่นหนาพอ ขอเงินคืนด่วน!',
    status: 'PENDING',
    createdDate: '2023-08-19T14:10:00.000Z',
    flagged: true,
    orderId: 'ORD-2026-08390',
    orderDate: '2026-08-01T10:00:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
  },
  {
    reviewId: 5,
    bookId: 'circe',
    bookTitle: 'Circe',
    author: 'Madeline Miller',
    isbn: '978-0316556347',
    price: 390,
    coverUrl: circeCover,
    customerName: 'Spam Account',
    username: '@spammer_shop',
    verifiedPurchase: false,
    rating: 1,
    headline: 'ไปซื้อร้านอื่นดีกว่า ลิงก์แจกโค้ดฟรี http://bit.ly/fake-link',
    comment: 'หนังสือส่งช้ามาก ไปซื้อร้าน XXX ดีกว่า แจกโค้ดส่วนลด 50% คลิกเลยที่ http://bit.ly/fake-discount-link รับประกันถูกกว่าร้านนี้แน่นอน',
    status: 'PENDING',
    createdDate: '2023-08-18T18:45:00.000Z',
    flagged: true,
    orderId: 'ORD-2026-08221',
    orderDate: '2026-07-28T16:20:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
  },
  {
    reviewId: 6,
    bookId: 'atomic-habits',
    bookTitle: 'Atomic Habits',
    author: 'James Clear',
    isbn: '978-0735211292',
    price: 350,
    coverUrl: atomicHabitsCover,
    customerName: 'Emily White',
    username: '@emilyw',
    verifiedPurchase: true,
    rating: 4,
    headline: 'มีประโยชน์มาก',
    comment: 'อ่านง่ายและนำไปใช้ได้จริง เริ่มปรับเปลี่ยนนิสัยได้หลายอย่างแล้ว แนะนำสำหรับคนที่ต้องการพัฒนาตัวเอง',
    status: 'PENDING',
    createdDate: '2023-08-18T16:00:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-08411',
    orderDate: '2026-08-01T16:00:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
  },
  {
    reviewId: 7,
    bookId: 'the-great-gatsby',
    bookTitle: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    isbn: '978-0743273565',
    price: 290,
    customerName: 'Mike Johnson',
    username: '@mikej',
    verifiedPurchase: true,
    rating: 5,
    headline: 'คลาสสิกเสมอ',
    comment: 'ยังคงเป็นหนึ่งในหนังสือที่ยิ่งใหญ่ที่สุดตลอดกาล การจัดส่งของร้านก็รวดเร็วเหมือนเดิม ขอบคุณครับ',
    status: 'PUBLISHED',
    createdDate: '2023-08-15T09:30:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-07185',
    orderDate: '2026-07-16T10:00:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    reply: {
      replyId: 2,
      replyText: 'ขอบคุณคุณไมค์สำหรับรีวิวและความไว้วางใจในบริการของเราเสมอมาครับ!',
      repliedDate: '2023-08-16T10:00:00.000Z',
      repliedBy: 'ฝ่ายขาย',
    },
  },
]
