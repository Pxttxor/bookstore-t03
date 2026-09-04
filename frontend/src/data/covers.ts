// covers.ts — ภาพปกหนังสือ แมปด้วย `book_id` ของฐานข้อมูล
//
// ตาราง `book` ไม่มีคอลัมน์รูปปก (ดู class diagram ของวุฒิภัทร) ปกจึงยังเป็นไฟล์
// ในโปรเจกต์ ไม่ใช่ข้อมูล · Vite แปลง import เหล่านี้เป็น URL ที่มี hash ให้ตอน build
//
// มีปกจริง 14 เล่ม (101–114) ส่วนเล่มไทย 115–123 ยังไม่มีไฟล์ปก —
// `<BookCover>` วาดปกสำรองให้เอง จึงไม่ต้องมีรูป placeholder ในโปรเจกต์
//
// **แมปด้วยรหัสตัวเลข ไม่ใช่ slug** เพราะหน้าร้านอ่านแคตตาล็อกจาก API แล้ว
// สะพาน slug↔bookId (`STOREFRONT_BOOK_IDS`) ที่เคยต้องดูแลด้วยมือถูกลบไปพร้อมกัน

import aLittleLife from '../assets/covers/a-little-life-641378.png'
import atomicHabits from '../assets/covers/atomic-habits-591d57.png'
import circe from '../assets/covers/circe-3ea9d1.png'
import cryingHMart from '../assets/covers/crying-in-h-mart-591d57.png'
import crawdads from '../assets/covers/where-the-crawdads-sing-641378.png'
import dune from '../assets/covers/dune-41c1d5.png'
import evelynHugo from '../assets/covers/evelyn-hugo-591d57.png'
import klara from '../assets/covers/klara-and-the-sun-641378.png'
import lessonsChemistry from '../assets/covers/lessons-in-chemistry-591d57.png'
import midnightLibrary from '../assets/covers/the-midnight-library-1b6823.png'
import normalPeople from '../assets/covers/normal-people-641378.png'
import projectHailMary from '../assets/covers/project-hail-mary-60c35e.png'
import songOfAchilles from '../assets/covers/the-song-of-achilles-591d57.png'
import theAlchemist from '../assets/covers/the-alchemist-761bdf.png'

const BOOK_COVERS: Record<number, string> = {
  101: atomicHabits,
  102: theAlchemist,
  103: circe,
  104: projectHailMary,
  105: klara,
  106: dune,
  107: aLittleLife,
  108: normalPeople,
  109: midnightLibrary,
  110: songOfAchilles,
  111: cryingHMart,
  112: lessonsChemistry,
  113: evelynHugo,
  114: crawdads,
}

/** ไฟล์ปกของหนังสือเล่มหนึ่ง — คืน undefined ถ้ายังไม่มีปก (ผู้เรียกวาดปกสำรองแทน) */
export function coverFor(bookId: number): string | undefined {
  return BOOK_COVERS[bookId]
}
