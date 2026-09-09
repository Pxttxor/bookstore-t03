import silentObserverCover from '../../assets/covers/the-silent-observer.jpg'
import echoesInTheRainCover from '../../assets/covers/echoes-in-the-rain.jpg'
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
  reportCount?: number
  category?: 'spam' | 'service' | 'inappropriate' | 'other'
  managerStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  decidedBy?: string
  decidedDate?: string
}

export interface Review {
  reviewId: number
  /**
   * รหัสหนังสือในแคตตาล็อกหลัง (`book.book_id`) ตามที่ตาราง review เก็บ
   * หน้าจอที่ต้องการรูปปกส่งรหัสนี้เข้า `coverFor()` ของ `data/covers.ts` ตรง ๆ
   */
  bookId: number
  bookTitle: string
  author?: string
  isbn?: string
  price?: number
  coverUrl?: string
  customerName: string
  username?: string
  avatarUrl?: string
  avatarColor?: 'orange' | 'green' | 'blue' | 'purple' | 'rose'
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
  PUBLISHED: 'ตรวจสอบสำเร็จ',
  HIDDEN: 'ซ่อนไว้',
  REMOVED: 'รีวิวที่ถูกลบ',
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
  PUBLISH: 'อนุมัติ',
  HIDE: 'ซ่อน',
  REMOVE: 'ลบรีวิว',
}

/**
 * ผลการตัดสินรายงานรีวิวที่เซิร์ฟเวอร์ปิดให้พร้อมกับสถานะรีวิว
 *
 * อนุมัติ/ตอบกลับ = รายงานไม่เป็นผล (REJECTED) · ซ่อน/ลบ = รายงานเป็นผล (APPROVED)
 */
export const REPORT_DECISION_LABELS: Record<'APPROVED' | 'REJECTED', string> = {
  APPROVED: 'รายงานเป็นผล',
  REJECTED: 'พิจารณาแล้ว',
}

/**
 * ช่องของหน้าฝ่ายขาย ("ตรวจสอบรีวิว") — รีวิวหนึ่งใบอยู่ได้ช่องเดียวเท่านั้น
 * ลำดับความสำคัญ: รายงานผู้จัดการแล้ว > ตอบกลับแล้ว > รอตอบกลับ
 * ใช้ทั้งตัวกรองและตัวนับ KPI เพื่อไม่ให้ผลรวมทับกันเอง
 */
export type SalesReviewBucket = 'REPORTED' | 'REPLIED' | 'UNREPLIED'

export const salesBucketOf = (r: Review): SalesReviewBucket =>
  r.report?.isReported ? 'REPORTED' : r.reply ? 'REPLIED' : 'UNREPLIED'

/**
 * ใบรายงานที่ฝ่ายขายส่งและผู้จัดการยังไม่ตัดสิน — คิว "รอตรวจสอบ" ของหน้าผู้จัดการ
 * นับเฉพาะจากรายงานจริง ไม่แตะ `review.status` เพราะสถานะนั้นไม่ได้แปลว่ามีรายงานค้าง
 */
export const hasPendingReport = (r: Review): boolean =>
  !!r.report?.isReported && r.report.managerStatus === 'PENDING'

/**
 * ช่องของหน้าผู้จัดการ ("จัดการรีวิวที่มีปัญหา") — รีวิวหนึ่งใบอยู่ได้ช่องเดียวเท่านั้น
 * ลำดับความสำคัญ: ซ่อนแล้ว > ลบแล้ว > รอตรวจสอบ (มีรายงานค้าง) > ตรวจสอบสำเร็จ
 * สถานะที่ตัดสินไปแล้ว (HIDDEN/REMOVED) ต้องมาก่อนรายงานค้างใหม่ที่อาจเกิดซ้ำ
 * ไม่งั้นรีวิวใบเดิมจะโผล่ทั้งแท็บรอตรวจสอบและแท็บซ่อน/ลบพร้อมกัน
 */
export type ManagerReviewBucket = 'HIDDEN' | 'DELETED' | 'PENDING' | 'APPROVED'

export const managerBucketOf = (r: Review): ManagerReviewBucket => {
  if (r.status === 'HIDDEN') return 'HIDDEN'
  if (r.status === 'REMOVED') return 'DELETED'
  if (hasPendingReport(r)) return 'PENDING'
  return 'APPROVED'
}

/**
 * รีวิวที่มีการกดส่งรายงานปัญหา — หน้าจัดการรีวิวที่มีปัญหาจะแสดงเฉพาะรีวิวกลุ่มนี้เท่านั้น
 * หากฝ่ายขายตอบกลับเองโดยไม่ได้ส่งรายงาน จะอยู่เฉพาะหน้าตรวจสอบรีวิว
 */
export const isReportedReview = (r: Review): boolean => !!r.report?.isReported

/**
 * คำต้องห้ามของ `ProfanityFilter` ตาม class diagram
 *
 * **การติดธงเกิดฝั่งเซิร์ฟเวอร์แล้ว** (`Review.Submit` → `model.ProfanityFilter.CheckText`)
 * รายการนี้จึงเหลือไว้เป็น "สัญญา" ที่ `TestProfanityFilterWordsMatchFrontend`
 * (`backend/internal/model/review_test.go`) เทียบทีละคำ — เทสต์ฝังรายการเดียวกันไว้เอง
 * ไม่ได้อ่านไฟล์นี้ **แก้ที่นี่เมื่อไรต้องแก้อีกฝั่งด้วย** ไม่งั้นเทสต์ล้ม
 */
export const BANNED_WORDS = [
  'ห่วย',
  'กาก',
  'เหี้ย',
  'โง่',
  'ควาย',
  'ขยะ',
  'trash',
  'stupid',
  'garbage',
  'scam',
  'สัสหมา',
]

/**
 * คำหยาบคาย/คำไม่เหมาะสมทั่วไปเพิ่มเติม สำหรับตรวจจับก่อนลูกค้าส่งรีวิว
 */
export const EXTRA_PROFANITY_WORDS = [
  'เหี้ย',
  'สัส',
  'เย็ด',
  'ควย',
  'แม่ง',
  'ระยำ',
  'สารเลว',
  'ดอกทอง',
  'สันดาน',
  'ชาติหมา',
  'หน้าตัวเมีย',
  'ไอ้สัตว์',
  'อีสัตว์',
  'อีดอก',
  'ไอ้เวร',
  'อีเวร',
  'fuck',
  'shit',
  'bitch',
  'bastard',
  'asshole',
]

export const ALL_PROFANITY_WORDS = [...BANNED_WORDS, ...EXTRA_PROFANITY_WORDS]

/**
 * ตรวจสอบข้อความว่ามีคำหยาบคายหรือไม่
 * คืนค่าคำหยาบที่พบคำแรก หรือ null หากไม่พบ
 */
export function detectProfanity(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const word of ALL_PROFANITY_WORDS) {
    if (word && lower.includes(word.toLowerCase())) {
      return word
    }
  }
  // ตรวจสอบแบบตัดเว้นวรรค (ป้องกันการพิมพ์เลี่ยง เช่น "ห่ ว ย", "ก า ก")
  const compact = lower.replace(/\s+/g, '')
  for (const word of ALL_PROFANITY_WORDS) {
    if (word && compact.includes(word.toLowerCase())) {
      return word
    }
  }
  return null
}

export function formatReviewCode(reviewId: number) {
  return `RV${String(reviewId).padStart(3, '0')}`
}

export function formatThaiRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours <= 0) return 'เมื่อสักครู่'
      return `${diffHours} ชั่วโมงที่แล้ว`
    }
    if (diffDays === 1) return '1 วันที่แล้ว'
    if (diffDays < 30) return `${diffDays} วันที่แล้ว`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} เดือนที่แล้ว`
    return `${Math.floor(diffDays / 365)} ปีที่แล้ว`
  } catch {
    return 'เมื่อไม่นานมานี้'
  }
}

// SEED_REVIEWS เป็นข้อมูลอ้างอิงอย่างเดียวแล้ว — `ReviewContext` อ่านจาก `GET /api/reviews`
// ไม่ได้ใช้ชุดนี้เป็น fallback อีก · เก็บไว้เพราะ backend ยึดความหมายของ "ผลการตัดสินรายงาน"
// ตามชุดนี้ (ดูหัวข้อการตัดสินรายงานรีวิวใน backend/CLAUDE.md)
//
// รหัสหนังสือ 101-114 คือเล่มเดียวกับแคตตาล็อกหลัก ส่วน 901/902 เป็นหนังสือสมมติของ seed ชุดนี้
// ที่มีรูปปกของตัวเองและไม่มีอยู่ในตาราง book
export const SEED_REVIEWS: Review[] = [
  {
    reviewId: 1,
    bookId: 901,
    bookTitle: 'The Silent Observer',
    author: 'A. E. Hemingway',
    isbn: '978-3-16-148410-0',
    price: 390,
    coverUrl: silentObserverCover,
    customerName: 'John Doe',
    username: '@johndoe89',
    avatarColor: 'orange',
    verifiedPurchase: true,
    rating: 1,
    headline: 'ไม่เกี่ยวกับหนังสือเลย',
    comment: 'คลิกที่นี่เพื่อหารายได้ $500 ต่อวันด้วยการทำงานจากที่บ้าน! แผนการลงทุนคริปโตที่ดีที่สุดรับประกันผลตอบแทน ไปที่ www.scam-link.biz เพื่อเริ่มรับรายได้ตอนนี้ หนังสือก็โอเคแหละมั้ง',
    status: 'PENDING',
    createdDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 วันที่แล้ว
    flagged: true,
    orderId: 'ORD-2026-08501',
    orderDate: '2026-08-02T14:15:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'สแปม / ไม่เกี่ยวข้อง (รายงาน 3 ครั้ง)',
      detail: 'พบการโพสต์ข้อความหลอกลวงชักชวนลงทุนคริปโตและแปะลิงก์ภายนอก',
      reportedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      reportedBy: 'ฝ่ายขาย',
      reportCount: 3,
      category: 'spam',
      managerStatus: 'PENDING',
    },
  },
  {
    reviewId: 2,
    bookId: 902,
    bookTitle: 'Echoes in the Rain',
    author: 'M. K. Vance',
    isbn: '978-1-56619-909-4',
    price: 420,
    coverUrl: echoesInTheRainCover,
    customerName: 'Sarah Adams',
    username: '@sarah_reads',
    avatarColor: 'green',
    verifiedPurchase: false,
    rating: 1,
    headline: 'หนังสือมาถึงในสภาพชำรุด',
    comment: 'ฉันชอบเนื้อเรื่องนะ แต่เล่มที่ได้รับจาก BookHaven มีรอยฉีกขาดที่ปกหลังและหน้ากระดาษพับหลายหน้า ผิดหวังมากกับการบรรจุหีบห่อ ฉันคาดหวังการควบคุมคุณภาพที่ดีกว่านี้',
    status: 'PENDING',
    createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 วันที่แล้ว
    flagged: false,
    orderId: 'ORD-2026-07240',
    orderDate: '2026-07-22T09:10:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'ปัญหาการบริการลูกค้า',
      detail: 'ลูกค้าบ่นเรื่องความเสียหายจากการขนส่งและการแพ็คสินค้า',
      reportedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reportedBy: 'ฝ่ายขาย',
      reportCount: 1,
      category: 'service',
      managerStatus: 'PENDING',
    },
  },
  {
    reviewId: 3,
    bookId: 103,
    bookTitle: 'Circe',
    author: 'Madeline Miller',
    isbn: '978-0316556347',
    price: 390,
    coverUrl: circeCover,
    customerName: 'Spam Bot',
    username: '@spammer_shop',
    avatarColor: 'rose',
    verifiedPurchase: false,
    rating: 1,
    headline: 'แจกโค้ดส่วนลด 50% คลิกเลย',
    comment: 'หนังสือส่งช้ามาก ไปซื้อร้านอื่นดีกว่า แจกโค้ดส่วนลด 50% คลิกเลยที่ http://bit.ly/fake-discount-link รับประกันถูกกว่าร้านนี้แน่นอน',
    status: 'PENDING',
    createdDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    flagged: true,
    orderId: 'ORD-2026-08221',
    orderDate: '2026-07-28T16:20:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'สแปม / โฆษณา / ลิงก์ภายนอก',
      detail: 'มีลิงก์โปรโมทร้านค้าภายนอกและข้อความสแปม',
      reportedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      reportedBy: 'ฝ่ายขาย',
      reportCount: 4,
      category: 'spam',
      managerStatus: 'PENDING',
    },
  },
  {
    reviewId: 4,
    bookId: 109,
    bookTitle: 'The Midnight Library',
    author: 'Matt Haig',
    isbn: '978-0525559474',
    price: 380,
    coverUrl: midnightLibraryCover,
    customerName: 'John Doe',
    username: '@johndoe',
    avatarColor: 'blue',
    verifiedPurchase: true,
    rating: 4,
    headline: 'เนื้อเรื่องชวนคิดและสร้างแรงบันดาลใจ',
    comment: 'เรื่องราวสนุกและให้ข้อคิดดีมาก หนังสืออ่านเพลิน การจัดส่งรวดเร็วและการแพ็คแน่นหนาดีครับ',
    status: 'PUBLISHED',
    createdDate: '2026-08-20T10:00:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-08501',
    orderDate: '2026-08-02T14:15:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    reply: {
      replyId: 1,
      replyText: 'ขอบคุณสำหรับรีวิวและกำลังใจครับ ทางเรายินดีอย่างยิ่งที่คุณลูกค้าประทับใจในหนังสือเล่มนี้',
      repliedDate: '2026-08-21T09:00:00.000Z',
      repliedBy: 'ผู้จัดการร้าน',
    },
  },
  {
    reviewId: 5,
    bookId: 104,
    bookTitle: 'Project Hail Mary',
    author: 'Andy Weir',
    isbn: '978-0593135204',
    price: 450,
    coverUrl: projectHailMaryCover,
    customerName: 'Michael Chang',
    username: '@mike_reads',
    avatarColor: 'green',
    verifiedPurchase: true,
    rating: 5,
    headline: 'สุดยอดนิยายไซไฟแห่งปี!',
    comment: 'เป็นหนังสือที่สนุกมาก วิทยาศาสตร์เข้าใจง่ายและตัวเอกตลกดี จัดส่งเร็วมากด้วย!',
    status: 'PUBLISHED',
    createdDate: '2026-08-19T14:30:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-07240',
    orderDate: '2026-07-22T09:10:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    reply: {
      replyId: 2,
      replyText: 'ขอบคุณสำหรับรีวิวดีๆ ค่ะ! ดีใจที่คุณสนุกกับการเดินทางของ Ryland Grace ขอให้อ่านหนังสือให้สนุกนะคะ!',
      repliedDate: '2026-08-20T09:00:00.000Z',
      repliedBy: 'ฝ่ายขาย',
    },
  },
  {
    reviewId: 6,
    bookId: 101,
    bookTitle: 'Atomic Habits',
    author: 'James Clear',
    isbn: '978-0735211292',
    price: 350,
    coverUrl: atomicHabitsCover,
    customerName: 'Emily White',
    username: '@emilyw',
    avatarColor: 'purple',
    verifiedPurchase: true,
    rating: 5,
    headline: 'มีประโยชน์มาก นำไปปรับใช้ได้จริง',
    comment: 'อ่านง่ายและนำไปใช้ได้จริง เริ่มปรับเปลี่ยนนิสัยได้หลายอย่างแล้ว แนะนำสำหรับคนที่ต้องการพัฒนาตัวเอง',
    status: 'PUBLISHED',
    createdDate: '2026-08-18T16:00:00.000Z',
    flagged: false,
    orderId: 'ORD-2026-08411',
    orderDate: '2026-08-01T16:00:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
  },
  {
    reviewId: 7,
    bookId: 106,
    bookTitle: 'Dune',
    author: 'Frank Herbert',
    isbn: '978-0441172719',
    price: 520,
    coverUrl: duneCover,
    customerName: 'Unknown User',
    username: '@anon123',
    avatarColor: 'rose',
    verifiedPurchase: false,
    rating: 1,
    headline: 'ข้อความหยาบคาย',
    comment: 'เนื้อหาข้อความหยาบคายและละเมิดข้อกำหนดชุมชน',
    status: 'HIDDEN',
    createdDate: '2026-08-15T11:20:00.000Z',
    flagged: true,
    orderId: 'ORD-2026-08102',
    orderDate: '2026-07-30T11:20:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'เนื้อหาไม่เหมาะสม / มีคำหยาบคาย',
      detail: 'พบการใช้คำไม่สุภาพในการรีวิว',
      reportedDate: '2026-08-16T09:00:00.000Z',
      reportedBy: 'พนักงานฝ่ายขาย',
      managerStatus: 'APPROVED',
    },
  },
  {
    reviewId: 8,
    bookId: 108,
    bookTitle: 'Normal People',
    author: 'Sally Rooney',
    isbn: '978-0525633471',
    price: 320,
    coverUrl: normalPeopleCover,
    customerName: 'Troll User',
    username: '@troll_404',
    avatarColor: 'rose',
    verifiedPurchase: false,
    rating: 1,
    headline: 'สแปมและคุกคาม',
    comment: 'โพสต์สแปมข้อความซ้ำๆ และข้อความขยะ',
    status: 'REMOVED',
    createdDate: '2026-08-10T14:10:00.000Z',
    flagged: true,
    orderId: 'ORD-2026-08390',
    orderDate: '2026-08-01T10:00:00.000Z',
    deliveryStatus: 'จัดส่งสำเร็จแล้ว',
    report: {
      isReported: true,
      reason: 'สแปม / ก่อกวน',
      detail: 'ตรวจสอบพบเป็นบอทสร้างสแปม',
      reportedDate: '2026-08-11T10:00:00.000Z',
      reportedBy: 'ผู้จัดการร้าน',
      managerStatus: 'APPROVED',
    },
  },
]
