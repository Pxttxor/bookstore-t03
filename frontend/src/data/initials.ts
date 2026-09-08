// initials.ts — ย่อชื่อเต็มเหลือ 1-2 ตัวอักษรสำหรับวงกลมอวาตาร์
//
// รวมจุดเดียวจากที่เดิมมี initialsOf() เหมือนกันเป๊ะอยู่ 3 ที่:
// ProfilePage.tsx, UserMenu.tsx, BookDetailPage.tsx

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
