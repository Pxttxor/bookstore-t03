// promptpay.ts — สร้าง payload ของคิวอาร์พร้อมเพย์ (Thai QR Payment) ตามยอดที่ต้องชำระ
//
// รหัสคิวอาร์พร้อมเพย์คือสตริงตามมาตรฐาน EMVCo ที่ประกอบจากช่อง TLV
// (tag 2 หลัก · length 2 หลัก · value) ต่อกันไปเรื่อย ๆ แล้วปิดท้ายด้วย
// checksum CRC-16 ในช่อง 63 แอปธนาคารอ่านสตริงนี้แล้วเติมเบอร์ผู้รับกับ
// จำนวนเงินให้ผู้จ่ายเอง — ผู้จ่ายจึงไม่ต้องพิมพ์ยอดเอง และโอนผิดยอดไม่ได้
//
// ถ้าใส่จำนวนเงินมา (ช่อง 54) รหัสจะเป็นแบบ "dynamic" คือล็อกยอดไว้แล้ว
// ถ้าไม่ใส่ จะเป็นแบบ "static" ที่ผู้จ่ายกรอกยอดเองในแอปธนาคาร

/** เบอร์พร้อมเพย์ของร้าน — ปลายทางที่ยอดชำระทุกออเดอร์จะเข้า */
export const SHOP_PROMPTPAY_ID = '0981878675'

/** ชื่อบัญชีที่แสดงคู่กับรหัสคิวอาร์ ให้ลูกค้าเทียบกับที่แอปธนาคารขึ้นให้ */
export const SHOP_PROMPTPAY_NAME = 'BookHaven'

// --- ค่าคงที่ของมาตรฐาน EMVCo / พร้อมเพย์ ---
const TAG_PAYLOAD_FORMAT = '00'
const TAG_POI_METHOD = '01'
const TAG_MERCHANT_INFO_BOT = '29'
const TAG_TRANSACTION_CURRENCY = '53'
const TAG_TRANSACTION_AMOUNT = '54'
const TAG_COUNTRY_CODE = '58'
const TAG_CRC = '63'

const BOT_TAG_GUID = '00'
const BOT_TAG_MOBILE = '01'
const BOT_TAG_NATIONAL_ID = '02'
const BOT_TAG_EWALLET_ID = '03'

const GUID_PROMPTPAY = 'A000000677010111'
const CURRENCY_THB = '764'
const COUNTRY_TH = 'TH'
const POI_STATIC = '11'   // ผู้จ่ายกรอกยอดเอง
const POI_DYNAMIC = '12'  // ยอดถูกล็อกมาในรหัสแล้ว

/** ประกอบหนึ่งช่อง TLV — ความยาวเป็นเลขสองหลักเสมอ เช่น `5802TH` */
function field(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * แปลงปลายทางพร้อมเพย์ให้เป็นรูปแบบที่มาตรฐานกำหนด
 * - เบอร์มือถือ 10 หลัก → ตัด 0 หน้าออกใส่รหัสประเทศ 66 แล้วเติม 0 ข้างหน้าให้ครบ 13 หลัก
 *   (0981878675 → 0066981878675)
 * - เลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก และเลข e-Wallet 15 หลัก ใช้ตามเลขจริง
 */
function targetField(promptPayId: string): string | null {
  const digits = digitsOnly(promptPayId)
  if (digits.length === 10) {
    const withCountry = `66${digits.replace(/^0/, '')}`
    return field(BOT_TAG_MOBILE, withCountry.padStart(13, '0'))
  }
  if (digits.length === 13) {
    return field(BOT_TAG_NATIONAL_ID, digits)
  }
  if (digits.length === 15) {
    return field(BOT_TAG_EWALLET_ID, digits)
  }
  return null
}

/**
 * CRC-16/CCITT-FALSE (poly 0x1021 · init 0xFFFF) — checksum ที่ช่อง 63 ต้องใช้
 * แอปธนาคารจะปฏิเสธรหัสที่ checksum ไม่ตรงทันที
 */
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * สร้างสตริงคิวอาร์พร้อมเพย์
 *
 * @param promptPayId เบอร์มือถือ 10 หลัก · เลขประจำตัว 13 หลัก · หรือเลข e-Wallet 15 หลัก
 * @param amount ยอดชำระเป็นบาท ถ้าไม่ใส่หรือเป็น 0 จะได้รหัสแบบให้ผู้จ่ายกรอกยอดเอง
 * @returns สตริงสำหรับเข้ารหัสเป็นรูปคิวอาร์ หรือ `null` เมื่อปลายทางไม่ถูกรูปแบบ
 */
export function buildPromptPayPayload(promptPayId: string, amount?: number): string | null {
  const target = targetField(promptPayId)
  if (!target) return null

  // ยอดต้องเป็นจำนวนบวกที่คำนวณได้ ไม่งั้นถอยไปใช้รหัสแบบไม่ล็อกยอด
  const hasAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0

  const parts = [
    field(TAG_PAYLOAD_FORMAT, '01'),
    field(TAG_POI_METHOD, hasAmount ? POI_DYNAMIC : POI_STATIC),
    field(TAG_MERCHANT_INFO_BOT, field(BOT_TAG_GUID, GUID_PROMPTPAY) + target),
    field(TAG_COUNTRY_CODE, COUNTRY_TH),
    field(TAG_TRANSACTION_CURRENCY, CURRENCY_THB),
  ]
  if (hasAmount) {
    parts.push(field(TAG_TRANSACTION_AMOUNT, amount.toFixed(2)))
  }

  // checksum คิดจากทุกช่องก่อนหน้า + หัวช่อง 63 ('6304') ด้วย
  const body = `${parts.join('')}${TAG_CRC}04`
  return `${body}${crc16(body)}`
}

/** เบอร์พร้อมเพย์ในรูปแบบอ่านง่าย 000-000-0000 สำหรับโชว์ข้างรหัสคิวอาร์ */
export function formatPromptPayId(promptPayId: string): string {
  const d = digitsOnly(promptPayId)
  if (d.length !== 10) return promptPayId
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}
