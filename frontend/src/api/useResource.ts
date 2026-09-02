import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './client'

// useResource — โหลดข้อมูลจาก API หนึ่งชุด พร้อมสถานะกำลังโหลด / ผิดพลาด / โหลดซ้ำ
//
// ทุก context ของหลังร้านใช้ตัวนี้ตัวเดียวกัน จึงไม่ต้องเขียน useEffect ซ้ำเก้ารอบ
//
// **`load` ต้องเป็นฟังก์ชันที่อ้างอิงคงที่** — ประกาศไว้ระดับโมดูล (นอกคอมโพเนนต์)
// หรือห่อด้วย useCallback มาก่อน ถ้าสร้างใหม่ทุกครั้งที่ render จะยิง API ไม่หยุด
//
// `enabled` มีไว้เพราะ NotificationProvider กับ OrderProvider อยู่ที่ main.tsx ซึ่งครอบ
// หน้าร้านด้วย · ผู้ใช้ที่ยังไม่ล็อกอิน (หรือเป็นลูกค้า) ต้องไม่ยิงเส้นทางของพนักงาน
// ไม่งั้นจะได้ 401/403 ทุกครั้งที่มีคนเปิดหน้าแรก
export interface Resource<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /**
   * เขียนผลลัพธ์ที่เซิร์ฟเวอร์คืนมาลง state ตรง ๆ แทนการโหลดทั้งชุดใหม่
   *
   * endpoint ที่แก้ข้อมูลเกือบทุกเส้นคืนแถวที่อัปเดตแล้วกลับมาให้อยู่แล้ว
   * (`httpx.OK(w, toSupplierDTO(...))`) การ `reload()` ต่อท้ายจึงเป็นการถามซ้ำในสิ่งที่รู้แล้ว
   *
   * **ไม่ทำอะไรถ้ายังไม่มีข้อมูลชุดเดิม** (กำลังโหลดอยู่ หรือรอบก่อนโหลดพัง)
   * เพราะไม่มีของเดิมให้ต่อยอด · กรณีนั้นผู้เรียกต้องใช้ `reload()`
   *
   * ใช้ได้เฉพาะเมื่อคำตอบของเซิร์ฟเวอร์ครอบคลุมสิ่งที่เปลี่ยนทั้งหมด — งานที่เขียนหลายตาราง
   * ในทรานแซกชันเดียวแล้วคืนมาแค่เอกสารใบเดียว (บันทึกรอบตรวจนับ · รับสินค้าเข้าคลัง)
   * ต้อง `reload()` เหมือนเดิม
   */
  apply: (next: (current: T) => T) => void
}

// key = ค่า enabled ที่ state ก้อนนี้เป็นของ · ใช้ล้างข้อมูลของผู้ใช้คนก่อนตอนสลับบัญชี
// โดยไม่ต้อง setState ตอน render หรือใน effect (React Compiler ห้ามทั้งสองอย่าง)
interface State<T> {
  key: boolean
  data: T | undefined
  loading: boolean
  error: string | null
}

const freshState = <T,>(enabled: boolean): State<T> => ({
  key: enabled,
  data: undefined,
  loading: enabled,
  error: null,
})

export function useResource<T>(load: () => Promise<T>, enabled = true): Resource<T> {
  const [state, setState] = useState<State<T>>(() => freshState<T>(enabled))

  // กันคำตอบของคำขอเก่าที่มาถึงช้ากว่าคำขอใหม่แล้วเขียนทับข้อมูลล่าสุด
  //
  // ใช้วิธีเมินคำตอบที่ล้าสมัย ไม่ใช่ AbortController เพราะ `apiGet` รวมคำขอ GET ที่ path
  // เดียวกันให้ใช้ตัวเดียวกัน การยกเลิกของผู้เรียกคนหนึ่งจะทำให้อีกคนที่รอคำตอบเดียวกันพังไปด้วย
  const requestId = useRef(0)

  // ยิงคำขอหนึ่งครั้ง — setState เกิดหลัง await เสมอ ไม่ใช่ตอน effect ทำงาน
  const run = useCallback(async () => {
    if (!enabled) return
    requestId.current += 1
    const id = requestId.current
    try {
      const data = await load()
      if (id !== requestId.current) return
      setState({ key: true, data, loading: false, error: null })
    } catch (err) {
      if (id !== requestId.current) return
      const message =
        err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      setState({ key: true, data: undefined, loading: false, error: message })
    }
  }, [load, enabled])

  // reload มาจากปุ่ม "ลองใหม่" และจากหลัง mutation — เป็น event handler จึงตั้ง loading ตรง ๆ ได้
  const reload = useCallback(async () => {
    if (!enabled) return
    setState((prev) => ({ ...prev, key: true, loading: true, error: null }))
    await run()
  }, [enabled, run])

  // โหลดครั้งแรกตอน mount และทุกครั้งที่ load/enabled เปลี่ยน
  //
  // `react-hooks/set-state-in-effect` ห้ามเรียกอะไรที่ setState จาก effect เพราะอยากให้
  // ไปใช้ไลบรารีดึงข้อมูลหรือ Suspense แทน · โปรเจกต์นี้ตั้งใจไม่เพิ่ม dependency
  // (กติกา "no state library" ใน frontend/CLAUDE.md) และ setState ที่นี่เกิดหลัง await เสมอ
  // พร้อม requestId กันคำตอบเก่าเขียนทับอยู่แล้ว จึงปิดกฎเฉพาะบรรทัดนี้
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run()
  }, [run])

  // เรียกจาก handler ของ mutation หลัง await เสมอ ไม่ใช่ตอน render หรือใน effect
  // จึง setState ได้ตรง ๆ โดยไม่ชน react-hooks/set-state-in-effect
  const apply = useCallback(
    (next: (current: T) => T) => {
      if (!enabled) return
      setState((prev) => {
        // state ยังเป็นของ enabled ค่าก่อนหน้า หรือยังไม่เคยโหลดสำเร็จ — ไม่มีของเดิมให้แก้
        if (!prev.key || prev.data === undefined) return prev
        return { key: true, data: next(prev.data), loading: false, error: null }
      })
    },
    [enabled],
  )

  // enabled เพิ่งเปลี่ยน แต่ state ยังเป็นของค่าก่อนหน้า — คำนวณค่าใหม่แทนการเขียน state
  // (ถ้าคืน state เก่าไป ผู้ใช้ที่เพิ่งล็อกอินจะเห็นข้อมูลของคนก่อนแวบหนึ่ง)
  const current = state.key === enabled ? state : freshState<T>(enabled)

  return {
    data: current.data,
    loading: current.loading,
    error: current.error,
    reload,
    apply,
  }
}


