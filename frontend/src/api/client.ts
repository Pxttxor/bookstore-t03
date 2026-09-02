// client.ts — จุดเดียวที่คุยกับ REST API ของ backend (Go · PostgreSQL)
//
// รูปแบบ response ตายตัวสองแบบ ตาม backend/internal/httpx/httpx.go:
//
//   สำเร็จ  → เนื้อหาของทรัพยากรตรง ๆ (array หรือ object)
//   ผิดพลาด → {"error": {"code": "SUPPLIER_DUPLICATE", "message": "มีผู้จัดจำหน่ายชื่อนี้อยู่แล้ว"}}
//
// `code` เป็นอังกฤษเอาไว้ switch · `message` เป็นไทยสำหรับแสดงบนหน้าจอได้ทันที
// จึงป้อน err.message เข้า useToast().notify() ได้ตรง ๆ โดยไม่ต้องแปลเอง
//
// หมายเหตุ: handler ฝั่ง Go ใช้ `Decode` ที่เปิด DisallowUnknownFields ไว้
// **body ที่ส่งไปต้องมีเฉพาะฟิลด์ที่ struct ฝั่งนั้นประกาศ** ส่งฟิลด์เกินไปจะได้ 422 INVALID_BODY

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')

// localStorage ก้อนเดียวที่เหลืออยู่ทั้งแอป — เก็บแค่ token ไม่ใช่ข้อมูลโดเมน
const TOKEN_KEY = 'bookhaven.token'

// `erasableSyntaxOnly` เปิดอยู่ จึงประกาศฟิลด์แยกและกำหนดค่าในตัวสร้าง
// ใช้ parameter property (`constructor(readonly code: string)`) ไม่ได้
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // โหมดส่วนตัวของบางเบราว์เซอร์เขียนไม่ได้ — ใช้งานต่อได้จนกว่าจะรีเฟรช
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // เช่นเดียวกับ set()
    }
  },
}

// token หมดอายุระหว่างใช้งาน (TTL 12 ชม.) เกิดที่ไหนก็ได้ในแอป แต่คนที่รู้วิธี
// พาผู้ใช้กลับไปหน้าเข้าสู่ระบบคือ AuthProvider จึงให้ลงทะเบียนตัวจัดการไว้ที่นี่
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

interface ErrorBody {
  error?: { code?: string; message?: string }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // เซิร์ฟเวอร์ไม่ตอบเลย (ปิดอยู่ · เน็ตหลุด · CORS ปฏิเสธ) — ไม่มี response ให้แกะ
    throw new ApiError('NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง', 0)
  }

  if (response.ok) {
    // 204 ไม่มีเนื้อหา (เช่นการลบ) — คืน undefined ให้ผู้เรียกที่ประกาศเป็น void
    if (response.status === 204) return undefined as T
    const text = await response.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  }

  let payload: ErrorBody = {}
  try {
    payload = (await response.json()) as ErrorBody
  } catch {
    // บาง error ตอบกลับมาไม่ใช่ JSON (เช่น proxy ขวางไว้) ใช้ข้อความกลาง ๆ แทน
  }

  const code = payload.error?.code ?? 'UNEXPECTED_ERROR'
  const message = payload.error?.message ?? 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง'

  if (response.status === 401) {
    tokenStore.clear()
    onUnauthorized?.()
  }

  throw new ApiError(code, message, response.status)
}

// คำขอ GET ที่ path เดียวกันและยังไม่ได้คำตอบ ใช้คำขอตัวเดียวร่วมกัน
//
// เกิดขึ้นจริงสองกรณี: `StrictMode` เรียก effect สองรอบในโหมดพัฒนา ทำให้ทุก provider
// ยิงซ้ำสองเท่า · และ provider สองตัวที่บังเอิญขอ path เดียวกันตอน mount พร้อมกัน
//
// **ไม่ใช่แคช** — ลบ key ทิ้งทันทีที่ได้คำตอบ คำขอถัดไปจึงวิ่งไปที่เซิร์ฟเวอร์เสมอ
// ข้อมูลหลังร้านต้องสดตลอด การเก็บคำตอบไว้ใช้ซ้ำจะทำให้สองหน้าจอเห็นยอดไม่ตรงกัน
const inFlight = new Map<string, Promise<unknown>>()

// ผู้เรียกที่ใช้คำขอร่วมกันจะได้อ็อบเจกต์ก้อนเดียวกัน — ทุก context อ่านอย่างเดียว
// (filter / map / find) และสร้างอาร์เรย์ใหม่เสมอเวลาแก้ จึงแชร์กันได้ปลอดภัย
export function apiGet<T>(path: string): Promise<T> {
  const shared = inFlight.get(path)
  if (shared) return shared as Promise<T>

  const pending = request<T>('GET', path).finally(() => {
    inFlight.delete(path)
  })
  inFlight.set(path, pending)
  return pending
}

export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {})
export const apiPut = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
export const apiDelete = <T>(path: string) => request<T>('DELETE', path)

