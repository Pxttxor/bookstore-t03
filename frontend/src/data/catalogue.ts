// catalogue.ts — แคตตาล็อกที่หน้าร้านอ่าน (ชนิดข้อมูล + ตัวโหลด)
//
// ตรงกับ `catalogueBookDTO` / `catalogueDetailDTO` ใน
// `backend/internal/handler/dto_catalogue.go` ทีละฟิลด์
//
// สามเส้นทางนี้ **เปิดสาธารณะ** ไม่ต้องมี token — คนเดินดูหนังสือยังไม่ล็อกอิน
// และเห็นเฉพาะเล่มที่ขายอยู่ (เซิร์ฟเวอร์คัด `status = ACTIVE` ให้แล้ว)

import { apiGet } from '../api/client'

export type StockLevel = 'OUT' | 'LOW' | 'OK'

export interface CatalogueBook {
  bookId: number
  isbn: string
  title: string
  author: string
  publisher: string
  /** ราคาปกเป็นบาท ตรงกับคอลัมน์ book.price */
  price: number
  description: string
  categoryId: number
  categoryName: string
  /** ยอดคงเหลือจริงจาก inventory_item — 0 = ขายไม่ได้ */
  quantityOnHand: number
  stockLevel: StockLevel
  stockLevelLabel: string
  /** ค่าเฉลี่ยของรีวิวที่เผยแพร่แล้ว ปัดหนึ่งตำแหน่งมาจากเซิร์ฟเวอร์ · 0 = ยังไม่มีรีวิว */
  ratingAverage: number
  ratingCount: number
}

export interface CatalogueCategory {
  categoryId: number
  name: string
  description: string
}

export interface CatalogueReply {
  replyId: number
  replyText: string
  repliedDate: string
  repliedBy: string
}

export interface CatalogueReview {
  reviewId: number
  customerName: string
  rating: number
  headline?: string
  comment: string
  verifiedPurchase: boolean
  createdDate: string
  replies: CatalogueReply[]
}

export interface CatalogueDetail extends CatalogueBook {
  reviews: CatalogueReview[]
}

export interface CatalogueData {
  books: CatalogueBook[]
  categories: CatalogueCategory[]
}

// ประกาศระดับโมดูลเพื่อให้ useResource ได้ฟังก์ชันที่อ้างอิงคงที่
export async function loadCatalogue(): Promise<CatalogueData> {
  const [books, categories] = await Promise.all([
    apiGet<CatalogueBook[]>('/api/catalogue'),
    apiGet<CatalogueCategory[]>('/api/catalogue/categories'),
  ])
  return { books, categories }
}

export const loadCatalogueBook = (bookId: number) =>
  apiGet<CatalogueDetail>(`/api/catalogue/${bookId}`)

/**
 * ค้นหาแบบเดียวกับ `Book.search()` ของวุฒิภัทร — ชื่อเรื่อง / ผู้แต่ง / ISBN
 * แบบไม่สนตัวพิมพ์ · คำค้นว่างถือว่าผ่านทุกเล่ม
 */
export function matchesSearch(book: CatalogueBook, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (needle === '') return true
  return (
    book.title.toLowerCase().includes(needle) ||
    book.author.toLowerCase().includes(needle) ||
    book.isbn.toLowerCase().includes(needle)
  )
}
