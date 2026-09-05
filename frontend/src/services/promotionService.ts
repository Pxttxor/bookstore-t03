import { apiGet } from '../api/client'
import type { Promotion } from '../admin/promotions/promotions'

/**
 * ดึงรายการโปรโมชั่นที่กำลังเปิดใช้งานอยู่ (GET /api/promotions/active)
 */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  try {
    const data = await apiGet<Promotion[]>('/api/promotions/active')
    if (Array.isArray(data)) {
      return data
    }
  } catch (err) {
    console.warn('Failed to load active promotions:', err)
  }
  return []
}

/**
 * คำนวณส่วนลดเป็นบาทสำหรับโปรโมชั่นนี้
 */
export function calculateDiscount(promo: Promotion, subtotal: number): number {
  let discount = promo.isPercent
    ? (subtotal * promo.discountValue) / 100
    : promo.discountValue
  if (discount > subtotal) discount = subtotal
  if (discount < 0) discount = 0
  return Math.round(discount * 100) / 100
}

/**
 * ตรวจสอบว่าคำสั่งซื้อนี้เข้าเงื่อนไขโปรโมชั่นหรือไม่
 */
export function isPromotionApplicable(
  promo: Promotion,
  subtotal: number,
  totalQty: number,
  currentDate?: string,
): boolean {
  const today = currentDate || new Date().toISOString().slice(0, 10)
  if (promo.status === 'INACTIVE') return false
  if (promo.startDate && today < promo.startDate) return false
  if (promo.endDate && today > promo.endDate) return false
  if (promo.minAmount > 0 && subtotal < promo.minAmount) return false
  if (promo.minQty > 0 && totalQty < promo.minQty) return false
  return true
}

export interface BestPromotionResult {
  promotion: Promotion | null
  discount: number
}

/**
 * ค้นหาโปรโมชั่นที่เข้าเงื่อนไขและให้ส่วนลดสูงสุดแก่ลูกค้า
 */
export function findBestPromotion(
  promotions: Promotion[],
  subtotal: number,
  totalQty: number,
  currentDate?: string,
): BestPromotionResult {
  let bestPromo: Promotion | null = null
  let maxDiscount = 0

  for (const promo of promotions) {
    if (isPromotionApplicable(promo, subtotal, totalQty, currentDate)) {
      const discount = calculateDiscount(promo, subtotal)
      if (discount > maxDiscount) {
        maxDiscount = discount
        bestPromo = promo
      }
    }
  }

  return {
    promotion: bestPromo,
    discount: maxDiscount,
  }
}
