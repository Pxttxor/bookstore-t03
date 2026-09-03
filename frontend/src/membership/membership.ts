// ระบบย่อยที่ 2 — ระบบสมาชิกและแต้มสะสม (Membership & Loyalty)
// เจ้าของ: บัญชาการ อภัยสอน (B6730741)

import type { BadgeTone } from '../admin/components/StatusBadge'

export type PointTxnType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'REVERSAL'
export type RewardType = 'DISCOUNT' | 'GIFT'

export interface MembershipTier {
  tierId: number
  name: string
  minAccumulatedPurchase: number
  pointRate: number
  benefits: string
}

/** รูปร่างข้อมูลตรงกับ memberDTO ของ backend */
export interface Member {
  memberId: number
  code: string
  customerId: number
  customerName: string
  joinDate: string
  pointBalance: number
  totalAccumulatedPurchase: number
  tierId: number
  tierName: string
  pointRate: number
  benefits?: string
}

export interface PointTransaction {
  pointTxnId: number
  type: PointTxnType
  typeLabel: string
  points: number
  earnedDate: string
  expiryDate?: string
  balanceAfter: number
  orderId?: number
  orderCode?: string
  note?: string
}

export interface Reward {
  rewardId: number
  name: string
  type: RewardType
  typeLabel: string
  pointCost: number
  discountValue: number
}

export interface Redemption {
  redemptionId: number
  memberId: number
  rewardId: number
  rewardName: string
  rewardType: RewardType
  pointsUsed: number
  redeemedDate: string
  couponCode: string
}

export const POINT_TXN_TYPE_LABELS: Record<PointTxnType, string> = {
  EARN: 'ได้รับแต้ม',
  REDEEM: 'ใช้แต้มแลก',
  EXPIRE: 'แต้มหมดอายุ',
  REVERSAL: 'ยกเลิก/คืนรายการ',
}

export const POINT_TXN_TYPE_TONES: Record<PointTxnType, BadgeTone> = {
  EARN: 'success',
  REDEEM: 'info',
  EXPIRE: 'neutral',
  REVERSAL: 'warning',
}

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  DISCOUNT: 'ส่วนลด',
  GIFT: 'ของแถม',
}

export function nextTierOf(
  tiers: MembershipTier[],
  totalPurchase: number,
): MembershipTier | undefined {
  return [...tiers]
    .sort((a, b) => a.minAccumulatedPurchase - b.minAccumulatedPurchase)
    .find((tier) => tier.minAccumulatedPurchase > totalPurchase)
}

export const formatMemberCode = (memberId: number) => `MBR${String(memberId).padStart(4, '0')}`

export const memberFullName = (member: Member) => member.customerName

export const formatPoints = (points: number) =>
  `${points > 0 ? '+' : ''}${points.toLocaleString('th-TH')}`

/** แต้ม EARN ที่กำลังจะหมดอายุภายใน 90 วัน */
export function expiringSoon(transactions: PointTransaction[], from = new Date()): number {
  const limit = new Date(from)
  limit.setDate(limit.getDate() + 90)
  return transactions
    .filter(
      (txn) =>
        txn.type === 'EARN' &&
        txn.expiryDate !== undefined &&
        new Date(txn.expiryDate) > from &&
        new Date(txn.expiryDate) <= limit,
    )
    .reduce((sum, txn) => sum + txn.points, 0)
}
