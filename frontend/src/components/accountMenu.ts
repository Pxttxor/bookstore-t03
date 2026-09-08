// accountMenu.ts — เมนูสมาชิกชุดเดียวที่ทั้ง UserMenu (ดรอปดาวน์บน TopNav) และ
// AccountNav (แถบเมนูซ้ายของหน้าบัญชี) ใช้ร่วมกัน
//
// ป้ายไทย/route ทุกตัวยกจาก "ทางลัด" เดิมของ ProfilePage ตรงตัว — ห้ามเพิ่มรายการใหม่
// (รายการโปรดของฉัน / สมุดที่อยู่จัดส่ง เป็นของระบบสมาชิกที่ยังไม่ทำ อยู่นอกขอบเขตต้นแบบนี้)

import type { IconName } from './Icon'

export interface AccountMenuItem {
  label: string
  icon: IconName
  /** ปลายทางจริง · ไม่มี = ยังไม่เปิดใช้ (แสดงป้าย "เร็ว ๆ นี้" กดไม่ได้) */
  to?: string
}

export const ACCOUNT_MENU: AccountMenuItem[] = [
  { label: 'ข้อมูลสมาชิก', icon: 'user', to: '/profile' },
  { label: 'ประวัติการสั่งซื้อ', icon: 'clock', to: '/orders' },
  { label: 'แต้มสะสมของฉัน', icon: 'award', to: '/member/points' },
  { label: 'แลกแต้มส่วนลด', icon: 'tag', to: '/member/rewards' },
  { label: 'รายการโปรดของฉัน', icon: 'heart' },
  { label: 'สมุดที่อยู่จัดส่ง', icon: 'truck' },
]

export const ACCOUNT_MENU_SOON_TITLE =
  'ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้'
