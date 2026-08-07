// Types follow the Category / Book / BookChangeLog classes in the analysis class
// diagram of the book-management subsystem; the diagram is authoritative on names,
// attributes and enum members.
//
// The Go model embeds an InventoryItem inside Book (composition). Here the two stay in
// separate modules joined by bookId: InventoryItem already lives in
// ../inventory/inventory.ts and is read by the reorder alerts screen, the dashboard and
// PurchasingContext, so embedding it would create a second copy of the same figure.
//
// This is the back-office catalogue. The storefront's src/data/books.ts is a separate,
// slug-keyed dataset and is deliberately left untouched.

import type { BadgeTone } from '../components/StatusBadge'

export type BookStatus = 'ACTIVE' | 'INACTIVE'

export interface Category {
  categoryId: number
  name: string
  description: string
}

export interface BookChangeLog {
  logId: number
  /** A key of BOOK_FIELD_LABELS. */
  changedField: string
  oldValue: string
  newValue: string
  changedDate: string
  /** Sales staff record every change log; stored as a name because staff have no id. */
  changedBy: string
}

export interface Book {
  bookId: number
  isbn: string
  title: string
  author: string
  publisher: string
  /** Cover price in baht. The diagram types this decimal. */
  price: number
  description: string
  status: BookStatus
  /** Category "1" o-- "*" Book : contains */
  categoryId: number
  /** Book "1" *-- "*" BookChangeLog : history */
  changeLogs: BookChangeLog[]
}

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดการขาย',
}

export const BOOK_STATUS_TONES: Record<BookStatus, BadgeTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
}

export type BookField =
  | 'isbn'
  | 'title'
  | 'author'
  | 'publisher'
  | 'price'
  | 'description'
  | 'categoryId'
  | 'status'

export const BOOK_FIELD_LABELS: Record<BookField, string> = {
  isbn: 'ISBN',
  title: 'ชื่อหนังสือ',
  author: 'ผู้แต่ง',
  publisher: 'สำนักพิมพ์',
  price: 'ราคาปก',
  description: 'รายละเอียด',
  categoryId: 'หมวดหมู่',
  status: 'สถานะ',
}

/** The fields the form refuses to leave blank — "กรุณากรอกข้อมูลให้ครบ". */
export const REQUIRED_BOOK_FIELDS: BookField[] = [
  'isbn',
  'title',
  'author',
  'publisher',
  'price',
  'categoryId',
]

/** Book.search() — keyword over title / author / isbn, case-insensitive. */
export function searchBook(book: Book, keyword: string) {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true
  return (
    book.title.toLowerCase().includes(needle) ||
    book.author.toLowerCase().includes(needle) ||
    book.isbn.toLowerCase().includes(needle)
  )
}

export function formatPriceBaht(price: number) {
  return price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const SEED_CATEGORIES: Category[] = [
  { categoryId: 1, name: 'วรรณกรรมและนวนิยาย', description: 'นิยาย เรื่องสั้น และวรรณกรรมแปล' },
  { categoryId: 2, name: 'พัฒนาตนเอง', description: 'จิตวิทยา นิสัย และการพัฒนาศักยภาพ' },
  { categoryId: 3, name: 'วิทยาศาสตร์และไซไฟ', description: 'วิทยาศาสตร์ทั่วไปและนิยายวิทยาศาสตร์' },
  { categoryId: 4, name: 'สารคดีและชีวประวัติ', description: 'เรื่องจริง บันทึก และชีวประวัติ' },
  { categoryId: 5, name: 'ตำราและวิชาการ', description: 'ตำราเรียนและหนังสือวิชาการ' },
  { categoryId: 6, name: 'วรรณกรรมเยาวชนและนิทาน', description: 'หนังสือเด็กและนิทานก่อนนอน' },
]

function book(
  bookId: number,
  isbn: string,
  title: string,
  author: string,
  publisher: string,
  price: number,
  categoryId: number,
  description: string,
  status: BookStatus = 'ACTIVE',
  changeLogs: BookChangeLog[] = [],
): Book {
  return { bookId, isbn, title, author, publisher, price, description, status, categoryId, changeLogs }
}

// bookId 101-123 lines up with SEED_INVENTORY and with the SupplierBook rows inside
// SEED_SUPPLIERS. isbn / title / author / publisher are copied from there character for
// character so the two datasets never contradict each other.
//
// price is the cover price, derived as round(supplyPrice / (1 - the supplier's cover
// discount)) using the discount quoted in that supplier's tradeTerms — e.g. BK101 comes
// from a supplier at 35%, so 285 / 0.65 = 438. That keeps price above supplyPrice
// everywhere, which the purchasing screens assume.
export const SEED_BOOKS: Book[] = [
  book(101, '978-616-0001-01', 'Atomic Habits', 'James Clear', 'สำนักพิมพ์ก้าวหน้า', 438, 2,
    'คู่มือสร้างนิสัยเล็ก ๆ ที่ให้ผลลัพธ์ยิ่งใหญ่ ด้วยระบบที่ทำซ้ำได้จริง', 'ACTIVE',
    // One seeded row so the change-history tab has something to show on first load.
    [{
      logId: 1,
      changedField: 'price',
      oldValue: '459',
      newValue: '438',
      changedDate: '2026-07-02T04:15:00.000Z',
      changedBy: 'ณัฐวุฒิ แสงจันทร์',
    }]),
  book(102, '978-616-0001-02', 'The Alchemist', 'Paulo Coelho', 'สำนักพิมพ์ก้าวหน้า', 369, 1,
    'การเดินทางของเด็กเลี้ยงแกะผู้ออกตามหาขุมทรัพย์และความหมายของชีวิต'),
  book(103, '978-616-0001-03', 'Circe', 'Madeline Miller', 'สำนักพิมพ์ก้าวหน้า', 477, 1,
    'เล่าตำนานกรีกผ่านมุมมองของเซอร์ซี แม่มดผู้ถูกเนรเทศ'),
  book(104, '978-616-0002-01', 'Project Hail Mary', 'Andy Weir', 'สำนักพิมพ์ปัญญาชน', 507, 3,
    'นักวิทยาศาสตร์ตื่นขึ้นกลางอวกาศพร้อมภารกิจกอบกู้โลกที่จำอะไรไม่ได้'),
  book(105, '978-616-0002-02', 'Klara and the Sun', 'Kazuo Ishiguro', 'สำนักพิมพ์ปัญญาชน', 457, 3,
    'หุ่นยนต์เพื่อนเล่นเฝ้ามองความรักและความสูญเสียของมนุษย์'),
  book(106, '978-616-0003-01', 'Dune', 'Frank Herbert', 'บุ๊คเน็ต', 700, 3,
    'มหากาพย์ไซไฟบนดาวทะเลทรายอาร์ราคิส ศูนย์กลางอำนาจของจักรวาล'),
  book(107, '978-616-0003-02', 'A Little Life', 'Hanya Yanagihara', 'บุ๊คเน็ต', 800, 1,
    'เรื่องราวมิตรภาพสี่คนในนิวยอร์กที่ทอดยาวตลอดชีวิต'),
  book(108, '978-616-0003-03', 'Normal People', 'Sally Rooney', 'บุ๊คเน็ต', 442, 1,
    'ความสัมพันธ์ที่ผูกพันและผลักไสกันของคนสองคนตั้งแต่มัธยมถึงมหาวิทยาลัย'),
  book(109, '978-616-0003-04', 'The Midnight Library', 'Matt Haig', 'บุ๊คเน็ต', 483, 1,
    'ห้องสมุดระหว่างความเป็นความตายที่ให้เลือกใช้ชีวิตในเวอร์ชันอื่น'),
  book(110, '978-616-0004-01', 'The Song of Achilles', 'Madeline Miller', 'แสงตะวัน', 404, 1,
    'สงครามกรุงทรอยผ่านสายตาของพาโทรคลัส สหายของอคิลลีส'),
  book(111, '978-616-0004-02', 'Crying in H Mart', 'Michelle Zauner', 'แสงตะวัน', 434, 4,
    'บันทึกความทรงจำเรื่องแม่ อาหารเกาหลี และการยอมรับการจากลา'),
  book(112, '978-616-0005-01', 'Lessons in Chemistry', 'Bonnie Garmus', 'Asia Books', 621, 1,
    'นักเคมีหญิงยุค 60 ที่กลายเป็นพิธีกรรายการทำอาหารโดยไม่ยอมทิ้งวิทยาศาสตร์'),
  book(113, '978-616-0005-02', 'The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid', 'Asia Books', 581, 1,
    'ดาราฮอลลีวูดในตำนานเปิดเผยความจริงเบื้องหลังการแต่งงานทั้งเจ็ดครั้ง'),
  book(114, '978-616-0005-03', 'Where the Crawdads Sing', 'Delia Owens', 'Asia Books', 548, 1,
    'เด็กหญิงผู้เติบโตลำพังในบึงนอร์ทแคโรไลนา กับคดีฆาตกรรมที่สั่นสะเทือนเมือง'),
  book(115, '978-616-0006-01', 'บันทึกใบไม้ผลิ', 'ชลธิชา แก้วประเสริฐ', 'ใบไม้', 250, 2,
    'บันทึกการกลับบ้านเกิดและการเริ่มต้นใหม่ในวัยสามสิบ'),
  book(116, '978-616-0007-01', 'เงาในกระจก', 'ปกรณ์ ทองใบ', 'สยามเปเปอร์แบ็ค', 291, 1,
    'นวนิยายสืบสวนที่ความจริงสะท้อนกลับมาหาผู้สืบสวนเอง'),
  book(117, '978-616-0007-02', 'ทางกลับบ้าน', 'สุนิสา วงษ์คำ', 'สยามเปเปอร์แบ็ค', 313, 1,
    'เรื่องราวครอบครัวชนบทกับการเดินทางกลับไปคืนดีกับอดีต'),
  book(118, '978-616-0008-01', 'ดาวเคราะห์สีคราม', 'ภูริช สมบูรณ์', 'ดวงดาว', 314, 3,
    'นิยายวิทยาศาสตร์ไทยว่าด้วยการตั้งอาณานิคมบนดาวดวงใหม่',
    // Its supplier closed down, so the title is no longer on sale.
    'INACTIVE'),
  book(119, '978-616-0009-01', 'สถิติสำหรับวิศวกร', 'ดร.วิชัย พงษ์ศิริ', 'เลิร์นนิ่งฮับ', 656, 5,
    'ตำราสถิติประยุกต์พร้อมโจทย์ตัวอย่างสำหรับงานวิศวกรรม'),
  book(120, '978-616-0009-02', 'การวิเคราะห์และออกแบบระบบ', 'ดร.อรพิน ชูเกียรติ', 'เลิร์นนิ่งฮับ', 703, 5,
    'ตำราการวิเคราะห์และออกแบบระบบสารสนเทศ ครอบคลุม UML และกรณีศึกษา'),
  book(121, '978-616-0011-01', 'ห้องสมุดเที่ยงคืน', 'Matt Haig', 'เพจเทิร์นเนอร์', 455, 1,
    'ฉบับแปลไทยของ The Midnight Library'),
  book(122, '978-616-0012-01', 'นิทานก่อนนอนของหนูดี', 'มณีรัตน์ บุญมี', 'ต้นกล้า', 204, 6,
    'รวมนิทานสั้นก่อนนอนพร้อมภาพประกอบสี่สีสำหรับเด็กปฐมวัย'),
  book(123, '978-616-0012-02', 'ผจญภัยในป่าใหญ่', 'กานต์ พิมพ์ทอง', 'ต้นกล้า', 225, 6,
    'การผจญภัยของเด็ก ๆ กับผองเพื่อนสัตว์ป่า สอนเรื่องการอนุรักษ์'),
]
