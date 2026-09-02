import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import { useResource } from '../../api/useResource'
import type { Promotion } from './promotions'

// ข้อมูลอยู่ในตาราง promotion ของ PostgreSQL แล้ว
// เดิมเก็บใน localStorage คีย์ bookhaven.promotions.v1
const loadPromotions = () => apiGet<Promotion[]>('/api/promotions')

export type PromotionDraft = Omit<Promotion, 'promotionId' | 'status'>

interface PromotionValue {
  promotions: Promotion[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findById: (promotionId: number) => Promotion | undefined
  findByName: (name: string, ignoreId?: number) => Promotion | undefined
  add: (draft: PromotionDraft) => Promise<Promotion>
  update: (promotionId: number, draft: PromotionDraft) => Promise<Promotion>
  setActive: (promotionId: number, active: boolean) => Promise<void>
  remove: (promotionId: number) => Promise<void>
}

const PromotionContext = createContext<PromotionValue | null>(null)

const key = (name: string) => name.trim().toLowerCase()

// `PromotionInput` ฝั่ง Go รับ status มาด้วย — โปรโมชั่นที่สร้างใหม่เริ่มที่ ACTIVE
// เหมือนเดิม ส่วนตอนแก้ไขให้คงสถานะที่เป็นอยู่ (การเปิด/ปิดใช้เส้นทาง /status แยกต่างหาก)
const toBody = (draft: PromotionDraft, status: Promotion['status']) => ({
  name: draft.name,
  type: draft.type,
  conditionDetail: draft.conditionDetail,
  discountValue: draft.discountValue,
  isPercent: draft.isPercent,
  minQty: draft.minQty,
  minAmount: draft.minAmount,
  startDate: draft.startDate,
  endDate: draft.endDate,
  status,
})

export function PromotionProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, apply } = useResource(loadPromotions)

  const value = useMemo<PromotionValue>(() => {
    const promotions = data ?? []

    const findById = (promotionId: number) =>
      promotions.find((p) => p.promotionId === promotionId)

    // สามเส้นทางแรกคืนแถวที่อัปเดตแล้วผ่าน toPromotionDTO ตัวเดียวกับตอนอ่านลิสต์
    const replace = (updated: Promotion) => (list: Promotion[]) =>
      list.map((row) => (row.promotionId === updated.promotionId ? updated : row))

    const add = async (draft: PromotionDraft) => {
      const created = await apiPost<Promotion>('/api/promotions', toBody(draft, 'ACTIVE'))
      apply((list) => [...list, created].sort((a, b) => a.promotionId - b.promotionId))
      return created
    }

    const update = async (promotionId: number, draft: PromotionDraft) => {
      const current = findById(promotionId)
      const updated = await apiPut<Promotion>(
        `/api/promotions/${promotionId}`,
        toBody(draft, current?.status ?? 'ACTIVE'),
      )
      apply(replace(updated))
      return updated
    }

    const setActive = async (promotionId: number, active: boolean) => {
      const updated = await apiPost<Promotion>(`/api/promotions/${promotionId}/status`, {
        status: active ? 'ACTIVE' : 'INACTIVE',
      })
      apply(replace(updated))
    }

    // DELETE ตอบ 204 ไม่มีเนื้อหา — ตัดแถวออกจากชุดเดิมตามรหัสที่เพิ่งลบสำเร็จ
    const remove = async (promotionId: number) => {
      await apiDelete(`/api/promotions/${promotionId}`)
      apply((list) => list.filter((row) => row.promotionId !== promotionId))
    }

    return {
      promotions,
      loading,
      error,
      reload,
      findById,
      // เตือนผู้จัดการก่อนกดบันทึก · เซิร์ฟเวอร์ตรวจซ้ำและเป็นคำตัดสินสุดท้าย
      findByName: (name: string, ignoreId?: number) =>
        promotions.find((p) => key(p.name) === key(name) && p.promotionId !== ignoreId),
      add,
      update,
      setActive,
      remove,
    }
  }, [data, loading, error, reload, apply])

  return <PromotionContext.Provider value={value}>{children}</PromotionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePromotions(): PromotionValue {
  const ctx = useContext(PromotionContext)
  if (!ctx) throw new Error('usePromotions must be used within a PromotionProvider')
  return ctx
}
