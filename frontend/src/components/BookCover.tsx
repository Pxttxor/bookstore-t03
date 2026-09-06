import { useEffect, useState } from 'react'
import { apiGetBlob } from '../api/client'
import { coverFor } from '../data/covers'
import './BookCover.css'

// BookCover — รูปปกหนังสือ พร้อมปกสำรองสำหรับเล่มที่ยังไม่มีไฟล์ปก
//
// ตาราง `book` ไม่มีคอลัมน์รูปปก ปกจึงมีเฉพาะ 14 เล่มแรกที่มีไฟล์อยู่ในโปรเจกต์
// ส่วนเล่มไทย (115–123) วาดปกจากชื่อเรื่อง + ผู้แต่งแทน ไม่ใช้รูป placeholder
// ตัวเดียวกันทุกเล่ม เพราะบนหน้าแรกจะกลายเป็นแถวของกล่องเทาที่แยกกันไม่ออก
//
// สีพื้นคำนวณจาก `bookId` จึงคงที่ตลอด — เล่มเดิมได้สีเดิมทุกครั้งที่โหลด
// (ถ้าสุ่ม ปกจะเปลี่ยนสีทุกครั้งที่ re-render แล้วดูเหมือนหน้าจอกระพริบ)

interface BookCoverProps {
  bookId: number
  title: string
  author?: string
  /** ปกสำรองบนการ์ดเล็กตัดผู้แต่งออกเพื่อไม่ให้ตัวหนังสือแน่นเกินไป */
  size?: 'sm' | 'md'
  className?: string
}

export default function BookCover({
  bookId,
  title,
  author,
  size = 'md',
  className,
}: BookCoverProps) {
  const fallbackSrc = coverFor(bookId)
  const [databaseCover, setDatabaseCover] = useState<{ bookId: number; url: string }>()
  const [failedCover, setFailedCover] = useState<number>()
  const classes = ['book-cover', `book-cover--${size}`, className].filter(Boolean).join(' ')

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined

    const loadCover = () => {
      void apiGetBlob(`/api/catalogue/${bookId}/cover`)
        .then((blob) => {
          if (!active) return
          if (objectUrl) URL.revokeObjectURL(objectUrl)
          objectUrl = URL.createObjectURL(blob)
          setDatabaseCover({ bookId, url: objectUrl })
          setFailedCover(undefined)
        })
        .catch(() => undefined)
    }

    const refreshIfBookMatches = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path
      if (path?.includes(`/books/${bookId}/cover`)) loadCover()
    }

    loadCover()
    window.addEventListener('book-cover-updated', refreshIfBookMatches)
    return () => {
      active = false
      window.removeEventListener('book-cover-updated', refreshIfBookMatches)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [bookId])

  const databaseSrc = databaseCover?.bookId === bookId ? databaseCover.url : undefined
  const src = databaseSrc ?? fallbackSrc

  if (src && failedCover !== bookId) {
    return (
      <img
        className={classes}
        src={src}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (databaseSrc) setDatabaseCover(undefined)
          setFailedCover(bookId)
        }}
      />
    )
  }

  // 137 เป็นจำนวนเฉพาะ ทำให้รหัสที่เรียงติดกันได้สีต่างกันชัด ไม่ไล่เฉดทีละนิด
  const hue = (bookId * 137) % 360

  return (
    <div
      className={`${classes} book-cover--fallback`}
      style={{ '--cover-hue': hue } as React.CSSProperties}
      role="img"
      aria-label={title}
    >
      <span className="book-cover__title">{title}</span>
      {author && size !== 'sm' && <span className="book-cover__author">{author}</span>}
    </div>
  )
}
