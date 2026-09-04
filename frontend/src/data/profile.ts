// profile.ts — โปรไฟล์ของลูกค้าที่ล็อกอินอยู่ (ชื่อ · เบอร์โทร · ที่อยู่ที่บันทึกไว้)
//
// ตรงกับ `customerDTO` ใน `backend/internal/handler/dto_person.go` ทีละฟิลด์
// สองเส้นทางนี้เป็น `roleCustomer` — พนักงานและแขกที่ยังไม่ล็อกอินเรียกไม่ได้
// ผู้เรียกจึงต้องกันด้วยแฟล็ก `enabled` ของ `useResource` ไม่ใช่ปล่อยให้ได้ 401/403

import { apiGet, apiPut } from '../api/client'

export interface MyProfile {
  customerId: number
  personId: number
  firstName: string
  lastName: string
  /** ชื่อเต็มที่เซิร์ฟเวอร์ประกอบให้ (`Person.Name()`) */
  name: string
  email: string
  phone: string
  /** ที่อยู่ที่ลูกค้าบันทึกไว้ครั้งก่อน · ว่าง = ยังไม่เคยบันทึก */
  address: string
  registeredDate: string
}

// ประกาศระดับโมดูลเพื่อให้ useResource ได้ฟังก์ชันที่อ้างอิงคงที่
export const loadMyProfile = () => apiGet<MyProfile>('/api/customers/me')

/**
 * บันทึกเบอร์โทรกับที่อยู่ลงโปรไฟล์
 *
 * `ProfileInput` ฝั่ง Go บังคับครบสี่ฟิลด์ (`httpx.Decode` เปิด `DisallowUnknownFields`
 * ส่งเกินหรือขาดคือ 422 ทันที) และ `firstName`/`lastName`/`address` ว่างไม่ได้
 *
 * **ส่งชื่อจากโปรไฟล์เดิมกลับไปตรง ๆ ไม่ใช่ชื่อที่กรอกในฟอร์ม** — ช่องนั้นคือชื่อผู้รับ
 * ของใบสั่งซื้อใบนี้ ซึ่งเป็นคนละอย่างกับชื่อเจ้าของบัญชี · การเดาแยกชื่อ-นามสกุล
 * ด้วยช่องว่างจะทำให้ชื่อจริงในฐานเพี้ยนไปทุกครั้งที่ลูกค้าสั่งของให้คนอื่น
 */
export const saveMyAddress = (profile: MyProfile, phone: string, address: string) =>
  apiPut<MyProfile>('/api/customers/me', {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone,
    address,
  })
