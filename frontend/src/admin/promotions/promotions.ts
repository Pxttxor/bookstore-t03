// Types follow the Promotion class in the analysis class diagram (Sub2 — Promotion).
// This is a runnable demo of a teammate's subsystem, self-contained like the
// customer-order flow: the store manager creates promotions and toggles or removes
// them. No live Order is wired in, so the diagram's isApplicable()/calcDiscount()
// are not evaluated here — only overlaps() is used, to warn about clashing windows.

import type { BadgeTone } from '../components/StatusBadge'
import { formatBaht } from '../suppliers/suppliers'

export type PromotionType = 'FESTIVAL_DISCOUNT' | 'COUPON' | 'BUY_X_QTY'
export type PromotionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED'

export interface Promotion {
  promotionId: number
  name: string
  type: PromotionType
  conditionDetail: string
  discountValue: number
  isPercent: boolean
  minQty: number
  minAmount: number
  startDate: string // yyyy-mm-dd
  endDate: string // yyyy-mm-dd
  status: PromotionStatus
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  FESTIVAL_DISCOUNT: 'ส่วนลดเทศกาล',
  COUPON: 'คูปองส่วนลด',
  BUY_X_QTY: 'ซื้อครบจำนวน',
}

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  EXPIRED: 'หมดอายุ',
}

export const PROMOTION_STATUS_TONES: Record<PromotionStatus, BadgeTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  EXPIRED: 'warning',
}

export function formatPromotionCode(promotionId: number) {
  return `PROMO${String(promotionId).padStart(2, '0')}`
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function formatDiscount(promo: Promotion) {
  return promo.isPercent
    ? `${promo.discountValue}%`
    : `${formatBaht(promo.discountValue)} บาท`
}

// A promotion whose end date has passed reads as EXPIRED regardless of its stored
// status, mirroring the EXPIRED state in the class diagram. A manager-set INACTIVE
// status is respected even before the end date.
export function promoDisplayStatus(promo: Promotion, today = new Date()): PromotionStatus {
  if (promo.status === 'INACTIVE') return 'INACTIVE'
  if (promo.endDate && promo.endDate < isoDate(today)) return 'EXPIRED'
  return promo.status
}

// Promotion.overlaps(other) from the class diagram — two promotions of the same type
// whose date windows intersect. The form uses this to warn the manager before saving.
export function overlaps(a: Promotion, b: Promotion): boolean {
  if (a.type !== b.type) return false
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export const SEED_PROMOTIONS: Promotion[] = [
  {
    promotionId: 1,
    name: 'ลดรับสงกรานต์',
    type: 'FESTIVAL_DISCOUNT',
    conditionDetail: 'ลดทั้งร้านช่วงเทศกาลสงกรานต์',
    discountValue: 15,
    isPercent: true,
    minQty: 0,
    minAmount: 0,
    startDate: '2026-04-10',
    endDate: '2026-04-20',
    status: 'ACTIVE',
  },
  {
    promotionId: 2,
    name: 'มหกรรมหนังสือกลางปี',
    type: 'FESTIVAL_DISCOUNT',
    conditionDetail: 'ลดหนังสือหมวดนิยายและพัฒนาตนเอง',
    discountValue: 20,
    isPercent: true,
    minQty: 0,
    minAmount: 300,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'ACTIVE',
  },
  {
    promotionId: 3,
    name: 'ต้อนรับเปิดเทอม',
    type: 'FESTIVAL_DISCOUNT',
    conditionDetail: 'ลดหนังสือทุกเล่มช่วงเปิดภาคเรียน',
    discountValue: 12,
    isPercent: true,
    minQty: 0,
    minAmount: 0,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: 'ACTIVE',
  },
  {
    promotionId: 4,
    name: 'คูปองต้อนรับสมาชิกใหม่',
    type: 'COUPON',
    conditionDetail: 'ใช้โค้ด WELCOME50 เมื่อซื้อครบ 500 บาท',
    discountValue: 50,
    isPercent: false,
    minQty: 0,
    minAmount: 500,
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
  },
  {
    promotionId: 5,
    name: 'ซื้อครบ 3 เล่มลดเพิ่ม',
    type: 'BUY_X_QTY',
    conditionDetail: 'ซื้อหนังสือครบ 3 เล่มขึ้นไป รับส่วนลดเพิ่ม 10%',
    discountValue: 10,
    isPercent: true,
    minQty: 3,
    minAmount: 0,
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    status: 'ACTIVE',
  },
  {
    promotionId: 6,
    name: 'คูปองสมาชิกวีไอพี (พักการใช้งาน)',
    type: 'COUPON',
    conditionDetail: 'ส่วนลด 100 บาทสำหรับสมาชิกวีไอพี',
    discountValue: 100,
    isPercent: false,
    minQty: 0,
    minAmount: 800,
    startDate: '2026-08-01',
    endDate: '2026-10-31',
    status: 'INACTIVE',
  },
]
