/** ตัดทุกอักขระที่ไม่ใช่ตัวอักษร/ตัวเลขทิ้ง แล้วลดรูปเป็นตัวพิมพ์เล็ก — `\p{L}` กันไม่ให้
 *  ตัวอักษรไทยหลุด, ที่ตัดคือขีดกลาง ช่องว่าง จุด วงเล็บ ทำให้ "PR-182" กับ "pr182" เป็นสตริงเดียวกัน */
export const searchKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** true เมื่อ needle ที่ normalize แล้วอยู่ในฟิลด์ใดฟิลด์หนึ่ง — normalize ทีละฟิลด์ ไม่ใช่ต่อเป็น
 *  สตริงเดียว เพราะการตัดช่องว่างจะทำให้ค้นข้ามขอบฟิลด์ไปเจอผลลวง (เช่น "5001po" แมตช์ข้ามเลขที่กับรหัส) */
export const matchesSearch = (needle: string, ...fields: (string | undefined)[]) => {
  const key = searchKey(needle)
  if (key === '') return true
  return fields.some((field) => field !== undefined && searchKey(field).includes(key))
}
