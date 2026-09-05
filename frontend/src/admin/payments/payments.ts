// ตรวจสอบการชำระเงิน (Payment Verification)

import type { BadgeTone } from '../components/StatusBadge'

export type PaymentStatus = 'WAITING' | 'VERIFYING' | 'SUCCESS' | 'REJECTED'

export interface Bank {
  bankId: number
  name: string
  accountNo: string
}

/** รูปร่างข้อมูลตรงกับ paymentDTO ของ backend */
export interface Payment {
  paymentId: number
  code: string
  orderId: number
  orderCode: string
  bankId?: number
  bankName?: string
  amount: number
  transferDate?: string
  slipImageUrl?: string
  status: PaymentStatus
  statusLabel: string
  verifiedDate?: string
  verifiedBy?: string
  rejectReason?: string
}

export interface PaymentReport {
  reportId: number
  code: string
  periodStart: string
  periodEnd: string
  totalReceived: number
  itemCount: number
  generatedDate: string
  generatedBy: string
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  WAITING: 'รอชำระเงิน',
  VERIFYING: 'รอตรวจสอบ',
  SUCCESS: 'ชำระสำเร็จ',
  REJECTED: 'ปฏิเสธการชำระ',
}

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  WAITING: 'neutral',
  VERIFYING: 'warning',
  SUCCESS: 'success',
  REJECTED: 'danger',
}

// backend อนุญาตทั้ง verify และ reject เฉพาะรายการที่กำลังรอตรวจสอบเท่านั้น
export const canVerify = (status: PaymentStatus) => status === 'VERIFYING'
export const canReject = (status: PaymentStatus) => status === 'VERIFYING'
export const isSettled = (status: PaymentStatus) =>
  status === 'SUCCESS' || status === 'REJECTED'

export const REJECT_REASONS = [
  'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  'สลิปไม่ชัดเจน อ่านรายละเอียดไม่ได้',
  'โอนเข้าบัญชีที่ไม่ใช่ของร้าน',
  'สลิปซ้ำกับรายการที่ตรวจสอบไปแล้ว',
] as const

export const formatPaymentCode = (paymentId: number) => `PAY-${paymentId}`

export const paymentDate = (payment: Payment) => payment.transferDate?.slice(0, 10) ?? '—'

/** ใช้วันที่ตรวจสอบผ่านเหมือน PaymentRepository.SummarizeSuccess */
export function summarise(payments: Payment[], from: string, to: string) {
  const inPeriod = payments.filter((payment) => {
    const receivedDate = payment.verifiedDate?.slice(0, 10)
    return (
      payment.status === 'SUCCESS' &&
      receivedDate !== undefined &&
      receivedDate >= from &&
      receivedDate <= to
    )
  })
  return {
    totalReceived: inPeriod.reduce((sum, payment) => sum + payment.amount, 0),
    itemCount: inPeriod.length,
    payments: inPeriod,
  }
}
