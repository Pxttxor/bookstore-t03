import EmptyState from './EmptyState'

interface ErrorStateProps {
  /** ข้อความไทยจาก ApiError.message — backend คัดมาจาก Figma spec แล้ว ไม่ต้องแปลซ้ำ */
  message: string
  onRetry: () => void
}

// ErrorState — โหลดข้อมูลจาก API ไม่สำเร็จ
//
// ใช้ EmptyState เป็นตัวแสดงผลเพื่อไม่ให้มีสองสไตล์บนหน้าจอเดียวกัน ต่างกันที่ไอคอน
// กับปุ่มลองใหม่ · ข้อความมาจาก backend ตรง ๆ ("code อังกฤษ message ไทย")
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-triangle"
      title="โหลดข้อมูลไม่สำเร็จ"
      description={message}
      action={{ label: 'ลองใหม่', onClick: onRetry }}
    />
  )
}
