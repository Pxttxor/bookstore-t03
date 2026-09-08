// phone.ts — การจัดการและจัดรูปแบบเบอร์โทรศัพท์ (3-3-4: 000-000-0000)

/**
 * จัดรูปแบบเบอร์โทรศัพท์โดยใส่ขีดให้อัตโนมัติ (เช่น 081-234-5678)
 * จำกัดตัวเลขไม่เกิน 10 หลัก
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * ดึงเฉพาะตัวเลขจากเบอร์โทรศัพท์ (สูงสุด 10 หลัก)
 */
export function cleanPhoneDigits(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '').slice(0, 10)
}

/**
 * ตรวจสอบว่าเบอร์โทรศัพท์กรอกตัวเลขครบ 10 หลักหรือไม่
 */
export function isValidPhoneNumber(value: string): boolean {
  return cleanPhoneDigits(value).length === 10
}
