import './LoadingState.css'

interface LoadingStateProps {
  /** ข้อความใต้ตัวหมุน — เขียนให้ตรงกับสิ่งที่กำลังโหลดได้ */
  label?: string
}

// LoadingState — สถานะกำลังดึงข้อมูลจาก API
//
// ก่อนหน้านี้ทั้งแอปอ่านจาก localStorage แบบ synchronous จึงไม่มีอะไรให้รอ
// (`frontend/CLAUDE.md` เคยบันทึกไว้ว่า "No loading skeletons") พอย้ายมาอ่านจาก
// ฐานข้อมูลจริงผ่าน REST การรอจึงมีอยู่จริงและต้องบอกผู้ใช้ ตามที่ Figma spec §7 ขอไว้แต่แรก
//
// ใช้โครงเดียวกับ EmptyState เพื่อให้ความสูงของการ์ดไม่กระโดดตอนสลับสถานะ
export default function LoadingState({ label = 'กำลังโหลดข้อมูล…' }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-state__spinner" aria-hidden="true" />
      <p className="loading-state__text">{label}</p>
    </div>
  )
}
